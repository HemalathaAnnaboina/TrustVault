package com.trustvault.dto;

import java.time.Instant;
import java.util.UUID;

public class DocumentDtos {

    public record DocumentDto(
            UUID id,
            String title,
            String originalFilename,
            String category,
            String contentType,
            long fileSizeBytes,
            String formattedSize,
            String sha256Checksum,
            UUID ownerId,
            String ownerName,
            String ownerEmail,
            UUID projectId,
            String projectName,
            String userAccessLevel, // "OWNER", "EDIT", "READ", "NONE"
            Instant expiresAt,
            boolean isExpiringSoon,
            Instant createdAt,
            Instant updatedAt,
            int version,
            boolean isStarred,
            UUID clientId,
            String clientName
    ) {
        // Backward compatibility constructor
        public DocumentDto(
                UUID id, String title, String originalFilename, String category,
                String contentType, long fileSizeBytes, String formattedSize,
                String sha256Checksum, UUID ownerId, String ownerName, String ownerEmail,
                UUID projectId, String projectName, String userAccessLevel,
                Instant expiresAt, boolean isExpiringSoon, Instant createdAt, Instant updatedAt
        ) {
            this(id, title, originalFilename, category, contentType, fileSizeBytes,
                    formattedSize, sha256Checksum, ownerId, ownerName, ownerEmail,
                    projectId, projectName, userAccessLevel, expiresAt, isExpiringSoon,
                    createdAt, updatedAt, 1, false, null, null);
        }
    }

    public record DocumentUpdateRequest(
            String title,
            String category,
            String content,
            Integer expectedVersion,
            String changeSummary
    ) {
        public DocumentUpdateRequest(String title, String category) {
            this(title, category, null, null, null);
        }
    }

    public record DownloadTokenResponse(
            String token,
            String downloadUrl,
            Instant expiresAt
    ) {}

    public record DocumentVersionDto(
            UUID id,
            UUID documentId,
            int versionNumber,
            String title,
            String contentType,
            long fileSizeBytes,
            String formattedSize,
            String sha256Checksum,
            String changeSummary,
            UUID createdById,
            String createdByName,
            Instant createdAt
    ) {}

    public record DocumentPreviewDto(
            UUID documentId,
            String title,
            String originalFilename,
            String contentType,
            boolean isTextEditable,
            boolean isPreviewSupported,
            String textContent,
            String message,
            int version,
            String userAccessLevel
    ) {}
}
