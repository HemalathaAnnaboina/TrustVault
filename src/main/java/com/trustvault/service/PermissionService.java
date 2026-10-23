package com.trustvault.service;

import com.trustvault.dto.PermissionDtos.*;
import com.trustvault.exception.BadRequestException;
import com.trustvault.exception.ForbiddenException;
import com.trustvault.exception.ResourceNotFoundException;
import com.trustvault.model.*;
import com.trustvault.repository.DocumentPermissionRepository;
import com.trustvault.repository.DocumentRepository;
import com.trustvault.repository.UserRepository;
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
public class PermissionService {

    private final DocumentPermissionRepository permissionRepository;
    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final DocumentAuthorizationService authorizationService;
    private final AuditService auditService;

    public PermissionService(
            DocumentPermissionRepository permissionRepository,
            DocumentRepository documentRepository,
            UserRepository userRepository,
            DocumentAuthorizationService authorizationService,
            AuditService auditService
    ) {
        this.permissionRepository = permissionRepository;
        this.documentRepository = documentRepository;
        this.userRepository = userRepository;
        this.authorizationService = authorizationService;
        this.auditService = auditService;
    }

    @Transactional
    public PermissionDto grantPermission(
            UUID documentId,
            GrantPermissionRequest request,
            User owner,
            HttpServletRequest httpRequest
    ) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found"));

        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        try {
            authorizationService.requireManagementAccess(owner, document);
        } catch (ForbiddenException e) {
            auditService.logEvent(owner, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "DOCUMENT", documentId.toString(),
                    AuditResult.DENIED, "Grant permission denied: " + e.getMessage(), clientIp, userAgent);
            throw e;
        }

        User targetUser = userRepository.findByEmailIgnoreCase(request.userEmail().trim())
                .orElseThrow(() -> new BadRequestException("Target user not found: " + request.userEmail()));

        if (!targetUser.isActive()) {
            throw new BadRequestException("Cannot grant permissions to an inactive user");
        }

        if (targetUser.getId().equals(owner.getId())) {
            throw new BadRequestException("Owner already has full access to this document");
        }

        Instant calculatedExpiresAt;
        if (request.durationDays() != null) {
            if (request.durationDays() < 1 || request.durationDays() > 30) {
                throw new BadRequestException("Permission duration must be between 1 and 30 days");
            }
            calculatedExpiresAt = Instant.now().plusSeconds((long) request.durationDays() * 86400L);
        } else if (request.expiresAt() != null) {
            if (request.expiresAt().isBefore(Instant.now())) {
                throw new BadRequestException("Expiry timestamp must be in the future");
            }
            if (request.expiresAt().isAfter(Instant.now().plusSeconds(30L * 86400L + 120L))) {
                throw new BadRequestException("Permission duration cannot exceed 30 days");
            }
            calculatedExpiresAt = request.expiresAt();
        } else {
            // Default 30 days
            calculatedExpiresAt = Instant.now().plusSeconds(30L * 86400L);
        }

        Optional<DocumentPermission> existingOpt = permissionRepository.findByDocumentAndUser(document, targetUser);
        DocumentPermission permission;

        if (existingOpt.isPresent()) {
            permission = existingOpt.get();
            permission.setPermissionLevel(request.permissionLevel());
            permission.setExpiresAt(calculatedExpiresAt);
            permission.setStatus(PermissionStatus.ACTIVE);
            permission.setGrantedBy(owner);
            permission.setGrantedAt(Instant.now());
        } else {
            permission = new DocumentPermission(
                    document,
                    targetUser,
                    request.permissionLevel(),
                    owner,
                    calculatedExpiresAt
            );
        }

        DocumentPermission saved = permissionRepository.save(permission);

        String expiryInfo = calculatedExpiresAt != null ? " (Expires: " + calculatedExpiresAt + ")" : " (No expiry)";
        auditService.logEvent(owner, AuditAction.PERMISSION_GRANT, "PERMISSION", saved.getId().toString(),
                AuditResult.SUCCESS, "Granted " + request.permissionLevel() + " on " + document.getTitle() + " to " + targetUser.getEmail() + expiryInfo,
                clientIp, userAgent);

        return mapToDto(saved);
    }

    @Transactional
    public void revokePermission(UUID permissionId, User owner, HttpServletRequest httpRequest) {
        DocumentPermission permission = permissionRepository.findById(permissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Permission grant not found"));

        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        try {
            authorizationService.requireManagementAccess(owner, permission.getDocument());
        } catch (ForbiddenException e) {
            auditService.logEvent(owner, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "PERMISSION", permissionId.toString(),
                    AuditResult.DENIED, "Revoke permission denied: " + e.getMessage(), clientIp, userAgent);
            throw e;
        }

        permission.setStatus(PermissionStatus.REVOKED);
        permissionRepository.save(permission);

        auditService.logEvent(owner, AuditAction.PERMISSION_REVOKE, "PERMISSION", permission.getId().toString(),
                AuditResult.SUCCESS, "Revoked access from " + permission.getUser().getEmail() + " for " + permission.getDocument().getTitle(),
                clientIp, userAgent);
    }

    @Transactional(readOnly = true)
    public List<PermissionDto> getPermissionsForDocument(UUID documentId, User owner) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found"));

        authorizationService.requireManagementAccess(owner, document);

        return permissionRepository.findByDocumentOrderByGrantedAtDesc(document).stream()
                .map(this::mapToDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PermissionDto> getMyPermissions(User user) {
        return permissionRepository.findByUserOrderByGrantedAtDesc(user).stream()
                .map(this::mapToDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PermissionDto> getOwnerPermissions(User user) {
        if (user.getRole() == Role.ROLE_ADMIN) {
            return permissionRepository.findAll().stream()
                    .sorted((a, b) -> b.getGrantedAt().compareTo(a.getGrantedAt()))
                    .map(this::mapToDto)
                    .toList();
        }
        return permissionRepository.findByDocumentOwnerOrderByGrantedAtDesc(user).stream()
                .map(this::mapToDto)
                .toList();
    }

    @Transactional
    public PermissionDto updatePermission(UUID permissionId, UpdatePermissionRequest request, User owner, HttpServletRequest httpRequest) {
        DocumentPermission permission = permissionRepository.findById(permissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Permission grant not found"));

        authorizationService.requireManagementAccess(owner, permission.getDocument());

        Instant calculatedExpiresAt;
        if (request.durationDays() != null) {
            if (request.durationDays() < 1 || request.durationDays() > 30) {
                throw new BadRequestException("Permission duration must be between 1 and 30 days");
            }
            calculatedExpiresAt = Instant.now().plusSeconds((long) request.durationDays() * 86400L);
        } else if (request.expiresAt() != null) {
            if (request.expiresAt().isBefore(Instant.now())) {
                throw new BadRequestException("Expiry timestamp must be in the future");
            }
            if (request.expiresAt().isAfter(Instant.now().plusSeconds(30L * 86400L + 120L))) {
                throw new BadRequestException("Permission duration cannot exceed 30 days");
            }
            calculatedExpiresAt = request.expiresAt();
        } else {
            calculatedExpiresAt = permission.getExpiresAt() != null ? permission.getExpiresAt() : Instant.now().plusSeconds(30L * 86400L);
        }

        permission.setPermissionLevel(request.permissionLevel());
        permission.setExpiresAt(calculatedExpiresAt);
        permission.setStatus(PermissionStatus.ACTIVE);
        permission.setGrantedBy(owner);
        permission.setGrantedAt(Instant.now());

        DocumentPermission saved = permissionRepository.save(permission);

        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);
        auditService.logEvent(owner, AuditAction.PERMISSION_GRANT, "PERMISSION", saved.getId().toString(),
                AuditResult.SUCCESS, "Updated permission for " + permission.getUser().getEmail() + " on " + permission.getDocument().getTitle() + " to " + request.permissionLevel(),
                clientIp, userAgent);

        return mapToDto(saved);
    }

    @Transactional
    public BulkGrantResponse bulkGrantPermissions(BulkGrantRequest request, User owner, HttpServletRequest httpRequest) {
        java.util.List<BulkGrantResultItem> results = new java.util.ArrayList<>();
        int successful = 0;
        int failed = 0;

        if (request.documentIds() == null || request.documentIds().isEmpty()) {
            throw new BadRequestException("At least one document ID must be specified");
        }
        if (request.assignments() == null || request.assignments().isEmpty()) {
            throw new BadRequestException("At least one employee assignment must be specified");
        }

        for (UUID docId : request.documentIds()) {
            Document document = documentRepository.findById(docId).orElse(null);
            if (document == null) {
                for (BulkAssignment assignment : request.assignments()) {
                    results.add(new BulkGrantResultItem(docId, "Unknown Document", assignment.userEmail(), assignment.permissionLevel(), false, "Document not found", null));
                    failed++;
                }
                continue;
            }

            try {
                authorizationService.requireManagementAccess(owner, document);
            } catch (ForbiddenException e) {
                for (BulkAssignment assignment : request.assignments()) {
                    results.add(new BulkGrantResultItem(docId, document.getTitle(), assignment.userEmail(), assignment.permissionLevel(), false, "Access denied: " + e.getMessage(), null));
                    failed++;
                }
                continue;
            }

            for (BulkAssignment assignment : request.assignments()) {
                try {
                    GrantPermissionRequest singleReq = new GrantPermissionRequest(
                            assignment.userEmail(),
                            assignment.permissionLevel(),
                            assignment.expiresAt(),
                            assignment.durationDays()
                    );
                    PermissionDto dto = grantPermission(docId, singleReq, owner, httpRequest);
                    results.add(new BulkGrantResultItem(docId, document.getTitle(), assignment.userEmail(), assignment.permissionLevel(), true, "Granted " + assignment.permissionLevel(), dto));
                    successful++;
                } catch (Exception e) {
                    results.add(new BulkGrantResultItem(docId, document.getTitle(), assignment.userEmail(), assignment.permissionLevel(), false, e.getMessage(), null));
                    failed++;
                }
            }
        }

        return new BulkGrantResponse(results.size(), successful, failed, results);
    }

    public PermissionDto mapToDto(DocumentPermission p) {
        boolean isExpired = (p.getStatus() == PermissionStatus.EXPIRED) ||
                (p.getExpiresAt() != null && Instant.now().isAfter(p.getExpiresAt()));

        UUID projectId = p.getDocument().getProject() != null ? p.getDocument().getProject().getId() : null;
        String projectName = p.getDocument().getProject() != null ? p.getDocument().getProject().getName() : null;

        return new PermissionDto(
                p.getId(),
                p.getDocument().getId(),
                p.getDocument().getTitle(),
                p.getUser().getId(),
                p.getUser().getEmail(),
                p.getUser().getFullName(),
                p.getPermissionLevel(),
                p.getGrantedBy().getId(),
                p.getGrantedBy().getFullName(),
                p.getGrantedAt(),
                p.getExpiresAt(),
                p.getStatus(),
                isExpired,
                projectId,
                projectName
        );
    }
}
