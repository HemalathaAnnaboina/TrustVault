package com.trustvault.controller;

import com.trustvault.dto.PermissionDtos.*;
import com.trustvault.model.User;
import com.trustvault.security.SecurityUtils;
import com.trustvault.service.PermissionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class PermissionController {

    private final PermissionService permissionService;

    public PermissionController(PermissionService permissionService) {
        this.permissionService = permissionService;
    }

    @PostMapping("/documents/{documentId}/permissions")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER', 'ROLE_OWNER')")
    public ResponseEntity<PermissionDto> grantPermission(
            @PathVariable UUID documentId,
            @Valid @RequestBody GrantPermissionRequest request,
            HttpServletRequest httpRequest
    ) {
        User owner = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(permissionService.grantPermission(documentId, request, owner, httpRequest));
    }

    @GetMapping("/documents/{documentId}/permissions")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER', 'ROLE_OWNER')")
    public ResponseEntity<List<PermissionDto>> getDocumentPermissions(@PathVariable UUID documentId) {
        User owner = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(permissionService.getPermissionsForDocument(documentId, owner));
    }

    @DeleteMapping("/permissions/{permissionId}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER', 'ROLE_OWNER')")
    public ResponseEntity<Void> revokePermission(
            @PathVariable UUID permissionId,
            HttpServletRequest httpRequest
    ) {
        User owner = SecurityUtils.getCurrentUser();
        permissionService.revokePermission(permissionId, owner, httpRequest);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/permissions/my")
    public ResponseEntity<List<PermissionDto>> getMyPermissions() {
        User user = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(permissionService.getMyPermissions(user));
    }

    @GetMapping("/permissions/owner")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER', 'ROLE_OWNER')")
    public ResponseEntity<List<PermissionDto>> getOwnerPermissions() {
        User user = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(permissionService.getOwnerPermissions(user));
    }

    @PutMapping("/permissions/{permissionId}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER', 'ROLE_OWNER')")
    public ResponseEntity<PermissionDto> updatePermission(
            @PathVariable UUID permissionId,
            @Valid @RequestBody UpdatePermissionRequest request,
            HttpServletRequest httpRequest
    ) {
        User owner = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(permissionService.updatePermission(permissionId, request, owner, httpRequest));
    }

    @PostMapping("/permissions/bulk")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER', 'ROLE_OWNER')")
    public ResponseEntity<BulkGrantResponse> bulkGrantPermissions(
            @Valid @RequestBody BulkGrantRequest request,
            HttpServletRequest httpRequest
    ) {
        User owner = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(permissionService.bulkGrantPermissions(request, owner, httpRequest));
    }
}
