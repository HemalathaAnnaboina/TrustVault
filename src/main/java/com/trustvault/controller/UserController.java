package com.trustvault.controller;

import com.trustvault.dto.UserDtos.*;
import com.trustvault.model.User;
import com.trustvault.security.SecurityUtils;
import com.trustvault.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public ResponseEntity<List<UserDto>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserDto> getUserById(@PathVariable UUID id) {
        return ResponseEntity.ok(userService.getUserById(id));
    }

    @PostMapping
    public ResponseEntity<UserDto> createUser(@Valid @RequestBody CreateUserRequest request, HttpServletRequest httpRequest) {
        User admin = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(userService.createUser(request, admin, httpRequest));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserDto> updateUser(
            @PathVariable UUID id,
            @RequestBody UserUpdateRequest request,
            HttpServletRequest httpRequest
    ) {
        User admin = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(userService.updateUser(id, request, admin, httpRequest));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<UserDto> toggleUserStatus(
            @PathVariable UUID id,
            @RequestBody Map<String, Boolean> body,
            HttpServletRequest httpRequest
    ) {
        User admin = SecurityUtils.getCurrentUser();
        boolean active = body.getOrDefault("active", true);
        return ResponseEntity.ok(userService.toggleUserStatus(id, active, admin, httpRequest));
    }
}
