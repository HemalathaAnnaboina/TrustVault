package com.trustvault.service;

import com.trustvault.dto.UserDtos.*;
import com.trustvault.exception.BadRequestException;
import com.trustvault.exception.ConflictException;
import com.trustvault.exception.ResourceNotFoundException;
import com.trustvault.model.AuditAction;
import com.trustvault.model.AuditResult;
import com.trustvault.model.Role;
import com.trustvault.model.User;
import com.trustvault.repository.UserRepository;
import com.trustvault.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;
    private final com.trustvault.repository.GroupMemberRepository groupMemberRepository;
    private final com.trustvault.repository.ProjectMemberRepository projectMemberRepository;
    private final com.trustvault.repository.DocumentPermissionRepository permissionRepository;
    private final com.trustvault.repository.ProjectRepository projectRepository;
    private final com.trustvault.repository.PasswordSetupTokenRepository passwordSetupTokenRepository;

    public UserService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            AuditService auditService,
            com.trustvault.repository.GroupMemberRepository groupMemberRepository,
            com.trustvault.repository.ProjectMemberRepository projectMemberRepository,
            com.trustvault.repository.DocumentPermissionRepository permissionRepository,
            com.trustvault.repository.ProjectRepository projectRepository,
            com.trustvault.repository.PasswordSetupTokenRepository passwordSetupTokenRepository
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
        this.groupMemberRepository = groupMemberRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.permissionRepository = permissionRepository;
        this.projectRepository = projectRepository;
        this.passwordSetupTokenRepository = passwordSetupTokenRepository;
    }

    @Transactional(readOnly = true)
    public List<EmployeeDirectoryDto> getEmployeeDirectory() {
        return userRepository.findAll().stream()
                .map(u -> {
                    List<String> groups = groupMemberRepository.findGroupNamesByUser(u);
                    int projectsCount = projectMemberRepository.findByUser(u).size();
                    int permsCount = (int) permissionRepository.countByUserAndStatus(u, com.trustvault.model.PermissionStatus.ACTIVE);
                    return new EmployeeDirectoryDto(
                            u.getId(),
                            u.getEmail(),
                            u.getFullName(),
                            u.getRole(),
                            u.isActive(),
                            groups,
                            projectsCount,
                            permsCount,
                            u.getCreatedAt()
                    );
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<UserDto> getAllUsers() {
        return userRepository.findAll().stream()
                .map(this::mapToDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public UserDto getUserById(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + id));
        return mapToDto(user);
    }

    @Transactional
    public UserDto createUser(CreateUserRequest request, User admin, HttpServletRequest httpRequest) {
        if (request.email() == null || request.email().isBlank()) {
            throw new BadRequestException("Corporate email is required");
        }
        if (request.fullName() == null || request.fullName().isBlank()) {
            throw new BadRequestException("Full name is required");
        }
        if (request.role() == null) {
            throw new BadRequestException("System role is required");
        }

        String email = request.email().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ConflictException("Email is already registered: " + email);
        }

        String rawPassword = request.password();
        if (rawPassword == null || rawPassword.isBlank()) {
            rawPassword = "TrustVault@" + UUID.randomUUID().toString().substring(0, 8) + "!9";
        } else {
            rawPassword = rawPassword.trim();
            if (rawPassword.length() < 8) {
                throw new BadRequestException("Password must be at least 8 characters");
            }
        }
        String encodedPassword = passwordEncoder.encode(rawPassword);
        User user = new User(email, encodedPassword, request.fullName().trim(), request.role(), true);
        User saved = userRepository.save(user);

        // Generate one-time 24-hour onboarding password setup token
        String setupTokenString = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
        com.trustvault.model.PasswordSetupToken setupToken = new com.trustvault.model.PasswordSetupToken(
                setupTokenString,
                saved,
                java.time.Instant.now().plus(24, java.time.temporal.ChronoUnit.HOURS)
        );
        passwordSetupTokenRepository.save(setupToken);
        String setupLink = "/setup-password?token=" + setupTokenString;

        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);
        auditService.logEvent(admin, AuditAction.USER_CREATED, "USER", saved.getId().toString(),
                AuditResult.SUCCESS, "Admin provisioned user: " + email + " with role: " + request.role(), clientIp, userAgent);

        List<String> projectNames = new java.util.ArrayList<>();
        if (request.initialProjectId() != null) {
            projectRepository.findById(request.initialProjectId()).ifPresent(project -> {
                com.trustvault.model.ProjectMember member = new com.trustvault.model.ProjectMember(project, saved, "Contributor");
                projectMemberRepository.save(member);
                projectNames.add(project.getName());
                auditService.logEvent(admin, AuditAction.PROJECT_MEMBER_ADDED, "PROJECT", project.getId().toString(),
                        AuditResult.SUCCESS, "Initial project assignment: Added " + email + " to " + project.getName(), clientIp, userAgent);
            });
        }

        return new UserDto(
                saved.getId(),
                saved.getEmail(),
                saved.getFullName(),
                saved.getRole(),
                saved.isActive(),
                saved.getCreatedAt(),
                projectNames,
                setupTokenString,
                setupLink,
                null
        );
    }

    @Transactional
    public UserDto updateUser(UUID id, UserUpdateRequest request, User admin, HttpServletRequest httpRequest) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + id));

        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        if (request.fullName() != null && !request.fullName().isBlank()) {
            user.setFullName(request.fullName().trim());
        }

        if (request.role() != null && request.role() != user.getRole()) {
            Role oldRole = user.getRole();
            user.setRole(request.role());
            auditService.logEvent(admin, AuditAction.USER_ROLE_CHANGED, "USER", user.getId().toString(),
                    AuditResult.SUCCESS, "Changed role from " + oldRole + " to " + request.role(), clientIp, userAgent);
        }

        if (request.active() != null && request.active() != user.isActive()) {
            if (!request.active()) {
                if (admin != null && admin.getId().equals(user.getId())) {
                    throw new BadRequestException("Administrators cannot deactivate their own account");
                }
                if (user.getRole() == Role.ROLE_ADMIN && userRepository.countByRoleAndActiveTrue(Role.ROLE_ADMIN) <= 1) {
                    throw new BadRequestException("Cannot deactivate the only active administrator account");
                }
            }
            user.setActive(request.active());
            AuditAction action = request.active() ? AuditAction.USER_ACTIVATED : AuditAction.USER_DEACTIVATED;
            auditService.logEvent(admin, action, "USER", user.getId().toString(),
                    AuditResult.SUCCESS, "Admin set user active=" + request.active(), clientIp, userAgent);
        }

        User updated = userRepository.save(user);
        return mapToDto(updated);
    }

    @Transactional
    public UserDto toggleUserStatus(UUID id, boolean active, User admin, HttpServletRequest httpRequest) {
        return updateUser(id, new UserUpdateRequest(null, null, active), admin, httpRequest);
    }

    private UserDto mapToDto(User u) {
        List<String> projectNames = projectMemberRepository.findByUser(u).stream()
                .filter(pm -> pm != null && pm.getProject() != null)
                .map(pm -> pm.getProject().getName())
                .toList();
        return new UserDto(
                u.getId(),
                u.getEmail(),
                u.getFullName(),
                u.getRole(),
                u.isActive(),
                u.getCreatedAt(),
                projectNames
        );
    }
}
