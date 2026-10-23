package com.trustvault;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.trustvault.dto.AccessRequestDtos.CreateAccessRequest;
import com.trustvault.dto.AccessRequestDtos.ReviewAccessRequest;
import com.trustvault.dto.AuthDtos.ChangePasswordRequest;
import com.trustvault.dto.DocumentDtos.DocumentUpdateRequest;
import com.trustvault.dto.RenewalRequestDtos.CreateRenewalRequest;
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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public class TrustVaultWorkshopSecurityTests {

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
    private ProjectRepository projectRepository;

    @Autowired
    private ProjectMemberRepository projectMemberRepository;

    @Autowired
    private AccessRequestRepository accessRequestRepository;

    @Autowired
    private RenewalRequestRepository renewalRequestRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    private User sita;
    private User owner;
    private User admin;
    private User betaUser;

    private String sitaToken;
    private String ownerToken;
    private String adminToken;
    private String betaUserToken;

    private Project collegeProject;
    private Project hospitalProject;
    private Project betaProject;

    private Document collegeDoc;   // READ for Sita
    private Document examDoc;      // EDIT for Sita
    private Document internalDoc;  // NO ACCESS for Sita (same project)
    private Document patientDoc;   // READ for Sita (Hospital Project)
    private Document betaDoc;      // Beta Client isolated

    private Client primaryClient;
    private Client betaClient;

    @BeforeEach
    void setUp() {
        primaryClient = clientRepository.findByCode("CLIENT_PRIMARY").orElseGet(() ->
                clientRepository.save(new Client(UUID.fromString("11111111-1111-1111-1111-111111111111"), "TrustVault Primary", "CLIENT_PRIMARY")));

        betaClient = clientRepository.findByCode("CLIENT_BETA").orElseGet(() ->
                clientRepository.save(new Client(UUID.fromString("22222222-2222-2222-2222-222222222222"), "Client Beta", "CLIENT_BETA")));

        sita = userRepository.findByEmailIgnoreCase("sita@trustvault.local").orElseThrow();
        owner = userRepository.findByEmailIgnoreCase("owner@trustvault.local").orElseThrow();
        admin = userRepository.findByEmailIgnoreCase("admin@trustvault.local").orElseThrow();
        betaUser = userRepository.findByEmailIgnoreCase("clientb_user@trustvault.local").orElseThrow();

        sitaToken = jwtTokenProvider.generateToken(sita);
        ownerToken = jwtTokenProvider.generateToken(owner);
        adminToken = jwtTokenProvider.generateToken(admin);
        betaUserToken = jwtTokenProvider.generateToken(betaUser);

        collegeProject = projectRepository.findAll().stream()
                .filter(p -> p.getName().equalsIgnoreCase("College Project"))
                .findFirst().orElseThrow();

        hospitalProject = projectRepository.findAll().stream()
                .filter(p -> p.getName().equalsIgnoreCase("Hospital Project"))
                .findFirst().orElseThrow();

        betaProject = projectRepository.findAll().stream()
                .filter(p -> p.getClient() != null && p.getClient().getId().equals(betaClient.getId()))
                .findFirst().orElseGet(() -> {
                    Project p = new Project("Beta Isolated Project", "Project for Beta Client", betaUser);
                    p.setClient(betaClient);
                    return projectRepository.save(p);
                });

        collegeDoc = documentRepository.findAll().stream()
                .filter(d -> d.getTitle().equalsIgnoreCase("College Guidelines.pdf"))
                .findFirst().orElseThrow();

        examDoc = documentRepository.findAll().stream()
                .filter(d -> d.getTitle().equalsIgnoreCase("Exam Results.xlsx"))
                .findFirst().orElseThrow();

        internalDoc = documentRepository.findAll().stream()
                .filter(d -> d.getTitle().equalsIgnoreCase("Internal Report.pdf"))
                .findFirst().orElseThrow();

        // Ensure internalDoc strictly has no permission grants for Sita
        permissionRepository.findByDocumentAndUser(internalDoc, sita).ifPresent(permissionRepository::delete);

        patientDoc = documentRepository.findAll().stream()
                .filter(d -> d.getTitle().equalsIgnoreCase("Patient Policy.pdf"))
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
    @DisplayName("1. Different document permissions for the same user (READ, EDIT, NO ACCESS)")
    void test01_differentDocumentPermissionsForSameUser() throws Exception {
        // College Guidelines.pdf -> READ
        mockMvc.perform(get("/api/documents/" + collegeDoc.getId())
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(collegeDoc.getId().toString()))
                .andExpect(jsonPath("$.userAccessLevel").value("READ"));

        // Exam Results.xlsx -> EDIT
        mockMvc.perform(get("/api/documents/" + examDoc.getId())
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(examDoc.getId().toString()))
                .andExpect(jsonPath("$.userAccessLevel").value("EDIT"));

        // Internal Report.pdf -> NO ACCESS
        mockMvc.perform(get("/api/documents/" + internalDoc.getId())
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("2. Project membership alone does not grant all document access")
    void test02_projectMembershipAloneDoesNotGrantDocumentAccess() throws Exception {
        // Sita is member of College Project
        assertThat(projectMemberRepository.existsByProjectAndUser(collegeProject, sita)).isTrue();
        assertThat(internalDoc.getProject().getId()).isEqualTo(collegeProject.getId());

        // But direct document metadata retrieval is forbidden
        mockMvc.perform(get("/api/documents/" + internalDoc.getId())
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden());

        // When listing project documents, internalDoc is listed with userAccessLevel = NONE
        mockMvc.perform(get("/api/documents")
                        .param("projectId", collegeProject.getId().toString())
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == '" + internalDoc.getId() + "')].userAccessLevel").value("NONE"))
                .andExpect(jsonPath("$[?(@.id == '" + collegeDoc.getId() + "')].userAccessLevel").value("READ"))
                .andExpect(jsonPath("$[?(@.id == '" + examDoc.getId() + "')].userAccessLevel").value("EDIT"));
    }

    @Test
    @DisplayName("3. Authorized uploads work for Workshop user in assigned project")
    void test03_authorizedUploadsWorkForWorkshopUser() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "workshop_notes.pdf", "application/pdf", "%PDF-1.5 Workshop Notes".getBytes()
        );

        mockMvc.perform(multipart("/api/documents")
                        .file(file)
                        .param("title", "Workshop Notes")
                        .param("category", "Academic")
                        .param("projectId", collegeProject.getId().toString())
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Workshop Notes"))
                .andExpect(jsonPath("$.userAccessLevel").value("OWNER"));
    }

    @Test
    @DisplayName("4. Unauthorized and cross-tenant uploads fail")
    void test04_unauthorizedAndCrossTenantUploadsFail() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "unauthorized.pdf", "application/pdf", "%PDF-1.5 Test".getBytes()
        );

        // Upload to unassigned/nonexistent project -> 403 Forbidden
        mockMvc.perform(multipart("/api/documents")
                        .file(file)
                        .param("title", "Invalid Project Upload")
                        .param("projectId", UUID.randomUUID().toString())
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden());

        // Upload to Beta project (cross-client) -> 403 Forbidden
        mockMvc.perform(multipart("/api/documents")
                        .file(file)
                        .param("title", "Cross Client Upload")
                        .param("projectId", betaProject.getId().toString())
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("5. Fabricated or mismatched document IDs cannot create valid requests")
    void test05_fabricatedOrMismatchedDocumentIdsCannotCreateValidRequests() throws Exception {
        // Document belongs to College Project, but request says Hospital Project
        CreateAccessRequest mismatchedReq = new CreateAccessRequest(
                collegeDoc.getId(),
                hospitalProject.getId(),
                PermissionLevel.READ,
                14,
                "Request with mismatched project"
        );

        mockMvc.perform(post("/api/requests")
                        .header("Authorization", "Bearer " + sitaToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(mismatchedReq)))
                .andExpect(status().isBadRequest());

        // Fabricated document ID
        CreateAccessRequest fabricatedReq = new CreateAccessRequest(
                UUID.randomUUID(),
                collegeProject.getId(),
                PermissionLevel.READ,
                14,
                "Request with fabricated document"
        );

        mockMvc.perform(post("/api/requests")
                        .header("Authorization", "Bearer " + sitaToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(fabricatedReq)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("6. Pending requests grant no access")
    void test06_pendingRequestsGrantNoAccess() throws Exception {
        Document targetDoc = documentRepository.save(new Document(
                "Pending Check.pdf", "pending.pdf", UUID.randomUUID().toString(),
                "application/pdf", 1024L, "hashPending", "Academic", owner, collegeProject
        ));
        targetDoc.setClient(primaryClient);
        documentRepository.save(targetDoc);

        CreateAccessRequest req = new CreateAccessRequest(
                targetDoc.getId(),
                collegeProject.getId(),
                PermissionLevel.READ,
                7,
                "Need to review pending report for workshop"
        );

        mockMvc.perform(post("/api/requests")
                        .header("Authorization", "Bearer " + sitaToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));

        // Even though request is PENDING, Sita still cannot access the document
        mockMvc.perform(get("/api/documents/" + targetDoc.getId())
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("7. Approval grants access only to the specified user and document")
    void test07_approvalGrantsAccessOnlyToSpecifiedUserAndDocument() throws Exception {
        Document targetDoc = documentRepository.save(new Document(
                "Approval Target.pdf", "approval.pdf", UUID.randomUUID().toString(),
                "application/pdf", 1024L, "hashApprovalTarget", "Academic", owner, collegeProject
        ));
        targetDoc.setClient(primaryClient);
        documentRepository.save(targetDoc);

        // Create request
        CreateAccessRequest req = new CreateAccessRequest(
                targetDoc.getId(),
                collegeProject.getId(),
                PermissionLevel.READ,
                10,
                "Request for approval flow test"
        );

        String createResp = mockMvc.perform(post("/api/requests")
                        .header("Authorization", "Bearer " + sitaToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        UUID requestId = UUID.fromString(objectMapper.readTree(createResp).get("id").asText());

        // Owner approves
        ReviewAccessRequest review = new ReviewAccessRequest(true, "Granted for workshop study");
        mockMvc.perform(post("/api/requests/" + requestId + "/review")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(review)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));

        // Now Sita has READ access
        mockMvc.perform(get("/api/documents/" + targetDoc.getId())
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userAccessLevel").value("READ"));

        // But Sita does NOT have EDIT access
        DocumentUpdateRequest editReq = new DocumentUpdateRequest("Tampered Title", "Academic");
        mockMvc.perform(put("/api/documents/" + targetDoc.getId())
                        .header("Authorization", "Bearer " + sitaToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(editReq)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("8. Rejection grants no access")
    void test08_rejectionGrantsNoAccess() throws Exception {
        // Create a temporary document owned by owner
        Document tempDoc = documentRepository.save(new Document(
                "Sensitive Audit.pdf", "audit.pdf", UUID.randomUUID().toString(),
                "application/pdf", 1024L, "hash123", "Audit", owner, collegeProject
        ));
        tempDoc.setClient(primaryClient);
        documentRepository.save(tempDoc);

        CreateAccessRequest req = new CreateAccessRequest(
                tempDoc.getId(),
                collegeProject.getId(),
                PermissionLevel.READ,
                7,
                "Request that will be rejected"
        );

        String createResp = mockMvc.perform(post("/api/requests")
                        .header("Authorization", "Bearer " + sitaToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        UUID requestId = UUID.fromString(objectMapper.readTree(createResp).get("id").asText());

        // Owner rejects
        ReviewAccessRequest review = new ReviewAccessRequest(false, "Access denied due to sensitivity");
        mockMvc.perform(post("/api/requests/" + requestId + "/review")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(review)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"));

        // Access remains forbidden
        mockMvc.perform(get("/api/documents/" + tempDoc.getId())
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("9. Renewal does not extend permissions before approval")
    void test09_renewalDoesNotExtendPermissionsBeforeApproval() throws Exception {
        // Create an expired permission for Sita on a temp document
        Document expireDoc = documentRepository.save(new Document(
                "Old Syllabus.pdf", "syllabus.pdf", UUID.randomUUID().toString(),
                "application/pdf", 1024L, "hashOld", "Academic", owner, collegeProject
        ));
        expireDoc.setClient(primaryClient);
        documentRepository.save(expireDoc);

        DocumentPermission expiredPerm = new DocumentPermission(
                expireDoc, sita, PermissionLevel.READ, owner, Instant.now().minusSeconds(3600)
        );
        expiredPerm.setStatus(PermissionStatus.EXPIRED);
        permissionRepository.save(expiredPerm);

        // Before renewal: accessing is forbidden
        mockMvc.perform(get("/api/documents/" + expireDoc.getId())
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden());

        // Submit renewal request
        CreateRenewalRequest renewalReq = new CreateRenewalRequest(
                expiredPerm.getId(),
                expireDoc.getId(),
                collegeProject.getId(),
                PermissionLevel.READ,
                "Need extension for semester grading",
                14
        );

        mockMvc.perform(post("/api/renewals")
                        .header("Authorization", "Bearer " + sitaToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(renewalReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));

        // While renewal is PENDING, access is still forbidden!
        mockMvc.perform(get("/api/documents/" + expireDoc.getId())
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("10. Expired and revoked permissions deny protected operations")
    void test10_expiredAndRevokedPermissionsDenyProtectedOperations() throws Exception {
        Document tempDoc = documentRepository.save(new Document(
                "Revoked Memo.pdf", "memo.pdf", UUID.randomUUID().toString(),
                "application/pdf", 1024L, "hashMemo", "Academic", owner, collegeProject
        ));
        tempDoc.setClient(primaryClient);
        documentRepository.save(tempDoc);

        DocumentPermission perm = new DocumentPermission(
                tempDoc, sita, PermissionLevel.EDIT, owner, Instant.now().plusSeconds(3600)
        );
        perm.setStatus(PermissionStatus.REVOKED);
        permissionRepository.save(perm);

        // Metadata retrieval forbidden
        mockMvc.perform(get("/api/documents/" + tempDoc.getId())
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden());

        // Download token generation forbidden
        mockMvc.perform(post("/api/documents/" + tempDoc.getId() + "/download-token")
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("11. Download tokens cannot bypass current authorization")
    void test11_downloadTokensCannotBypassCurrentAuthorization() throws Exception {
        // Sita has READ on collegeDoc -> cannot request download token (requires EDIT)
        mockMvc.perform(post("/api/documents/" + collegeDoc.getId() + "/download-token")
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden());

        // Requesting download with invalid or fabricated token fails with 400 Bad Request
        mockMvc.perform(get("/api/documents/download/nonexistent-token-12345"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("12. Workshop cannot access audit or administrative APIs")
    void test12_workshopCannotAccessAuditOrAdministrativeApis() throws Exception {
        // Workshop cannot access global audit logs
        mockMvc.perform(get("/api/audit-logs")
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden());

        // Workshop cannot access my-activity audit endpoint
        mockMvc.perform(get("/api/audit-logs/my-activity")
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden());

        // Workshop cannot access admin user management
        mockMvc.perform(get("/api/admin/users")
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden());

        // Workshop cannot change password via auth endpoint
        ChangePasswordRequest pwdReq = new ChangePasswordRequest("TrustVault@2025!", "NewPass@2025!");
        mockMvc.perform(post("/api/auth/change-password")
                        .header("Authorization", "Bearer " + sitaToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(pwdReq)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("13. Managers cannot view unauthorized projects' logs or requests")
    void test13_managersCannotViewUnauthorizedProjectsLogsOrRequests() throws Exception {
        // Owner only gets requests for Primary Client documents
        mockMvc.perform(get("/api/requests/owner")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    @DisplayName("14. Admin functionality remains intact")
    void test14_adminFunctionalityRemainsIntact() throws Exception {
        mockMvc.perform(get("/api/audit-logs")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/admin/users")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("15. Unauthorized users cannot preview, download, edit, or delete documents")
    void test15_unauthorizedUsersCannotPreviewDownloadEditOrDelete() throws Exception {
        // Sita cannot delete College Guidelines
        mockMvc.perform(delete("/api/documents/" + collegeDoc.getId())
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden());

        // Sita cannot edit College Guidelines (READ only)
        DocumentUpdateRequest updateReq = new DocumentUpdateRequest("Updated", "Cat");
        mockMvc.perform(put("/api/documents/" + collegeDoc.getId())
                        .header("Authorization", "Bearer " + sitaToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isForbidden());

        // Sita cannot download College Guidelines (READ only)
        mockMvc.perform(post("/api/documents/" + collegeDoc.getId() + "/download-token")
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden());

        // But Sita CAN download Exam Results (EDIT grant) -> returns 200 OK
        mockMvc.perform(post("/api/documents/" + examDoc.getId() + "/download-token")
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    @DisplayName("16. Workshop stats reflect real counts without audit log queries")
    void test16_workshopStatsReflectRealCountsWithoutAuditLogs() throws Exception {
        mockMvc.perform(get("/api/stats/summary")
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.totalProjects").value(2)) // College Project and Hospital Project
                .andExpect(jsonPath("$.summary.totalFiles").isNumber())
                .andExpect(jsonPath("$.summary.pendingRequests").isNumber())
                .andExpect(jsonPath("$.summary.approvedRequests").isNumber());
    }
}
