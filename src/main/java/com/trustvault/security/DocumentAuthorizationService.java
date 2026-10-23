package com.trustvault.security;

import com.trustvault.exception.ForbiddenException;
import com.trustvault.model.*;
import com.trustvault.repository.DocumentPermissionRepository;
import com.trustvault.repository.ProjectMemberRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

@Service
public class DocumentAuthorizationService {

    private static final Logger log = LoggerFactory.getLogger(DocumentAuthorizationService.class);

    private final DocumentPermissionRepository permissionRepository;
    private final ProjectMemberRepository projectMemberRepository;

    public DocumentAuthorizationService(
            DocumentPermissionRepository permissionRepository,
            ProjectMemberRepository projectMemberRepository
    ) {
        this.permissionRepository = permissionRepository;
        this.projectMemberRepository = projectMemberRepository;
    }

    /**
     * Checks if a user has permission to read/preview a document's content.
     */
    @Transactional(readOnly = true)
    public void requireReadAccess(User user, Document document) {
        validateUserActive(user);
        validateTenantIsolation(user, document);
        validateProjectMembership(user, document);

        // Document owner always has access
        if (isDocumentOwner(user, document)) {
            return;
        }

        // Check explicit permission
        Optional<DocumentPermission> permOpt = permissionRepository.findByDocumentAndUser(document, user);
        if (permOpt.isEmpty()) {
            log.warn("User {} has no explicit permission for document {}", user.getEmail(), document.getId());
            throw new ForbiddenException("Access denied: No explicit permission grant found for this document");
        }

        DocumentPermission permission = permOpt.get();

        if (permission.getStatus() == PermissionStatus.REVOKED) {
            log.warn("User {} attempted access with REVOKED permission on document {}", user.getEmail(), document.getId());
            throw new ForbiddenException("Access denied: Permission has been revoked");
        }

        // Dynamic immediate expiry verification
        if (permission.getStatus() == PermissionStatus.EXPIRED ||
                (permission.getExpiresAt() != null && Instant.now().isAfter(permission.getExpiresAt()))) {
            log.warn("User {} attempted access with EXPIRED permission on document {}", user.getEmail(), document.getId());
            throw new ForbiddenException("Access denied: Permission has expired");
        }

        // READ, EDIT, and DOWNLOAD allow reading/previewing
        if (permission.isReadAllowed()) {
            return;
        }

        throw new ForbiddenException("Access denied: Insufficient permission level");
    }

    /**
     * Checks if a user has permission to download a document's file bytes.
     */
    @Transactional(readOnly = true)
    public void requireDownloadAccess(User user, Document document) {
        validateUserActive(user);
        validateTenantIsolation(user, document);
        validateProjectMembership(user, document);

        if (isDocumentOwner(user, document)) {
            return;
        }

        Optional<DocumentPermission> permOpt = permissionRepository.findByDocumentAndUser(document, user);
        if (permOpt.isEmpty()) {
            log.warn("User {} has no explicit permission for document {}", user.getEmail(), document.getId());
            throw new ForbiddenException("Access denied: No explicit permission grant found for this document");
        }

        DocumentPermission permission = permOpt.get();

        if (permission.getStatus() == PermissionStatus.REVOKED) {
            log.warn("User {} attempted download with REVOKED permission on document {}", user.getEmail(), document.getId());
            throw new ForbiddenException("Access denied: Permission has been revoked");
        }

        if (permission.getStatus() == PermissionStatus.EXPIRED ||
                (permission.getExpiresAt() != null && Instant.now().isAfter(permission.getExpiresAt()))) {
            log.warn("User {} attempted download with EXPIRED permission on document {}", user.getEmail(), document.getId());
            throw new ForbiddenException("Access denied: Permission has expired");
        }

        if (permission.getPermissionLevel() == PermissionLevel.READ) {
            log.warn("User {} attempted download with READ permission on document {}", user.getEmail(), document.getId());
            throw new ForbiddenException("Access denied: Viewers are not permitted to download documents. Download requires EDIT permission on this document");
        }

        if (!permission.isDownloadAllowed()) {
            log.warn("User {} has no download permission for document {}", user.getEmail(), document.getId());
            throw new ForbiddenException("Access denied: Download requires EDIT or DOWNLOAD permission on this document");
        }
    }

    /**
     * Checks if a user has permission to edit document contents or metadata.
     */
    @Transactional(readOnly = true)
    public void requireEditAccess(User user, Document document) {
        validateUserActive(user);
        validateTenantIsolation(user, document);
        validateProjectMembership(user, document);

        if (isDocumentOwner(user, document)) {
            return;
        }

        // If document belongs to a project, verify project member has canEdit
        if (document.getProject() != null) {
            Optional<ProjectMember> memberOpt = projectMemberRepository.findByProjectIdAndUserId(document.getProject().getId(), user.getId());
            if (memberOpt.isPresent() && !memberOpt.get().isCanEdit()) {
                log.warn("User {} has VIEW-only access in project {} and cannot edit document {}",
                        user.getEmail(), document.getProject().getName(), document.getId());
                throw new ForbiddenException("Access denied: You only have VIEW permissions in project " + document.getProject().getName() + " and cannot edit documents");
            }
        }

        Optional<DocumentPermission> permOpt = permissionRepository.findByDocumentAndUser(document, user);
        if (permOpt.isEmpty()) {
            throw new ForbiddenException("Access denied: No permission grant found for this document");
        }

        DocumentPermission permission = permOpt.get();

        if (permission.getStatus() == PermissionStatus.REVOKED) {
            throw new ForbiddenException("Access denied: Permission has been revoked");
        }

        if (permission.getStatus() == PermissionStatus.EXPIRED ||
                (permission.getExpiresAt() != null && Instant.now().isAfter(permission.getExpiresAt()))) {
            throw new ForbiddenException("Access denied: Permission has expired");
        }

        if (permission.getPermissionLevel() != PermissionLevel.EDIT) {
            log.warn("User {} attempted EDIT with {} permission on document {}", user.getEmail(), permission.getPermissionLevel(), document.getId());
            throw new ForbiddenException("Access denied: READ permission does not allow editing or modifying document");
        }
    }

    /**
     * Checks if a user is authorized to manage document permissions, grant/revoke access, or delete.
     */
    @Transactional(readOnly = true)
    public void requireManagementAccess(User user, Document document) {
        validateUserActive(user);
        validateTenantIsolation(user, document);

        boolean isDocOwner = isDocumentOwner(user, document);
        boolean isProjectManager = document.getProject() != null
                && document.getProject().getOwner() != null
                && document.getProject().getOwner().getId().equals(user.getId());
        boolean isAdmin = user.getRole() == Role.ROLE_ADMIN;

        if (!isDocOwner && !isProjectManager && !isAdmin) {
            log.warn("User {} attempted unauthorized management on document {}", user.getEmail(), document.getId());
            throw new ForbiddenException("Access denied: Only the document owner, project manager, or an administrator can manage permissions for this document");
        }
    }

    /**
     * Determines user access level string for UI display.
     */
    @Transactional(readOnly = true)
    public String determineAccessLevel(User user, Document document) {
        if (user == null) return "NONE";
        if (isDocumentOwner(user, document)) return "OWNER";

        if (document.getProject() != null) {
            Optional<ProjectMember> pm = projectMemberRepository.findByProjectIdAndUserId(document.getProject().getId(), user.getId());
            if (pm.isPresent()) {
                if (pm.get().isSuspended()) return "SUSPENDED";
                if (!pm.get().isCanView()) return "NONE";
            }
        }

        Optional<DocumentPermission> permOpt = permissionRepository.findByDocumentAndUser(document, user);
        if (permOpt.isPresent()) {
            DocumentPermission p = permOpt.get();
            if (p.getStatus() == PermissionStatus.REVOKED) {
                return "REVOKED";
            }
            if (p.getStatus() == PermissionStatus.EXPIRED || (p.getExpiresAt() != null && Instant.now().isAfter(p.getExpiresAt()))) {
                return "EXPIRED";
            }
            if (p.isCurrentlyValid()) {
                return p.getPermissionLevel().name();
            }
        }
        return "NONE";
    }

    @Transactional(readOnly = true)
    public boolean hasActiveAccess(User user, Document document) {
        if (user == null || document == null) return false;
        if (isDocumentOwner(user, document)) return true;

        if (document.getProject() != null) {
            Optional<ProjectMember> pm = projectMemberRepository.findByProjectIdAndUserId(document.getProject().getId(), user.getId());
            if (pm.isPresent()) {
                if (pm.get().isSuspended() || !pm.get().isCanView()) {
                    return false;
                }
            }
        }

        return permissionRepository.findByDocumentAndUser(document, user)
                .map(DocumentPermission::isCurrentlyValid)
                .orElse(false);
    }

    public boolean isDocumentOwner(User user, Document document) {
        if (user == null || document == null || document.getOwner() == null) {
            return false;
        }
        return document.getOwner().getId().equals(user.getId());
    }

    private void validateTenantIsolation(User user, Document document) {
        if (user != null && document != null && user.getClient() != null && document.getClient() != null) {
            if (!user.getClient().getId().equals(document.getClient().getId())) {
                log.warn("Cross-tenant access attempted by user {} (client {}) to document {} (client {})",
                        user.getEmail(), user.getClient().getId(), document.getId(), document.getClient().getId());
                throw new ForbiddenException("Access denied: Cross-client access blocked");
            }
        }
    }

    private void validateUserActive(User user) {
        if (user == null || !user.isActive()) {
            throw new ForbiddenException("Your account is deactivated. Contact your administrator.");
        }
    }

    private void validateProjectMembership(User user, Document document) {
        if (user == null || document == null || document.getProject() == null) {
            return;
        }
        if (isDocumentOwner(user, document) || user.isAdmin()) {
            return;
        }
        Optional<ProjectMember> memberOpt = projectMemberRepository.findByProjectIdAndUserId(document.getProject().getId(), user.getId());
        if (memberOpt.isPresent()) {
            ProjectMember member = memberOpt.get();
            if (member.isSuspended()) {
                log.warn("User {} attempted access while project membership is suspended in project {}", user.getEmail(), document.getProject().getName());
                throw new ForbiddenException("Access denied: Your project membership has been suspended");
            }
            if (!member.isCanView()) {
                log.warn("User {} has no view permission in project {}", user.getEmail(), document.getProject().getName());
                throw new ForbiddenException("Access denied: You do not have view access to this project");
            }
        }
    }
}
