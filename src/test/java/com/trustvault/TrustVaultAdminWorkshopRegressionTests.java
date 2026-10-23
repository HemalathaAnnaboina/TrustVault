package com.trustvault;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.trustvault.dto.DocumentDtos.DocumentUpdateRequest;
import com.trustvault.dto.ProjectDtos.AddMemberRequest;
import com.trustvault.dto.ProjectDtos.UpdateMemberPermissionsRequest;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public class TrustVaultAdminWorkshopRegressionTests {

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
    private ClientRepository clientRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    private User admin;
    private User managerA;
    private User managerB;
    private Project projectA;
    private Project projectB;
    private Client primaryClient;

    private String adminToken;
    private String managerAToken;
    private String managerBToken;

    @BeforeEach
    void setUp() {
        primaryClient = clientRepository.findByCode("CLIENT_PRIMARY").orElseGet(() ->
                clientRepository.save(new Client(UUID.fromString("11111111-1111-1111-1111-111111111111"), "TrustVault Primary", "CLIENT_PRIMARY")));

        admin = userRepository.findByEmailIgnoreCase("admin@trustvault.local").orElseThrow();
        adminToken = jwtTokenProvider.generateToken(admin);

        managerA = userRepository.findByEmailIgnoreCase("owner@trustvault.local").orElseThrow();
        managerAToken = jwtTokenProvider.generateToken(managerA);

        managerB = userRepository.findByEmailIgnoreCase("manager_b@trustvault.local").orElseGet(() -> {
            User u = new User("manager_b@trustvault.local", admin.getPasswordHash(), "Manager Beta", Role.ROLE_MANAGER, true);
            u.setClient(primaryClient);
            return userRepository.save(u);
        });
        managerBToken = jwtTokenProvider.generateToken(managerB);

        projectA = projectRepository.findAll().stream()
                .filter(p -> p.getOwner().getId().equals(managerA.getId()))
                .findFirst().orElseGet(() -> {
                    Project p = new Project("Project Alpha", "Primary workspace", managerA);
                    p.setClient(primaryClient);
                    return projectRepository.save(p);
                });

        projectB = projectRepository.findAll().stream()
                .filter(p -> p.getOwner().getId().equals(managerB.getId()))
                .findFirst().orElseGet(() -> {
                    Project p = new Project("Project Beta Isolated", "Secondary workspace", managerB);
                    p.setClient(primaryClient);
                    return projectRepository.save(p);
                });
    }

    @Test
    @DisplayName("Regression 1: GET /api/admin/users and GET /api/projects return 200 OK without HTTP 500")
    void test01_endpointsReturn200Without500() throws Exception {
        // Admin gets all users
        mockMvc.perform(get("/api/admin/users")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].email").isNotEmpty());

        // Admin gets all projects
        mockMvc.perform(get("/api/projects")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());

        // Manager gets authorized projects
        mockMvc.perform(get("/api/projects")
                        .header("Authorization", "Bearer " + managerAToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    @DisplayName("Regression 2: Admin creates Manager and Workshop Member; persisted in DB and not automatically added to projects")
    void test02_adminCreatesManagerAndWorkshopMemberIsolatedFromProjects() throws Exception {
        String managerEmail = "new_manager_" + UUID.randomUUID().toString().substring(0, 8) + "@trustvault.local";
        CreateUserRequest createManager = new CreateUserRequest(
                managerEmail, "Pass1234!", "New Test Manager", Role.ROLE_MANAGER, null
        );

        MvcResult mgrResult = mockMvc.perform(post("/api/admin/users")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createManager)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(managerEmail))
                .andExpect(jsonPath("$.role").value("ROLE_MANAGER"))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.projectNames").isEmpty())
                .andReturn();

        UUID createdManagerId = UUID.fromString(objectMapper.readTree(mgrResult.getResponse().getContentAsString()).get("id").asText());
        User persistedManager = userRepository.findById(createdManagerId).orElseThrow();
        assertThat(persistedManager.getRole()).isEqualTo(Role.ROLE_MANAGER);
        assertThat(projectMemberRepository.findByUser(persistedManager)).isEmpty();

        // Admin creates Workshop Member
        String memberEmail = "workshop_member_" + UUID.randomUUID().toString().substring(0, 8) + "@trustvault.local";
        CreateUserRequest createMember = new CreateUserRequest(
                memberEmail, "Pass1234!", "New Workshop Member", Role.ROLE_WORKSHOP_MEMBER, null
        );

        MvcResult memResult = mockMvc.perform(post("/api/admin/users")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createMember)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(memberEmail))
                .andExpect(jsonPath("$.role").value("ROLE_WORKSHOP_MEMBER"))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.projectNames").isEmpty())
                .andReturn();

        UUID createdMemberId = UUID.fromString(objectMapper.readTree(memResult.getResponse().getContentAsString()).get("id").asText());
        User persistedMember = userRepository.findById(createdMemberId).orElseThrow();
        assertThat(persistedMember.getRole()).isEqualTo(Role.ROLE_WORKSHOP_MEMBER);
        assertThat(projectMemberRepository.findByUser(persistedMember)).isEmpty();

        // Verify both appear in Admin Users list
        mockMvc.perform(get("/api/admin/users")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.email == '" + managerEmail + "')]").exists())
                .andExpect(jsonPath("$[?(@.email == '" + memberEmail + "')]").exists());
    }

    @Test
    @DisplayName("Regression 3: Manager assigns, updates, and revokes Reader vs Editor permissions in authorized project")
    void test03_managerManagesWorkshopMembersReaderAndEditorLevels() throws Exception {
        String memberEmail = "member_perm_" + UUID.randomUUID().toString().substring(0, 8) + "@trustvault.local";
        User memberUser = userRepository.save(new User(memberEmail, admin.getPasswordHash(), "Perm Member", Role.ROLE_WORKSHOP_MEMBER, true));
        memberUser.setClient(primaryClient);
        userRepository.save(memberUser);

        // 1. Manager A adds member to Project A as Reader (canView=true, canEdit=false)
        AddMemberRequest addReq = new AddMemberRequest(memberEmail, "Reader Contributor", true, false, null);
        MvcResult addRes = mockMvc.perform(post("/api/projects/" + projectA.getId() + "/members")
                        .header("Authorization", "Bearer " + managerAToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(addReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userEmail").value(memberEmail))
                .andExpect(jsonPath("$.canView").value(true))
                .andExpect(jsonPath("$.canEdit").value(false))
                .andReturn();

        UUID memberRecordId = UUID.fromString(objectMapper.readTree(addRes.getResponse().getContentAsString()).get("id").asText());

        // 2. Manager A queries project members list
        mockMvc.perform(get("/api/projects/" + projectA.getId() + "/members")
                        .header("Authorization", "Bearer " + managerAToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.userEmail == '" + memberEmail + "')].canView").value(true))
                .andExpect(jsonPath("$[?(@.userEmail == '" + memberEmail + "')].canEdit").value(false));

        // 3. Manager A updates member to Editor (canView=true, canEdit=true)
        UpdateMemberPermissionsRequest updateReq = new UpdateMemberPermissionsRequest(true, true, "Lead Editor", "ACTIVE");
        mockMvc.perform(put("/api/projects/" + projectA.getId() + "/members/" + memberRecordId)
                        .header("Authorization", "Bearer " + managerAToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canView").value(true))
                .andExpect(jsonPath("$.canEdit").value(true))
                .andExpect(jsonPath("$.responsibility").value("Lead Editor"));

        // 4. Manager A revokes / removes member from project
        mockMvc.perform(delete("/api/projects/" + projectA.getId() + "/members/" + memberRecordId)
                        .header("Authorization", "Bearer " + managerAToken))
                .andExpect(status().isNoContent());

        assertThat(projectMemberRepository.findById(memberRecordId)).isEmpty();
    }

    @Test
    @DisplayName("Regression 4: Manager isolation - Manager cannot manage members or share documents of another project")
    void test04_managerIsolationEnforcedAgainstOtherProjects() throws Exception {
        String memberEmail = "target_member_" + UUID.randomUUID().toString().substring(0, 8) + "@trustvault.local";
        User memberUser = userRepository.save(new User(memberEmail, admin.getPasswordHash(), "Target Member", Role.ROLE_WORKSHOP_MEMBER, true));
        memberUser.setClient(primaryClient);
        userRepository.save(memberUser);

        // Manager A attempts to add member to Manager B's Project B -> 403 Forbidden
        AddMemberRequest addReq = new AddMemberRequest(memberEmail, "Intruder", true, false, null);
        mockMvc.perform(post("/api/projects/" + projectB.getId() + "/members")
                        .header("Authorization", "Bearer " + managerAToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(addReq)))
                .andExpect(status().isForbidden());

        // Manager A attempts to delete Manager B's project -> 403 Forbidden
        mockMvc.perform(delete("/api/projects/" + projectB.getId())
                        .header("Authorization", "Bearer " + managerAToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Regression 5: Reader cannot edit or delete documents; Editor cannot delete documents")
    void test05_readerAndEditorPermissionBoundariesEnforced() throws Exception {
        // Document owned by managerA in projectA
        Document doc = documentRepository.save(new Document(
                "Boundaries Policy.pdf", "boundaries.pdf", UUID.randomUUID().toString(),
                "application/pdf", 1024L, "dummyhash1", "Policy", managerA, projectA
        ));
        doc.setClient(primaryClient);
        doc = documentRepository.save(doc);

        // Create Reader member
        User readerUser = userRepository.save(new User("reader_user@trustvault.local", admin.getPasswordHash(), "Reader", Role.ROLE_WORKSHOP_MEMBER, true));
        readerUser.setClient(primaryClient);
        userRepository.save(readerUser);
        projectMemberRepository.save(new ProjectMember(projectA, readerUser, "Reader Member", true, false));
        permissionRepository.save(new DocumentPermission(doc, readerUser, PermissionLevel.READ, managerA, Instant.now().plusSeconds(86400)));
        String readerToken = jwtTokenProvider.generateToken(readerUser);

        // Create Editor member
        User editorUser = userRepository.save(new User("editor_user@trustvault.local", admin.getPasswordHash(), "Editor", Role.ROLE_WORKSHOP_MEMBER, true));
        editorUser.setClient(primaryClient);
        userRepository.save(editorUser);
        projectMemberRepository.save(new ProjectMember(projectA, editorUser, "Editor Member", true, true));
        permissionRepository.save(new DocumentPermission(doc, editorUser, PermissionLevel.EDIT, managerA, Instant.now().plusSeconds(86400)));
        String editorToken = jwtTokenProvider.generateToken(editorUser);

        // 1. Reader can preview/read document
        mockMvc.perform(get("/api/documents/" + doc.getId())
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isOk());

        // 2. Reader cannot edit document -> 403 Forbidden
        DocumentUpdateRequest editReq = new DocumentUpdateRequest("Reader Overwrite Attempt", "General");
        mockMvc.perform(put("/api/documents/" + doc.getId())
                        .header("Authorization", "Bearer " + readerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(editReq)))
                .andExpect(status().isForbidden());

        // 3. Reader cannot delete document -> 403 Forbidden
        mockMvc.perform(delete("/api/documents/" + doc.getId())
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isForbidden());

        // 4. Editor can edit document -> 200 OK
        DocumentUpdateRequest validEdit = new DocumentUpdateRequest("Editor Authorized Edit", "Policy");
        mockMvc.perform(put("/api/documents/" + doc.getId())
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validEdit)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Editor Authorized Edit"));

        // 5. Editor CANNOT delete document -> 403 Forbidden
        mockMvc.perform(delete("/api/documents/" + doc.getId())
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());

        // 6. Reader cannot upload documents to project without canEdit -> 403 Forbidden
        MockMultipartFile file = new MockMultipartFile("file", "unauth.pdf", "application/pdf", "%PDF-test".getBytes());
        mockMvc.perform(multipart("/api/documents")
                        .file(file)
                        .param("title", "Reader Unauthorized Upload")
                        .param("projectId", projectA.getId().toString())
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isForbidden());

        // 7. Editor CAN upload documents to project where canEdit=true -> 200 OK
        MockMultipartFile editorFile = new MockMultipartFile("file", "editor_doc.pdf", "application/pdf", "%PDF-test".getBytes());
        mockMvc.perform(multipart("/api/documents")
                        .file(editorFile)
                        .param("title", "Editor Authorized Upload")
                        .param("projectId", projectA.getId().toString())
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Editor Authorized Upload"));
    }
}
