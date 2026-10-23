package com.trustvault.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class GroupDtos {

    public record GroupDto(
            UUID id,
            String name,
            String description,
            String department,
            UUID ownerId,
            String ownerName,
            long memberCount,
            Instant createdAt,
            Instant updatedAt,
            List<GroupMemberDto> members
    ) {}

    public record GroupMemberDto(
            UUID id,
            UUID userId,
            String email,
            String fullName,
            Instant addedAt
    ) {}

    public record CreateGroupRequest(
            @NotBlank(message = "Group name is required")
            String name,
            String description,
            String department,
            List<String> memberEmails
    ) {}

    public record UpdateGroupRequest(
            @NotBlank(message = "Group name is required")
            String name,
            String description,
            String department
    ) {}

    public record AddMembersRequest(
            List<String> memberEmails,
            List<UUID> memberUserIds
    ) {}
}
