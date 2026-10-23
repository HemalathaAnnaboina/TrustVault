package com.trustvault;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.trustvault.dto.PermissionDtos.*;
import com.trustvault.dto.ProjectDtos.*;
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
import org.springframework.test.web.servlet.MvcResult;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public class TrustVaultManagerDurationRegressionTests {

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
    private ClientRepository clientRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    private User managerA;
    private User managerB;
    private User workshopMember;
    private Project projectA;
    private Document documentA;
    private Client primaryClient;

    private String managerAToken;
    private String managerBToken;

    @BeforeEach
    void setUp() {
        primaryClient = clientRepository.findByCode("CLIENT_PRIMARY").orElseGet(() ->
                clientRepository.save(new Client(UUID.fromString("11111111-1111-1111-1111-111111111111"), "TrustVault Primary", "CLIENT_PRIMARY")));

        managerA = userRepository.findByEmailIgnoreCase("owner@trustvault.local").orElseThrow();
        managerAToken = jwtTokenProvider.generateToken(managerA);

        managerB = userRepository.findByEmailIgnoreCase("manager_b@trustvault.local").orElseGet(() -> {
            User u = new User("manager_b@trustvault.local", managerA.getPasswordHash(), "Manager B", Role.ROLE_MANAGER, true);
            u.setClient(primaryClient);
            return userRepository.save(u);
        });
        managerBToken = jwtTokenProvider.generateToken(managerB);

        workshopMember = userRepository.findByEmailIgnoreCase("viewer@trustvault.local").orElseGet(() -> {
            User u = new User("viewer@trustvault.local", managerA.getPasswordHash(), "Workshop User", Role.ROLE_WORKSHOP_MEMBER, true);
            u.setClient(primaryClient);
            return userRepository.save(u);
        });

        projectA = projectRepository.findAll().stream()
                .filter(p -> p.getOwner().getId().equals(managerA.getId()))
                .findFirst().orElseGet(() -> {
                    Project p = new Project("Manager Duration Project", "Workspace for testing durations", managerA);
                    p.setClient(primaryClient);
                    return projectRepository.save(p);
                });

        documentA = documentRepository.findAll().stream()
                .filter(d -> d.getOwner().getId().equals(managerA.getId()))
                .findFirst().orElseGet(() -> {
                    Document doc = new Document(
                            "Duration Policy.pdf", "duration_policy.pdf", UUID.randomUUID().toString(),
                            "application/pdf", 2048L, "dummychecksum123", "Policy", managerA, projectA
                    );
                    doc.setClient(primaryClient);
                    return documentRepository.save(doc);
                });
    }

    @Test
    @DisplayName("1. Project creation with members does NOT grant document permissions implicitly")
    void test01_createProjectDoesNotGrantImplicitFileAccess() throws Exception {
        String memberEmail = "proj_mem_only_" + UUID.randomUUID().toString().substring(0, 8) + "@trustvault.local";
        User newMember = userRepository.save(new User(memberEmail, managerA.getPasswordHash(), "Member Only", Role.ROLE_WORKSHOP_MEMBER, true));
        newMember.setClient(primaryClient);
        userRepository.save(newMember);

        ProjectCreateRequest request = new ProjectCreateRequest(
                "Zero Implicit Access Project",
                "Verifying no implicit file access",
                null,
                "General",
                "ACTIVE",
                List.of(new MemberAllocationDto(memberEmail, "Contributor", true, false)),
                List.of(documentA.getId()),
                List.of(), // No explicit document permissions
                30
        );

        MvcResult result = mockMvc.perform(post("/api/projects")
                        .header("Authorization", "Bearer " + managerAToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andReturn();

        UUID createdProjectId = UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
        Project createdProj = projectRepository.findById(createdProjectId).orElseThrow();

        // Verify member is added to project
        assertThat(projectMemberRepository.existsByProjectIdAndUserId(createdProjectId, newMember.getId())).isTrue();

        // Verify strictly ZERO document permissions exist for this user
        List<DocumentPermission> perms = permissionRepository.findByUserOrderByGrantedAtDesc(newMember);
        assertThat(perms).isEmpty();
    }

    @Test
    @DisplayName("2. Adding member to project does NOT implicitly grant document access")
    void test02_addMemberDoesNotGrantImplicitFileAccess() throws Exception {
        String memberEmail = "add_mem_no_file_" + UUID.randomUUID().toString().substring(0, 8) + "@trustvault.local";
        User newMember = userRepository.save(new User(memberEmail, managerA.getPasswordHash(), "Add Member Only", Role.ROLE_WORKSHOP_MEMBER, true));
        newMember.setClient(primaryClient);
        userRepository.save(newMember);

        AddMemberRequest addReq = new AddMemberRequest(
                memberEmail, "Auditor", true, false, List.of(), 30
        );

        mockMvc.perform(post("/api/projects/" + projectA.getId() + "/members")
                        .header("Authorization", "Bearer " + managerAToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(addReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userEmail").value(memberEmail));

        // Membership created
        assertThat(projectMemberRepository.existsByProjectIdAndUserId(projectA.getId(), newMember.getId())).isTrue();

        // Absolutely NO file permissions created
        assertThat(permissionRepository.findByDocumentAndUser(documentA, newMember)).isEmpty();
    }

    @Test
    @DisplayName("3. Grant document permission with valid duration calculates expiry starting from grant time")
    void test03_grantPermissionWithDurationCalculatesExpiryFromGrantTime() throws Exception {
        String memberEmail = "grant_test_" + UUID.randomUUID().toString().substring(0, 8) + "@trustvault.local";
        User targetUser = userRepository.save(new User(memberEmail, managerA.getPasswordHash(), "Grant Target", Role.ROLE_WORKSHOP_MEMBER, true));
        targetUser.setClient(primaryClient);
        userRepository.save(targetUser);

        // Grant 15 days
        GrantPermissionRequest grantReq = new GrantPermissionRequest(
                memberEmail, PermissionLevel.READ, null, 15
        );

        Instant beforeGrant = Instant.now();
        MvcResult res = mockMvc.perform(post("/api/documents/" + documentA.getId() + "/permissions")
                        .header("Authorization", "Bearer " + managerAToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(grantReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.permissionLevel").value("READ"))
                .andExpect(jsonPath("$.userEmail").value(memberEmail))
                .andReturn();
        Instant afterGrant = Instant.now();

        String expiresAtStr = objectMapper.readTree(res.getResponse().getContentAsString()).get("expiresAt").asText();
        Instant expiresAt = Instant.parse(expiresAtStr);

        // Expiry must be roughly beforeGrant + 15 days
        Instant expectedMin = beforeGrant.plus(Duration.ofDays(15));
        Instant expectedMax = afterGrant.plus(Duration.ofDays(15)).plusSeconds(5);
        assertThat(expiresAt).isBetween(expectedMin, expectedMax);
    }

    @Test
    @DisplayName("4. Grant document permission rejects invalid duration (< 1 or > 30 days)")
    void test04_grantPermissionRejectsInvalidDurations() throws Exception {
        String memberEmail = "invalid_dur_" + UUID.randomUUID().toString().substring(0, 8) + "@trustvault.local";
        User targetUser = userRepository.save(new User(memberEmail, managerA.getPasswordHash(), "Invalid Dur User", Role.ROLE_WORKSHOP_MEMBER, true));
        targetUser.setClient(primaryClient);
        userRepository.save(targetUser);

        // 0 days -> 400 Bad Request
        GrantPermissionRequest zeroReq = new GrantPermissionRequest(memberEmail, PermissionLevel.READ, null, 0);
        mockMvc.perform(post("/api/documents/" + documentA.getId() + "/permissions")
                        .header("Authorization", "Bearer " + managerAToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(zeroReq)))
                .andExpect(status().isBadRequest());

        // Negative days -> 400 Bad Request
        GrantPermissionRequest negReq = new GrantPermissionRequest(memberEmail, PermissionLevel.READ, null, -7);
        mockMvc.perform(post("/api/documents/" + documentA.getId() + "/permissions")
                        .header("Authorization", "Bearer " + managerAToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(negReq)))
                .andExpect(status().isBadRequest());

        // > 30 days -> 400 Bad Request
        GrantPermissionRequest overReq = new GrantPermissionRequest(memberEmail, PermissionLevel.READ, null, 31);
        mockMvc.perform(post("/api/documents/" + documentA.getId() + "/permissions")
                        .header("Authorization", "Bearer " + managerAToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(overReq)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("5. Bulk grant and Project Share enforce 1-30 days duration limits")
    void test05_bulkGrantAndProjectShareEnforceDurationLimits() throws Exception {
        String memberEmail = "bulk_dur_" + UUID.randomUUID().toString().substring(0, 8) + "@trustvault.local";
        User targetUser = userRepository.save(new User(memberEmail, managerA.getPasswordHash(), "Bulk User", Role.ROLE_WORKSHOP_MEMBER, true));
        targetUser.setClient(primaryClient);
        userRepository.save(targetUser);

        // Bulk grant with valid 30 days -> 200 OK
        BulkGrantRequest validBulk = new BulkGrantRequest(
                List.of(documentA.getId()),
                List.of(new BulkAssignment(memberEmail, PermissionLevel.EDIT, null, 30))
        );
        mockMvc.perform(post("/api/permissions/bulk")
                        .header("Authorization", "Bearer " + managerAToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validBulk)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.successful").value(1));

        DocumentPermission perm = permissionRepository.findByDocumentAndUser(documentA, targetUser).orElseThrow();
        assertThat(perm.getPermissionLevel()).isEqualTo(PermissionLevel.EDIT);
        assertThat(perm.getExpiresAt()).isAfter(Instant.now().plus(Duration.ofDays(29)));

        // Project share with invalid duration (> 30) -> 400 Bad Request
        ShareDocumentRequest invalidShare = new ShareDocumentRequest(
                documentA.getId(),
                List.of(new MemberPermissionAssignmentDto(memberEmail, PermissionLevel.READ, null, 45))
        );
        mockMvc.perform(post("/api/projects/" + projectA.getId() + "/share")
                        .header("Authorization", "Bearer " + managerAToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidShare)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("6. Manager isolation enforced: Manager cannot grant permissions or share documents in another manager's project")
    void test06_managerIsolationEnforcedForDurationsAndSharing() throws Exception {
        String memberEmail = "isolation_target_" + UUID.randomUUID().toString().substring(0, 8) + "@trustvault.local";
        User targetUser = userRepository.save(new User(memberEmail, managerA.getPasswordHash(), "Isolation Target", Role.ROLE_WORKSHOP_MEMBER, true));
        targetUser.setClient(primaryClient);
        userRepository.save(targetUser);

        // Manager B attempts to share Manager A's document in Project A -> 403 Forbidden
        ShareDocumentRequest unauthorizedShare = new ShareDocumentRequest(
                documentA.getId(),
                List.of(new MemberPermissionAssignmentDto(memberEmail, PermissionLevel.READ, null, 15))
        );
        mockMvc.perform(post("/api/projects/" + projectA.getId() + "/share")
                        .header("Authorization", "Bearer " + managerBToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(unauthorizedShare)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("7. Manager pending requests and renewals correctly query without inner-join drop and maintain isolation")
    void test07_managerPendingRequestsAndRenewalsRetrievedAndSynchronized() throws Exception {
        String requesterEmail = "req_user_" + UUID.randomUUID().toString().substring(0, 8) + "@trustvault.local";
        User requester = userRepository.save(new User(requesterEmail, managerA.getPasswordHash(), "Requester User", Role.ROLE_WORKSHOP_MEMBER, true));
        requester.setClient(primaryClient);
        userRepository.save(requester);

        // 1. Direct document access request (project is null)
        AccessRequest docReq = new AccessRequest(documentA, null, "DocOnly.pdf", requester, PermissionLevel.READ, "Need doc access", 14);
        accessRequestRepository.save(docReq);

        // 2. Project-level file request (document is null)
        AccessRequest projReq = new AccessRequest(null, projectA, "ProjDoc.pdf", requester, PermissionLevel.EDIT, "Need project file", 21);
        accessRequestRepository.save(projReq);

        // 3. Document permission + renewal request
        DocumentPermission perm = permissionRepository.save(new DocumentPermission(documentA, requester, PermissionLevel.READ, managerA, Instant.now().plus(Duration.ofDays(2))));
        RenewalRequest renewal = new RenewalRequest(perm, requester, "Need extension", 15);
        renewalRequestRepository.save(renewal);

        // 4. Verify /api/projects/stats/manager counts both access and renewal requests
        MvcResult statsResult = mockMvc.perform(get("/api/projects/stats/manager")
                        .header("Authorization", "Bearer " + managerAToken))
                .andExpect(status().isOk())
                .andReturn();
        long pendingBadge = objectMapper.readTree(statsResult.getResponse().getContentAsString()).get("pendingRequests").asLong();
        assertThat(pendingBadge).isGreaterThanOrEqualTo(3L);

        // 5. Verify /api/requests/owner returns both docReq and projReq (neither is dropped by inner joins)
        MvcResult reqResult = mockMvc.perform(get("/api/requests/owner")
                        .header("Authorization", "Bearer " + managerAToken))
                .andExpect(status().isOk())
                .andReturn();
        String reqJson = reqResult.getResponse().getContentAsString();
        assertThat(reqJson).contains(docReq.getId().toString());
        assertThat(reqJson).contains(projReq.getId().toString());

        // 6. Verify /api/renewals/owner returns the renewal request
        MvcResult renResult = mockMvc.perform(get("/api/renewals/owner")
                        .header("Authorization", "Bearer " + managerAToken))
                .andExpect(status().isOk())
                .andReturn();
        String renJson = renResult.getResponse().getContentAsString();
        assertThat(renJson).contains(renewal.getId().toString());

        // 7. Verify Manager B cannot see Manager A's requests
        MvcResult mgrBReqResult = mockMvc.perform(get("/api/requests/owner")
                        .header("Authorization", "Bearer " + managerBToken))
                .andExpect(status().isOk())
                .andReturn();
        String mgrBJson = mgrBReqResult.getResponse().getContentAsString();
        assertThat(mgrBJson).doesNotContain(docReq.getId().toString());
        assertThat(mgrBJson).doesNotContain(projReq.getId().toString());
    }
}

