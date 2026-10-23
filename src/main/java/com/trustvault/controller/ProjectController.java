package com.trustvault.controller;

import com.trustvault.dto.ProjectDtos.*;
import com.trustvault.model.User;
import com.trustvault.security.SecurityUtils;
import com.trustvault.service.ProjectService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER', 'ROLE_OWNER')")
    public ResponseEntity<ProjectDto> createProject(@Valid @RequestBody ProjectCreateRequest request) {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(projectService.createProject(request, currentUser));
    }

    @GetMapping
    public ResponseEntity<List<ProjectDto>> getProjects() {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(projectService.getProjectsForUser(currentUser));
    }

    @GetMapping("/my")
    public ResponseEntity<List<ProjectDto>> getMyProjects() {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(projectService.getProjectsForUser(currentUser));
    }

    @GetMapping("/stats/manager")
    public ResponseEntity<ManagerStatsDto> getManagerStats() {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(projectService.getManagerStats(currentUser));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProjectDto> getProjectById(@PathVariable UUID id) {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(projectService.getProjectById(id, currentUser));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER', 'ROLE_OWNER')")
    public ResponseEntity<Void> deleteProject(@PathVariable UUID id) {
        User currentUser = SecurityUtils.getCurrentUser();
        projectService.deleteProject(id, currentUser);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/members")
    public ResponseEntity<ProjectMemberDto> addMember(
            @PathVariable UUID id,
            @Valid @RequestBody AddMemberRequest request
    ) {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(projectService.addMember(id, request, currentUser));
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<List<ProjectMemberDto>> getProjectMembers(@PathVariable UUID id) {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(projectService.getProjectMembers(id, currentUser));
    }

    @PutMapping("/{id}/members/{memberId}")
    public ResponseEntity<ProjectMemberDto> updateMember(
            @PathVariable UUID id,
            @PathVariable UUID memberId,
            @Valid @RequestBody UpdateMemberPermissionsRequest request
    ) {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(projectService.updateMemberPermissions(id, memberId, request, currentUser));
    }

    @PostMapping("/{id}/members/{memberId}/suspend")
    public ResponseEntity<ProjectMemberDto> suspendMember(
            @PathVariable UUID id,
            @PathVariable UUID memberId,
            @RequestBody(required = false) SuspendMemberRequest request
    ) {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(projectService.suspendMember(id, memberId, request, currentUser));
    }

    @PostMapping("/{id}/members/{memberId}/reactivate")
    public ResponseEntity<ProjectMemberDto> reactivateMember(
            @PathVariable UUID id,
            @PathVariable UUID memberId
    ) {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(projectService.reactivateMember(id, memberId, currentUser));
    }

    @DeleteMapping("/{id}/members/{memberId}")
    public ResponseEntity<Void> removeMember(@PathVariable UUID id, @PathVariable UUID memberId) {
        User currentUser = SecurityUtils.getCurrentUser();
        projectService.removeMember(id, memberId, currentUser);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/share")
    public ResponseEntity<Void> shareDocument(
            @PathVariable UUID id,
            @Valid @RequestBody ShareDocumentRequest request,
            HttpServletRequest httpRequest
    ) {
        User currentUser = SecurityUtils.getCurrentUser();
        projectService.shareDocument(id, request, currentUser, httpRequest);
        return ResponseEntity.ok().build();
    }
}
