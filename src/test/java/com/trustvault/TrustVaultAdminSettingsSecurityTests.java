package com.trustvault;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.trustvault.dto.GroupDtos.CreateGroupRequest;
import com.trustvault.dto.UserDtos.UserUpdateRequest;
import com.trustvault.model.*;
import com.trustvault.repository.*;
import com.trustvault.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public class TrustVaultAdminSettingsSecurityTests {

        @Autowired
        private MockMvc mockMvc;

        @Autowired
        private ObjectMapper objectMapper;

        @Autowired
        private UserRepository userRepository;

        @Autowired
        private DocumentRepository documentRepository;

        @Autowired
        private DocumentPermissionRepository permissionRepository;

        @Autowired
        private SystemSettingRepository systemSettingRepository;

        @Autowired
        private AuditLogRepository auditLogRepository;

        @Autowired
        private JwtTokenProvider jwtTokenProvider;

        private User admin;
        private User owner;
        private User sita;

        private String adminToken;
        private String ownerToken;
        private String sitaToken;

        private Document sampleDoc;

        @BeforeEach
        void setUp() {
                admin = userRepository.findByEmailIgnoreCase("admin@trustvault.local").orElseThrow();
                owner = userRepository.findByEmailIgnoreCase("owner@trustvault.local").orElseThrow();
                sita = userRepository.findByEmailIgnoreCase("sita@trustvault.local").orElseThrow();

                // Ensure accounts are active
                admin.setActive(true);
                userRepository.save(admin);
                sita.setActive(true);
                userRepository.save(sita);

                adminToken = jwtTokenProvider.generateToken(admin);
                ownerToken = jwtTokenProvider.generateToken(owner);
                sitaToken = jwtTokenProvider.generateToken(sita);

                sampleDoc = documentRepository.findAll().stream().findFirst().orElseThrow();
        }

        @Test
        @DisplayName("1. Viewer/Workshop members cannot access administrative settings endpoints")
        void test01_viewerCannotAccessAdminSettings() throws Exception {
                // GET /api/admin/settings
                mockMvc.perform(get("/api/admin/settings")
                                .header("Authorization", "Bearer " + sitaToken))
                                .andExpect(status().isForbidden());

                // PUT /api/admin/settings
                mockMvc.perform(put("/api/admin/settings")
                                .header("Authorization", "Bearer " + sitaToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of("maxUploadSizeMb", 100))))
                                .andExpect(status().isForbidden());

                // POST /api/admin/settings/reset
                mockMvc.perform(post("/api/admin/settings/reset")
                                .header("Authorization", "Bearer " + sitaToken))
                                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("2. Viewer/Workshop members cannot access administrative user endpoints or audit logs")
        void test02_viewerCannotAccessAdminUsersOrAuditLogs() throws Exception {
                // GET /api/admin/users
                mockMvc.perform(get("/api/admin/users")
                                .header("Authorization", "Bearer " + sitaToken))
                                .andExpect(status().isForbidden());

                // GET /api/audit-logs
                mockMvc.perform(get("/api/audit-logs")
                                .header("Authorization", "Bearer " + sitaToken))
                                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("3. Viewer/Workshop members cannot create groups or assign themselves as owners")
        void test03_viewerCannotCreateGroups() throws Exception {
                CreateGroupRequest req = new CreateGroupRequest("Malicious Group", "Attempted creation", "IT", null);

                mockMvc.perform(post("/api/groups")
                                .header("Authorization", "Bearer " + sitaToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("4. Admin can retrieve and persist general system configuration settings")
        void test04_adminSettingsPersistenceAndAudit() throws Exception {
                // Read defaults
                mockMvc.perform(get("/api/admin/settings")
                                .header("Authorization", "Bearer " + adminToken))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.systemName").isNotEmpty())
                                .andExpect(jsonPath("$.maxUploadSizeMb").value("50"))
                                .andExpect(jsonPath("$.sessionTimeoutMinutes").value("60"))
                                .andExpect(jsonPath("$.defaultPageSize").value("20"));

                // Update settings
                Map<String, Object> updates = Map.of(
                                "systemName", "TrustVault Financial Operations",
                                "maxUploadSizeMb", 100,
                                "sessionTimeoutMinutes", 120,
                                "defaultPageSize", 25);

                mockMvc.perform(put("/api/admin/settings")
                                .header("Authorization", "Bearer " + adminToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(updates)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.systemName").value("TrustVault Financial Operations"))
                                .andExpect(jsonPath("$.maxUploadSizeMb").value("100"))
                                .andExpect(jsonPath("$.sessionTimeoutMinutes").value("120"))
                                .andExpect(jsonPath("$.defaultPageSize").value("25"));

                // Verify audit event
                AuditLog latest = auditLogRepository.findTopByOrderByTimestampDesc().orElseThrow();
                assertThat(latest.getAction()).isEqualTo(AuditAction.SYSTEM_SETTING_UPDATED);
                assertThat(latest.getResult()).isEqualTo(AuditResult.SUCCESS);
                assertThat(latest.getActorEmail()).isEqualTo("admin@trustvault.local");
        }

        @Test
        @DisplayName("5. Server-side validation rejects invalid configuration parameters")
        void test05_settingsServerSideValidation() throws Exception {
                // Upload limit exceeding 500 MB
                mockMvc.perform(put("/api/admin/settings")
                                .header("Authorization", "Bearer " + adminToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of("maxUploadSizeMb", 1000))))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.message").value("Max upload size must be between 1 and 500 MB"));

                // Session timeout exceeding 1440 minutes
                mockMvc.perform(put("/api/admin/settings")
                                .header("Authorization", "Bearer " + adminToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of("sessionTimeoutMinutes", 5000))))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.message")
                                                .value("Session timeout must be between 5 and 1440 minutes"));

                // Default page size less than 5
                mockMvc.perform(put("/api/admin/settings")
                                .header("Authorization", "Bearer " + adminToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of("defaultPageSize", 2))))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.message").value("Default page size must be between 5 and 100"));
        }

        @Test
        @DisplayName("6. Admin can reset settings to factory defaults")
        void test06_resetSettingsRestoresDefaults() throws Exception {
                mockMvc.perform(post("/api/admin/settings/reset")
                                .header("Authorization", "Bearer " + adminToken))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.systemName").value("TrustVault Enterprise Vault"))
                                .andExpect(jsonPath("$.maxUploadSizeMb").value(50));
        }

        @Test
        @DisplayName("7. System protects against demoting or deactivating the last active administrator")
        void test07_lastAdminDemotionProtection() throws Exception {
                // Attempting to demote the sole active admin
                UserUpdateRequest demoteReq = new UserUpdateRequest(null, Role.ROLE_VIEWER, null);

                mockMvc.perform(put("/api/admin/users/" + admin.getId())
                                .header("Authorization", "Bearer " + adminToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(demoteReq)))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.message")
                                                .value("Cannot demote the only active administrator account"));

                // Attempting to deactivate own admin account
                UserUpdateRequest deactivateReq = new UserUpdateRequest(null, null, false);
                mockMvc.perform(put("/api/admin/users/" + admin.getId())
                                .header("Authorization", "Bearer " + adminToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(deactivateReq)))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.message")
                                                .value("Administrators cannot deactivate their own account"));
        }

        @Test
        @DisplayName("8. Account suspension immediately denies all document access across all projects")
        void test08_accountSuspensionImmediatelyBlocksAccess() throws Exception {
                // Suspend Sita's user account
                mockMvc.perform(patch("/api/admin/users/" + sita.getId() + "/status")
                                .header("Authorization", "Bearer " + adminToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of("active", false))))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.active").value(false));

                // Sita now immediately denied document listing
                mockMvc.perform(get("/api/documents")
                                .header("Authorization", "Bearer " + sitaToken))
                                .andExpect(status().isForbidden())
                                .andExpect(jsonPath("$.message")
                                                .value("Your account is deactivated. Contact your administrator."));

                // Sita denied document metadata
                mockMvc.perform(get("/api/documents/" + sampleDoc.getId())
                                .header("Authorization", "Bearer " + sitaToken))
                                .andExpect(status().isForbidden())
                                .andExpect(jsonPath("$.message")
                                                .value("Your account is deactivated. Contact your administrator."));

                // Reactivate Sita
                mockMvc.perform(patch("/api/admin/users/" + sita.getId() + "/status")
                                .header("Authorization", "Bearer " + adminToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of("active", true))))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.active").value(true));
        }
}
