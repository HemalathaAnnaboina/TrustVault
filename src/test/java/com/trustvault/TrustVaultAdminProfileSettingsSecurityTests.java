package com.trustvault;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.trustvault.dto.AuthDtos.ChangePasswordRequest;
import com.trustvault.dto.AuthDtos.LoginRequest;
import com.trustvault.dto.AuthDtos.UpdateProfileRequest;
import com.trustvault.model.*;
import com.trustvault.repository.AuditLogRepository;
import com.trustvault.repository.UserRepository;
import com.trustvault.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public class TrustVaultAdminProfileSettingsSecurityTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User admin;
    private User sita;
    private String adminToken;
    private String sitaToken;

    @BeforeEach
    void setUp() {
        admin = userRepository.findByEmailIgnoreCase("admin@trustvault.local").orElseGet(() ->
                userRepository.save(new User("admin@trustvault.local", passwordEncoder.encode("AdminPass123!"), "Sarah Admin", Role.ROLE_ADMIN, true)));

        // Ensure password is reset to AdminPass123! before each test
        admin.setPasswordHash(passwordEncoder.encode("AdminPass123!"));
        admin.setActive(true);
        admin.setFullName("Sarah Admin");
        admin = userRepository.save(admin);

        sita = userRepository.findByEmailIgnoreCase("sita@trustvault.local").orElseGet(() ->
                userRepository.save(new User("sita@trustvault.local", passwordEncoder.encode("SitaPass123!"), "Sita Member", Role.ROLE_WORKSHOP_MEMBER, true)));

        adminToken = jwtTokenProvider.generateToken(admin);
        sitaToken = jwtTokenProvider.generateToken(sita);
    }

    @Test
    @DisplayName("1. Admin profile retrieval includes timestamps, role, and active status")
    void test01_adminProfileRetrievalWithTimestamps() throws Exception {
        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("admin@trustvault.local"))
                .andExpect(jsonPath("$.fullName").value("Sarah Admin"))
                .andExpect(jsonPath("$.role").value("ROLE_ADMIN"))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.passwordLastChangedAt").isNotEmpty());

        mockMvc.perform(get("/api/auth/profile")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("admin@trustvault.local"))
                .andExpect(jsonPath("$.fullName").value("Sarah Admin"));
    }

    @Test
    @DisplayName("2. Admin can update personal profile full name and action is audited")
    void test02_adminUpdateProfileFullName() throws Exception {
        UpdateProfileRequest updateRequest = new UpdateProfileRequest("Sarah Executive Admin");

        mockMvc.perform(put("/api/auth/profile")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Sarah Executive Admin"))
                .andExpect(jsonPath("$.email").value("admin@trustvault.local"))
                .andExpect(jsonPath("$.role").value("ROLE_ADMIN"));

        User refreshed = userRepository.findByEmailIgnoreCase("admin@trustvault.local").orElseThrow();
        assertThat(refreshed.getFullName()).isEqualTo("Sarah Executive Admin");

        // Verify audit log
        AuditLog latest = auditLogRepository.findTopByOrderByTimestampDesc().orElseThrow();
        assertThat(latest.getAction()).isEqualTo(AuditAction.USER_UPDATED);
        assertThat(latest.getResult()).isEqualTo(AuditResult.SUCCESS);
        assertThat(latest.getActorEmail()).isEqualTo("admin@trustvault.local");
    }

    @Test
    @DisplayName("3. Profile update enforces input validation on full name")
    void test03_adminUpdateProfileValidation() throws Exception {
        // Blank name
        mockMvc.perform(put("/api/auth/profile")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateProfileRequest("   "))))
                .andExpect(status().isBadRequest());

        // Name too short (< 2 characters)
        mockMvc.perform(put("/api/auth/profile")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateProfileRequest("A"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("4. Change password verifies old credentials, updates hash, and supports re-authentication")
    void test04_changePasswordSuccessAndReAuthentication() throws Exception {
        ChangePasswordRequest changeReq = new ChangePasswordRequest("AdminPass123!", "NewAdminSecure2026!");

        mockMvc.perform(post("/api/auth/change-password")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(changeReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Password changed successfully"));

        // Verify audit event
        AuditLog latest = auditLogRepository.findTopByOrderByTimestampDesc().orElseThrow();
        assertThat(latest.getAction()).isEqualTo(AuditAction.USER_PASSWORD_CHANGED);
        assertThat(latest.getResult()).isEqualTo(AuditResult.SUCCESS);

        // Subsequent login with NEW password must succeed
        LoginRequest newLogin = new LoginRequest("admin@trustvault.local", "NewAdminSecure2026!");
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newLogin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());

        // Login with OLD password must be rejected
        LoginRequest oldLogin = new LoginRequest("admin@trustvault.local", "AdminPass123!");
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(oldLogin)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("5. Change password rejects incorrect current password")
    void test05_changePasswordRejectsWrongCurrentPassword() throws Exception {
        ChangePasswordRequest wrongOldPass = new ChangePasswordRequest("WrongPassword123!", "ValidNewPass123!");

        mockMvc.perform(post("/api/auth/change-password")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(wrongOldPass)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("6. Change password rejects new password under 8 characters")
    void test06_changePasswordRejectsShortPassword() throws Exception {
        ChangePasswordRequest shortPass = new ChangePasswordRequest("AdminPass123!", "short");

        mockMvc.perform(post("/api/auth/change-password")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(shortPass)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("7. Unauthenticated requests to profile and password endpoints return 401")
    void test07_unauthenticatedAccessBlocked() throws Exception {
        mockMvc.perform(get("/api/auth/profile"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(put("/api/auth/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateProfileRequest("Anonymous Attacker"))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/auth/change-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ChangePasswordRequest("test", "test1234"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("8. Workspace members cannot change password through profile settings")
    void test08_workspaceUserCannotChangePasswordThroughSettings() throws Exception {
        ChangePasswordRequest req = new ChangePasswordRequest("SitaPass123!", "NewSitaPass123!");

        mockMvc.perform(post("/api/auth/change-password")
                        .header("Authorization", "Bearer " + sitaToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());
    }
}
