package com.trustvault.controller;

import com.trustvault.dto.UserDtos.*;
import com.trustvault.model.Role;
import com.trustvault.model.User;
import com.trustvault.security.SecurityUtils;
import com.trustvault.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class EmployeeDirectoryController {

    private final UserService userService;

    public EmployeeDirectoryController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public ResponseEntity<List<EmployeeDirectoryDto>> getEmployeeDirectory() {
        return ResponseEntity.ok(userService.getEmployeeDirectory());
    }

    @PostMapping("/invite")
    @PreAuthorize("hasAnyAuthority('ROLE_OWNER', 'ROLE_ADMIN')")
    public ResponseEntity<UserDto> inviteEmployee(
            @Valid @RequestBody CreateUserRequest request,
            HttpServletRequest httpRequest
    ) {
        User currentUser = SecurityUtils.getCurrentUser();
        // Force role to ROLE_VIEWER if created by non-admin
        Role assignedRole = (currentUser.getRole() == Role.ROLE_ADMIN && request.role() != null)
                ? request.role()
                : Role.ROLE_VIEWER;

        CreateUserRequest safeRequest = new CreateUserRequest(
                request.email(),
                request.password(),
                request.fullName(),
                assignedRole
        );
        return ResponseEntity.ok(userService.createUser(safeRequest, currentUser, httpRequest));
    }
}
