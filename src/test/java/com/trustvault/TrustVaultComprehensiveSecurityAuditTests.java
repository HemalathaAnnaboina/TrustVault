package com.trustvault;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.trustvault.dto.AccessRequestDtos.CreateAccessRequest;
import com.trustvault.dto.AccessRequestDtos.ReviewAccessRequest;
import com.trustvault.dto.GroupDtos.CreateGroupRequest;
import com.trustvault.dto.PermissionDtos.GrantPermissionRequest;
import com.trustvault.dto.ProjectDtos.AddMemberRequest;
import com.trustvault.dto.ProjectDtos.MemberPermissionAssignmentDto;
import com.trustvault.dto.ProjectDtos.ShareDocumentRequest;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public class TrustVaultComprehensiveSecurityAuditTests {

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
    private ProjectRepository projectRepository;

    @Autowired
    private AccessRequestRepository accessRequestRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    private User admin;
    private User manager;
    private User viewer;
    private User outsideUser;
    private Project testProject;
    private Document testDoc;

    @BeforeEach
    void setUp() {
        admin = userRepository.findByEmailIgnoreCase("admin@trustvault.local").orElseThrow();
        manager = userRepository.findByEmailIgnoreCase("owner@trustvault.local").orElseThrow();
        viewer = userRepository.findByEmailIgnoreCase("sita@trustvault.local").orElseThrow();
        outsideUser = userRepository.findByEmailIgnoreCase("clientb_user@trustvault.local").orElseThrow();

        testProject = projectRepository.findAll().stream()
                .filter(p -> p.getName().equalsIgnoreCase("College Project"))
                .findFirst().orElseThrow();

        testDoc = documentRepository.findAll().stream()
                .filter(d -> d.getTitle().equalsIgnoreCase("Internal Report.pdf"))
                .findFirst().orElseThrow();

        // Ensure viewer strictly has no permission grants on testDoc
        permissionRepository.findByDocumentAndUser(testDoc, viewer).ifPresent(permissionRepository::delete);
    }

    private String token(User user) {
        return "Bearer " + jwtTokenProvider.generateToken(user);
    }

    @Test
    @DisplayName("1. JWT Secret fail-fast prevents startup with weak/missing secret")
    void testJwtWeakSecretFailFast() {
        assertThatThrownBy(() -> new JwtTokenProvider(null, 3600000))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("at least 32 characters long");

        assertThatThrownBy(() -> new JwtTokenProvider("short-secret-key", 3600000))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("at least 32 characters long");

        JwtTokenProvider validProvider = new JwtTokenProvider("this-is-a-valid-at-least-32-chars-long-secret-key!!", 3600000);
        assertThat(validProvider).isNotNull();
    }

    @Test
    @DisplayName("2. HTTP Security headers configured properly on responses")
    void testSecurityHeadersPresentOnResponses() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none';"))
                .andExpect(header().string("Referrer-Policy", "strict-origin-when-cross-origin"));
    }

    @Test
    @DisplayName("3. Workshop Member/Viewer cannot access audit logs")
    void testWorkshopMemberCannotAccessAuditLogs() throws Exception {
        mockMvc.perform(get("/api/audit-logs")
                        .header("Authorization", token(viewer)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/audit-logs/my-activity")
                        .header("Authorization", token(viewer)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/audit-logs/recent")
                        .header("Authorization", token(viewer)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("4. Manager and Admin can access audit logs")
    void testManagerAndAdminCanAccessAuditLogs() throws Exception {
        mockMvc.perform(get("/api/audit-logs")
                        .header("Authorization", token(manager)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/audit-logs")
                        .header("Authorization", token(admin)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("5. Workshop Member/Viewer cannot create or manage groups")
    void testWorkshopMemberCannotCreateGroup() throws Exception {
        CreateGroupRequest req = new CreateGroupRequest("Malicious Group", "Description", "Eng", List.of());
        mockMvc.perform(post("/api/groups")
                        .header("Authorization", token(viewer))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("6. Manager can create groups")
    void testManagerCanCreateGroup() throws Exception {
        CreateGroupRequest req = new CreateGroupRequest("Audit Group " + UUID.randomUUID(), "Description", "Eng", List.of());
        mockMvc.perform(post("/api/groups")
                        .header("Authorization", token(manager))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("7. Workshop Member/Viewer cannot add project members")
    void testWorkshopMemberCannotAddProjectMembers() throws Exception {
        AddMemberRequest req = new AddMemberRequest("clientb_user@trustvault.local", "Observer", true, false, List.of(), 30);
        mockMvc.perform(post("/api/projects/" + testProject.getId() + "/members")
                        .header("Authorization", token(viewer))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("8. Workshop Member/Viewer cannot share documents via project")
    void testWorkshopMemberCannotShareProjectDocuments() throws Exception {
        ShareDocumentRequest req = new ShareDocumentRequest(
                testDoc.getId(),
                List.of(new MemberPermissionAssignmentDto(viewer.getEmail(), PermissionLevel.EDIT, null, 30))
        );
        mockMvc.perform(post("/api/projects/" + testProject.getId() + "/share")
                        .header("Authorization", token(viewer))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("9. Workshop Member/Viewer cannot grant or revoke document permissions")
    void testWorkshopMemberCannotManagePermissions() throws Exception {
        GrantPermissionRequest req = new GrantPermissionRequest(outsideUser.getEmail(), PermissionLevel.EDIT, null, 30);
        mockMvc.perform(post("/api/documents/" + testDoc.getId() + "/permissions")
                        .header("Authorization", token(viewer))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/permissions/" + UUID.randomUUID())
                        .header("Authorization", token(viewer)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("10. Self-approval of access requests is strictly prevented")
    void testSelfApprovalOfAccessRequestBlocked() throws Exception {
        AccessRequest req = new AccessRequest(testDoc, testProject, null, manager, PermissionLevel.READ, "Need to inspect", 30);
        req = accessRequestRepository.save(req);

        ReviewAccessRequest review = new ReviewAccessRequest(true, "I approve my own request", null, 30, null, PermissionLevel.READ);
        mockMvc.perform(post("/api/requests/" + req.getId() + "/review")
                        .header("Authorization", token(manager))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(review)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("11. Regular Viewer cannot review access requests")
    void testViewerCannotReviewAccessRequests() throws Exception {
        AccessRequest req = new AccessRequest(testDoc, testProject, null, outsideUser, PermissionLevel.READ, "Need to inspect", 30);
        req = accessRequestRepository.save(req);

        ReviewAccessRequest review = new ReviewAccessRequest(true, "Viewer approving", null, 30, null, PermissionLevel.READ);
        mockMvc.perform(post("/api/requests/" + req.getId() + "/review")
                        .header("Authorization", token(viewer))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(review)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("12. IDOR / Cross-project document access blocked for unpermitted user")
    void testIDORCrossProjectDocumentAccessBlocked() throws Exception {
        mockMvc.perform(get("/api/documents/" + testDoc.getId())
                        .header("Authorization", token(outsideUser)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/documents/" + testDoc.getId() + "/preview")
                        .header("Authorization", token(outsideUser)))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/documents/" + testDoc.getId() + "/download-token")
                        .header("Authorization", token(outsideUser)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("13. Dynamic permission expiry immediately denies access")
    void testExpiredPermissionDeniesAccessImmediately() throws Exception {
        DocumentPermission expiredPerm = new DocumentPermission(
                testDoc,
                viewer,
                PermissionLevel.READ,
                manager,
                Instant.now().minusSeconds(3600) // expired 1 hour ago
        );
        permissionRepository.save(expiredPerm);

        mockMvc.perform(get("/api/documents/" + testDoc.getId())
                        .header("Authorization", token(viewer)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/documents/" + testDoc.getId() + "/preview")
                        .header("Authorization", token(viewer)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("14. Path traversal in upload filename is rejected with 400 Bad Request")
    void testMaliciousPathTraversalFilenameUploadRejected() throws Exception {
        MockMultipartFile traversalFile = new MockMultipartFile(
                "file",
                "../../../../etc/passwd.pdf",
                "application/pdf",
                "%PDF-1.4 Mock valid pdf bytes".getBytes()
        );

        mockMvc.perform(multipart("/api/documents/upload")
                        .file(traversalFile)
                        .param("projectId", testProject.getId().toString())
                        .header("Authorization", token(manager)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("15. Dangerous executable file upload rejected with 400 Bad Request")
    void testExecutableFileTypeUploadRejected() throws Exception {
        MockMultipartFile exeFile = new MockMultipartFile(
                "file",
                "payload.exe",
                "application/octet-stream",
                "MZ\0\0\0executable".getBytes()
        );

        mockMvc.perform(multipart("/api/documents/upload")
                        .file(exeFile)
                        .param("projectId", testProject.getId().toString())
                        .header("Authorization", token(manager)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("16. Admin Settings endpoint is restricted to ROLE_ADMIN")
    void testSettingsEndpointRestrictedToAdmin() throws Exception {
        mockMvc.perform(get("/api/admin/settings")
                        .header("Authorization", token(viewer)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/admin/settings")
                        .header("Authorization", token(manager)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/admin/settings")
                        .header("Authorization", token(admin)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("17. Manager Stats endpoint is restricted to managers/admins")
    void testStatsManagerEndpointRestricted() throws Exception {
        mockMvc.perform(get("/api/stats/manager")
                        .header("Authorization", token(viewer)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/stats/manager")
                        .header("Authorization", token(manager)))
                .andExpect(status().isOk());
    }
}
