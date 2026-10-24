package com.trustvault;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.trustvault.dto.DocumentDtos.DocumentUpdateRequest;
import com.trustvault.dto.PermissionDtos.GrantPermissionRequest;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public class TrustVaultSecurityAuditVerificationTests {

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
    private ProjectMemberRepository projectMemberRepository;

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private Client clientA;
    private Client clientB;

    private User userClientA_Owner;
    private User userClientA_Viewer;
    private User userClientA_Editor;
    private User userClientB_Viewer;
    private User adminUser;

    private Project projectA;
    private Project projectB;

    private Document docClientA_PermittedRead;
    private Document docClientA_PermittedEdit;
    private Document docClientA_NoPermission;
    private Document docClientB_Secret;

    private String tokenA_Owner;
    private String tokenA_Viewer;
    private String tokenA_Editor;
    private String tokenB_Viewer;
    private String tokenAdmin;

    @BeforeEach
    void setUp() {
        // Setup Clients
        clientA = clientRepository.findByCode("CLIENT_PRIMARY").orElseGet(() ->
                clientRepository.save(new Client(UUID.fromString("11111111-1111-1111-1111-111111111111"), "Client A Corp", "CLIENT_PRIMARY")));

        clientB = clientRepository.findByCode("CLIENT_BETA").orElseGet(() ->
                clientRepository.save(new Client(UUID.fromString("22222222-2222-2222-2222-222222222222"), "Client B Corp", "CLIENT_BETA")));

        // Setup Users
        userClientA_Owner = userRepository.findByEmailIgnoreCase("owner@trustvault.local").orElseThrow();
        userClientA_Viewer = userRepository.findByEmailIgnoreCase("sita@trustvault.local").orElseThrow();
        userClientA_Editor = userRepository.findByEmailIgnoreCase("alex@trustvault.local").orElseThrow();
        userClientB_Viewer = userRepository.findByEmailIgnoreCase("clientb_user@trustvault.local").orElseThrow();
        adminUser = userRepository.findByEmailIgnoreCase("admin@trustvault.local").orElseThrow();

        // Ensure Clients on users
        userClientA_Owner.setClient(clientA);
        userRepository.save(userClientA_Owner);
        userClientA_Viewer.setClient(clientA);
        userClientA_Viewer.setActive(true);
        userRepository.save(userClientA_Viewer);
        userClientA_Editor.setClient(clientA);
        userRepository.save(userClientA_Editor);
        userClientB_Viewer.setClient(clientB);
        userRepository.save(userClientB_Viewer);

        // Tokens
        tokenA_Owner = "Bearer " + jwtTokenProvider.generateToken(userClientA_Owner);
        tokenA_Viewer = "Bearer " + jwtTokenProvider.generateToken(userClientA_Viewer);
        tokenA_Editor = "Bearer " + jwtTokenProvider.generateToken(userClientA_Editor);
        tokenB_Viewer = "Bearer " + jwtTokenProvider.generateToken(userClientB_Viewer);
        tokenAdmin = "Bearer " + jwtTokenProvider.generateToken(adminUser);

        // Projects
        projectA = projectRepository.findAll().stream()
                .filter(p -> p.getName().equalsIgnoreCase("College Project"))
                .findFirst().orElseThrow();

        projectB = projectRepository.findAll().stream()
                .filter(p -> p.getClient() != null && p.getClient().getId().equals(clientB.getId()))
                .findFirst().orElseGet(() -> {
                    Project p = new Project("Client B Secure Project", "Confidential", userClientB_Viewer);
                    p.setClient(clientB);
                    return projectRepository.save(p);
                });

        // Ensure Sita active member of projectA
        ProjectMember pm = projectMemberRepository.findByProjectAndUser(projectA, userClientA_Viewer).orElseGet(() ->
                projectMemberRepository.save(new ProjectMember(projectA, userClientA_Viewer, "Contributor", true, false)));
        pm.setStatus("ACTIVE");
        pm.setCanView(true);
        projectMemberRepository.save(pm);

        // Documents
        docClientA_PermittedRead = documentRepository.findAll().stream()
                .filter(d -> d.getTitle().equalsIgnoreCase("College Guidelines.pdf")
                        || (d.getOriginalFilename() != null && d.getOriginalFilename().equalsIgnoreCase("College Guidelines.pdf")))
                .findFirst().orElseThrow();
        docClientA_PermittedRead.setTitle("College Guidelines.pdf");
        docClientA_PermittedRead.setClient(clientA);
        docClientA_PermittedRead.setProject(projectA);
        documentRepository.save(docClientA_PermittedRead);

        docClientA_PermittedEdit = documentRepository.findAll().stream()
                .filter(d -> d.getTitle().equalsIgnoreCase("Exam Results.xlsx")
                        || d.getTitle().equalsIgnoreCase("Exam Results 2026")
                        || (d.getOriginalFilename() != null && d.getOriginalFilename().equalsIgnoreCase("Exam Results.xlsx")))
                .findFirst().orElseThrow();
        docClientA_PermittedEdit.setTitle("Exam Results.xlsx");
        docClientA_PermittedEdit.setClient(clientA);
        docClientA_PermittedEdit.setProject(projectA);
        documentRepository.save(docClientA_PermittedEdit);

        docClientA_NoPermission = documentRepository.findAll().stream()
                .filter(d -> d.getTitle().equalsIgnoreCase("Internal Report.pdf")
                        || (d.getOriginalFilename() != null && d.getOriginalFilename().equalsIgnoreCase("Internal Report.pdf")))
                .findFirst().orElseThrow();
        docClientA_NoPermission.setTitle("Internal Report.pdf");
        docClientA_NoPermission.setClient(clientA);
        docClientA_NoPermission.setProject(projectA);
        documentRepository.save(docClientA_NoPermission);

        docClientB_Secret = documentRepository.findAll().stream()
                .filter(d -> d.getClient() != null && d.getClient().getId().equals(clientB.getId()))
                .findFirst().orElseGet(() -> {
                    Document d = new Document(
                            "Client B Secret Patent.pdf",
                            "patent.pdf",
                            "mock-storage-key-clientb",
                            "application/pdf",
                            1024L,
                            "mock-sha256-clientb",
                            "Legal",
                            userClientB_Viewer,
                            projectB
                    );
                    d.setClient(clientB);
                    return documentRepository.save(d);
                });

        // Permissions for userClientA_Viewer (Sita)
        // 1. Permitted Read
        DocumentPermission permRead = permissionRepository.findByDocumentAndUser(docClientA_PermittedRead, userClientA_Viewer)
                .orElseGet(() -> new DocumentPermission(docClientA_PermittedRead, userClientA_Viewer, PermissionLevel.READ, userClientA_Owner, Instant.now().plusSeconds(86400)));
        permRead.setPermissionLevel(PermissionLevel.READ);
        permRead.setStatus(PermissionStatus.ACTIVE);
        permRead.setExpiresAt(Instant.now().plusSeconds(86400));
        permissionRepository.save(permRead);

        // 2. Permitted Edit
        DocumentPermission permEdit = permissionRepository.findByDocumentAndUser(docClientA_PermittedEdit, userClientA_Viewer)
                .orElseGet(() -> new DocumentPermission(docClientA_PermittedEdit, userClientA_Viewer, PermissionLevel.EDIT, userClientA_Owner, Instant.now().plusSeconds(86400)));
        permEdit.setPermissionLevel(PermissionLevel.EDIT);
        permEdit.setStatus(PermissionStatus.ACTIVE);
        permEdit.setExpiresAt(Instant.now().plusSeconds(86400));
        permissionRepository.save(permEdit);

        // 3. Explicitly remove any permission for docClientA_NoPermission
        permissionRepository.findByDocumentAndUser(docClientA_NoPermission, userClientA_Viewer)
                .ifPresent(permissionRepository::delete);
    }

    @Test
    @DisplayName("Scenario 1: Authorized user can access an explicitly permitted document")
    void test01_authorizedUserCanAccessExplicitlyPermittedDocument() throws Exception {
        mockMvc.perform(get("/api/documents/" + docClientA_PermittedRead.getId())
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(docClientA_PermittedRead.getId().toString()))
                .andExpect(jsonPath("$.userAccessLevel").value("READ"));

        mockMvc.perform(get("/api/documents/" + docClientA_PermittedRead.getId() + "/preview")
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userAccessLevel").value("READ"));
    }

    @Test
    @DisplayName("Scenario 2: User without permission receives a denial")
    void test02_userWithoutPermissionReceivesDenial() throws Exception {
        // Sita has no permission grant on Internal Report.pdf
        mockMvc.perform(get("/api/documents/" + docClientA_NoPermission.getId())
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/documents/" + docClientA_NoPermission.getId() + "/preview")
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/documents/" + docClientA_NoPermission.getId() + "/download-token")
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Scenario 3: READ-only user cannot edit, download, or delete a document")
    void test03_readOnlyUserCannotEditOrDeleteDocument() throws Exception {
        // 1. Cannot update/rename metadata
        DocumentUpdateRequest updateReq = new DocumentUpdateRequest("Hacked Title", "General");
        mockMvc.perform(put("/api/documents/" + docClientA_PermittedRead.getId())
                        .header("Authorization", tokenA_Viewer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isForbidden());

        // 2. Cannot download
        mockMvc.perform(post("/api/documents/" + docClientA_PermittedRead.getId() + "/download-token")
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isForbidden());

        // 3. Cannot delete
        mockMvc.perform(delete("/api/documents/" + docClientA_PermittedRead.getId())
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Scenario 4: EDIT permission allows read, preview, download, and edit, but not delete")
    void test04_editPermissionAllowsOperationsAccordingToModel() throws Exception {
        // Ensure project membership allows edit
        ProjectMember pm = projectMemberRepository.findByProjectAndUser(projectA, userClientA_Viewer).orElseThrow();
        pm.setCanEdit(true);
        projectMemberRepository.save(pm);

        // 1. Can view metadata
        mockMvc.perform(get("/api/documents/" + docClientA_PermittedEdit.getId())
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isOk());

        // 2. Can preview
        mockMvc.perform(get("/api/documents/" + docClientA_PermittedEdit.getId() + "/preview")
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userAccessLevel").value("EDIT"));

        // 3. Can generate download token
        mockMvc.perform(post("/api/documents/" + docClientA_PermittedEdit.getId() + "/download-token")
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.downloadUrl").isNotEmpty());

        // 4. Can edit metadata
        DocumentUpdateRequest updateReq = new DocumentUpdateRequest("Exam Results 2026", "Academic");
        mockMvc.perform(put("/api/documents/" + docClientA_PermittedEdit.getId())
                        .header("Authorization", tokenA_Viewer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Exam Results 2026"));

        // 5. But CANNOT delete document (only owner or admin can delete)
        mockMvc.perform(delete("/api/documents/" + docClientA_PermittedEdit.getId())
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Scenario 5: User from Client A cannot access Client B's documents (Multi-tenant isolation)")
    void test05_userFromClientACannotAccessClientBDocuments() throws Exception {
        // User from Client A attempting to access Client B's document
        mockMvc.perform(get("/api/documents/" + docClientB_Secret.getId())
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/documents/" + docClientB_Secret.getId() + "/preview")
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/documents/" + docClientB_Secret.getId() + "/download-token")
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isForbidden());

        // Even Manager from Client A is blocked by tenant isolation
        mockMvc.perform(get("/api/documents/" + docClientB_Secret.getId())
                        .header("Authorization", tokenA_Owner))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Scenario 6: User from Project A cannot access Project B's restricted documents")
    void test06_userFromProjectACannotAccessProjectBRestrictedDocuments() throws Exception {
        // Viewer in Client B accessing Project A document
        mockMvc.perform(get("/api/documents/" + docClientA_PermittedRead.getId())
                        .header("Authorization", tokenB_Viewer))
                .andExpect(status().isForbidden());

        // Accessing documents by projectId filter
        mockMvc.perform(get("/api/documents?projectId=" + projectB.getId())
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Scenario 7: Changing a document ID does not expose another document (IDOR Protection)")
    void test07_changingDocumentIdDoesNotExposeAnotherDocument() throws Exception {
        // Sita has access to docClientA_PermittedRead, but tampers ID to docClientA_NoPermission
        mockMvc.perform(get("/api/documents/" + docClientA_NoPermission.getId())
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isForbidden());

        // Sita tampers ID to a non-existent random UUID
        UUID nonExistentId = UUID.randomUUID();
        mockMvc.perform(get("/api/documents/" + nonExistentId)
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Scenario 8: Revoking access blocks subsequent requests immediately")
    void test08_revokingAccessBlocksSubsequentRequestsImmediately() throws Exception {
        // 1. Initial access succeeds
        mockMvc.perform(get("/api/documents/" + docClientA_PermittedRead.getId())
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isOk());

        // 2. Revoke permission
        DocumentPermission perm = permissionRepository.findByDocumentAndUser(docClientA_PermittedRead, userClientA_Viewer).orElseThrow();
        mockMvc.perform(delete("/api/permissions/" + perm.getId())
                        .header("Authorization", tokenA_Owner))
                .andExpect(status().isNoContent());

        // 3. Subsequent request immediately denied with 403 Forbidden
        mockMvc.perform(get("/api/documents/" + docClientA_PermittedRead.getId())
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/documents/" + docClientA_PermittedRead.getId() + "/preview")
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Scenario 9: Deactivated users cannot access protected documents")
    void test09_deactivatedUsersCannotAccessProtectedDocuments() throws Exception {
        // Deactivate userClientA_Viewer
        userClientA_Viewer.setActive(false);
        userRepository.save(userClientA_Viewer);

        // Request denied immediately
        mockMvc.perform(get("/api/documents/" + docClientA_PermittedRead.getId())
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/documents")
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isForbidden());

        // Re-activate user for remaining tests
        userClientA_Viewer.setActive(true);
        userRepository.save(userClientA_Viewer);
    }

    @Test
    @DisplayName("Scenario 10: Unauthorized downloads and denied access attempts create audit events")
    void test10_unauthorizedDownloadsAndDeniedAccessAttemptsCreateAuditEvents() throws Exception {
        long deniedBefore = auditLogRepository.countByResult(AuditResult.DENIED);

        // Attempt unauthorized download token
        mockMvc.perform(post("/api/documents/" + docClientA_NoPermission.getId() + "/download-token")
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isForbidden());

        // Attempt invalid download token retrieval
        mockMvc.perform(get("/api/documents/download/invalid-token-12345"))
                .andExpect(status().isBadRequest());

        long deniedAfter = auditLogRepository.countByResult(AuditResult.DENIED);
        assertThat(deniedAfter).isGreaterThan(deniedBefore);

        // Verify latest audit log has action UNAUTHORIZED_ACCESS_ATTEMPT and result DENIED
        AuditLog latest = auditLogRepository.findTopByOrderByTimestampDesc().orElseThrow();
        assertThat(latest.getResult()).isEqualTo(AuditResult.DENIED);
        assertThat(latest.getAction()).isEqualTo(AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT);
        assertThat(latest.getTimestamp()).isNotNull();
    }

    @Test
    @DisplayName("Scenario 11: Successful document actions create appropriate audit events")
    void test11_successfulDocumentActionsCreateAppropriateAuditEvents() throws Exception {
        long successBefore = auditLogRepository.countByResult(AuditResult.SUCCESS);

        // View document metadata
        mockMvc.perform(get("/api/documents/" + docClientA_PermittedRead.getId())
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isOk());

        long successAfter = auditLogRepository.countByResult(AuditResult.SUCCESS);
        assertThat(successAfter).isGreaterThan(successBefore);

        AuditLog latest = auditLogRepository.findTopByOrderByTimestampDesc().orElseThrow();
        assertThat(latest.getResult()).isEqualTo(AuditResult.SUCCESS);
        assertThat(latest.getAction()).isEqualTo(AuditAction.DOCUMENT_VIEW);
        assertThat(latest.getActorId()).isEqualTo(userClientA_Viewer.getId());
        assertThat(latest.getResourceId()).isEqualTo(docClientA_PermittedRead.getId().toString());
    }

    @Test
    @DisplayName("Scenario 12: Ordinary users cannot modify or delete audit records")
    void test12_ordinaryUsersCannotModifyOrDeleteAuditRecords() throws Exception {
        UUID sampleLogId = auditLogRepository.findTopByOrderByTimestampDesc()
                .map(AuditLog::getId)
                .orElse(UUID.randomUUID());

        // 1. Viewer cannot view or delete audit records
        mockMvc.perform(get("/api/audit-logs")
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/audit-logs/" + sampleLogId)
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isForbidden());

        // 2. Even Admin cannot delete audit records (Immutability protection)
        mockMvc.perform(delete("/api/audit-logs/" + sampleLogId)
                        .header("Authorization", tokenAdmin))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Scenario 13: Unauthorized users cannot bypass protections through search, preview, or alternate endpoints")
    void test13_unauthorizedUsersCannotBypassProtectionsThroughSearchOrPreview() throws Exception {
        // 1. Document list / search does not leak unpermitted documents
        mockMvc.perform(get("/api/documents?query=Internal")
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[?(@.title == 'Internal Report.pdf')]").doesNotExist());

        // 2. Versions endpoint enforces authorization
        mockMvc.perform(get("/api/documents/" + docClientA_NoPermission.getId() + "/versions")
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isForbidden());

        // 3. Star / Unstar enforces authorization
        mockMvc.perform(post("/api/documents/" + docClientA_NoPermission.getId() + "/star")
                        .header("Authorization", tokenA_Viewer))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Scenario 14: Upload validation rejects prohibited file types or invalid files")
    void test14_uploadValidationRejectsProhibitedFileTypesOrInvalidFiles() throws Exception {
        // 1. Prohibited executable file
        MockMultipartFile exeFile = new MockMultipartFile(
                "file",
                "backdoor.exe",
                "application/octet-stream",
                "MZ\0\0\0executable_content".getBytes()
        );

        mockMvc.perform(multipart("/api/documents/upload")
                        .file(exeFile)
                        .param("projectId", projectA.getId().toString())
                        .header("Authorization", tokenA_Owner))
                .andExpect(status().isBadRequest());

        // 2. Path traversal filename
        MockMultipartFile traversalFile = new MockMultipartFile(
                "file",
                "../../secret.pdf",
                "application/pdf",
                "%PDF-1.4 mock pdf".getBytes()
        );

        mockMvc.perform(multipart("/api/documents/upload")
                        .file(traversalFile)
                        .param("projectId", projectA.getId().toString())
                        .header("Authorization", tokenA_Owner))
                .andExpect(status().isBadRequest());

        // 3. Magic bytes spoofing (claims to be PDF with .pdf extension, but invalid header bytes)
        MockMultipartFile spoofedFile = new MockMultipartFile(
                "file",
                "spoofed.pdf",
                "application/pdf",
                "NOT_A_REAL_PDF_HEADER_CONTENT".getBytes()
        );

        mockMvc.perform(multipart("/api/documents/upload")
                        .file(spoofedFile)
                        .param("projectId", projectA.getId().toString())
                        .header("Authorization", tokenA_Owner))
                .andExpect(status().isBadRequest());
    }
}
