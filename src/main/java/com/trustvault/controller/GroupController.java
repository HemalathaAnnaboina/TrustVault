package com.trustvault.controller;

import com.trustvault.dto.GroupDtos.*;
import com.trustvault.dto.ProjectDtos.ProjectDto;
import com.trustvault.model.User;
import com.trustvault.security.SecurityUtils;
import com.trustvault.service.GroupService;
import com.trustvault.service.ProjectService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping({"/api/groups", "/api/workshops"})
public class GroupController {

    private final GroupService groupService;
    private final ProjectService projectService;

    public GroupController(GroupService groupService, ProjectService projectService) {
        this.groupService = groupService;
        this.projectService = projectService;
    }

    @GetMapping
    public ResponseEntity<List<GroupDto>> getGroups() {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(groupService.getGroupsForUser(currentUser));
    }

    @PostMapping
    public ResponseEntity<GroupDto> createGroup(
            @Valid @RequestBody CreateGroupRequest request,
            HttpServletRequest httpRequest
    ) {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(groupService.createGroup(request, currentUser, httpRequest));
    }

    @GetMapping("/{id}")
    public ResponseEntity<GroupDto> getGroupById(@PathVariable UUID id) {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(groupService.getGroupById(id, currentUser));
    }

    @GetMapping("/{id}/projects")
    public ResponseEntity<List<ProjectDto>> getGroupProjects(@PathVariable UUID id) {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(projectService.getProjectsForGroup(id, currentUser));
    }

    @PutMapping("/{id}")
    public ResponseEntity<GroupDto> updateGroup(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateGroupRequest request,
            HttpServletRequest httpRequest
    ) {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(groupService.updateGroup(id, request, currentUser, httpRequest));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteGroup(@PathVariable UUID id, HttpServletRequest httpRequest) {
        User currentUser = SecurityUtils.getCurrentUser();
        groupService.deleteGroup(id, currentUser, httpRequest);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/members")
    public ResponseEntity<GroupDto> addMembers(
            @PathVariable UUID id,
            @RequestBody AddMembersRequest request,
            HttpServletRequest httpRequest
    ) {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(groupService.addMembers(id, request, currentUser, httpRequest));
    }

    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<GroupDto> removeMember(
            @PathVariable UUID id,
            @PathVariable UUID userId,
            HttpServletRequest httpRequest
    ) {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(groupService.removeMember(id, userId, currentUser, httpRequest));
    }
}
