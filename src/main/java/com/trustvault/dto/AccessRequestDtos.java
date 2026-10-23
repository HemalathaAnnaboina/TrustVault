package com.trustvault.dto;

import com.trustvault.model.PermissionLevel;
import com.trustvault.model.RequestStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.UUID;

public class AccessRequestDtos {

    public record CreateAccessRequest(
            UUID documentId,
            UUID projectId,
            String requestedFilename,
            @NotNull(message = "Requested permission is required")
            PermissionLevel requestedPermission,
            Integer durationDays,
            @NotBlank(message = "Reason is required")
            String reason
    ) {
        public CreateAccessRequest(UUID documentId, PermissionLevel requestedPermission, String reason) {
            this(documentId, null, null, requestedPermission, 7, reason);
        }

        public CreateAccessRequest(UUID documentId, UUID projectId, PermissionLevel requestedPermission, Integer durationDays, String reason) {
            this(documentId, projectId, null, requestedPermission, durationDays, reason);
        }
    }

    public record ReviewAccessRequest(
        boolean approved,
        String reviewNote,
        Instant expiresAt,
        Integer approvedDurationDays,
        UUID resolvedDocumentId,
        PermissionLevel grantedPermission
    ) {
        public ReviewAccessRequest(boolean approved, String reviewNote) {
            this(approved, reviewNote, null, null, null, null);
        }

        public ReviewAccessRequest(boolean approved, String reviewNote, Instant expiresAt) {
            this(approved, reviewNote, expiresAt, null, null, null);
        }

        public ReviewAccessRequest(boolean approved, String reviewNote, Instant expiresAt, Integer approvedDurationDays) {
            this(approved, reviewNote, expiresAt, approvedDurationDays, null, null);
        }

        public ReviewAccessRequest(boolean approved, String reviewNote, Instant expiresAt, Integer approvedDurationDays, UUID resolvedDocumentId) {
            this(approved, reviewNote, expiresAt, approvedDurationDays, resolvedDocumentId, null);
        }
    }

    public record AccessRequestDto(
            UUID id,
            UUID documentId,
            String documentTitle,
            UUID projectId,
            String projectName,
            String requestedFilename,
            int durationDays,
            UUID requesterId,
            String requesterEmail,
            String requesterName,
            PermissionLevel requestedPermission,
            String reason,
            RequestStatus status,
            Instant createdAt,
            UUID reviewedById,
            String reviewedByName,
            Instant reviewedAt,
            String reviewNote
    ) {
        public AccessRequestDto(
                UUID id, UUID documentId, String documentTitle, UUID requesterId,
                String requesterEmail, String requesterName, PermissionLevel requestedPermission,
                String reason, RequestStatus status, Instant createdAt, UUID reviewedById,
                String reviewedByName, Instant reviewedAt, String reviewNote
        ) {
            this(id, documentId, documentTitle, null, null, null, 7, requesterId, requesterEmail,
                    requesterName, requestedPermission, reason, status, createdAt, reviewedById,
                    reviewedByName, reviewedAt, reviewNote);
        }
    }
}
