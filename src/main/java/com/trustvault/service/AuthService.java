package com.trustvault.service;

import com.trustvault.dto.AuthDtos.*;
import com.trustvault.exception.BadRequestException;
import com.trustvault.model.AuditAction;
import com.trustvault.model.AuditResult;
import com.trustvault.model.Role;
import com.trustvault.model.User;
import com.trustvault.repository.UserRepository;
import com.trustvault.security.JwtTokenProvider;
import com.trustvault.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuditService auditService;
    private final com.trustvault.repository.PasswordSetupTokenRepository passwordSetupTokenRepository;
    private final com.trustvault.repository.AuditLogRepository auditLogRepository;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokenProvider,
            AuditService auditService,
            com.trustvault.repository.PasswordSetupTokenRepository passwordSetupTokenRepository,
            com.trustvault.repository.AuditLogRepository auditLogRepository
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.auditService = auditService;
        this.passwordSetupTokenRepository = passwordSetupTokenRepository;
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional
    public LoginResponse login(LoginRequest request, HttpServletRequest httpRequest) {
        String email = request.email().trim().toLowerCase();
        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        User user = userRepository.findByEmailIgnoreCase(email).orElse(null);

        if (user == null) {
            auditService.logEvent(null, AuditAction.LOGIN_FAILURE, "USER", email,
                    AuditResult.DENIED, "Login failed: User not found", clientIp, userAgent);
            throw new BadCredentialsException("Invalid email or password");
        }

        if (!user.isActive()) {
            auditService.logEvent(user, AuditAction.INACTIVE_USER_ACCESS_ATTEMPT, "USER", user.getId().toString(),
                    AuditResult.DENIED, "Login rejected: Account is deactivated", clientIp, userAgent);
            throw new DisabledException("Your account is deactivated. Contact your administrator.");
        }

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            auditService.logEvent(user, AuditAction.LOGIN_FAILURE, "USER", user.getId().toString(),
                    AuditResult.DENIED, "Login failed: Incorrect password", clientIp, userAgent);
            throw new BadCredentialsException("Invalid email or password");
        }

        String token = jwtTokenProvider.generateToken(user);
        auditService.logEvent(user, AuditAction.LOGIN_SUCCESS, "USER", user.getId().toString(),
                AuditResult.SUCCESS, "User logged in successfully", clientIp, userAgent);

        return new LoginResponse(
                token,
                "Bearer",
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getRole(),
                user.isActive()
        );
    }

    @Transactional
    public UserProfileResponse register(RegisterRequest request, HttpServletRequest httpRequest) {
        String email = request.email().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new BadRequestException("Email is already registered");
        }

        if (request.role() != null && request.role() != Role.ROLE_OWNER) {
            String clientIp = SecurityUtils.getClientIp(httpRequest);
            String userAgent = SecurityUtils.getUserAgent(httpRequest);
            String reason = request.role() == Role.ROLE_ADMIN
                    ? "Registration rejected: Public users cannot create ADMIN accounts"
                    : "Registration rejected: Public registration allows only OWNER accounts. Viewers must be invited by an authorized Owner or Administrator";
            auditService.logEvent(null, AuditAction.USER_CREATED, "USER", email,
                    AuditResult.DENIED, reason, clientIp, userAgent);
            throw new BadRequestException(request.role() == Role.ROLE_ADMIN
                    ? "Public users cannot create ADMIN accounts"
                    : "Public registration allows only OWNER accounts. Viewers must be invited by an authorized Owner or Administrator");
        }

        Role role = Role.ROLE_OWNER;
        String encodedPassword = passwordEncoder.encode(request.password());

        User user = new User(email, encodedPassword, request.fullName().trim(), role, true);
        User savedUser = userRepository.save(user);

        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);
        auditService.logEvent(savedUser, AuditAction.USER_CREATED, "USER", savedUser.getId().toString(),
                AuditResult.SUCCESS, "New user registered with role " + role, clientIp, userAgent);

        return new UserProfileResponse(
                savedUser.getId(),
                savedUser.getEmail(),
                savedUser.getFullName(),
                savedUser.getRole(),
                savedUser.isActive()
        );
    }

    public UserProfileResponse getCurrentProfile(User user) {
        java.time.Instant passwordLastChangedAt = auditLogRepository
                .findFirstByActorEmailAndActionOrderByTimestampDesc(user.getEmail(), AuditAction.USER_PASSWORD_CHANGED)
                .map(com.trustvault.model.AuditLog::getTimestamp)
                .orElse(user.getUpdatedAt());

        java.time.Instant lastLoginAt = auditLogRepository
                .findFirstByActorEmailAndActionOrderByTimestampDesc(user.getEmail(), AuditAction.LOGIN_SUCCESS)
                .map(com.trustvault.model.AuditLog::getTimestamp)
                .orElse(null);

        return new UserProfileResponse(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getRole(),
                user.isActive(),
                user.getCreatedAt(),
                passwordLastChangedAt,
                lastLoginAt
        );
    }

    @Transactional
    public UserProfileResponse updateProfile(User user, UpdateProfileRequest request, HttpServletRequest httpRequest) {
        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        if (request.fullName() == null || request.fullName().trim().length() < 2 || request.fullName().trim().length() > 100) {
            throw new BadRequestException("Full name must be between 2 and 100 characters");
        }

        String oldName = user.getFullName();
        user.setFullName(request.fullName().trim());
        User saved = userRepository.save(user);

        auditService.logEvent(saved, AuditAction.USER_UPDATED, "USER", saved.getId().toString(),
                AuditResult.SUCCESS, "User updated profile full name from '" + oldName + "' to '" + saved.getFullName() + "'", clientIp, userAgent);

        return getCurrentProfile(saved);
    }

    @Transactional
    public void changePassword(User user, ChangePasswordRequest request, HttpServletRequest httpRequest) {
        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        // Security check: Workshop users (Members, Editors, and Viewers) cannot change passwords through settings or direct API requests
        if (user.isWorkshopMember() || user.getRole() == Role.ROLE_WORKSHOP_MEMBER || user.getRole() == Role.ROLE_VIEWER || user.getRole() == Role.ROLE_EDITOR || user.getRole() == Role.ROLE_WORKSHOP) {
            auditService.logEvent(user, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "USER", user.getId().toString(),
                    AuditResult.DENIED, "Password change rejected: Disabled for workshop users", clientIp, userAgent);
            throw new com.trustvault.exception.ForbiddenException("Password change is disabled for workshop users. Please contact your administrator.");
        }

        if (!passwordEncoder.matches(request.oldPassword(), user.getPasswordHash())) {
            throw new BadRequestException("Current password is incorrect");
        }
        if (request.newPassword().length() < 8) {
            throw new BadRequestException("New password must be at least 8 characters");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        auditService.logEvent(user, AuditAction.USER_PASSWORD_CHANGED, "USER", user.getId().toString(),
                AuditResult.SUCCESS, "User changed account password", clientIp, userAgent);
    }

    @Transactional(readOnly = true)
    public java.util.Map<String, Object> validateSetupToken(String tokenString) {
        if (tokenString == null || tokenString.isBlank()) {
            throw new BadRequestException("Setup token is required");
        }
        com.trustvault.model.PasswordSetupToken token = passwordSetupTokenRepository.findByTokenValue(tokenString.trim())
                .orElseThrow(() -> new BadRequestException("Invalid or expired password setup link"));

        if (token.isUsed()) {
            throw new BadRequestException("This password setup link has already been used");
        }
        if (java.time.Instant.now().isAfter(token.getExpiresAt())) {
            throw new BadRequestException("This password setup link has expired. Please contact your administrator.");
        }

        User user = token.getUser();
        if (!user.isActive()) {
            throw new com.trustvault.exception.ForbiddenException("Your account is deactivated. Contact your administrator.");
        }

        java.util.Map<String, Object> res = new java.util.HashMap<>();
        res.put("valid", true);
        res.put("email", user.getEmail());
        res.put("fullName", user.getFullName());
        res.put("role", user.getRole().name());
        return res;
    }

    @Transactional
    public java.util.Map<String, String> setupPassword(SetupPasswordRequest request, HttpServletRequest httpRequest) {
        if (request.token() == null || request.token().isBlank()) {
            throw new BadRequestException("Setup token is required");
        }
        com.trustvault.model.PasswordSetupToken token = passwordSetupTokenRepository.findByTokenValue(request.token().trim())
                .orElseThrow(() -> new BadRequestException("Invalid or expired password setup link"));

        if (token.isUsed()) {
            throw new BadRequestException("This password setup link has already been used");
        }
        if (java.time.Instant.now().isAfter(token.getExpiresAt())) {
            throw new BadRequestException("This password setup link has expired. Please contact your administrator.");
        }
        if (request.newPassword() == null || request.newPassword().length() < 8) {
            throw new BadRequestException("New password must be at least 8 characters");
        }

        User user = token.getUser();
        if (!user.isActive()) {
            throw new com.trustvault.exception.ForbiddenException("Your account is deactivated. Contact your administrator.");
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        token.setUsed(true);
        passwordSetupTokenRepository.save(token);

        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);
        auditService.logEvent(user, AuditAction.USER_PASSWORD_CHANGED, "USER", user.getId().toString(),
                AuditResult.SUCCESS, "User completed password setup via onboarding token", clientIp, userAgent);

        return java.util.Map.of("message", "Password established successfully. You can now log in.");
    }
}
