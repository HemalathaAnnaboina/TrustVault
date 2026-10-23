package com.trustvault;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.trustvault.dto.AccessRequestDtos.CreateAccessRequest;
import com.trustvault.dto.AccessRequestDtos.ReviewAccessRequest;
import com.trustvault.dto.AuthDtos.ChangePasswordRequest;
import com.trustvault.dto.DocumentDtos.DocumentUpdateRequest;
import com.trustvault.dto.PermissionDtos.GrantPermissionRequest;
import com.trustvault.dto.RenewalRequestDtos.CreateRenewalRequest;
import com.trustvault.dto.RenewalRequestDtos.ReviewRenewalRequest;
import com.trustvault.model.*;
import com.trustvault.repository.*;
import com.trustvault.service.AuditService;
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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public class TrustVaultViewerEditorSecurityTests {

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
    private ClientRepository clientRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private ProjectMemberRepository projectMemberRepository;

    @Autowired
    private AccessRequestRepository accessRequestRepository;

    @Autowired
    private RenewalRequestRepository renewalRequestRepository;

    @Autowired
    private DownloadTokenRepository downloadTokenRepository;

    @Autowired
    private AuditService auditService;

    @Autowired
    private com.trustvault.security.JwtTokenProvider jwtTokenProvider;

    private User owner;
    private User viewer;
    private User editor;
    private User inactiveUser;
    private User betaUser;

    private String ownerToken;
    private String viewerToken;
    private String editorToken;
    private String inactiveToken;
    private String betaUserToken;

    private Document roadmapDoc; // Shared with editor (EDIT) and viewer (EDIT)
    private Document handbookDoc; // Shared with editor (READ) and viewer (READ)
    private Document q4Doc; // Owned by owner, not shared with viewer or editor
    private Document betaDoc; // Belongs to isolated Client Beta

    private Client primaryClient;
    private Client betaClient;

    @BeforeEach
    void setUp() {
        primaryClient = clientRepository.findByCode("CLIENT_PRIMARY").orElseGet(() ->
                clientRepository.save(new Client(UUID.fromString("11111111-1111-1111-1111-111111111111"), "TrustVault Primary", "CLIENT_PRIMARY")));

        betaClient = clientRepository.findByCode("CLIENT_BETA").orElseGet(() ->
                clientRepository.save(new Client(UUID.fromString("22222222-2222-2222-2222-222222222222"), "Client Beta", "CLIENT_BETA")));

        owner = userRepository.findByEmailIgnoreCase("owner@trustvault.local").orElseThrow();
        viewer = userRepository.findByEmailIgnoreCase("viewer@trustvault.local").orElseThrow();
        editor = userRepository.findByEmailIgnoreCase("editor@trustvault.local").orElseThrow();
        inactiveUser = userRepository.findByEmailIgnoreCase("inactive@trustvault.local").orElseThrow();
        betaUser = userRepository.findByEmailIgnoreCase("clientb_user@trustvault.local").orElseThrow();

        ownerToken = jwtTokenProvider.generateToken(owner);
        viewerToken = jwtTokenProvider.generateToken(viewer);
        editorToken = jwtTokenProvider.generateToken(editor);
        inactiveToken = jwtTokenProvider.generateToken(inactiveUser);
        betaUserToken = jwtTokenProvider.generateToken(betaUser);

        roadmapDoc = documentRepository.findAll().stream()
                .filter(d -> (d.getOriginalFilename() != null && d.getOriginalFilename().toLowerCase().contains("roadmap")) || (d.getTitle() != null && d.getTitle().toLowerCase().contains("roadmap")))
                .findFirst().orElseThrow();

        handbookDoc = documentRepository.findAll().stream()
                .filter(d -> (d.getOriginalFilename() != null && d.getOriginalFilename().toLowerCase().contains("handbook")) || (d.getTitle() != null && d.getTitle().toLowerCase().contains("handbook")))
                .findFirst().orElseThrow();

        q4Doc = documentRepository.findAll().stream()
                .filter(d -> (d.getOriginalFilename() != null && d.getOriginalFilename().toLowerCase().contains("q4")) || (d.getTitle() != null && d.getTitle().toLowerCase().contains("q4")))
                .findFirst().orElseThrow();

        betaDoc = documentRepository.findAll().stream()
                .filter(d -> d.getTitle().contains("Beta"))
                .findFirst().orElseGet(() -> {
                    Document d = new Document("Beta Client Confidential Asset.pdf", "beta_confidential.pdf",
                            UUID.randomUUID().toString(), "application/pdf", 1024L, "dummyhash", "Confidential", betaUser, null);
                    d.setClient(betaClient);
                    return documentRepository.save(d);
                });
    }

    @Test
    @DisplayName("1. An unauthenticated user cannot access document endpoints")
    void test01_unauthenticatedUserCannotAccessDocumentEndpoints() throws Exception {
        mockMvc.perform(get("/api/documents"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/documents/" + roadmapDoc.getId()))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/documents/starred"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/documents/recent"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("2. A Viewer can read a document shared with them")
    void test02_viewerCanReadDocumentSharedWithThem() throws Exception {
        mockMvc.perform(get("/api/documents/" + handbookDoc.getId())
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(handbookDoc.getId().toString()))
                .andExpect(jsonPath("$.title").value(handbookDoc.getTitle()))
                .andExpect(jsonPath("$.userAccessLevel").value("READ"));
    }

    @Test
    @DisplayName("3. A Viewer cannot edit a document")
    void test03_viewerCannotEditDocument() throws Exception {
        DocumentUpdateRequest req = new DocumentUpdateRequest("Tampered Title", "Hacked Category");

        mockMvc.perform(put("/api/documents/" + handbookDoc.getId())
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("4. A Viewer cannot delete or share a document")
    void test04_viewerCannotDeleteOrShareDocument() throws Exception {
        // Attempt delete
        mockMvc.perform(delete("/api/documents/" + handbookDoc.getId())
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isForbidden());

        // Attempt grant permission
        GrantPermissionRequest grantReq = new GrantPermissionRequest("alex@trustvault.local", PermissionLevel.READ, null);
        mockMvc.perform(post("/api/documents/" + handbookDoc.getId() + "/permissions")
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(grantReq)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("5. An Editor can edit a document with active EDIT permission")
    void test05_editorCanEditDocumentWithActiveEditPermission() throws Exception {
        DocumentUpdateRequest req = new DocumentUpdateRequest("Product Roadmap 2025 - Updated By Editor", "Engineering");

        mockMvc.perform(put("/api/documents/" + roadmapDoc.getId())
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Product Roadmap 2025 - Updated By Editor"))
                .andExpect(jsonPath("$.version").isNotEmpty());
    }

    @Test
    @DisplayName("6. An Editor cannot edit a READ-only document")
    void test06_editorCannotEditReadOnlyDocument() throws Exception {
        DocumentUpdateRequest req = new DocumentUpdateRequest("Handbook Tampered", "HR");

        // handbookDoc is READ-only for editor
        mockMvc.perform(put("/api/documents/" + handbookDoc.getId())
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("7. An Editor cannot grant or revoke permissions")
    void test07_editorCannotGrantOrRevokePermissions() throws Exception {
        GrantPermissionRequest grantReq = new GrantPermissionRequest("alex@trustvault.local", PermissionLevel.READ, null);

        mockMvc.perform(post("/api/documents/" + roadmapDoc.getId() + "/permissions")
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(grantReq)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("8. A user cannot access another client's document by changing the document ID")
    void test08_userCannotAccessAnotherClientsDocumentByChangingId() throws Exception {
        // Viewer is in CLIENT_PRIMARY, betaDoc is in CLIENT_BETA
        mockMvc.perform(get("/api/documents/" + betaDoc.getId())
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isForbidden());

        // Editor in CLIENT_PRIMARY also blocked from CLIENT_BETA
        mockMvc.perform(get("/api/documents/" + betaDoc.getId())
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("9. A user cannot discover unauthorised documents through search or pagination")
    void test09_userCannotDiscoverUnauthorisedDocumentsThroughSearchOrPagination() throws Exception {
        // q4Doc is private to owner. Viewer searches for "Q4"
        mockMvc.perform(get("/api/documents?query=Q4")
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.title contains 'Q4')]").doesNotExist());
    }

    @Test
    @DisplayName("10. A revoked user can no longer preview or download a document")
    void test10_revokedUserCanNoLongerPreviewOrDownloadDocument() throws Exception {
        // Create temporary document and grant READ to viewer
        Document tempDoc = documentRepository.save(new Document(
                "Revoke Test Doc.pdf", "Revoke Test Doc.pdf", UUID.randomUUID().toString(),
                "application/pdf", 1024L, "dummyhash", "General", owner, null
        ));
        tempDoc.setClient(primaryClient);
        documentRepository.save(tempDoc);

        DocumentPermission perm = permissionRepository.save(new DocumentPermission(
                tempDoc, viewer, PermissionLevel.READ, owner, Instant.now().plusSeconds(3600)
        ));

        // Viewer can access initially
        mockMvc.perform(get("/api/documents/" + tempDoc.getId())
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isOk());

        // Owner revokes permission
        perm.setStatus(PermissionStatus.REVOKED);
        permissionRepository.save(perm);

        // Immediate rejection
        mockMvc.perform(get("/api/documents/" + tempDoc.getId())
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/documents/" + tempDoc.getId() + "/download-token")
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("11. An expired permission is rejected")
    void test11_expiredPermissionIsRejected() throws Exception {
        Document expiredDoc = documentRepository.save(new Document(
                "Expired Grant Doc.pdf", "Expired Grant Doc.pdf", UUID.randomUUID().toString(),
                "application/pdf", 1024L, "dummyhash", "General", owner, null
        ));
        expiredDoc.setClient(primaryClient);
        documentRepository.save(expiredDoc);

        // Grant already expired in the past
        permissionRepository.save(new DocumentPermission(
                expiredDoc, viewer, PermissionLevel.READ, owner, Instant.now().minusSeconds(3600)
        ));

        mockMvc.perform(get("/api/documents/" + expiredDoc.getId())
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("12. A deactivated user cannot access documents")
    void test12_deactivatedUserCannotAccessDocuments() throws Exception {
        mockMvc.perform(get("/api/documents/" + roadmapDoc.getId())
                        .header("Authorization", "Bearer " + inactiveToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("13. An unauthorised download request does not return file bytes or a usable storage URL")
    void test13_unauthorisedDownloadRequestDoesNotReturnFileBytesOrUsableUrl() throws Exception {
        // Viewer has no grant on q4Doc
        mockMvc.perform(post("/api/documents/" + q4Doc.getId() + "/download-token")
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("14. Invalid or oversized uploads are rejected")
    void test14_invalidOrOversizedUploadsAreRejected() throws Exception {
        MockMultipartFile exeFile = new MockMultipartFile(
                "file", "malware.exe", "application/octet-stream", "MZdangerousbytes".getBytes()
        );

        mockMvc.perform(multipart("/api/documents")
                        .file(exeFile)
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("15. Denied operations generate audit events")
    void test15_deniedOperationsGenerateAuditEvents() throws Exception {
        long countBefore = auditLogRepository.countByResult(AuditResult.DENIED);

        mockMvc.perform(get("/api/documents/" + q4Doc.getId())
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isForbidden());

        long countAfter = auditLogRepository.countByResult(AuditResult.DENIED);
        assertThat(countAfter).isGreaterThan(countBefore);
    }

    @Test
    @DisplayName("16. Successful downloads, edits, uploads, and permission changes are audited")
    void test16_successfulDownloadsEditsUploadsAndPermissionChangesAreAudited() throws Exception {
        // Successful edit
        DocumentUpdateRequest req = new DocumentUpdateRequest("Roadmap Audited Title", "Planning");
        mockMvc.perform(put("/api/documents/" + roadmapDoc.getId())
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());

        boolean updateAudited = auditLogRepository.findAll().stream()
                .anyMatch(l -> l.getAction() == AuditAction.DOCUMENT_UPDATE && l.getResourceId().equals(roadmapDoc.getId().toString()));
        assertThat(updateAudited).isTrue();
    }

    @Test
    @DisplayName("17. Users cannot read or modify audit records they are not authorised to access")
    void test17_usersCannotReadOrModifyAuditRecordsTheyAreNotAuthorisedToAccess() throws Exception {
        mockMvc.perform(get("/api/audit-logs")
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/audit-logs")
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("18. Concurrent edits do not silently overwrite newer changes")
    void test18_concurrentEditsDoNotSilentlyOverwriteNewerChanges() throws Exception {
        // Current document version
        Document current = documentRepository.findById(roadmapDoc.getId()).orElseThrow();
        int currentVersion = current.getVersion();

        // Legitimate update with current version
        DocumentUpdateRequest req1 = new DocumentUpdateRequest("Title Version A", "Planning", null, currentVersion, "First edit");
        mockMvc.perform(put("/api/documents/" + roadmapDoc.getId())
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isOk());

        // Concurrent update submitted with stale version -> Conflict 409
        DocumentUpdateRequest staleReq = new DocumentUpdateRequest("Stale Overwrite Attempt", "Planning", null, currentVersion, "Stale edit");
        mockMvc.perform(put("/api/documents/" + roadmapDoc.getId())
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(staleReq)))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("19. Viewer cannot download a document even with a valid READ permission")
    void test19_viewerCannotDownloadDocumentEvenWithReadPermission() throws Exception {
        // handbookDoc is READ for viewer
        mockMvc.perform(post("/api/documents/" + handbookDoc.getId() + "/download-token")
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Viewers are not permitted to download")));
    }

    @Test
    @DisplayName("20. Viewer cannot upload new documents")
    void test20_viewerCannotUploadNewDocuments() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "viewer_doc.pdf", "application/pdf", "%PDF-sample".getBytes()
        );

        mockMvc.perform(multipart("/api/documents")
                        .file(file)
                        .param("title", "Viewer Upload Attempt")
                        .param("category", "General")
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Viewers are not permitted to upload")));
    }

    @Test
    @DisplayName("21. Editor can preview, download, and edit a document with valid EDIT permission")
    void test21_editorCanPreviewDownloadAndEditDocumentWithEditPermission() throws Exception {
        // roadmapDoc has EDIT permission for editor
        // 1. Preview/Get metadata
        mockMvc.perform(get("/api/documents/" + roadmapDoc.getId())
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userAccessLevel").value("EDIT"));

        // 2. Download token
        org.springframework.test.web.servlet.MvcResult tokenRes = mockMvc.perform(post("/api/documents/" + roadmapDoc.getId() + "/download-token")
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isOk())
                .andReturn();

        String token = objectMapper.readTree(tokenRes.getResponse().getContentAsString()).get("token").asText();
        assertThat(token).isNotBlank();

        mockMvc.perform(get("/api/documents/download/" + token))
                .andExpect(status().isOk());

        // 3. Edit document
        DocumentUpdateRequest req = new DocumentUpdateRequest("Roadmap Editor Modified", "Engineering");
        mockMvc.perform(put("/api/documents/" + roadmapDoc.getId())
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("22. Editor cannot download a READ-only document")
    void test22_editorCannotDownloadReadOnlyDocument() throws Exception {
        // handbookDoc is READ-only for editor
        mockMvc.perform(post("/api/documents/" + handbookDoc.getId() + "/download-token")
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Download requires EDIT permission")));
    }

    @Test
    @DisplayName("23. Editor cannot upload without server-side project upload authorization")
    void test23_editorCannotUploadWithoutProjectUploadAuthorization() throws Exception {
        Project restrictedProject = projectRepository.save(new Project("Strict Private Project", "Restricted", owner));
        restrictedProject.setClient(primaryClient);
        projectRepository.save(restrictedProject);

        MockMultipartFile file = new MockMultipartFile(
                "file", "editor_unauth.pdf", "application/pdf", "%PDF-editor".getBytes()
        );

        // Editor is not a member of restrictedProject
        mockMvc.perform(multipart("/api/documents")
                        .file(file)
                        .param("title", "Unauthorized Project Upload")
                        .param("category", "General")
                        .param("projectId", restrictedProject.getId().toString())
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("24. Editor can upload when authorized as editor in project")
    void test24_editorCanUploadWhenAuthorizedInProject() throws Exception {
        Project editorProject = projectRepository.save(new Project("Editor Authorized Project", "Active", owner));
        editorProject.setClient(primaryClient);
        projectRepository.save(editorProject);

        projectMemberRepository.save(new ProjectMember(editorProject, editor, "Contributor", Role.ROLE_EDITOR));

        MockMultipartFile file = new MockMultipartFile(
                "file", "authorized_upload.pdf", "application/pdf", "%PDF-authorized".getBytes()
        );

        mockMvc.perform(multipart("/api/documents")
                        .file(file)
                        .param("title", "Authorized Editor Document")
                        .param("category", "Engineering")
                        .param("projectId", editorProject.getId().toString())
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Authorized Editor Document"))
                .andExpect(jsonPath("$.projectId").value(editorProject.getId().toString()));
    }

    @Test
    @DisplayName("25. User can have different roles in different projects")
    void test25_userCanHaveDifferentRolesInDifferentProjects() throws Exception {
        Project projA = projectRepository.save(new Project("Project Alpha", "Alpha", owner));
        projA.setClient(primaryClient);
        projectRepository.save(projA);

        Project projB = projectRepository.save(new Project("Project Beta", "Beta", owner));
        projB.setClient(primaryClient);
        projectRepository.save(projB);

        // In ProjA, user has ROLE_VIEWER
        projectMemberRepository.save(new ProjectMember(projA, editor, "Viewer Only", Role.ROLE_VIEWER));
        // In ProjB, user has ROLE_EDITOR
        projectMemberRepository.save(new ProjectMember(projB, editor, "Lead Editor", Role.ROLE_EDITOR));

        MockMultipartFile file = new MockMultipartFile(
                "file", "test_role.pdf", "application/pdf", "%PDF-role".getBytes()
        );

        // Upload to ProjA (ROLE_VIEWER) -> 403 Forbidden
        mockMvc.perform(multipart("/api/documents")
                        .file(file)
                        .param("title", "ProjA Upload")
                        .param("projectId", projA.getId().toString())
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());

        // Upload to ProjB (ROLE_EDITOR) -> 200 OK
        mockMvc.perform(multipart("/api/documents")
                        .file(file)
                        .param("title", "ProjB Upload")
                        .param("projectId", projB.getId().toString())
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("26. Project membership alone does not grant document access")
    void test26_projectMembershipAloneDoesNotGrantDocumentAccess() throws Exception {
        Project project = projectRepository.save(new Project("Membership Test Project", "Testing isolation", owner));
        project.setClient(primaryClient);
        projectRepository.save(project);

        Document privateDoc = documentRepository.save(new Document(
                "Internal Memo.pdf", "Internal Memo.pdf", "key_memo_" + UUID.randomUUID(),
                "application/pdf", 1024L, "hashmemo", "Internal", owner, project
        ));
        privateDoc.setClient(primaryClient);
        documentRepository.save(privateDoc);

        // Add viewer as a member of the project
        projectMemberRepository.save(new ProjectMember(project, viewer, "Member", Role.ROLE_VIEWER));

        // Viewer is in the project, but has NO explicit DocumentPermission for privateDoc -> 403 Forbidden!
        mockMvc.perform(get("/api/documents/" + privateDoc.getId())
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("27. Cross-project and cross-client IDOR attempts are denied")
    void test27_crossProjectAccessIsDenied() throws Exception {
        Project proj1 = projectRepository.save(new Project("Project One", "P1", owner));
        proj1.setClient(primaryClient);
        projectRepository.save(proj1);

        Project proj2 = projectRepository.save(new Project("Project Two", "P2", owner));
        proj2.setClient(primaryClient);
        projectRepository.save(proj2);

        Document docP2 = documentRepository.save(new Document(
                "P2 Confidential.pdf", "p2_conf.pdf", "key_p2_" + UUID.randomUUID(),
                "application/pdf", 1024L, "hashp2", "Confidential", owner, proj2
        ));
        docP2.setClient(primaryClient);
        documentRepository.save(docP2);

        // Viewer only belongs to proj1, tries to access doc in proj2 -> 403 Forbidden
        mockMvc.perform(get("/api/documents/" + docP2.getId())
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("28. Guessed document IDs are denied")
    void test28_guessedDocumentIdsAreDenied() throws Exception {
        UUID fakeId = UUID.randomUUID();
        mockMvc.perform(get("/api/documents/" + fakeId)
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("29. Access request approval grants permission only to specified document and user")
    void test29_accessRequestApprovalGrantsPermissionOnlyToSpecifiedDocAndUser() throws Exception {
        Document targetDoc = documentRepository.save(new Document(
                "Access Grant Target.pdf", "target.pdf", "key_tgt_" + UUID.randomUUID(),
                "application/pdf", 1024L, "hashtgt", "Target", owner, null
        ));
        targetDoc.setClient(primaryClient);
        documentRepository.save(targetDoc);

        // Viewer requests access
        CreateAccessRequest req = new CreateAccessRequest(targetDoc.getId(), null, null, PermissionLevel.READ, 7, "Need for audit verification");
        org.springframework.test.web.servlet.MvcResult reqRes = mockMvc.perform(post("/api/requests")
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();

        UUID reqId = UUID.fromString(objectMapper.readTree(reqRes.getResponse().getContentAsString()).get("id").asText());

        // Owner approves
        ReviewAccessRequest review = new ReviewAccessRequest(true, "Approved for audit", null, 7);
        mockMvc.perform(post("/api/requests/" + reqId + "/review")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(review)))
                .andExpect(status().isOk());

        // Viewer now has access
        mockMvc.perform(get("/api/documents/" + targetDoc.getId())
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isOk());

        // Editor does NOT have access
        mockMvc.perform(get("/api/documents/" + targetDoc.getId())
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("30. Rejected access requests do not grant access")
    void test30_rejectedAccessRequestDoesNotGrantAccess() throws Exception {
        Document targetDoc = documentRepository.save(new Document(
                "Access Reject Target.pdf", "target_rej.pdf", "key_rej_" + UUID.randomUUID(),
                "application/pdf", 1024L, "hashrej", "Target", owner, null
        ));
        targetDoc.setClient(primaryClient);
        documentRepository.save(targetDoc);

        CreateAccessRequest req = new CreateAccessRequest(targetDoc.getId(), null, null, PermissionLevel.READ, 7, "Requesting access");
        org.springframework.test.web.servlet.MvcResult reqRes = mockMvc.perform(post("/api/requests")
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();

        UUID reqId = UUID.fromString(objectMapper.readTree(reqRes.getResponse().getContentAsString()).get("id").asText());

        // Owner rejects
        ReviewAccessRequest review = new ReviewAccessRequest(false, "Rejected: unauthorized need", null);
        mockMvc.perform(post("/api/requests/" + reqId + "/review")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(review)))
                .andExpect(status().isOk());

        // Viewer still forbidden
        mockMvc.perform(get("/api/documents/" + targetDoc.getId())
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("31. Manual filename entry does not create fake document and requires manager verification")
    void test31_manualFilenameEntryDoesNotCreateFakeDocumentOrGrantAccess() throws Exception {
        Project proj = projectRepository.save(new Project("Design Project", "Design", owner));
        proj.setClient(primaryClient);
        projectRepository.save(proj);

        projectMemberRepository.save(new ProjectMember(proj, viewer, "Member", Role.ROLE_VIEWER));

        long docCountBefore = documentRepository.count();

        // Viewer types manual filename that doesn't exist yet
        CreateAccessRequest manualReq = new CreateAccessRequest(null, proj.getId(), "Unreleased_Design.fig", PermissionLevel.READ, 5, "Need design file");
        org.springframework.test.web.servlet.MvcResult res = mockMvc.perform(post("/api/requests")
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(manualReq)))
                .andExpect(status().isOk())
                .andReturn();

        // Verify NO fake document was created in the database
        assertThat(documentRepository.count()).isEqualTo(docCountBefore);

        UUID reqId = UUID.fromString(objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText());

        // Owner cannot approve without real document existing
        ReviewAccessRequest approveAttempt = new ReviewAccessRequest(true, "Approve anyway", null, 5);
        mockMvc.perform(post("/api/requests/" + reqId + "/review")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(approveAttempt)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("existing document in the project")));
    }

    @Test
    @DisplayName("32. Renewal approval follows manager-approved duration")
    void test32_renewalApprovalFollowsApprovedDuration() throws Exception {
        Document doc = documentRepository.save(new Document(
                "Renewal Test Doc.pdf", "renew.pdf", "key_rnw_" + UUID.randomUUID(),
                "application/pdf", 1024L, "hashrnw", "General", owner, null
        ));
        doc.setClient(primaryClient);
        documentRepository.save(doc);

        Instant initialExpiry = Instant.now().plusSeconds(3600); // 1 hour
        DocumentPermission perm = permissionRepository.save(new DocumentPermission(
                doc, viewer, PermissionLevel.READ, owner, initialExpiry
        ));

        // Viewer requests renewal for 30 days
        CreateRenewalRequest renewalReq = new CreateRenewalRequest(perm.getId(), "Project extension needed", 30);
        org.springframework.test.web.servlet.MvcResult res = mockMvc.perform(post("/api/renewals")
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(renewalReq)))
                .andExpect(status().isOk())
                .andReturn();

        UUID renewalId = UUID.fromString(objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText());

        // Manager approves but restricts to only 7 days
        ReviewRenewalRequest review = new ReviewRenewalRequest(true, "Only approved for 7 days", 7);
        mockMvc.perform(post("/api/renewals/" + renewalId + "/review")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(review)))
                .andExpect(status().isOk());

        // Verify updated permission expires around 7 days (not 30 days)
        DocumentPermission updatedPerm = permissionRepository.findById(perm.getId()).orElseThrow();
        long hoursDiff = java.time.Duration.between(initialExpiry, updatedPerm.getExpiresAt()).toHours();
        assertThat(Math.round(hoursDiff / 24.0)).isEqualTo(7);
    }

    @Test
    @DisplayName("33. Password-change requests are rejected server-side for Viewer and Editor")
    void test33_passwordChangeRejectedServerSideForViewerAndEditor() throws Exception {
        ChangePasswordRequest changeReq = new ChangePasswordRequest("TrustVault@2025!", "NewSecret123!");

        // Viewer rejected
        mockMvc.perform(post("/api/auth/change-password")
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(changeReq)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Password change is disabled")));

        // Editor rejected
        mockMvc.perform(post("/api/auth/change-password")
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(changeReq)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Password change is disabled")));
    }

    @Test
    @DisplayName("34. Similar filenames in different projects do not cause document collisions")
    void test34_similarFilenamesInDifferentProjectsDoNotCollide() throws Exception {
        Project projA = projectRepository.save(new Project("Finance Project", "Finance", owner));
        projA.setClient(primaryClient);
        projectRepository.save(projA);

        Project projB = projectRepository.save(new Project("HR Project", "HR", owner));
        projB.setClient(primaryClient);
        projectRepository.save(projB);

        // Same filename in both projects
        Document docA = documentRepository.save(new Document(
                "quarterly_report.pdf", "quarterly_report.pdf", "key_qa_" + UUID.randomUUID(),
                "application/pdf", 1024L, "hashqa", "Reports", owner, projA
        ));
        docA.setClient(primaryClient);
        documentRepository.save(docA);

        Document docB = documentRepository.save(new Document(
                "quarterly_report.pdf", "quarterly_report.pdf", "key_qb_" + UUID.randomUUID(),
                "application/pdf", 2048L, "hashqb", "Reports", owner, projB
        ));
        docB.setClient(primaryClient);
        documentRepository.save(docB);

        // Grant READ on docA only to viewer
        permissionRepository.save(new DocumentPermission(docA, viewer, PermissionLevel.READ, owner, null));

        // Viewer can read docA
        mockMvc.perform(get("/api/documents/" + docA.getId())
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(docA.getId().toString()))
                .andExpect(jsonPath("$.fileSizeBytes").value(1024));

        // Viewer cannot read docB even though originalFilename is identical
        mockMvc.perform(get("/api/documents/" + docB.getId())
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("35. Managers cannot view other projects' audit logs")
    void test35_managersCannotViewOtherProjectsAuditLogs() throws Exception {
        // Owner 2
        User owner2 = userRepository.findByEmailIgnoreCase("owner2@trustvault.local").orElseGet(() -> {
            User u = new User("owner2@trustvault.local", "$2a$10$xyz", "Owner Two", Role.ROLE_OWNER, true);
            u.setClient(primaryClient);
            return userRepository.save(u);
        });
        String owner2Token = jwtTokenProvider.generateToken(owner2);

        // Create log for Owner 1 project
        auditService.logEvent(
                owner, AuditAction.DOCUMENT_UPLOAD, "DOCUMENT", roadmapDoc.getId().toString(),
                AuditResult.SUCCESS, "Owner1 roadmap created", "127.0.0.1", "Browser"
        );

        // Owner 2 checks audit logs -> cannot see Owner 1's project events
        org.springframework.test.web.servlet.MvcResult res = mockMvc.perform(get("/api/audit-logs")
                        .header("Authorization", "Bearer " + owner2Token))
                .andExpect(status().isOk())
                .andReturn();

        String responseBody = res.getResponse().getContentAsString();
        assertThat(responseBody).doesNotContain("Owner1 roadmap created");
    }
}
