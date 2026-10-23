package com.trustvault.dto;

import com.trustvault.model.RequestStatus;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.UUID;

public class RenewalRequestDtos {

    public record CreateRenewalRequest(
            UUID permissionId,
            UUID documentId,
            UUID projectId,
            com.trustvault.model.PermissionLevel requestedPermission,
            @NotBlank(message = "Reason is required")
            String reason,
            @Min(value = 1, message = "Days must be at least 1")
            int requestedExtensionDays
    ) {
        public CreateRenewalRequest(UUID permissionId, String reason, int requestedExtensionDays) {
            this(permissionId, null, null, null, reason, requestedExtensionDays);
        }
    }

    public record ReviewRenewalRequest(
            boolean approved,
            String reviewNote,
            @Min(value = 1, message = "Days must be at least 1")
            Integer extensionDays
    ) {}

    public record RenewalRequestDto(
            UUID id,
            UUID permissionId,
            UUID documentId,
            String documentTitle,
            UUID requesterId,
            String requesterEmail,
            String requesterName,
            Instant currentExpiresAt,
            String reason,
            int requestedExtensionDays,
            RequestStatus status,
            Instant createdAt,
            UUID reviewedById,
            String reviewedByName,
            Instant reviewedAt,
            String reviewNote,
            UUID projectId,
            String projectName
    ) {
        public RenewalRequestDto(
                UUID id, UUID permissionId, UUID documentId, String documentTitle,
                UUID requesterId, String requesterEmail, String requesterName,
                Instant currentExpiresAt, String reason, int requestedExtensionDays,
                RequestStatus status, Instant createdAt, UUID reviewedById,
                String reviewedByName, Instant reviewedAt, String reviewNote
        ) {
            this(id, permissionId, documentId, documentTitle, requesterId, requesterEmail, requesterName,
                    currentExpiresAt, reason, requestedExtensionDays, status, createdAt, reviewedById,
                    reviewedByName, reviewedAt, reviewNote, null, null);
        }
    }
}
