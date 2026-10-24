package com.trustvault.service;

import com.trustvault.dto.AccessRequestDtos.*;
import com.trustvault.exception.BadRequestException;
import com.trustvault.exception.ForbiddenException;
import com.trustvault.exception.ResourceNotFoundException;
import com.trustvault.model.*;
import com.trustvault.repository.AccessRequestRepository;
import com.trustvault.repository.DocumentPermissionRepository;
import com.trustvault.repository.DocumentRepository;
import com.trustvault.repository.ProjectMemberRepository;
import com.trustvault.repository.ProjectRepository;
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
public class AccessRequestService {

    private final AccessRequestRepository accessRequestRepository;
    private final DocumentRepository documentRepository;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final DocumentPermissionRepository permissionRepository;
    private final DocumentAuthorizationService authorizationService;
    private final AuditService auditService;

    public AccessRequestService(
            AccessRequestRepository accessRequestRepository,
            DocumentRepository documentRepository,
            ProjectRepository projectRepository,
            ProjectMemberRepository projectMemberRepository,
            DocumentPermissionRepository permissionRepository,
            DocumentAuthorizationService authorizationService,
            AuditService auditService
    ) {
        this.accessRequestRepository = accessRequestRepository;
        this.documentRepository = documentRepository;
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.permissionRepository = permissionRepository;
        this.authorizationService = authorizationService;
        this.auditService = auditService;
    }

    @Transactional
    public AccessRequestDto createRequest(CreateAccessRequest request, User requester, HttpServletRequest httpRequest) {
        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        if (requester == null || !requester.isActive()) {
            auditService.logEvent(requester, AuditAction.INACTIVE_USER_ACCESS_ATTEMPT, "ACCESS_REQUEST", null,
                    AuditResult.DENIED, "Access request rejected: Account is inactive", clientIp, userAgent);
            throw new ForbiddenException("Your account is deactivated. Contact your administrator.");
        }

        Document document = null;
        Project project = null;
        String requestedFilename = request.requestedFilename() != null ? request.requestedFilename().trim() : null;
        int durationDays = request.durationDays() != null && request.durationDays() > 0 ? request.durationDays() : 7;

        if (request.documentId() != null) {
            document = documentRepository.findById(request.documentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Document not found"));
            project = document.getProject();
            if (request.projectId() != null && project != null && !project.getId().equals(request.projectId())) {
                throw new BadRequestException("Selected document does not belong to the selected project");
            }

            if (project != null) {
                boolean isProjectOwner = project.getOwner() != null && project.getOwner().getId().equals(requester.getId());
                if (!isProjectOwner && requester.getRole() != Role.ROLE_ADMIN) {
                    Optional<ProjectMember> memberOpt = projectMemberRepository.findByProjectAndUser(project, requester);
                    if (memberOpt.isEmpty()) {
                        auditService.logEvent(requester, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "PROJECT", project.getId().toString(),
                                AuditResult.DENIED, "User attempted to reference project without authorization", clientIp, userAgent);
                        throw new ForbiddenException("Access denied: You are not authorized to reference this project");
                    }
                    ProjectMember member = memberOpt.get();
                    if (member.isSuspended()) {
                        auditService.logEvent(requester, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "PROJECT", project.getId().toString(),
                                AuditResult.DENIED, "Access request denied: Your project membership has been suspended for project " + project.getName(), clientIp, userAgent);
                        throw new ForbiddenException("Access denied: Your project membership has been suspended");
                    }
                }
            }

            if (requestedFilename == null || requestedFilename.isBlank()) {
                requestedFilename = document.getOriginalFilename();
            }

            if (document.getOwner().getId().equals(requester.getId())) {
                throw new BadRequestException("You are already the owner of this document");
            }

            // Prevent duplicate pending requests for this exact document
            if (accessRequestRepository.existsByDocumentAndRequesterAndStatus(document, requester, RequestStatus.PENDING)) {
                throw new BadRequestException("You already have a pending access request for this document");
            }
        } else {
            // Manual typed filename path
            if (request.projectId() == null) {
                throw new BadRequestException("Project must be specified when requesting access by document name");
            }
            if (requestedFilename == null || requestedFilename.isBlank()) {
                throw new BadRequestException("Document selection or a valid document name is required");
            }

            project = projectRepository.findById(request.projectId())
                    .orElseThrow(() -> new ResourceNotFoundException("Project not found with ID: " + request.projectId()));

            // User must be authorized to reference this project (owner, member, or admin)
            boolean isProjectOwner = project.getOwner() != null && project.getOwner().getId().equals(requester.getId());
            if (!isProjectOwner && requester.getRole() != Role.ROLE_ADMIN) {
                Optional<ProjectMember> memberOpt = projectMemberRepository.findByProjectAndUser(project, requester);
                if (memberOpt.isEmpty()) {
                    auditService.logEvent(requester, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "PROJECT", project.getId().toString(),
                            AuditResult.DENIED, "User attempted to reference project without authorization", clientIp, userAgent);
                    throw new ForbiddenException("Access denied: You are not authorized to reference this project");
                }
                ProjectMember member = memberOpt.get();
                if (member.isSuspended()) {
                    auditService.logEvent(requester, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "PROJECT", project.getId().toString(),
                            AuditResult.DENIED, "Access request denied: Your project membership has been suspended for project " + project.getName(), clientIp, userAgent);
                    throw new ForbiddenException("Access denied: Your project membership has been suspended");
                }
            }

            // Attempt safe resolution to an existing document in this project
            List<Document> projectDocs = documentRepository.findByProject(project);
            String targetName = requestedFilename.toLowerCase();
            Optional<Document> matchOpt = projectDocs.stream()
                    .filter(d -> (d.getOriginalFilename() != null && d.getOriginalFilename().equalsIgnoreCase(targetName))
                            || (d.getTitle() != null && d.getTitle().equalsIgnoreCase(targetName)))
                    .findFirst();

            if (matchOpt.isPresent()) {
                document = matchOpt.get();
                if (document.getOwner().getId().equals(requester.getId())) {
                    throw new BadRequestException("You are already the owner of this document");
                }
                if (accessRequestRepository.existsByDocumentAndRequesterAndStatus(document, requester, RequestStatus.PENDING)) {
                    throw new BadRequestException("You already have a pending access request for this document");
                }
            } else {
                // If not found in project: do NOT create fake document. Store requestedFilename and project for manager review!
                if (accessRequestRepository.existsByProjectAndRequestedFilenameIgnoreCaseAndRequesterAndStatus(project, requestedFilename, requester, RequestStatus.PENDING)) {
                    throw new BadRequestException("You already have a pending access request for this document name in this project");
                }
            }
        }

        AccessRequest accessRequest = new AccessRequest(
                document,
                project,
                requestedFilename,
                requester,
                request.requestedPermission(),
                request.reason().trim(),
                durationDays
        );

        AccessRequest saved = accessRequestRepository.save(accessRequest);

        String docLabel = document != null ? document.getTitle() : ("[" + requestedFilename + " in " + project.getName() + "]");
        auditService.logEvent(requester, AuditAction.ACCESS_REQUEST_CREATED, "ACCESS_REQUEST", saved.getId().toString(),
                AuditResult.SUCCESS, "Created access request for " + docLabel + " (" + request.requestedPermission() + ")",
                clientIp, userAgent);

        return mapToDto(saved);
    }

    @Transactional(readOnly = true)
    public List<AccessRequestDto> getRequestsForOwner(User owner) {
        if (owner != null && owner.getRole() == Role.ROLE_ADMIN) {
            return accessRequestRepository.findAll(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt")).stream()
                    .map(this::mapToDto)
                    .toList();
        }
        return accessRequestRepository.findByDocumentOwner(owner).stream()
                .map(this::mapToDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AccessRequestDto> getMyRequests(User requester) {
        return accessRequestRepository.findByRequesterOrderByCreatedAtDesc(requester).stream()
                .map(this::mapToDto)
                .toList();
    }

    @Transactional
    public AccessRequestDto reviewRequest(
            UUID requestId,
            ReviewAccessRequest review,
            User reviewer,
            HttpServletRequest httpRequest
    ) {
        AccessRequest request = accessRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Access request not found"));

        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        // Security check: Only document owner, project owner, or administrator can approve/reject
        boolean isAuthorizedReviewer = false;
        if (reviewer.getRole() == Role.ROLE_ADMIN) {
            isAuthorizedReviewer = true;
        } else if (request.getDocument() != null && authorizationService.isDocumentOwner(reviewer, request.getDocument())) {
            isAuthorizedReviewer = true;
        } else if (request.getProject() != null && request.getProject().getOwner() != null && request.getProject().getOwner().getId().equals(reviewer.getId())) {
            isAuthorizedReviewer = true;
        }

        if (!isAuthorizedReviewer) {
            auditService.logEvent(reviewer, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "ACCESS_REQUEST", requestId.toString(),
                    AuditResult.DENIED, "Unauthorized user attempted to review access request", clientIp, userAgent);
            throw new ForbiddenException("Only the document owner, project manager, or an administrator can approve or reject access requests");
        }

        // Defense-in-depth: Self-approval is strictly forbidden
        if (request.getRequester().getId().equals(reviewer.getId())) {
            auditService.logEvent(reviewer, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "ACCESS_REQUEST", requestId.toString(),
                    AuditResult.DENIED, "Self-approval is forbidden", clientIp, userAgent);
            throw new ForbiddenException("Self-approval is strictly forbidden");
        }

        if (request.getStatus() != RequestStatus.PENDING) {
            throw new BadRequestException("This request has already been reviewed");
        }

        request.setReviewedBy(reviewer);
        request.setReviewedAt(Instant.now());
        request.setReviewNote(review.reviewNote());

        if (review.approved()) {
            Document document = request.getDocument();

            // If document was not yet resolved, resolve from review.resolvedDocumentId() or project matching
            if (document == null && review.resolvedDocumentId() != null) {
                document = documentRepository.findById(review.resolvedDocumentId()).orElse(null);
            }
            if (document == null && request.getProject() != null && request.getRequestedFilename() != null) {
                String target = request.getRequestedFilename().toLowerCase();
                document = documentRepository.findByProject(request.getProject()).stream()
                        .filter(d -> (d.getOriginalFilename() != null && d.getOriginalFilename().equalsIgnoreCase(target))
                                || (d.getTitle() != null && d.getTitle().equalsIgnoreCase(target)))
                        .findFirst().orElse(null);
            }

            if (document == null) {
                throw new BadRequestException("Cannot approve request: The requested document could not be resolved to an existing document in the project. Verification failed.");
            }

            // Ensure document belongs to requested project if project was specified
            if (request.getProject() != null && document.getProject() != null && !document.getProject().getId().equals(request.getProject().getId())) {
                throw new BadRequestException("Resolved document belongs to a different project than requested");
            }

            request.setDocument(document);
            request.setStatus(RequestStatus.APPROVED);

            // Approved duration: Manager approved duration overrides requested duration
            int durationDays = (review.approvedDurationDays() != null && review.approvedDurationDays() > 0)
                    ? review.approvedDurationDays() : request.getDurationDays();
            Instant calculatedExpiry = review.expiresAt() != null ? review.expiresAt() : Instant.now().plusSeconds((long) durationDays * 86400L);

            // Create explicit permission grant in the same transaction
            PermissionLevel effectiveLevel = review.grantedPermission() != null ? review.grantedPermission() : request.getRequestedPermission();
            Optional<DocumentPermission> existingOpt = permissionRepository.findByDocumentAndUser(document, request.getRequester());
            DocumentPermission permission;
            if (existingOpt.isPresent()) {
                permission = existingOpt.get();
                permission.setPermissionLevel(effectiveLevel);
                permission.setExpiresAt(calculatedExpiry);
                permission.setStatus(PermissionStatus.ACTIVE);
                permission.setGrantedBy(reviewer);
                permission.setGrantedAt(Instant.now());
            } else {
                permission = new DocumentPermission(
                        document,
                        request.getRequester(),
                        effectiveLevel,
                        reviewer,
                        calculatedExpiry
                );
            }
            permissionRepository.save(permission);

            auditService.logEvent(reviewer, AuditAction.ACCESS_REQUEST_APPROVED, "ACCESS_REQUEST", requestId.toString(),
                    AuditResult.SUCCESS, "Approved access request for " + request.getRequester().getEmail() + " on " + document.getTitle(),
                    clientIp, userAgent);
        } else {
            request.setStatus(RequestStatus.REJECTED);
            String docLabel = request.getDocument() != null ? request.getDocument().getTitle() : request.getRequestedFilename();
            auditService.logEvent(reviewer, AuditAction.ACCESS_REQUEST_REJECTED, "ACCESS_REQUEST", requestId.toString(),
                    AuditResult.SUCCESS, "Rejected access request for " + request.getRequester().getEmail() + " on " + docLabel,
                    clientIp, userAgent);
        }

        AccessRequest saved = accessRequestRepository.save(request);
        return mapToDto(saved);
    }

    private AccessRequestDto mapToDto(AccessRequest r) {
        return new AccessRequestDto(
                r.getId(),
                r.getDocument() != null ? r.getDocument().getId() : null,
                r.getDocument() != null ? r.getDocument().getTitle() : r.getRequestedFilename(),
                r.getProject() != null ? r.getProject().getId() : (r.getDocument() != null && r.getDocument().getProject() != null ? r.getDocument().getProject().getId() : null),
                r.getProject() != null ? r.getProject().getName() : (r.getDocument() != null && r.getDocument().getProject() != null ? r.getDocument().getProject().getName() : null),
                r.getRequestedFilename(),
                r.getDurationDays(),
                r.getRequester().getId(),
                r.getRequester().getEmail(),
                r.getRequester().getFullName(),
                r.getRequestedPermission(),
                r.getReason(),
                r.getStatus(),
                r.getCreatedAt(),
                r.getReviewedBy() != null ? r.getReviewedBy().getId() : null,
                r.getReviewedBy() != null ? r.getReviewedBy().getFullName() : null,
                r.getReviewedAt(),
                r.getReviewNote()
        );
    }
}
