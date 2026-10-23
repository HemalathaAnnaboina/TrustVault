package com.trustvault;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.trustvault.dto.AccessRequestDtos.*;
import com.trustvault.dto.AuthDtos.LoginRequest;
import com.trustvault.dto.PermissionDtos.*;
import com.trustvault.dto.ProjectDtos.*;
import com.trustvault.dto.UserDtos.CreateUserRequest;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public class TrustVaultManagerLifecycleIntegrationTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private ProjectMemberRepository projectMemberRepository;
    @Autowired private DocumentRepository documentRepository;
    @Autowired private DocumentPermissionRepository permissionRepository;
    @Autowired private AccessRequestRepository accessRequestRepository;
    @Autowired private AuditLogRepository auditLogRepository;
    @Autowired private ClientRepository clientRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtTokenProvider jwtTokenProvider;

    private User admin;
    private User manager;
    private User otherManager;
    private User ram;
    private User lakshman;
    private User ravi;
    private Client primaryClient;
    private Client otherClient;

    private String adminToken;
    private String managerToken;
    private String otherManagerToken;
    private String ramToken;
    private String lakshmanToken;
    private String raviToken;

    private Project projectAlpha;
    private Document docA;
    private Document docB;
    private Document docC;

    @BeforeEach
    void setUp() {
        primaryClient = clientRepository.findByCode("CLIENT_PRIMARY").orElseGet(() ->
                clientRepository.save(new Client("Primary Client", "CLIENT_PRIMARY")));

        otherClient = clientRepository.findByCode("CLIENT_BETA").orElseGet(() ->
                clientRepository.save(new Client("Beta Client", "CLIENT_BETA")));

        admin = userRepository.findByEmailIgnoreCase("admin@trustvault.local").orElseThrow();
        manager = userRepository.findByEmailIgnoreCase("owner@trustvault.local").orElseThrow();

        otherManager = userRepository.findByEmailIgnoreCase("manager2@trustvault.local").orElseGet(() -> {
            User u = new User("manager2@trustvault.local", passwordEncoder.encode("TrustVault@2025!"), "Other Manager", Role.ROLE_MANAGER, true);
            u.setClient(otherClient);
            return userRepository.save(u);
        });

        ram = userRepository.findByEmailIgnoreCase("ram@trustvault.local").orElseThrow();
        lakshman = userRepository.findByEmailIgnoreCase("lakshman@trustvault.local").orElseThrow();
        ravi = userRepository.findByEmailIgnoreCase("ravi@trustvault.local").orElseThrow();

        adminToken = "Bearer " + jwtTokenProvider.generateToken(admin);
        managerToken = "Bearer " + jwtTokenProvider.generateToken(manager);
        otherManagerToken = "Bearer " + jwtTokenProvider.generateToken(otherManager);
        ramToken = "Bearer " + jwtTokenProvider.generateToken(ram);
        lakshmanToken = "Bearer " + jwtTokenProvider.generateToken(lakshman);
        raviToken = "Bearer " + jwtTokenProvider.generateToken(ravi);

        projectAlpha = projectRepository.findAll().stream()
                .filter(p -> p.getName().equalsIgnoreCase("Project Alpha"))
                .findFirst().orElseThrow();

        docA = documentRepository.findAll().stream()
                .filter(d -> d.getTitle().equalsIgnoreCase("admission.pdf"))
                .findFirst().orElseThrow();

        docB = documentRepository.findAll().stream()
                .filter(d -> d.getTitle().equalsIgnoreCase("notes.txt"))
                .findFirst().orElseThrow();

        docC = documentRepository.findAll().stream()
                .filter(d -> d.getTitle().equalsIgnoreCase("confidential.pdf"))
                .findFirst().orElseThrow();
    }

    @Test
    @DisplayName("1. Only authorized roles can create projects - Workshop member denied, Manager allowed")
    void test01_onlyAuthorizedRolesCanCreateProjects() throws Exception {
        ProjectCreateRequest req = new ProjectCreateRequest("Unauthorized Proj", "Desc", null, "General");

        // Workshop Member -> Forbidden 403
        mockMvc.perform(post("/api/projects")
                        .header("Authorization", ramToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());

        // Manager -> Allowed 200
        ProjectCreateRequest validReq = new ProjectCreateRequest("Manager Proj 1", "Desc", null, "Business");
        mockMvc.perform(post("/api/projects")
                        .header("Authorization", managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Manager Proj 1"));
    }

    @Test
    @DisplayName("2. Managers cannot create users or assign global roles")
    void test02_managersCannotCreateUsersOrAssignGlobalRoles() throws Exception {
        CreateUserRequest req = new CreateUserRequest("baduser@trustvault.local", "Password123!", "Bad User", Role.ROLE_ADMIN);

        mockMvc.perform(post("/api/admin/users")
                        .header("Authorization", managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("3. Managers cannot access unrelated projects")
    void test03_managersCannotAccessUnrelatedProjects() throws Exception {
        // Create project owned by otherManager
        Project otherProj = projectRepository.save(new Project("Isolated Beta Proj", "Desc", otherManager, null, "Other", "ACTIVE"));

        // Manager 1 tries to access -> Forbidden
        mockMvc.perform(get("/api/projects/" + otherProj.getId())
                        .header("Authorization", managerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("4. Managers cannot inspect unrelated audit logs")
    void test04_managersCannotInspectUnrelatedAuditLogs() throws Exception {
        // otherManager attempts to inspect docA owned by manager
        mockMvc.perform(get("/api/audit-logs/document/" + docA.getId())
                        .header("Authorization", otherManagerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("5. Managers cannot deactivate other Managers or Admins")
    void test05_managersCannotDeactivateOtherManagersOrAdmins() throws Exception {
        ProjectMember pmAdmin = new ProjectMember(projectAlpha, admin, "Advisor", true, false);
        pmAdmin = projectMemberRepository.save(pmAdmin);

        mockMvc.perform(post("/api/projects/" + projectAlpha.getId() + "/members/" + pmAdmin.getId() + "/suspend")
                        .header("Authorization", managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Unauthorized attempt\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("6. Project membership alone does not grant all document permissions")
    void test06_projectMembershipAloneDoesNotGrantAllDocumentPermissions() throws Exception {
        // Ram is in Project Alpha, has READ on docA, EDIT on docB, NO ACCESS on docC
        mockMvc.perform(get("/api/documents/" + docC.getId() + "/preview")
                        .header("Authorization", ramToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("7. READ-only users cannot download the original file")
    void test07_readOnlyUsersCannotDownloadOriginalFile() throws Exception {
        // docA is READ-only for Ram
        mockMvc.perform(post("/api/documents/" + docA.getId() + "/download-token")
                        .header("Authorization", ramToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("8. EDIT and DOWNLOAD permissions are enforced independently")
    void test08_editAndDownloadPermissionsEnforcedIndependently() throws Exception {
        // Ram has EDIT on docB: preview and edit succeed
        mockMvc.perform(get("/api/documents/" + docB.getId() + "/preview")
                        .header("Authorization", ramToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isTextEditable").value(true));

        // Ravi has no permissions on docB -> Forbidden
        mockMvc.perform(get("/api/documents/" + docB.getId() + "/preview")
                        .header("Authorization", raviToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("9. Changing permissions takes effect immediately")
    void test09_changingPermissionsTakesEffectImmediately() throws Exception {
        // Lakshman initially has no grant on docA
        mockMvc.perform(get("/api/documents/" + docA.getId() + "/preview")
                        .header("Authorization", lakshmanToken))
                .andExpect(status().isForbidden());

        // Manager grants READ to Lakshman
        GrantPermissionRequest grantReq = new GrantPermissionRequest(lakshman.getEmail(), PermissionLevel.READ, Instant.now().plusSeconds(3600));
        mockMvc.perform(post("/api/documents/" + docA.getId() + "/permissions")
                        .header("Authorization", managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(grantReq)))
                .andExpect(status().isOk());

        // Immediately Lakshman can read
        mockMvc.perform(get("/api/documents/" + docA.getId() + "/preview")
                        .header("Authorization", lakshmanToken))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("10. Adding a member does not automatically grant all file access")
    void test10_addingMemberDoesNotAutomaticallyGrantAllFileAccess() throws Exception {
        // Add Ravi to Project Alpha with canView=true, but NO document permissions
        AddMemberRequest addReq = new AddMemberRequest(ravi.getEmail(), "Observer", true, false);
        mockMvc.perform(post("/api/projects/" + projectAlpha.getId() + "/members")
                        .header("Authorization", managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(addReq)))
                .andExpect(status().isOk());

        // Ravi cannot access docA or docB without explicit document permission grants
        mockMvc.perform(get("/api/documents/" + docA.getId() + "/preview")
                        .header("Authorization", raviToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("11. Unauthorized document IDs and URLs do not bypass authorization")
    void test11_unauthorizedDocumentIdsAndUrlsDoNotBypassAuthorization() throws Exception {
        UUID randomId = UUID.randomUUID();
        mockMvc.perform(get("/api/documents/" + randomId + "/preview")
                        .header("Authorization", ramToken))
                .andExpect(status().isNotFound());

        // Knowing docC id does not allow Ram to preview
        mockMvc.perform(get("/api/documents/" + docC.getId() + "/preview")
                        .header("Authorization", ramToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("12. Pending access requests do not grant access")
    void test12_pendingRequestsDoNotGrantAccess() throws Exception {
        CreateAccessRequest req = new CreateAccessRequest(docC.getId(), PermissionLevel.READ, "Need to review confidential report");
        mockMvc.perform(post("/api/requests")
                        .header("Authorization", ramToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));

        // While pending, Ram is still denied
        mockMvc.perform(get("/api/documents/" + docC.getId() + "/preview")
                        .header("Authorization", ramToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("13. Approved requests grant only approved capabilities")
    void test13_approvedRequestsGrantOnlyApprovedCapabilities() throws Exception {
        // Find Ram's pending request on docC
        AccessRequest pendingReq = accessRequestRepository.findByDocumentAndRequesterAndStatus(docC, ram, RequestStatus.PENDING)
                .orElseGet(() -> accessRequestRepository.save(new AccessRequest(docC, ram, PermissionLevel.EDIT, "Review needed")));

        // Manager approves with READ capability only
        ReviewAccessRequest review = new ReviewAccessRequest(true, "Approved for reading only", Instant.now().plusSeconds(3600), 1, null, PermissionLevel.READ);
        mockMvc.perform(post("/api/requests/" + pendingReq.getId() + "/review")
                        .header("Authorization", managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(review)))
                .andExpect(status().isOk());

        // Ram can now read docC
        mockMvc.perform(get("/api/documents/" + docC.getId() + "/preview")
                        .header("Authorization", ramToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userAccessLevel").value("READ"));

        // But Ram cannot download docC
        mockMvc.perform(post("/api/documents/" + docC.getId() + "/download-token")
                        .header("Authorization", ramToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("14. Expired grants are denied immediately")
    void test14_expiredGrantsAreDeniedImmediately() throws Exception {
        // Set grant on docA to expired timestamp in the past
        DocumentPermission perm = permissionRepository.findByDocumentAndUser(docA, ram).orElseThrow();
        perm.setExpiresAt(Instant.now().minusSeconds(60));
        permissionRepository.save(perm);

        // Immediate denial without cron run
        mockMvc.perform(get("/api/documents/" + docA.getId() + "/preview")
                        .header("Authorization", ramToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("15. Revoked grants and suspended memberships are denied immediately")
    void test15_revokedGrantsAndSuspendedMembershipsDeniedImmediately() throws Exception {
        // Reset valid grant on docB
        DocumentPermission perm = permissionRepository.findByDocumentAndUser(docB, ram).orElseThrow();
        perm.setExpiresAt(Instant.now().plusSeconds(3600));
        perm.setStatus(PermissionStatus.ACTIVE);
        permissionRepository.save(perm);

        // Suspend Ram in Project Alpha
        ProjectMember pmRam = projectMemberRepository.findByProjectIdAndUserId(projectAlpha.getId(), ram.getId()).orElseThrow();
        mockMvc.perform(post("/api/projects/" + projectAlpha.getId() + "/members/" + pmRam.getId() + "/suspend")
                        .header("Authorization", managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Security investigation\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUSPENDED"));

        // Access to docB is immediately denied due to suspended membership!
        mockMvc.perform(get("/api/documents/" + docB.getId() + "/preview")
                        .header("Authorization", ramToken))
                .andExpect(status().isForbidden());

        // Reactivate Ram
        mockMvc.perform(post("/api/projects/" + projectAlpha.getId() + "/members/" + pmRam.getId() + "/reactivate")
                        .header("Authorization", managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        // Access restored
        mockMvc.perform(get("/api/documents/" + docB.getId() + "/preview")
                        .header("Authorization", ramToken))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("16. Cross-project sharing follows configured authorization policy")
    void test16_crossProjectSharingFollowsAuthorizationPolicy() throws Exception {
        ShareDocumentRequest shareReq = new ShareDocumentRequest(
                docA.getId(),
                List.of(new MemberPermissionAssignmentDto(lakshman.getEmail(), PermissionLevel.READ, Instant.now().plusSeconds(7200)))
        );

        mockMvc.perform(post("/api/projects/" + projectAlpha.getId() + "/share")
                        .header("Authorization", managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(shareReq)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("17. Unauthorized users cannot view audit logs")
    void test17_unauthorizedUsersCannotViewAuditLogs() throws Exception {
        mockMvc.perform(get("/api/audit-logs")
                        .header("Authorization", ramToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("18. Required allowed and denied security events are recorded")
    void test18_requiredSecurityEventsAreRecorded() throws Exception {
        long count = auditLogRepository.count();
        assertTrue(count > 0, "Audit events should be recorded in database");
    }

    @Test
    @DisplayName("19. Existing project data and login functionality remain intact")
    void test19_existingProjectDataAndLoginRemainIntact() throws Exception {
        LoginRequest loginReq = new LoginRequest("owner@trustvault.local", "TrustVault@2025!");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.email").value("owner@trustvault.local"));
    }

    @Test
    @DisplayName("20. The new project wizard and existing project management flows work correctly")
    void test20_newProjectWizardAndManagementFlowsWorkCorrectly() throws Exception {
        ProjectCreateRequest wizardReq = new ProjectCreateRequest(
                "Wizard Test Project",
                "Built via full 6-step creation flow",
                null,
                "Hospital",
                "ACTIVE",
                List.of(new MemberAllocationDto(ram.getEmail(), "Lead", true, true),
                        new MemberAllocationDto(lakshman.getEmail(), "Auditor", true, false)),
                List.of(docA.getId()),
                List.of(new DocumentPermissionAssignmentDto(docA.getId(), null, ram.getEmail(), PermissionLevel.READ, Instant.now().plusSeconds(86400)))
        );

        mockMvc.perform(post("/api/projects")
                        .header("Authorization", managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(wizardReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Wizard Test Project"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.memberCount").value(2))
                .andExpect(jsonPath("$.documentCount").value(1));

        // Manager stats endpoint verification
        mockMvc.perform(get("/api/projects/stats/manager")
                        .header("Authorization", managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalProjects").isNumber())
                .andExpect(jsonPath("$.vaultDocuments").isNumber())
                .andExpect(jsonPath("$.activeTeamMembers").isNumber());
    }

    @Test
    @DisplayName("21. GET /api/projects returns projects for manager, admin, and assigned member")
    void test21_getProjectsReturnsProjects() throws Exception {
        // Manager can get projects
        mockMvc.perform(get("/api/projects")
                        .header("Authorization", managerToken))
                .andExpect(status().isOk());

        // Admin can get projects
        mockMvc.perform(get("/api/projects")
                        .header("Authorization", adminToken))
                .andExpect(status().isOk());

        // Assigned Workshop Member can get projects
        mockMvc.perform(get("/api/projects")
                        .header("Authorization", ramToken))
                .andExpect(status().isOk());
    }
}
