package com.trustvault.service;

import com.trustvault.dto.RenewalRequestDtos.*;
import com.trustvault.exception.BadRequestException;
import com.trustvault.exception.ForbiddenException;
import com.trustvault.exception.ResourceNotFoundException;
import com.trustvault.model.*;
import com.trustvault.repository.DocumentPermissionRepository;
import com.trustvault.repository.RenewalRequestRepository;
import com.trustvault.security.DocumentAuthorizationService;
import com.trustvault.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class RenewalRequestService {

    private final RenewalRequestRepository renewalRequestRepository;
    private final DocumentPermissionRepository permissionRepository;
    private final com.trustvault.repository.DocumentRepository documentRepository;
    private final com.trustvault.repository.ProjectMemberRepository projectMemberRepository;
    private final DocumentAuthorizationService authorizationService;
    private final AuditService auditService;
    private final int maxExtensionDays;

    public RenewalRequestService(
            RenewalRequestRepository renewalRequestRepository,
            DocumentPermissionRepository permissionRepository,
            com.trustvault.repository.DocumentRepository documentRepository,
            com.trustvault.repository.ProjectMemberRepository projectMemberRepository,
            DocumentAuthorizationService authorizationService,
            AuditService auditService,
            @org.springframework.beans.factory.annotation.Value("${trustvault.renewal.max-extension-days:365}") int maxExtensionDays
    ) {
        this.renewalRequestRepository = renewalRequestRepository;
        this.permissionRepository = permissionRepository;
        this.documentRepository = documentRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.authorizationService = authorizationService;
        this.auditService = auditService;
        this.maxExtensionDays = maxExtensionDays;
    }

    @Transactional
    public RenewalRequestDto createRenewalRequest(CreateRenewalRequest request, User requester, HttpServletRequest httpRequest) {
        if (request.requestedExtensionDays() <= 0 || request.requestedExtensionDays() > maxExtensionDays) {
            throw new BadRequestException("Requested extension days must be between 1 and " + maxExtensionDays);
        }

        DocumentPermission permission;
        if (request.permissionId() != null) {
            permission = permissionRepository.findById(request.permissionId())
                    .orElseThrow(() -> new ResourceNotFoundException("Permission not found with ID: " + request.permissionId()));
        } else if (request.documentId() != null) {
            Document doc = documentRepository.findById(request.documentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Document not found with ID: " + request.documentId()));
            permission = permissionRepository.findByDocumentAndUser(doc, requester)
                    .orElseThrow(() -> new BadRequestException("No existing permission found to renew for this document. Please submit a new access request."));
        } else {
            throw new BadRequestException("Either permission ID or document ID is required to request a renewal");
        }

        if (request.projectId() != null && permission.getDocument().getProject() != null) {
            if (!permission.getDocument().getProject().getId().equals(request.projectId())) {
                throw new BadRequestException("The selected document does not belong to the selected project");
            }
        }

        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        if (!requester.isActive()) {
            auditService.logEvent(requester, AuditAction.INACTIVE_USER_ACCESS_ATTEMPT, "RENEWAL_REQUEST", null,
                    AuditResult.DENIED, "Renewal request rejected: Account is inactive", clientIp, userAgent);
            throw new ForbiddenException("Your account is deactivated. Contact your administrator.");
        }

        if (!permission.getUser().getId().equals(requester.getId())) {
            throw new ForbiddenException("You can only request renewal for your own permissions");
        }

        if (permission.getDocument().getProject() != null && !requester.isAdmin()) {
            Project project = permission.getDocument().getProject();
            boolean isProjectOwner = project.getOwner() != null && project.getOwner().getId().equals(requester.getId());
            if (!isProjectOwner) {
                Optional<ProjectMember> memberOpt = projectMemberRepository.findByProjectAndUser(project, requester);
                if (memberOpt.isPresent() && memberOpt.get().isSuspended()) {
                    auditService.logEvent(requester, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "PROJECT", project.getId().toString(),
                            AuditResult.DENIED, "Renewal request denied: Your project membership has been suspended for project " + project.getName(), clientIp, userAgent);
                    throw new ForbiddenException("Access denied: Your project membership has been suspended");
                }
            }
        }

        if (permission.getStatus() == PermissionStatus.REVOKED) {
            throw new BadRequestException("Cannot renew a revoked permission. Please submit a new access request.");
        }

        if (renewalRequestRepository.existsByDocumentPermissionAndStatus(permission, RequestStatus.PENDING)) {
            throw new BadRequestException("A pending renewal request already exists for this document permission");
        }

        RenewalRequest renewalRequest = new RenewalRequest(
                permission,
                requester,
                request.reason().trim(),
                request.requestedExtensionDays()
        );

        RenewalRequest saved = renewalRequestRepository.save(renewalRequest);

        auditService.logEvent(requester, AuditAction.RENEWAL_REQUEST_CREATED, "RENEWAL_REQUEST", saved.getId().toString(),
                AuditResult.SUCCESS, "Submitted renewal request for " + permission.getDocument().getTitle() + " (" + request.requestedExtensionDays() + " days)",
                clientIp, userAgent);

        return mapToDto(saved);
    }

    @Transactional(readOnly = true)
    public List<RenewalRequestDto> getPendingRenewalsForOwner(User owner) {
        return renewalRequestRepository.findByDocumentOwner(owner).stream()
                .map(this::mapToDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RenewalRequestDto> getMyRenewalRequests(User requester) {
        return renewalRequestRepository.findByRequesterOrderByCreatedAtDesc(requester).stream()
                .map(this::mapToDto)
                .toList();
    }

    @Transactional
    public RenewalRequestDto reviewRenewalRequest(
            UUID renewalId,
            ReviewRenewalRequest review,
            User reviewer,
            HttpServletRequest httpRequest
    ) {
        RenewalRequest renewal = renewalRequestRepository.findById(renewalId)
                .orElseThrow(() -> new ResourceNotFoundException("Renewal request not found"));

        Document document = renewal.getDocumentPermission().getDocument();
        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        if (!authorizationService.isDocumentOwner(reviewer, document) && reviewer.getRole() != Role.ROLE_ADMIN) {
            auditService.logEvent(reviewer, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "RENEWAL_REQUEST", renewalId.toString(),
                    AuditResult.DENIED, "Unauthorized user attempted to review renewal request", clientIp, userAgent);
            throw new ForbiddenException("Only the document owner or an administrator can approve or reject renewal requests");
        }

        // Defense-in-depth: Self-approval is strictly forbidden
        if (renewal.getRequester().getId().equals(reviewer.getId())) {
            auditService.logEvent(reviewer, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "RENEWAL_REQUEST", renewalId.toString(),
                    AuditResult.DENIED, "Self-approval is forbidden", clientIp, userAgent);
            throw new ForbiddenException("Self-approval is strictly forbidden");
        }

        if (renewal.getStatus() != RequestStatus.PENDING) {
            throw new BadRequestException("This renewal request has already been reviewed");
        }

        renewal.setReviewedBy(reviewer);
        renewal.setReviewedAt(Instant.now());
        renewal.setReviewNote(review.reviewNote());

        if (review.approved()) {
            if (review.extensionDays() != null && (review.extensionDays() <= 0 || review.extensionDays() > maxExtensionDays)) {
                throw new BadRequestException("Extension days must be between 1 and " + maxExtensionDays);
            }

            renewal.setStatus(RequestStatus.APPROVED);

            int days = (review.extensionDays() != null && review.extensionDays() > 0) ?
                    review.extensionDays() : renewal.getRequestedExtensionDays();

            DocumentPermission perm = renewal.getDocumentPermission();

            // Calculate new expiry: from current expiry if not yet expired, or from now if already expired
            Instant baseTime = (perm.getExpiresAt() != null && perm.getExpiresAt().isAfter(Instant.now())) ?
                    perm.getExpiresAt() : Instant.now();

            Instant newExpiry = baseTime.plusSeconds((long) days * 24 * 3600);

            perm.setExpiresAt(newExpiry);
            perm.setStatus(PermissionStatus.ACTIVE); // Reactivate if it was expired
            permissionRepository.save(perm);

            auditService.logEvent(reviewer, AuditAction.RENEWAL_REQUEST_APPROVED, "RENEWAL_REQUEST", renewalId.toString(),
                    AuditResult.SUCCESS, "Approved renewal for " + perm.getUser().getEmail() + " on " + document.getTitle() + " until " + newExpiry,
                    clientIp, userAgent);
        } else {
            renewal.setStatus(RequestStatus.REJECTED);
            // Rejection leaves existing expiry unchanged!
            auditService.logEvent(reviewer, AuditAction.RENEWAL_REQUEST_REJECTED, "RENEWAL_REQUEST", renewalId.toString(),
                    AuditResult.SUCCESS, "Rejected renewal for " + renewal.getDocumentPermission().getUser().getEmail() + " on " + document.getTitle(),
                    clientIp, userAgent);
        }

        RenewalRequest saved = renewalRequestRepository.save(renewal);
        return mapToDto(saved);
    }

    private RenewalRequestDto mapToDto(RenewalRequest r) {
        UUID projId = r.getDocumentPermission().getDocument().getProject() != null ? r.getDocumentPermission().getDocument().getProject().getId() : null;
        String projName = r.getDocumentPermission().getDocument().getProject() != null ? r.getDocumentPermission().getDocument().getProject().getName() : null;

        return new RenewalRequestDto(
                r.getId(),
                r.getDocumentPermission().getId(),
                r.getDocumentPermission().getDocument().getId(),
                r.getDocumentPermission().getDocument().getTitle(),
                r.getRequester().getId(),
                r.getRequester().getEmail(),
                r.getRequester().getFullName(),
                r.getDocumentPermission().getExpiresAt(),
                r.getReason(),
                r.getRequestedExtensionDays(),
                r.getStatus(),
                r.getCreatedAt(),
                r.getReviewedBy() != null ? r.getReviewedBy().getId() : null,
                r.getReviewedBy() != null ? r.getReviewedBy().getFullName() : null,
                r.getReviewedAt(),
                r.getReviewNote(),
                projId,
                projName
        );
    }
}
