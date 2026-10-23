package com.trustvault.dto;

import com.trustvault.model.PermissionLevel;
import com.trustvault.model.PermissionStatus;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.UUID;

public class PermissionDtos {

    public record GrantPermissionRequest(
            @NotBlank(message = "User email is required")
            @Email(message = "Valid email is required")
            String userEmail,

            @NotNull(message = "Permission level is required")
            PermissionLevel permissionLevel,

            Instant expiresAt,

            Integer durationDays
    ) {
        public GrantPermissionRequest(String userEmail, PermissionLevel permissionLevel, Instant expiresAt) {
            this(userEmail, permissionLevel, expiresAt, null);
        }
    }

    public record PermissionDto(
            UUID id,
            UUID documentId,
            String documentTitle,
            UUID userId,
            String userEmail,
            String userName,
            PermissionLevel permissionLevel,
            UUID grantedById,
            String grantedByName,
            Instant grantedAt,
            Instant expiresAt,
            PermissionStatus status,
            boolean isExpired,
            UUID projectId,
            String projectName
    ) {
        public PermissionDto(
                UUID id, UUID documentId, String documentTitle, UUID userId,
                String userEmail, String userName, PermissionLevel permissionLevel,
                UUID grantedById, String grantedByName, Instant grantedAt,
                Instant expiresAt, PermissionStatus status, boolean isExpired
        ) {
            this(id, documentId, documentTitle, userId, userEmail, userName, permissionLevel,
                    grantedById, grantedByName, grantedAt, expiresAt, status, isExpired, null, null);
        }
    }

    public record UpdatePermissionRequest(
            @NotNull(message = "Permission level is required")
            PermissionLevel permissionLevel,
            Instant expiresAt,
            Integer durationDays
    ) {
        public UpdatePermissionRequest(PermissionLevel permissionLevel, Instant expiresAt) {
            this(permissionLevel, expiresAt, null);
        }
    }

    public record BulkAssignment(
            @NotBlank(message = "User email is required")
            @Email(message = "Valid email is required")
            String userEmail,
            @NotNull(message = "Permission level is required")
            PermissionLevel permissionLevel,
            Instant expiresAt,
            Integer durationDays
    ) {
        public BulkAssignment(String userEmail, PermissionLevel permissionLevel, Instant expiresAt) {
            this(userEmail, permissionLevel, expiresAt, null);
        }
    }

    public record BulkGrantRequest(
            java.util.List<UUID> documentIds,
            java.util.List<BulkAssignment> assignments
    ) {}

    public record BulkGrantResultItem(
            UUID documentId,
            String documentTitle,
            String userEmail,
            PermissionLevel permissionLevel,
            boolean success,
            String message,
            PermissionDto permission
    ) {}

    public record BulkGrantResponse(
            int totalProcessed,
            int successful,
            int failed,
            java.util.List<BulkGrantResultItem> results
    ) {}
}
