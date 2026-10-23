package com.trustvault.controller;

import com.trustvault.dto.AuthDtos.*;
import com.trustvault.model.User;
import com.trustvault.security.SecurityUtils;
import com.trustvault.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        LoginResponse response = authService.login(request, httpRequest);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/register")
    public ResponseEntity<UserProfileResponse> register(@Valid @RequestBody RegisterRequest request, HttpServletRequest httpRequest) {
        UserProfileResponse response = authService.register(request, httpRequest);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getMe() {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(authService.getCurrentProfile(currentUser));
    }

    @PostMapping("/change-password")
    public ResponseEntity<java.util.Map<String, String>> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            HttpServletRequest httpRequest
    ) {
        User currentUser = SecurityUtils.getCurrentUser();
        authService.changePassword(currentUser, request, httpRequest);
        return ResponseEntity.ok(java.util.Map.of("message", "Password changed successfully"));
    }

    @GetMapping("/validate-setup-token")
    public ResponseEntity<java.util.Map<String, Object>> validateSetupToken(@RequestParam("token") String token) {
        return ResponseEntity.ok(authService.validateSetupToken(token));
    }

    @PostMapping("/setup-password")
    public ResponseEntity<java.util.Map<String, String>> setupPassword(
            @Valid @RequestBody SetupPasswordRequest request,
            HttpServletRequest httpRequest
    ) {
        return ResponseEntity.ok(authService.setupPassword(request, httpRequest));
    }
}
