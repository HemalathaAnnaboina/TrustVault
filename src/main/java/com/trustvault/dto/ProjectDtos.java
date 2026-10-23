package com.trustvault.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.trustvault.model.PermissionLevel;
import com.trustvault.model.Role;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class ProjectDtos {

    public record MemberAllocationDto(
            @NotBlank(message = "Member email is required")
            String userEmail,
            String responsibility,
            boolean canView,
            boolean canEdit
    ) {
        @JsonCreator
        public MemberAllocationDto(
                @JsonProperty("userEmail") String userEmail,
                @JsonProperty("responsibility") String responsibility,
                @JsonProperty("canView") Boolean canView,
                @JsonProperty("canEdit") Boolean canEdit
        ) {
            this(
                    userEmail,
                    responsibility != null && !responsibility.isBlank() ? responsibility : "Contributor",
                    canView != null ? canView : true,
                    canEdit != null ? canEdit : false
            );
        }
    }

    public record DocumentPermissionAssignmentDto(
            UUID documentId,
            String documentTitle,
            @NotBlank(message = "User email is required")
            String userEmail,
            PermissionLevel permissionLevel,
            Instant expiresAt,
            Integer durationDays
    ) {
        public DocumentPermissionAssignmentDto {
            if (permissionLevel == null) {
                permissionLevel = PermissionLevel.READ;
            }
        }

        public DocumentPermissionAssignmentDto(UUID documentId, String documentTitle, String userEmail, PermissionLevel permissionLevel, Instant expiresAt) {
            this(documentId, documentTitle, userEmail, permissionLevel, expiresAt, null);
        }
    }

    public record ProjectCreateRequest(
            @NotBlank(message = "Project name is required")
            String name,
            String description,
            UUID groupId,
            String category,
            String status,
            List<MemberAllocationDto> members,
            List<UUID> existingDocumentIds,
            List<DocumentPermissionAssignmentDto> permissions,
            Integer defaultDocumentDurationDays
    ) {
        public ProjectCreateRequest {
            category = category != null && !category.isBlank() ? category : "General";
            status = status != null && !status.isBlank() ? status.trim().toUpperCase() : "ACTIVE";
            members = members != null ? members : List.of();
            existingDocumentIds = existingDocumentIds != null ? existingDocumentIds : List.of();
            permissions = permissions != null ? permissions : List.of();
            defaultDocumentDurationDays = defaultDocumentDurationDays != null ? defaultDocumentDurationDays : 30;
        }

        public ProjectCreateRequest(String name, String description, UUID groupId, String category) {
            this(name, description, groupId, category, "ACTIVE", List.of(), List.of(), List.of(), 30);
        }

        public ProjectCreateRequest(String name, String description, UUID groupId, String category, List<MemberAllocationDto> members) {
            this(name, description, groupId, category, "ACTIVE", members, List.of(), List.of(), 30);
        }

        public ProjectCreateRequest(String name, String description, UUID groupId, String category, String status, List<MemberAllocationDto> members, List<UUID> existingDocumentIds, List<DocumentPermissionAssignmentDto> permissions) {
            this(name, description, groupId, category, status, members, existingDocumentIds, permissions, 30);
        }
    }

    public record ProjectDto(
            UUID id,
            String name,
            String description,
            UUID ownerId,
            String ownerName,
            UUID groupId,
            String groupName,
            String category,
            String status,
            long documentCount,
            long memberCount,
            Instant createdAt,
            boolean canView,
            boolean canEdit
    ) {
        public ProjectDto(
                UUID id, String name, String description, UUID ownerId,
                String ownerName, UUID groupId, String groupName, String category,
                long documentCount, long memberCount, Instant createdAt
        ) {
            this(id, name, description, ownerId, ownerName, groupId, groupName, category, "ACTIVE", documentCount, memberCount, createdAt, true, true);
        }

        public ProjectDto(
                UUID id, String name, String description, UUID ownerId,
                String ownerName, UUID groupId, String groupName, String category,
                long documentCount, long memberCount, Instant createdAt,
                boolean canView, boolean canEdit
        ) {
            this(id, name, description, ownerId, ownerName, groupId, groupName, category, "ACTIVE", documentCount, memberCount, createdAt, canView, canEdit);
        }
    }

    public record AddMemberRequest(
            @NotBlank(message = "User email is required")
            String userEmail,
            String responsibility,
            Boolean canView,
            Boolean canEdit,
            List<DocumentPermissionAssignmentDto> documentPermissions,
            Integer documentAccessDurationDays
    ) {
        public AddMemberRequest {
            responsibility = responsibility != null && !responsibility.isBlank() ? responsibility : "Contributor";
            canView = canView != null ? canView : true;
            canEdit = canEdit != null ? canEdit : false;
            documentPermissions = documentPermissions != null ? documentPermissions : List.of();
            documentAccessDurationDays = documentAccessDurationDays != null ? documentAccessDurationDays : 30;
        }

        public AddMemberRequest(String userEmail, String responsibility) {
            this(userEmail, responsibility, true, false, List.of(), 30);
        }

        public AddMemberRequest(String userEmail, String responsibility, Boolean canView, Boolean canEdit) {
            this(userEmail, responsibility, canView, canEdit, List.of(), 30);
        }

        public AddMemberRequest(String userEmail, String responsibility, Boolean canView, Boolean canEdit, List<DocumentPermissionAssignmentDto> documentPermissions) {
            this(userEmail, responsibility, canView, canEdit, documentPermissions, 30);
        }
    }

    public record UpdateMemberPermissionsRequest(
            Boolean canView,
            Boolean canEdit,
            String responsibility,
            String status
    ) {}

    public record SuspendMemberRequest(
            String reason
    ) {}

    public record MemberPermissionAssignmentDto(
            @NotBlank(message = "User email is required")
            String userEmail,
            PermissionLevel permissionLevel,
            Instant expiresAt,
            Integer durationDays
    ) {
        public MemberPermissionAssignmentDto(String userEmail, PermissionLevel permissionLevel, Instant expiresAt) {
            this(userEmail, permissionLevel, expiresAt, null);
        }
    }

    public record ShareDocumentRequest(
            UUID documentId,
            List<MemberPermissionAssignmentDto> assignments
    ) {}

    public record ProjectMemberDto(
            UUID id,
            UUID userId,
            String userEmail,
            String fullName,
            String responsibility,
            boolean active,
            Instant addedAt,
            boolean canView,
            boolean canEdit,
            Role projectRole,
            String roleLabel,
            String status,
            Instant suspendedAt,
            long accessibleDocumentCount
    ) {
        public ProjectMemberDto(
                UUID id, UUID userId, String userEmail, String fullName,
                String responsibility, boolean active, Instant addedAt
        ) {
            this(id, userId, userEmail, fullName, responsibility, active, addedAt, true, false, Role.ROLE_WORKSHOP_MEMBER, responsibility, "ACTIVE", null, 0);
        }

        public ProjectMemberDto(
                UUID id, UUID userId, String userEmail, String fullName,
                String responsibility, boolean active, Instant addedAt,
                boolean canView, boolean canEdit, String roleLabel
        ) {
            this(id, userId, userEmail, fullName, responsibility, active, addedAt, canView, canEdit, Role.ROLE_WORKSHOP_MEMBER, roleLabel, "ACTIVE", null, 0);
        }

        public ProjectMemberDto(
                UUID id, UUID userId, String userEmail, String fullName,
                String responsibility, boolean active, Instant addedAt,
                boolean canView, boolean canEdit, String roleLabel,
                String status, Instant suspendedAt, long accessibleDocumentCount
        ) {
            this(id, userId, userEmail, fullName, responsibility, active, addedAt, canView, canEdit, Role.ROLE_WORKSHOP_MEMBER, roleLabel, status, suspendedAt, accessibleDocumentCount);
        }
    }

    public record ManagerStatsDto(
            long totalProjects,
            long vaultDocuments,
            long activeTeamMembers,
            long pendingRequests,
            long expiringPermissions,
            long securityEvents
    ) {}
}
