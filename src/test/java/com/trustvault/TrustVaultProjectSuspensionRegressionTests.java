package com.trustvault;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.trustvault.dto.AccessRequestDtos.CreateAccessRequest;
import com.trustvault.dto.DocumentDtos.DocumentUpdateRequest;
import com.trustvault.dto.PermissionDtos.GrantPermissionRequest;
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
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public class TrustVaultProjectSuspensionRegressionTests {

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
    private AuditLogRepository auditLogRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    private User sita;
    private User owner;
    private User admin;

    private String sitaToken;
    private String ownerToken;
    private String adminToken;

    private Project collegeProject;
    private Project hospitalProject;

    private Document collegeDoc;  // READ permission granted to Sita in College Project
    private Document examDoc;     // EDIT permission granted to Sita in College Project
    private Document hospitalDoc; // READ permission granted to Sita in Hospital Project

    private ProjectMember sitaCollegeMembership;
    private ProjectMember sitaHospitalMembership;

    @BeforeEach
    void setUp() {
        sita = userRepository.findByEmailIgnoreCase("sita@trustvault.local").orElseThrow();
        owner = userRepository.findByEmailIgnoreCase("owner@trustvault.local").orElseThrow();
        admin = userRepository.findByEmailIgnoreCase("admin@trustvault.local").orElseThrow();

        sitaToken = jwtTokenProvider.generateToken(sita);
        ownerToken = jwtTokenProvider.generateToken(owner);
        adminToken = jwtTokenProvider.generateToken(admin);

        collegeProject = projectRepository.findAll().stream()
                .filter(p -> p.getName().equalsIgnoreCase("College Project"))
                .findFirst().orElseThrow();

        hospitalProject = projectRepository.findAll().stream()
                .filter(p -> p.getName().equalsIgnoreCase("Hospital Project"))
                .findFirst().orElseThrow();

        collegeDoc = documentRepository.findAll().stream()
                .filter(d -> d.getTitle().equalsIgnoreCase("College Guidelines.pdf"))
                .findFirst().orElseThrow();

        examDoc = documentRepository.findAll().stream()
                .filter(d -> d.getTitle().equalsIgnoreCase("Exam Results.xlsx"))
                .findFirst().orElseThrow();

        hospitalDoc = documentRepository.findAll().stream()
                .filter(d -> d.getTitle().equalsIgnoreCase("Patient Policy.pdf"))
                .findFirst().orElseThrow();

        sitaCollegeMembership = projectMemberRepository.findByProjectAndUser(collegeProject, sita)
                .orElseGet(() -> projectMemberRepository.save(new ProjectMember(collegeProject, sita, "Contributor", true, true)));

        sitaHospitalMembership = projectMemberRepository.findByProjectAndUser(hospitalProject, sita)
                .orElseGet(() -> projectMemberRepository.save(new ProjectMember(hospitalProject, sita, "Contributor", true, false)));

        // Ensure memberships are active initially
        sitaCollegeMembership.reactivate();
        projectMemberRepository.save(sitaCollegeMembership);

        sitaHospitalMembership.reactivate();
        projectMemberRepository.save(sitaHospitalMembership);

        // Ensure active permissions exist
        ensureActivePermission(collegeDoc, sita, PermissionLevel.READ);
        ensureActivePermission(examDoc, sita, PermissionLevel.EDIT);
        ensureActivePermission(hospitalDoc, sita, PermissionLevel.READ);
    }

    private void ensureActivePermission(Document doc, User user, PermissionLevel level) {
        DocumentPermission perm = permissionRepository.findByDocumentAndUser(doc, user).orElseGet(() -> {
            DocumentPermission p = new DocumentPermission(doc, user, level, owner, Instant.now().plusSeconds(86400 * 30));
            return permissionRepository.save(p);
        });
        perm.setStatus(PermissionStatus.ACTIVE);
        perm.setPermissionLevel(level);
        perm.setExpiresAt(Instant.now().plusSeconds(86400 * 30));
        permissionRepository.save(perm);
    }

    private void suspendSitaFromCollegeProject() {
        sitaCollegeMembership.suspend(owner);
        projectMemberRepository.save(sitaCollegeMembership);
    }

    @Test
    @DisplayName("1. Active user lists documents before suspension; suspended membership immediately removes documents")
    void test01_documentListingEnforcesSuspension() throws Exception {
        // Before suspension: Sita sees College Guidelines, Exam Results, and Patient Policy in the accessible list
        mockMvc.perform(get("/api/documents")
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == '" + collegeDoc.getId() + "')]").isNotEmpty())
                .andExpect(jsonPath("$[?(@.id == '" + examDoc.getId() + "')]").isNotEmpty())
                .andExpect(jsonPath("$[?(@.id == '" + hospitalDoc.getId() + "')]").isNotEmpty());

        // Suspend Sita from College Project
        suspendSitaFromCollegeProject();

        // After suspension: College Guidelines and Exam Results are completely removed from the accessible document list
        mockMvc.perform(get("/api/documents")
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == '" + collegeDoc.getId() + "')]").isEmpty())
                .andExpect(jsonPath("$[?(@.id == '" + examDoc.getId() + "')]").isEmpty())
                // Legitimate access to Hospital Project is preserved
                .andExpect(jsonPath("$[?(@.id == '" + hospitalDoc.getId() + "')]").isNotEmpty());

        // Calling /api/documents?projectId={collegeProjectId} returns 403 Forbidden
        mockMvc.perform(get("/api/documents")
                        .param("projectId", collegeProject.getId().toString())
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Access denied: Your project membership has been suspended"));

        // Audit log records UNAUTHORIZED_ACCESS_ATTEMPT with result DENIED
        List<AuditLog> deniedLogs = auditLogRepository.findByActionOrderByTimestampDesc(AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT);
        assertThat(deniedLogs).anyMatch(l -> l.getActorEmail().equalsIgnoreCase("sita@trustvault.local")
                && l.getResult() == AuditResult.DENIED
                && l.getReason().contains("suspended"));
    }

    @Test
    @DisplayName("2. Search excludes documents from suspended project while preserving legitimate matches")
    void test02_searchExcludesSuspendedProjectDocuments() throws Exception {
        suspendSitaFromCollegeProject();

        // Searching "College" matches College Guidelines.pdf in DB, but returns empty for suspended Sita
        mockMvc.perform(get("/api/documents")
                        .param("query", "College")
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$").isEmpty());

        // Searching "Patient" returns Patient Policy.pdf (active membership)
        mockMvc.perform(get("/api/documents")
                        .param("query", "Patient")
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Patient Policy.pdf"));
    }

    @Test
    @DisplayName("3. Direct metadata API access by guessing document ID returns 403 and logs audit event")
    void test03_directMetadataAccessForbiddenAndAudited() throws Exception {
        suspendSitaFromCollegeProject();

        long auditCountBefore = auditLogRepository.count();

        mockMvc.perform(get("/api/documents/" + collegeDoc.getId())
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Access denied: Your project membership has been suspended"));

        // Verify audit log
        long auditCountAfter = auditLogRepository.count();
        assertThat(auditCountAfter).isGreaterThan(auditCountBefore);

        AuditLog latest = auditLogRepository.findTopByOrderByTimestampDesc().orElseThrow();
        assertThat(latest.getAction()).isEqualTo(AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT);
        assertThat(latest.getResult()).isEqualTo(AuditResult.DENIED);
        assertThat(latest.getActorEmail()).isEqualTo("sita@trustvault.local");
        assertThat(latest.getResourceType()).isEqualTo("DOCUMENT");
        assertThat(latest.getResourceId()).isEqualTo(collegeDoc.getId().toString());
    }

    @Test
    @DisplayName("4. Preview API returns 403 Forbidden and logs security audit event on suspended project document")
    void test04_previewApiForbiddenAndAudited() throws Exception {
        suspendSitaFromCollegeProject();

        mockMvc.perform(get("/api/documents/" + collegeDoc.getId() + "/preview")
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Access denied: Your project membership has been suspended"));

        AuditLog latest = auditLogRepository.findTopByOrderByTimestampDesc().orElseThrow();
        assertThat(latest.getAction()).isEqualTo(AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT);
        assertThat(latest.getResult()).isEqualTo(AuditResult.DENIED);
        assertThat(latest.getActorEmail()).isEqualTo("sita@trustvault.local");
        assertThat(latest.getResourceId()).isEqualTo(collegeDoc.getId().toString());
    }

    @Test
    @DisplayName("5. Download token generation returns 403 Forbidden even with prior EDIT permission")
    void test05_downloadTokenGenerationForbiddenAndAudited() throws Exception {
        // Sita had EDIT permission on examDoc
        suspendSitaFromCollegeProject();

        mockMvc.perform(post("/api/documents/" + examDoc.getId() + "/download-token")
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Access denied: Your project membership has been suspended"));

        AuditLog latest = auditLogRepository.findTopByOrderByTimestampDesc().orElseThrow();
        assertThat(latest.getAction()).isEqualTo(AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT);
        assertThat(latest.getResult()).isEqualTo(AuditResult.DENIED);
        assertThat(latest.getActorEmail()).isEqualTo("sita@trustvault.local");
    }

    @Test
    @DisplayName("6. Edit and Delete document APIs return 403 Forbidden on suspended project document")
    void test06_editAndDeleteForbidden() throws Exception {
        suspendSitaFromCollegeProject();

        // Edit
        DocumentUpdateRequest updateReq = new DocumentUpdateRequest("Tampered Title", "Academic");
        mockMvc.perform(put("/api/documents/" + examDoc.getId())
                        .header("Authorization", "Bearer " + sitaToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Access denied: Your project membership has been suspended"));

        // Delete
        mockMvc.perform(delete("/api/documents/" + examDoc.getId())
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("7. Document versions API returns 403 Forbidden on suspended project document")
    void test07_documentVersionsForbidden() throws Exception {
        suspendSitaFromCollegeProject();

        mockMvc.perform(get("/api/documents/" + collegeDoc.getId() + "/versions")
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Access denied: Your project membership has been suspended"));
    }

    @Test
    @DisplayName("8. Star and unstar endpoints return 403 Forbidden on suspended project document")
    void test08_starAndUnstarForbidden() throws Exception {
        suspendSitaFromCollegeProject();

        mockMvc.perform(post("/api/documents/" + collegeDoc.getId() + "/star")
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Access denied: Your project membership has been suspended"));

        mockMvc.perform(delete("/api/documents/" + collegeDoc.getId() + "/star")
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Access denied: Your project membership has been suspended"));
    }

    @Test
    @DisplayName("9. Uploading document to suspended project returns 403 Forbidden")
    void test09_uploadToSuspendedProjectForbidden() throws Exception {
        suspendSitaFromCollegeProject();

        MockMultipartFile file = new MockMultipartFile(
                "file", "forbidden_upload.txt", "text/plain", "Attempted upload content".getBytes()
        );

        mockMvc.perform(multipart("/api/documents/upload")
                        .file(file)
                        .param("projectId", collegeProject.getId().toString())
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("10. Sharing document or granting permission to suspended member is blocked")
    void test10_grantPermissionToSuspendedMemberBlocked() throws Exception {
        suspendSitaFromCollegeProject();

        GrantPermissionRequest grantReq = new GrantPermissionRequest(
                sita.getEmail(),
                PermissionLevel.READ,
                null,
                14
        );

        mockMvc.perform(post("/api/documents/" + collegeDoc.getId() + "/permissions")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(grantReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("suspended")));
    }

    @Test
    @DisplayName("11. Access request and Renewal request creation for suspended project return 403 Forbidden")
    void test11_accessAndRenewalRequestsForbiddenForSuspendedMember() throws Exception {
        suspendSitaFromCollegeProject();

        // Access request by document ID
        CreateAccessRequest accReq = new CreateAccessRequest(
                collegeDoc.getId(),
                collegeProject.getId(),
                "College Guidelines.pdf",
                PermissionLevel.READ,
                7,
                "Need access again"
        );

        mockMvc.perform(post("/api/requests")
                        .header("Authorization", "Bearer " + sitaToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(accReq)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Access denied: Your project membership has been suspended"));

        // Renewal request
        DocumentPermission perm = permissionRepository.findByDocumentAndUser(collegeDoc, sita).orElseThrow();
        CreateRenewalRequest renReq = new CreateRenewalRequest(
                perm.getId(),
                collegeDoc.getId(),
                collegeProject.getId(),
                PermissionLevel.READ,
                "Need renewal",
                14
        );

        mockMvc.perform(post("/api/renewals")
                        .header("Authorization", "Bearer " + sitaToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(renReq)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Access denied: Your project membership has been suspended"));
    }

    @Test
    @DisplayName("12. My Permissions endpoint filters out permissions belonging to suspended projects")
    void test12_myPermissionsFiltersOutSuspendedProjectPermissions() throws Exception {
        suspendSitaFromCollegeProject();

        mockMvc.perform(get("/api/permissions/my")
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.documentId == '" + collegeDoc.getId() + "')]").isEmpty())
                .andExpect(jsonPath("$[?(@.documentId == '" + examDoc.getId() + "')]").isEmpty())
                .andExpect(jsonPath("$[?(@.documentId == '" + hospitalDoc.getId() + "')]").isNotEmpty());
    }

    @Test
    @DisplayName("13. Legitimate access is preserved: Manager and Admin retain access; non-suspended project preserved")
    void test13_managerAndAdminRetainLegitimateAccess() throws Exception {
        suspendSitaFromCollegeProject();

        // Project Manager / Document Owner retains access to College Guidelines and can preview it
        mockMvc.perform(get("/api/documents/" + collegeDoc.getId())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("College Guidelines.pdf"));

        mockMvc.perform(get("/api/documents/" + collegeDoc.getId() + "/preview")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk());

        // Administrator retains access across all documents
        mockMvc.perform(get("/api/documents/" + collegeDoc.getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("College Guidelines.pdf"));

        mockMvc.perform(get("/api/documents")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == '" + collegeDoc.getId() + "')]").isNotEmpty());

        // Sita retains active access to Hospital Project
        mockMvc.perform(get("/api/documents/" + hospitalDoc.getId())
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Patient Policy.pdf"));
    }

    @Test
    @DisplayName("14. Reactivation immediately restores access without requiring new permissions")
    void test14_reactivationRestoresAccessImmediately() throws Exception {
        suspendSitaFromCollegeProject();

        // Verified suspended
        mockMvc.perform(get("/api/documents/" + collegeDoc.getId())
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isForbidden());

        // Reactivate membership
        sitaCollegeMembership.reactivate();
        projectMemberRepository.save(sitaCollegeMembership);

        // Immediate access restored
        mockMvc.perform(get("/api/documents/" + collegeDoc.getId())
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userAccessLevel").value("READ"));

        mockMvc.perform(get("/api/documents")
                        .header("Authorization", "Bearer " + sitaToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == '" + collegeDoc.getId() + "')]").isNotEmpty())
                .andExpect(jsonPath("$[?(@.id == '" + examDoc.getId() + "')]").isNotEmpty());
    }
}
