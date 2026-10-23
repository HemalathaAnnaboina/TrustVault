package com.trustvault;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.trustvault.dto.AccessRequestDtos.CreateAccessRequest;
import com.trustvault.dto.AccessRequestDtos.ReviewAccessRequest;
import com.trustvault.dto.AuthDtos.LoginRequest;
import com.trustvault.dto.AuthDtos.LoginResponse;
import com.trustvault.dto.AuthDtos.RegisterRequest;
import com.trustvault.dto.DocumentDtos.DocumentUpdateRequest;
import com.trustvault.dto.PermissionDtos.GrantPermissionRequest;
import com.trustvault.dto.RenewalRequestDtos.CreateRenewalRequest;
import com.trustvault.dto.UserDtos.CreateUserRequest;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public class TrustVaultSecurityTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private ProjectMemberRepository projectMemberRepository;

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private DocumentPermissionRepository permissionRepository;

    @Autowired
    private AccessRequestRepository accessRequestRepository;

    @Autowired
    private RenewalRequestRepository renewalRequestRepository;

    @Autowired
    private DownloadTokenRepository downloadTokenRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private AuditService auditService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Autowired
    private com.trustvault.security.JwtTokenProvider jwtTokenProvider;

    private String ownerToken;
    private String viewerToken;
    private String viewer2Token;
    private String adminToken;
    private String editorToken;

    private User owner;
    private User viewer;
    private User viewer2;
    private User admin;
    private User editor;

    @BeforeEach
    void setUp() throws Exception {
        owner = userRepository.findByEmailIgnoreCase("owner@trustvault.local").orElseThrow();
        viewer = userRepository.findByEmailIgnoreCase("viewer@trustvault.local").orElseThrow();
        viewer2 = userRepository.findByEmailIgnoreCase("alex@trustvault.local").orElseThrow();
        admin = userRepository.findByEmailIgnoreCase("admin@trustvault.local").orElseThrow();
        editor = userRepository.findByEmailIgnoreCase("editor@trustvault.local").orElseGet(() ->
                userRepository.save(new User("editor@trustvault.local", passwordEncoder.encode("TrustVault@2025!"), "Jordan Lee (Editor)", Role.ROLE_EDITOR, true)));

        ownerToken = jwtTokenProvider.generateToken(owner);
        viewerToken = jwtTokenProvider.generateToken(viewer);
        viewer2Token = jwtTokenProvider.generateToken(viewer2);
        adminToken = jwtTokenProvider.generateToken(admin);
        editorToken = jwtTokenProvider.generateToken(editor);
    }

    @Test
    @DisplayName("Security Test 1: User A cannot access User B's private documents without an explicit grant")
    void test1_userACannotAccessUserBPrivateDocumentsWithoutGrant() throws Exception {
        // Find document owned by Owner (e.g. Q4 Financial Report)
        Document privateDoc = documentRepository.findByOwnerOrderByCreatedAtDesc(owner).stream()
                .filter(d -> d.getTitle().contains("Q4"))
                .findFirst().orElseThrow();

        // Viewer2 (Alex) has no grant for Q4 Financial Report
        mockMvc.perform(get("/api/documents/" + privateDoc.getId())
                        .header("Authorization", "Bearer " + viewer2Token))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/documents/" + privateDoc.getId() + "/download-token")
                        .header("Authorization", "Bearer " + viewer2Token))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Security Test 2: Changing a document ID cannot bypass authorization (IDOR protection)")
    void test2_changingDocumentIdCannotBypassAuthorization() throws Exception {
        // Viewer has access to Product Roadmap (ID 1)
        Document authorizedDoc = documentRepository.findByOwnerOrderByCreatedAtDesc(owner).stream()
                .filter(d -> d.getTitle().contains("Roadmap"))
                .findFirst().orElseThrow();

        // Viewer accesses authorized doc: 200 OK
        mockMvc.perform(get("/api/documents/" + authorizedDoc.getId())
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isOk());

        // Now attacker manipulates the document ID to an unauthorized document
        Document unauthorizedDoc = documentRepository.findByOwnerOrderByCreatedAtDesc(owner).stream()
                .filter(d -> d.getTitle().contains("Brand"))
                .findFirst().orElseThrow();

        mockMvc.perform(get("/api/documents/" + unauthorizedDoc.getId())
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Security Test 3: Project membership alone does not grant document access")
    void test3_projectMembershipAloneDoesNotGrantDocumentAccess() throws Exception {
        // Create new project
        Project project = projectRepository.save(new Project("Project Alpha", "Secret Project", owner));

        // Add Viewer2 as a project member
        projectMemberRepository.save(new ProjectMember(project, viewer2));

        // Create document inside Project Alpha
        Document projectDoc = documentRepository.save(new Document(
                "Alpha Secret.pdf", "Alpha Secret.pdf", "key_alpha_" + UUID.randomUUID(),
                "application/pdf", 1024L, "dummy_hash", "General", owner, project
        ));

        // Viewer2 is a project member, but has NO explicit DocumentPermission for this document
        mockMvc.perform(get("/api/documents/" + projectDoc.getId())
                        .header("Authorization", "Bearer " + viewer2Token))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Security Test 4: READ cannot edit, delete, or share a document")
    void test4_readCannotEditDeleteOrShareDocument() throws Exception {
        // Document with READ grant for viewer (Employee Handbook)
        Document readDoc = documentRepository.findByOwnerOrderByCreatedAtDesc(owner).stream()
                .filter(d -> d.getTitle().contains("Handbook"))
                .findFirst().orElseThrow();

        // 1. Attempt Edit -> Forbidden
        DocumentUpdateRequest editReq = new DocumentUpdateRequest("Hacked Title.pdf", "Finance");
        mockMvc.perform(put("/api/documents/" + readDoc.getId())
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(editReq)))
                .andExpect(status().isForbidden());

        // 2. Attempt Delete -> Forbidden
        mockMvc.perform(delete("/api/documents/" + readDoc.getId())
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isForbidden());

        // 3. Attempt Share / Grant Permission -> Forbidden
        GrantPermissionRequest shareReq = new GrantPermissionRequest("alex@trustvault.local", PermissionLevel.READ, null);
        mockMvc.perform(post("/api/documents/" + readDoc.getId() + "/permissions")
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(shareReq)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Security Test 5: EDIT cannot manage permissions unless separately authorized")
    void test5_editCannotManagePermissionsUnlessSeparatelyAuthorized() throws Exception {
        // Editor has EDIT permission on Product Roadmap
        Document editDoc = documentRepository.findByOwnerOrderByCreatedAtDesc(owner).stream()
                .filter(d -> d.getTitle().contains("Roadmap"))
                .findFirst().orElseThrow();

        // Verify editor CAN update metadata (EDIT allowed)
        DocumentUpdateRequest updateReq = new DocumentUpdateRequest("Product Roadmap 2025 - Updated.docx", "Planning");
        mockMvc.perform(put("/api/documents/" + editDoc.getId())
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isOk());

        // But EDIT CANNOT grant permissions to other users!
        GrantPermissionRequest grantReq = new GrantPermissionRequest("alex@trustvault.local", PermissionLevel.READ, null);
        mockMvc.perform(post("/api/documents/" + editDoc.getId() + "/permissions")
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(grantReq)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Security Test 6: Revoked permission blocks subsequent requests immediately")
    void test6_revokedPermissionBlocksSubsequentRequestsImmediately() throws Exception {
        // Create document and grant permission
        Document doc = documentRepository.save(new Document(
                "Revoke Test.pdf", "Revoke Test.pdf", "key_rev_" + UUID.randomUUID(),
                "application/pdf", 1024L, "hash", "General", owner, null
        ));

        DocumentPermission perm = permissionRepository.save(new DocumentPermission(
                doc, viewer2, PermissionLevel.READ, owner, null
        ));

        // Prior to revocation: 200 OK
        mockMvc.perform(get("/api/documents/" + doc.getId())
                        .header("Authorization", "Bearer " + viewer2Token))
                .andExpect(status().isOk());

        // Owner revokes permission
        mockMvc.perform(delete("/api/permissions/" + perm.getId())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNoContent());

        // Subsequent request immediately blocked
        mockMvc.perform(get("/api/documents/" + doc.getId())
                        .header("Authorization", "Bearer " + viewer2Token))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Security Test 7: Expired permission blocks view, download, and edit immediately")
    void test7_expiredPermissionBlocksViewDownloadAndEdit() throws Exception {
        Document doc = documentRepository.save(new Document(
                "Expiry Test.pdf", "Expiry Test.pdf", "key_exp_" + UUID.randomUUID(),
                "application/pdf", 1024L, "hash", "General", owner, null
        ));

        // Set expiresAt 10 minutes in the past
        Instant pastExpiry = Instant.now().minusSeconds(600);
        permissionRepository.save(new DocumentPermission(
                doc, viewer2, PermissionLevel.EDIT, owner, pastExpiry
        ));

        // 1. View blocked
        mockMvc.perform(get("/api/documents/" + doc.getId())
                        .header("Authorization", "Bearer " + viewer2Token))
                .andExpect(status().isForbidden());

        // 2. Download token blocked
        mockMvc.perform(post("/api/documents/" + doc.getId() + "/download-token")
                        .header("Authorization", "Bearer " + viewer2Token))
                .andExpect(status().isForbidden());

        // 3. Edit blocked
        DocumentUpdateRequest editReq = new DocumentUpdateRequest("Expired Edit.pdf", "General");
        mockMvc.perform(put("/api/documents/" + doc.getId())
                        .header("Authorization", "Bearer " + viewer2Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(editReq)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Security Test 8: An old URL or token cannot bypass the current authorization policy")
    void test8_oldUrlOrTokenCannotBypassCurrentAuthorizationPolicy() throws Exception {
        Document doc = documentRepository.save(new Document(
                "Token Test.pdf", "Token Test.pdf", "key_token_" + UUID.randomUUID(),
                "application/pdf", 1024L, "hash", "General", owner, null
        ));

        // Create an expired or already used download token
        DownloadToken expiredToken = downloadTokenRepository.save(new DownloadToken(
                "expired_token_12345", doc.getId(), viewer.getId(), Instant.now().minusSeconds(120)
        ));

        mockMvc.perform(get("/api/documents/download/" + expiredToken.getTokenValue()))
                .andExpect(status().isBadRequest());

        // Create a used token
        DownloadToken usedToken = new DownloadToken(
                "used_token_12345", doc.getId(), viewer.getId(), Instant.now().plusSeconds(60)
        );
        usedToken.setUsed(true);
        downloadTokenRepository.save(usedToken);

        mockMvc.perform(get("/api/documents/download/" + usedToken.getTokenValue()))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Security Test 9: Inactive users cannot access protected resources")
    void test9_inactiveUsersCannotAccessProtectedResources() throws Exception {
        // Attempt login with inactive user
        LoginRequest req = new LoginRequest("inactive@trustvault.local", "TrustVault@2025!");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Security Test 10: Unauthorized users cannot approve requests or grant permissions")
    void test10_unauthorizedUsersCannotApproveRequestsOrGrantPermissions() throws Exception {
        Document doc = documentRepository.findByOwnerOrderByCreatedAtDesc(owner).get(0);

        // Viewer2 requests access
        CreateAccessRequest req = new CreateAccessRequest(doc.getId(), PermissionLevel.READ, "Please grant");
        MvcResult res = mockMvc.perform(post("/api/requests")
                        .header("Authorization", "Bearer " + viewer2Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();

        UUID requestId = objectMapper.readTree(res.getResponse().getContentAsString()).get("id").traverse(objectMapper).readValueAs(UUID.class);

        // Viewer (not the owner) attempts to approve the request
        ReviewAccessRequest review = new ReviewAccessRequest(true, "Malicious approval", null);
        mockMvc.perform(post("/api/requests/" + requestId + "/review")
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(review)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Security Test 11: Renewal requests do not extend access until approved")
    void test11_renewalRequestsDoNotExtendAccessUntilApproved() throws Exception {
        Document doc = documentRepository.save(new Document(
                "Renewal Test.pdf", "Renewal Test.pdf", "key_ren_" + UUID.randomUUID(),
                "application/pdf", 1024L, "hash", "General", owner, null
        ));

        // Create expired permission
        DocumentPermission perm = permissionRepository.save(new DocumentPermission(
                doc, viewer, PermissionLevel.READ, owner, Instant.now().minusSeconds(100)
        ));

        // Submit renewal request
        CreateRenewalRequest renReq = new CreateRenewalRequest(perm.getId(), "Need more time", 14);
        mockMvc.perform(post("/api/renewals")
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(renReq)))
                .andExpect(status().isOk());

        // Verify that access is STILL denied while renewal is pending
        mockMvc.perform(get("/api/documents/" + doc.getId())
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Security Test 12: Denied access attempts are recorded in audit logs")
    void test12_deniedAccessAttemptsAreRecordedInAuditLogs() throws Exception {
        long initialDeniedCount = auditLogRepository.findAll().stream()
                .filter(l -> l.getResult() == AuditResult.DENIED)
                .count();

        // Trigger unauthorized access on a private document with no grants
        Document privateDoc = documentRepository.save(new Document(
                "Strictly Private Test 12.pdf", "Strictly Private Test 12.pdf", "key_priv12_" + UUID.randomUUID(),
                "application/pdf", 1024L, "hash12", "Confidential", owner, null
        ));
        mockMvc.perform(get("/api/documents/" + privateDoc.getId())
                        .header("Authorization", "Bearer " + viewer2Token))
                .andExpect(status().isForbidden());

        long afterDeniedCount = auditLogRepository.findAll().stream()
                .filter(l -> l.getResult() == AuditResult.DENIED)
                .count();

        assertThat(afterDeniedCount).isGreaterThan(initialDeniedCount);
    }

    @Test
    @DisplayName("Security Test 13: Upload validation rejects disallowed or malformed files")
    void test13_uploadValidationRejectsDisallowedOrMalformedFiles() throws Exception {
        // Dangerous extension (.exe)
        MockMultipartFile exeFile = new MockMultipartFile(
                "file", "malware.exe", "application/octet-stream", "MZThisIsFakeExecutable".getBytes()
        );

        mockMvc.perform(multipart("/api/documents")
                        .file(exeFile)
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isBadRequest());

        // Path traversal in filename
        MockMultipartFile traversalFile = new MockMultipartFile(
                "file", "../../etc/passwd.pdf", "application/pdf", "%PDF-1.4 Content".getBytes()
        );

        mockMvc.perform(multipart("/api/documents")
                        .file(traversalFile)
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isBadRequest());

        // Spoofed PDF with invalid magic bytes
        MockMultipartFile spoofedPdf = new MockMultipartFile(
                "file", "fake.pdf", "application/pdf", "NotAPdfFileContentHere".getBytes()
        );

        mockMvc.perform(multipart("/api/documents")
                        .file(spoofedPdf)
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Security Test 14: Users cannot modify or delete protected audit records")
    void test14_usersCannotModifyOrDeleteProtectedAuditRecords() throws Exception {
        AuditLog log = auditLogRepository.findAll().get(0);

        // Attempting to delete an audit log via API must fail
        mockMvc.perform(delete("/api/audit-logs/" + log.getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isForbidden());

        // Attempting to delete via service directly must throw UnsupportedOperationException
        assertThatThrownBy(() -> auditService.deleteAuditRecord(log.getId()))
                .isInstanceOf(UnsupportedOperationException.class)
                .hasMessageContaining("Tamper Protection");
    }

    @Test
    @DisplayName("Security Test 15: Valid login succeeds and invalid login fails with generic error")
    void test15_validLoginSucceedsAndInvalidLoginFails() throws Exception {
        // 1. Valid login succeeds
        LoginRequest validReq = new LoginRequest("owner@trustvault.local", "TrustVault@2025!");
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validReq)))
                .andExpect(status().isOk())
                .andReturn();

        LoginResponse response = objectMapper.readValue(result.getResponse().getContentAsString(), LoginResponse.class);
        assertThat(response.token()).isNotBlank();
        assertThat(response.role()).isEqualTo(Role.ROLE_OWNER);
        assertThat(response.email()).isEqualTo("owner@trustvault.local");

        // 2. Invalid password fails with 401 Unauthorized
        LoginRequest badPasswordReq = new LoginRequest("owner@trustvault.local", "WrongPassword123!");
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badPasswordReq)))
                .andExpect(status().isUnauthorized());

        // 3. Unknown email fails with 401 Unauthorized (generic error, no email enumeration)
        LoginRequest unknownEmailReq = new LoginRequest("nonexistent@trustvault.local", "SomePassword123!");
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(unknownEmailReq)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Security Test 16: Plaintext passwords are never stored in the database")
    void test16_plaintextPasswordsAreNeverStored() {
        for (User u : userRepository.findAll()) {
            assertThat(u.getPasswordHash()).isNotBlank();
            // BCrypt hashes start with $2a$ or $2b$ and have 60 chars
            assertThat(u.getPasswordHash()).startsWith("$2");
            assertThat(u.getPasswordHash()).isNotEqualTo("TrustVault@2025!");
            assertThat(u.getPasswordHash().length()).isGreaterThanOrEqualTo(60);
        }
    }

    @Test
    @DisplayName("Security Test 17: Unauthenticated requests are rejected with 401 Unauthorized")
    void test17_unauthenticatedRequestsAreRejected() throws Exception {
        mockMvc.perform(get("/api/documents"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/audit-logs"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/projects"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Security Test 18: Public registration allows only OWNER and rejects ADMIN and VIEWER roles")
    void test18_publicRegistrationAllowsOnlyOwnerAndRejectsAdminAndViewer() throws Exception {
        // 1. Attempting to register as ADMIN is rejected (400 Bad Request)
        RegisterRequest maliciousAdminReg = new RegisterRequest(
                "hacker_admin@trustvault.local",
                "HackerPass123!",
                "Malicious Admin Attempt",
                Role.ROLE_ADMIN
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(maliciousAdminReg)))
                .andExpect(status().isBadRequest());

        assertThat(userRepository.findByEmailIgnoreCase("hacker_admin@trustvault.local")).isEmpty();

        // 2. Attempting to register as VIEWER is rejected (400 Bad Request)
        RegisterRequest viewerReg = new RegisterRequest(
                "attempt_viewer@trustvault.local",
                "ViewerPass123!",
                "Attempted Public Viewer",
                Role.ROLE_VIEWER
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(viewerReg)))
                .andExpect(status().isBadRequest());

        assertThat(userRepository.findByEmailIgnoreCase("attempt_viewer@trustvault.local")).isEmpty();

        // 3. Legitimate public registration with ROLE_OWNER succeeds
        RegisterRequest legitOwnerReg = new RegisterRequest(
                "new_owner@trustvault.local",
                "OwnerPass123!",
                "New Vault Owner",
                Role.ROLE_OWNER
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(legitOwnerReg)))
                .andExpect(status().isOk());

        User createdOwner = userRepository.findByEmailIgnoreCase("new_owner@trustvault.local").orElseThrow();
        assertThat(createdOwner.getRole()).isEqualTo(Role.ROLE_OWNER);

        // 4. Public registration without role specified defaults safely to ROLE_OWNER
        RegisterRequest defaultRoleReg = new RegisterRequest(
                "default_owner@trustvault.local",
                "OwnerPass123!",
                "Default Role Owner",
                null
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(defaultRoleReg)))
                .andExpect(status().isOk());

        User createdDefault = userRepository.findByEmailIgnoreCase("default_owner@trustvault.local").orElseThrow();
        assertThat(createdDefault.getRole()).isEqualTo(Role.ROLE_OWNER);
    }

    @Test
    @DisplayName("Security Test 19: ADMIN cannot read private document contents without explicit grant, and non-admin cannot access admin endpoints")
    void test19_adminCannotReadPrivateDocumentContentsWithoutExplicitGrant() throws Exception {
        // Document owned by Owner (e.g. Q4 Financial Report)
        Document privateDoc = documentRepository.findByOwnerOrderByCreatedAtDesc(owner).stream()
                .filter(d -> d.getTitle().contains("Q4"))
                .findFirst().orElseThrow();

        // Admin has NO explicit permission grant for Q4 Financial Report
        // Admin attempt to create a download token for file content must be rejected with 403 Forbidden!
        mockMvc.perform(post("/api/documents/" + privateDoc.getId() + "/download-token")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isForbidden());

        // Non-admin attempting to access Admin endpoints must be rejected with 403 Forbidden
        mockMvc.perform(get("/api/admin/users")
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/admin/users")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Security Test 20: Audit integrity verification detects unauthorized database tampering")
    void test20_auditIntegrityVerificationDetectsUnauthorizedTampering() {
        // 1. Initial audit chain is valid
        var initialVerification = auditService.verifyChainIntegrity();
        assertThat(initialVerification.valid()).isTrue();

        // 2. Simulate rogue direct DB tampering (e.g. database injection or unauthorized row change)
        AuditLog targetRecord = auditLogRepository.findAll().get(0);
        String originalHash = targetRecord.getCurrentHash();

        try {
            jdbcTemplate.update("UPDATE tv_audit_logs SET current_hash = ? WHERE id = ?",
                    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", targetRecord.getId());

            // 3. Verification must fail and report broken record
            var tamperedVerification = auditService.verifyChainIntegrity();
            assertThat(tamperedVerification.valid()).isFalse();
            assertThat(tamperedVerification.brokenRecordId()).isEqualTo(targetRecord.getId());
        } finally {
            // Restore original hash
            jdbcTemplate.update("UPDATE tv_audit_logs SET current_hash = ? WHERE id = ?",
                    originalHash, targetRecord.getId());
        }

        // 4. Verification passes once restored
        assertThat(auditService.verifyChainIntegrity().valid()).isTrue();
    }

    @Test
    @DisplayName("Security Test 21: One owner cannot access another owner's private document")
    void test21_oneOwnerCannotAccessAnotherOwnersPrivateDocument() throws Exception {
        // Create second owner
        User owner2 = userRepository.save(new User(
                "owner2@trustvault.local", passwordEncoder.encode("TrustVault@2025!"),
                "Owner Two", Role.ROLE_OWNER, true
        ));
        String owner2Token = jwtTokenProvider.generateToken(owner2);

        // Owner 2 creates their private document
        Document doc2 = documentRepository.save(new Document(
                "Owner2 Confidential.pdf", "Owner2 Confidential.pdf", "key_owner2_" + UUID.randomUUID(),
                "application/pdf", 2048L, "hash2", "Executive", owner2, null
        ));

        // Owner 1 attempts to view Owner 2's document metadata -> 403 Forbidden!
        mockMvc.perform(get("/api/documents/" + doc2.getId())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isForbidden());

        // Owner 1 attempts to generate a download token for Owner 2's document -> 403 Forbidden!
        mockMvc.perform(post("/api/documents/" + doc2.getId() + "/download-token")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isForbidden());

        // Owner 1 attempts to edit Owner 2's document -> 403 Forbidden!
        DocumentUpdateRequest editReq = new DocumentUpdateRequest("Hijacked Title.pdf", "Hacked");
        mockMvc.perform(put("/api/documents/" + doc2.getId())
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(editReq)))
                .andExpect(status().isForbidden());

        // Owner 1 attempts to delete Owner 2's document -> 403 Forbidden!
        mockMvc.perform(delete("/api/documents/" + doc2.getId())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Security Test 22: Inactive users cannot continue using valid JWTs issued prior to deactivation")
    void test22_inactiveUsersCannotContinueUsingValidJwt() throws Exception {
        // Create an active user
        User activeUser = userRepository.save(new User(
                "temp_user@trustvault.local", passwordEncoder.encode("TrustVault@2025!"),
                "Temporary User", Role.ROLE_VIEWER, true
        ));

        // Generate valid JWT while active
        String jwtToken = jwtTokenProvider.generateToken(activeUser);

        // Verify request succeeds while user is active
        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk());

        // Deactivate user in database
        activeUser.setActive(false);
        userRepository.save(activeUser);

        // Immediate subsequent request with the same JWT must be rejected with 403 Forbidden!
        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/documents")
                        .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Security Test 23: Old download tokens fail after permission revocation or user deactivation")
    void test23_downloadTokenFailsAfterPermissionRevocationOrUserDeactivation() throws Exception {
        // Create document owned by owner
        Document doc = documentRepository.save(new Document(
                "Token Security Test.pdf", "Token Security Test.pdf", "key_toksec_" + UUID.randomUUID(),
                "application/pdf", 1024L, "hash", "General", owner, null
        ));

        // Grant EDIT permission to editor (Editors can download if they have EDIT permission)
        DocumentPermission perm = permissionRepository.save(new DocumentPermission(
                doc, editor, PermissionLevel.EDIT, owner, null
        ));

        // Editor requests a download token
        MvcResult res = mockMvc.perform(post("/api/documents/" + doc.getId() + "/download-token")
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isOk())
                .andReturn();

        String tokenValue = objectMapper.readTree(res.getResponse().getContentAsString()).get("token").asText();
        assertThat(tokenValue).isNotBlank();

        // 1. Owner revokes the permission grant
        mockMvc.perform(delete("/api/permissions/" + perm.getId())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNoContent());

        // Now downloading with the previously issued token must fail because permission was revoked!
        mockMvc.perform(get("/api/documents/download/" + tokenValue))
                .andExpect(status().isForbidden());

        // 2. Test user deactivation: Grant permission on dedicated document and issue a new token
        Document docDeact = documentRepository.save(new Document(
                "Deact Security Test.pdf", "Deact Security Test.pdf", "key_deact_" + UUID.randomUUID(),
                "application/pdf", 1024L, "hash", "General", owner, null
        ));

        permissionRepository.save(new DocumentPermission(
                docDeact, editor, PermissionLevel.EDIT, owner, null
        ));

        MvcResult res2 = mockMvc.perform(post("/api/documents/" + docDeact.getId() + "/download-token")
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isOk())
                .andReturn();
        String tokenValue2 = objectMapper.readTree(res2.getResponse().getContentAsString()).get("token").asText();

        // Deactivate editor
        editor.setActive(false);
        userRepository.save(editor);

        try {
            // Downloading with the token must fail because user account is deactivated!
            mockMvc.perform(get("/api/documents/download/" + tokenValue2))
                    .andExpect(status().isForbidden());
        } finally {
            // Restore editor active status for subsequent tests
            editor.setActive(true);
            userRepository.save(editor);
        }
    }

    @Test
    @DisplayName("Security Test 24: Self-approval of access requests and renewals is strictly forbidden")
    void test24_selfApprovalOfAccessRequestAndRenewalIsForbidden() throws Exception {
        // Create dedicated fresh document for this test
        Document doc = documentRepository.save(new Document(
                "Self Approval Fresh.pdf", "Self Approval Fresh.pdf", "key_sa_" + UUID.randomUUID(),
                "application/pdf", 1024L, "hash_sa", "General", owner, null
        ));

        // Alex requests access
        CreateAccessRequest arReq = new CreateAccessRequest(doc.getId(), PermissionLevel.READ, "Need access");
        MvcResult arResult = mockMvc.perform(post("/api/requests")
                        .header("Authorization", "Bearer " + viewer2Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(arReq)))
                .andExpect(status().isOk())
                .andReturn();

        UUID arId = objectMapper.readTree(arResult.getResponse().getContentAsString()).get("id").traverse(objectMapper).readValueAs(UUID.class);

        // Alex attempts to approve their own request -> 403 Forbidden!
        ReviewAccessRequest selfApproval = new ReviewAccessRequest(true, "Self approved", null);
        mockMvc.perform(post("/api/requests/" + arId + "/review")
                        .header("Authorization", "Bearer " + viewer2Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(selfApproval)))
                .andExpect(status().isForbidden());

        // Test Renewal Self-Approval:
        DocumentPermission perm = permissionRepository.save(new DocumentPermission(
                doc, viewer, PermissionLevel.READ, owner, Instant.now().plusSeconds(3600)
        ));

        CreateRenewalRequest renReq = new CreateRenewalRequest(perm.getId(), "Need extension", 10);
        MvcResult renResult = mockMvc.perform(post("/api/renewals")
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(renReq)))
                .andExpect(status().isOk())
                .andReturn();

        UUID renId = objectMapper.readTree(renResult.getResponse().getContentAsString()).get("id").traverse(objectMapper).readValueAs(UUID.class);

        // Requester (viewer) attempts to approve their own renewal -> 403 Forbidden!
        com.trustvault.dto.RenewalRequestDtos.ReviewRenewalRequest selfRenReview =
                new com.trustvault.dto.RenewalRequestDtos.ReviewRenewalRequest(true, "Self approved", 10);
        mockMvc.perform(post("/api/renewals/" + renId + "/review")
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(selfRenReview)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Security Test 25: Concurrent audit writes preserve a verifiable hash chain")
    void test25_concurrentAuditWritesPreserveVerifiableChain() throws Exception {
        int threadCount = 10;
        int eventsPerThread = 5;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        for (int i = 0; i < threadCount; i++) {
            final int threadId = i;
            executor.submit(() -> {
                try {
                    startLatch.await(); // Synchronize all threads to start at the exact same moment
                    for (int j = 0; j < eventsPerThread; j++) {
                        auditService.logEvent(
                                admin,
                                AuditAction.TAMPER_VERIFICATION_CHECK,
                                "SYSTEM",
                                "item-" + threadId + "-" + j,
                                AuditResult.SUCCESS,
                                "Concurrent test event from thread " + threadId + " iteration " + j,
                                "127.0.0.1",
                                "ConcurrentTestRunner/1.0"
                        );
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        // Fire all threads simultaneously
        startLatch.countDown();
        boolean completed = doneLatch.await(30, TimeUnit.SECONDS);
        executor.shutdown();

        assertThat(completed).isTrue();

        // Verify that the hash chain is 100% valid and unbroken despite concurrent writes!
        var verification = auditService.verifyChainIntegrity();
        assertThat(verification.valid()).isTrue();
        assertThat(verification.brokenRecordId()).isNull();
    }

    @Test
    @DisplayName("Security Test 26: Project IDOR protection prevents unauthorized access to project members")
    void test26_projectMemberCannotAccessUnrelatedDocumentsAndIDORProtected() throws Exception {
        // Owner creates a private project
        Project project = projectRepository.save(new Project("Top Secret Project", "Restricted", owner));

        // Viewer 2 (Alex) is NOT a member and NOT the owner of the project
        // Alex attempts to fetch project members -> 403 Forbidden!
        mockMvc.perform(get("/api/projects/" + project.getId() + "/members")
                        .header("Authorization", "Bearer " + viewer2Token))
                .andExpect(status().isForbidden());

        // Alex attempts to fetch project details by ID -> 403 Forbidden!
        mockMvc.perform(get("/api/projects/" + project.getId())
                        .header("Authorization", "Bearer " + viewer2Token))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Security Test 27: Inactive account login attempt is rejected")
    void test27_inactiveAccountLoginIsRejected() throws Exception {
        LoginRequest inactiveLogin = new LoginRequest("inactive@trustvault.local", "TrustVault@2025!");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(inactiveLogin)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("deactivated")));
    }

    @Test
    @DisplayName("Security Test 28: Valid active administrator login succeeds with JWT and ROLE_ADMIN")
    void test28_validActiveAdminLoginSucceeds() throws Exception {
        LoginRequest adminLogin = new LoginRequest("admin@trustvault.local", "TrustVault@2025!");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(adminLogin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.email").value("admin@trustvault.local"))
                .andExpect(jsonPath("$.role").value("ROLE_ADMIN"))
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    @DisplayName("Security Test 29: Admin user provisioning")
    void test29_adminUserProvisioning() throws Exception {
        CreateUserRequest req = new CreateUserRequest("newemp@trustvault.local", null, "New Employee", Role.ROLE_VIEWER);
        mockMvc.perform(post("/api/admin/users")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }
}
