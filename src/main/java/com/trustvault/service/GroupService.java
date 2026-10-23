package com.trustvault.service;

import com.trustvault.dto.GroupDtos.*;
import com.trustvault.exception.BadRequestException;
import com.trustvault.exception.ForbiddenException;
import com.trustvault.exception.ResourceNotFoundException;
import com.trustvault.model.*;
import com.trustvault.repository.GroupMemberRepository;
import com.trustvault.repository.GroupRepository;
import com.trustvault.repository.UserRepository;
import com.trustvault.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class GroupService {

    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    public GroupService(
            GroupRepository groupRepository,
            GroupMemberRepository groupMemberRepository,
            UserRepository userRepository,
            AuditService auditService
    ) {
        this.groupRepository = groupRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.userRepository = userRepository;
        this.auditService = auditService;
    }

    @Transactional
    public GroupDto createGroup(CreateGroupRequest request, User owner, HttpServletRequest httpRequest) {
        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        Optional<Group> existing = groupRepository.findByNameIgnoreCaseAndOwner(request.name().trim(), owner);
        if (existing.isPresent()) {
            throw new BadRequestException("A group with name '" + request.name().trim() + "' already exists");
        }

        Group group = new Group(
                request.name().trim(),
                request.description(),
                request.department() != null ? request.department().trim() : null,
                owner
        );
        Group savedGroup = groupRepository.save(group);

        // Add initial members if provided
        if (request.memberEmails() != null && !request.memberEmails().isEmpty()) {
            for (String email : request.memberEmails()) {
                if (email != null && !email.isBlank()) {
                    userRepository.findByEmailIgnoreCase(email.trim()).ifPresent(user -> {
                        if (user.isActive()) {
                            groupMemberRepository.save(new GroupMember(savedGroup, user));
                        }
                    });
                }
            }
        }

        auditService.logEvent(owner, AuditAction.GROUP_CREATED, "GROUP", savedGroup.getId().toString(),
                AuditResult.SUCCESS, "Created group: " + savedGroup.getName(), clientIp, userAgent);

        return mapToDto(savedGroup);
    }

    @Transactional(readOnly = true)
    public List<GroupDto> getGroupsForUser(User user) {
        if (user.getRole() == Role.ROLE_ADMIN) {
            return groupRepository.findAll().stream().map(this::mapToDto).toList();
        }
        return groupRepository.findByOwnerOrderByCreatedAtDesc(user).stream()
                .map(this::mapToDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public GroupDto getGroupById(UUID id, User user) {
        Group group = groupRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found with ID: " + id));

        if (!group.getOwner().getId().equals(user.getId()) && user.getRole() != Role.ROLE_ADMIN) {
            // Check if user is a member of the group
            boolean isMember = groupMemberRepository.findByGroupAndUser(group, user).isPresent();
            if (!isMember) {
                throw new ForbiddenException("You are not authorized to view this group");
            }
        }

        return mapToDto(group);
    }

    @Transactional
    public GroupDto updateGroup(UUID id, UpdateGroupRequest request, User owner, HttpServletRequest httpRequest) {
        Group group = groupRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found with ID: " + id));

        if (!group.getOwner().getId().equals(owner.getId()) && owner.getRole() != Role.ROLE_ADMIN) {
            throw new ForbiddenException("Only the group owner can update this group");
        }

        group.setName(request.name().trim());
        group.setDescription(request.description());
        group.setDepartment(request.department() != null ? request.department().trim() : null);

        Group saved = groupRepository.save(group);
        auditService.logEvent(owner, AuditAction.GROUP_UPDATED, "GROUP", saved.getId().toString(),
                AuditResult.SUCCESS, "Updated group: " + saved.getName(),
                SecurityUtils.getClientIp(httpRequest), SecurityUtils.getUserAgent(httpRequest));

        return mapToDto(saved);
    }

    @Transactional
    public void deleteGroup(UUID id, User owner, HttpServletRequest httpRequest) {
        Group group = groupRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found with ID: " + id));

        if (!group.getOwner().getId().equals(owner.getId()) && owner.getRole() != Role.ROLE_ADMIN) {
            throw new ForbiddenException("Only the group owner can delete this group");
        }

        groupMemberRepository.findByGroupOrderByAddedAtDesc(group)
                .forEach(groupMemberRepository::delete);

        groupRepository.delete(group);
        auditService.logEvent(owner, AuditAction.GROUP_DELETED, "GROUP", id.toString(),
                AuditResult.SUCCESS, "Deleted group: " + group.getName(),
                SecurityUtils.getClientIp(httpRequest), SecurityUtils.getUserAgent(httpRequest));
    }

    @Transactional
    public GroupDto addMembers(UUID groupId, AddMembersRequest request, User owner, HttpServletRequest httpRequest) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found with ID: " + groupId));

        if (!group.getOwner().getId().equals(owner.getId()) && owner.getRole() != Role.ROLE_ADMIN) {
            throw new ForbiddenException("Only the group owner can add members to this group");
        }

        List<User> usersToAdd = new ArrayList<>();

        if (request.memberEmails() != null) {
            for (String email : request.memberEmails()) {
                if (email != null && !email.isBlank()) {
                    userRepository.findByEmailIgnoreCase(email.trim()).ifPresent(usersToAdd::add);
                }
            }
        }

        if (request.memberUserIds() != null) {
            for (UUID userId : request.memberUserIds()) {
                userRepository.findById(userId).ifPresent(usersToAdd::add);
            }
        }

        int addedCount = 0;
        for (User u : usersToAdd) {
            if (u.isActive() && groupMemberRepository.findByGroupAndUser(group, u).isEmpty()) {
                groupMemberRepository.save(new GroupMember(group, u));
                addedCount++;
            }
        }

        auditService.logEvent(owner, AuditAction.GROUP_MEMBER_ADDED, "GROUP", group.getId().toString(),
                AuditResult.SUCCESS, "Added " + addedCount + " members to group: " + group.getName(),
                SecurityUtils.getClientIp(httpRequest), SecurityUtils.getUserAgent(httpRequest));

        return mapToDto(group);
    }

    @Transactional
    public GroupDto removeMember(UUID groupId, UUID userId, User owner, HttpServletRequest httpRequest) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found with ID: " + groupId));

        if (!group.getOwner().getId().equals(owner.getId()) && owner.getRole() != Role.ROLE_ADMIN) {
            throw new ForbiddenException("Only the group owner can remove members from this group");
        }

        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + userId));

        groupMemberRepository.deleteByGroupAndUser(group, targetUser);

        auditService.logEvent(owner, AuditAction.GROUP_MEMBER_REMOVED, "GROUP", group.getId().toString(),
                AuditResult.SUCCESS, "Removed " + targetUser.getEmail() + " from group: " + group.getName(),
                SecurityUtils.getClientIp(httpRequest), SecurityUtils.getUserAgent(httpRequest));

        return mapToDto(group);
    }

    public GroupDto mapToDto(Group g) {
        List<GroupMember> members = groupMemberRepository.findByGroupOrderByAddedAtDesc(g);
        List<GroupMemberDto> memberDtos = members.stream()
                .map(m -> new GroupMemberDto(
                        m.getId(),
                        m.getUser().getId(),
                        m.getUser().getEmail(),
                        m.getUser().getFullName(),
                        m.getAddedAt()
                ))
                .toList();

        return new GroupDto(
                g.getId(),
                g.getName(),
                g.getDescription(),
                g.getDepartment(),
                g.getOwner().getId(),
                g.getOwner().getFullName(),
                memberDtos.size(),
                g.getCreatedAt(),
                g.getUpdatedAt(),
                memberDtos
        );
    }
}
