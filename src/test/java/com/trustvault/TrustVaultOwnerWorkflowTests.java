package com.trustvault;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.trustvault.dto.GroupDtos.*;
import com.trustvault.dto.PermissionDtos.*;
import com.trustvault.dto.ProjectDtos.*;
import com.trustvault.model.*;
import com.trustvault.repository.*;
import com.trustvault.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public class TrustVaultOwnerWorkflowTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private DocumentRepository documentRepository;
    @Autowired private DocumentPermissionRepository permissionRepository;
    @Autowired private GroupRepository groupRepository;
    @Autowired private GroupMemberRepository groupMemberRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtTokenProvider jwtTokenProvider;
    @Autowired private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    private User owner;
    private User viewer1;
    private User viewer2;
    private String ownerToken;
    private Document doc1;
    private Document doc2;

    @BeforeEach
    void setUp() {
        owner = userRepository.findByEmailIgnoreCase("owner@trustvault.local").orElseThrow();
        viewer1 = userRepository.findByEmailIgnoreCase("viewer@trustvault.local").orElseThrow();
        viewer2 = userRepository.findByEmailIgnoreCase("alex@trustvault.local").orElseThrow();

        ownerToken = "Bearer " + jwtTokenProvider.generateToken(owner);

        List<Document> docs = documentRepository.findByOwnerOrderByCreatedAtDesc(owner);
        doc1 = docs.get(0);
        doc2 = docs.get(1);
    }

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM tv_document_permissions WHERE document_id = ?", doc1.getId());
        jdbcTemplate.update("DELETE FROM tv_document_permissions WHERE user_id = ?", viewer2.getId());
    }

    @Test
    @DisplayName("1. Owner creates a group and adds members")
    void testGroupLifecycle() throws Exception {
        CreateGroupRequest createReq = new CreateGroupRequest(
                "Security Operations", "Core SecOps and review team", "Security",
                List.of(viewer1.getEmail())
        );

        String response = mockMvc.perform(post("/api/groups")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Security Operations"))
                .andExpect(jsonPath("$.memberCount").value(1))
                .andReturn().getResponse().getContentAsString();

        GroupDto groupDto = objectMapper.readValue(response, GroupDto.class);
        UUID groupId = groupDto.id();

        // Add second member
        AddMembersRequest addReq = new AddMembersRequest(List.of(viewer2.getEmail()), null);
        mockMvc.perform(post("/api/groups/" + groupId + "/members")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(addReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.memberCount").value(2));

        // Get groups list
        mockMvc.perform(get("/api/groups")
                        .header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    @DisplayName("2. Owner accesses Employee Directory with real group and permission counts")
    void testEmployeeDirectory() throws Exception {
        Group group = groupRepository.save(new Group("Engineering", "Dev team", "Tech", owner));
        groupMemberRepository.save(new GroupMember(group, viewer1));

        mockMvc.perform(get("/api/users")
                        .header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(4))))
                .andExpect(jsonPath("$[?(@.email == 'viewer@trustvault.local')].groups", not(empty())));
    }

    @Test
    @DisplayName("3. Owner assigns file access to multiple employees in one workflow")
    void testBulkPermissionAssignment() throws Exception {
        Instant in30Days = Instant.now().plusSeconds(30L * 24 * 3600);
        BulkGrantRequest bulkReq = new BulkGrantRequest(
                List.of(doc1.getId(), doc2.getId()),
                List.of(
                        new BulkAssignment(viewer1.getEmail(), PermissionLevel.READ, in30Days),
                        new BulkAssignment(viewer2.getEmail(), PermissionLevel.EDIT, null)
                )
        );

        mockMvc.perform(post("/api/permissions/bulk")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(bulkReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalProcessed").value(4))
                .andExpect(jsonPath("$.successful").value(4))
                .andExpect(jsonPath("$.failed").value(0));

        // Verify owner permissions list returns grants
        mockMvc.perform(get("/api/permissions/owner")
                        .header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(4))));
    }

    @Test
    @DisplayName("4. Owner updates an existing permission level and expiry")
    void testUpdatePermission() throws Exception {
        GrantPermissionRequest grantReq = new GrantPermissionRequest(viewer1.getEmail(), PermissionLevel.READ, null);
        String grantResp = mockMvc.perform(post("/api/documents/" + doc1.getId() + "/permissions")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(grantReq)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        PermissionDto perm = objectMapper.readValue(grantResp, PermissionDto.class);

        Instant newExpiry = Instant.now().plusSeconds(14L * 24 * 3600);
        UpdatePermissionRequest updateReq = new UpdatePermissionRequest(PermissionLevel.EDIT, newExpiry);

        mockMvc.perform(put("/api/permissions/" + perm.id())
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.permissionLevel").value("EDIT"))
                .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    @DisplayName("5. Manager adds team member with responsibility and removes member")
    void testProjectMemberLifecycleWithResponsibility() throws Exception {
        Project project = projectRepository.save(new Project("Team Alpha Project", "Confidential testing project", owner));

        // Add member with "Lead Engineer" responsibility
        AddMemberRequest addReq = new AddMemberRequest(viewer1.getEmail(), "Lead Engineer");
        String addResp = mockMvc.perform(post("/api/projects/" + project.getId() + "/members")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(addReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userEmail").value(viewer1.getEmail()))
                .andExpect(jsonPath("$.responsibility").value("Lead Engineer"))
                .andReturn().getResponse().getContentAsString();

        ProjectMemberDto member = objectMapper.readValue(addResp, ProjectMemberDto.class);

        // Verify member in project members list
        mockMvc.perform(get("/api/projects/" + project.getId() + "/members")
                        .header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].responsibility").value("Lead Engineer"));

        // Remove member
        mockMvc.perform(delete("/api/projects/" + project.getId() + "/members/" + member.id())
                        .header("Authorization", ownerToken))
                .andExpect(status().isNoContent());

        // Verify empty members list
        mockMvc.perform(get("/api/projects/" + project.getId() + "/members")
                        .header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("6. Manager can access and filter audit logs")
    void testManagerCanAccessAndFilterAuditLogs() throws Exception {
        mockMvc.perform(get("/api/audit-logs")
                        .header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());

        mockMvc.perform(get("/api/audit-logs?action=LOGIN_SUCCESS")
                        .header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());

        mockMvc.perform(get("/api/audit-logs/verify-integrity")
                        .header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(true));
    }

    @Test
    @DisplayName("7. User password change with validation")
    void testChangePasswordLifecycle() throws Exception {
        com.trustvault.dto.AuthDtos.ChangePasswordRequest wrongOldPass =
                new com.trustvault.dto.AuthDtos.ChangePasswordRequest("WrongPass123!", "NewSecretPass2025!");

        mockMvc.perform(post("/api/auth/change-password")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(wrongOldPass)))
                .andExpect(status().isBadRequest());

        com.trustvault.dto.AuthDtos.ChangePasswordRequest validChange =
                new com.trustvault.dto.AuthDtos.ChangePasswordRequest("TrustVault@2025!", "UpdatedOwnerPass2025!");

        mockMvc.perform(post("/api/auth/change-password")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validChange)))
                .andExpect(status().isOk());

        // Restore original password
        com.trustvault.dto.AuthDtos.ChangePasswordRequest restoreChange =
                new com.trustvault.dto.AuthDtos.ChangePasswordRequest("UpdatedOwnerPass2025!", "TrustVault@2025!");

        mockMvc.perform(post("/api/auth/change-password")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(restoreChange)))
                .andExpect(status().isOk());
    }
}
