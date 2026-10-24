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
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public class TrustVaultProjectDocumentSecurityTests {

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
    private JwtTokenProvider jwtTokenProvider;

    private User manager;
    private User member;
    private User otherMember;
    private User crossClientUser;

    private String managerToken;
    private String memberToken;
    private String otherMemberToken;
    private String crossClientToken;

    private Client clientAlpha;
    private Client clientBeta;

    private Project alphaProject;
    private Project otherAlphaProject;
    private Project betaProject;

    private Document doc1;
    private Document doc2;
    private Document doc3;

    @BeforeEach
    void setUp() {
        clientAlpha = clientRepository.findByCode("CLIENT_PRIMARY").orElseGet(() ->
                clientRepository.save(new Client(UUID.fromString("11111111-1111-1111-1111-111111111111"), "Client Alpha", "CLIENT_PRIMARY")));

        clientBeta = clientRepository.findByCode("CLIENT_BETA").orElseGet(() ->
                clientRepository.save(new Client(UUID.fromString("22222222-2222-2222-2222-222222222222"), "Client Beta", "CLIENT_BETA")));

        // Manager (krishna / owner role)
        manager = userRepository.findByEmailIgnoreCase("owner@trustvault.local").orElseThrow();
        managerToken = jwtTokenProvider.generateToken(manager);

        // Project member (sita / workshop role)
        member = userRepository.findByEmailIgnoreCase("sita@trustvault.local").orElseThrow();
        memberToken = jwtTokenProvider.generateToken(member);

        // Another member in same client but not in alphaProject
        otherMember = userRepository.findByEmailIgnoreCase("lakshman@trustvault.local").orElseGet(() ->
                userRepository.findByEmailIgnoreCase("admin@trustvault.local").orElseThrow());
        otherMemberToken = jwtTokenProvider.generateToken(otherMember);

        // User belonging to Client Beta
        crossClientUser = userRepository.findByEmailIgnoreCase("clientb_user@trustvault.local").orElseThrow();
        crossClientToken = jwtTokenProvider.generateToken(crossClientUser);

        // 1. Manager creates a project and adds member
        alphaProject = new Project("Engineering Architecture Workshop", "Architecture sprint", manager);
        alphaProject.setClient(clientAlpha);
        alphaProject = projectRepository.save(alphaProject);

        ProjectMember pm = new ProjectMember(alphaProject, member, "Workshop Contributor", true, false);
        projectMemberRepository.save(pm);

        otherAlphaProject = new Project("Marketing Isolated Project", "Marketing assets", manager);
        otherAlphaProject.setClient(clientAlpha);
        otherAlphaProject = projectRepository.save(otherAlphaProject);

        betaProject = new Project("Beta Confidential Workspace", "Client Beta project", crossClientUser);
        betaProject.setClient(clientBeta);
        betaProject = projectRepository.save(betaProject);

        // 2. Manager uploads three documents to alphaProject without granting member access
        doc1 = new Document(
                "excel-for-data-analysis.xlsx",
                "excel-for-data-analysis.xlsx",
                UUID.randomUUID().toString(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                2048L,
                "sha256-hash-doc1",
                "Analytics",
                manager,
                alphaProject
        );
        doc1.setClient(clientAlpha);
        doc1 = documentRepository.save(doc1);

        doc2 = new Document(
                "Large_Shopping_Dress_Data.xlsx",
                "Large_Shopping_Dress_Data.xlsx",
                UUID.randomUUID().toString(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                4096L,
                "sha256-hash-doc2",
                "Finance",
                manager,
                alphaProject
        );
        doc2.setClient(clientAlpha);
        doc2 = documentRepository.save(doc2);

        doc3 = new Document(
                "System_Security_Blueprint.pdf",
                "System_Security_Blueprint.pdf",
                UUID.randomUUID().toString(),
                "application/pdf",
                8192L,
                "sha256-hash-doc3",
                "Engineering",
                manager,
                alphaProject
        );
        doc3.setClient(clientAlpha);
        doc3 = documentRepository.save(doc3);

        // Ensure no initial document-level permissions exist for member on any of these three documents
        permissionRepository.findByDocumentAndUser(doc1, member).ifPresent(permissionRepository::delete);
        permissionRepository.findByDocumentAndUser(doc2, member).ifPresent(permissionRepository::delete);
        permissionRepository.findByDocumentAndUser(doc3, member).ifPresent(permissionRepository::delete);
    }

    @Test
    @DisplayName("Requirements 1 to 5: Member sees safe metadata with userAccessLevel=NONE (No Access), direct preview/download/edit returns 403")
    void test01_memberSeesSafeMetadataWithNoAccessAndDirectActionsForbidden() throws Exception {
        // Requirement 3 & 4: Member sees all three document names and safe metadata, all three show userAccessLevel=NONE
        mockMvc.perform(get("/api/documents")
                        .param("projectId", alphaProject.getId().toString())
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                // doc1: excel-for-data-analysis.xlsx
                .andExpect(jsonPath("$[?(@.id == '" + doc1.getId() + "')].title").value("excel-for-data-analysis.xlsx"))
                .andExpect(jsonPath("$[?(@.id == '" + doc1.getId() + "')].category").value("Analytics"))
                .andExpect(jsonPath("$[?(@.id == '" + doc1.getId() + "')].ownerName").value(manager.getFullName()))
                .andExpect(jsonPath("$[?(@.id == '" + doc1.getId() + "')].userAccessLevel").value("NONE"))
                .andExpect(jsonPath("$[?(@.id == '" + doc1.getId() + "')].canRead").value(false))
                .andExpect(jsonPath("$[?(@.id == '" + doc1.getId() + "')].canEdit").value(false))
                // doc2: Large_Shopping_Dress_Data.xlsx
                .andExpect(jsonPath("$[?(@.id == '" + doc2.getId() + "')].title").value("Large_Shopping_Dress_Data.xlsx"))
                .andExpect(jsonPath("$[?(@.id == '" + doc2.getId() + "')].category").value("Finance"))
                .andExpect(jsonPath("$[?(@.id == '" + doc2.getId() + "')].userAccessLevel").value("NONE"))
                .andExpect(jsonPath("$[?(@.id == '" + doc2.getId() + "')].canRead").value(false))
                .andExpect(jsonPath("$[?(@.id == '" + doc2.getId() + "')].canEdit").value(false))
                // doc3: System_Security_Blueprint.pdf
                .andExpect(jsonPath("$[?(@.id == '" + doc3.getId() + "')].title").value("System_Security_Blueprint.pdf"))
                .andExpect(jsonPath("$[?(@.id == '" + doc3.getId() + "')].userAccessLevel").value("NONE"))
                .andExpect(jsonPath("$[?(@.id == '" + doc3.getId() + "')].canRead").value(false))
                .andExpect(jsonPath("$[?(@.id == '" + doc3.getId() + "')].canEdit").value(false));

        // Requirement 5: Direct preview, download, and edit API attempts return 403 Forbidden
        // Direct preview attempt for doc1
        mockMvc.perform(get("/api/documents/" + doc1.getId() + "/preview")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isForbidden());

        // Direct download token attempt for doc1
        mockMvc.perform(post("/api/documents/" + doc1.getId() + "/download-token")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isForbidden());

        // Direct edit attempt for doc1
        DocumentUpdateRequest editRequest = new DocumentUpdateRequest("Tampered Title", "Hacked Category");
        mockMvc.perform(put("/api/documents/" + doc1.getId())
                        .header("Authorization", "Bearer " + memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(editRequest)))
                .andExpect(status().isForbidden());

        // Direct delete attempt for doc1
        mockMvc.perform(delete("/api/documents/" + doc1.getId())
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isForbidden());

        // Same for doc2
        mockMvc.perform(get("/api/documents/" + doc2.getId() + "/preview")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/documents/" + doc2.getId() + "/download-token")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/documents/" + doc2.getId())
                        .header("Authorization", "Bearer " + memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(editRequest)))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/documents/" + doc2.getId())
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Requirements 6, 7 & 8: Manager grants READ to one document; only that document allows preview; others remain inaccessible")
    void test02_grantReadToOneDocumentAllowsOnlyThatDocumentPreview() throws Exception {
        // Manager grants READ to doc1 (excel-for-data-analysis.xlsx)
        GrantPermissionRequest grantReq = new GrantPermissionRequest(member.getEmail(), PermissionLevel.READ, null, 7);
        mockMvc.perform(post("/api/documents/" + doc1.getId() + "/permissions")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(grantReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.permissionLevel").value("READ"))
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        // Requirement 7: Listing project documents now shows doc1 as READ (canRead=true, canEdit=false)
        mockMvc.perform(get("/api/documents")
                        .param("projectId", alphaProject.getId().toString())
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == '" + doc1.getId() + "')].userAccessLevel").value("READ"))
                .andExpect(jsonPath("$[?(@.id == '" + doc1.getId() + "')].canRead").value(true))
                .andExpect(jsonPath("$[?(@.id == '" + doc1.getId() + "')].canEdit").value(false))
                // Requirement 8: Other documents remain inaccessible (NONE, canRead=false)
                .andExpect(jsonPath("$[?(@.id == '" + doc2.getId() + "')].userAccessLevel").value("NONE"))
                .andExpect(jsonPath("$[?(@.id == '" + doc2.getId() + "')].canRead").value(false))
                .andExpect(jsonPath("$[?(@.id == '" + doc3.getId() + "')].userAccessLevel").value("NONE"))
                .andExpect(jsonPath("$[?(@.id == '" + doc3.getId() + "')].canRead").value(false));

        // Member can now preview doc1
        mockMvc.perform(get("/api/documents/" + doc1.getId() + "/preview")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userAccessLevel").value("READ"));

        // But member still CANNOT download doc1 (READ permission does not permit download)
        mockMvc.perform(post("/api/documents/" + doc1.getId() + "/download-token")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isForbidden());

        // Member still CANNOT edit doc1
        DocumentUpdateRequest editRequest = new DocumentUpdateRequest("Tampered Title", "Hacked Category");
        mockMvc.perform(put("/api/documents/" + doc1.getId())
                        .header("Authorization", "Bearer " + memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(editRequest)))
                .andExpect(status().isForbidden());

        // Member still CANNOT delete doc1 (READ permission does not permit delete)
        mockMvc.perform(delete("/api/documents/" + doc1.getId())
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isForbidden());

        // doc2 and doc3 direct preview remains forbidden
        mockMvc.perform(get("/api/documents/" + doc2.getId() + "/preview")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/documents/" + doc3.getId() + "/preview")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Requirement 9: Manager revokes READ, and access is immediately denied")
    void test03_managerRevokesReadAccessImmediatelyDenied() throws Exception {
        // Manager grants READ to doc1
        GrantPermissionRequest grantReq = new GrantPermissionRequest(member.getEmail(), PermissionLevel.READ, null, 7);
        String permResponse = mockMvc.perform(post("/api/documents/" + doc1.getId() + "/permissions")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(grantReq)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        UUID permId = UUID.fromString(objectMapper.readTree(permResponse).get("id").asText());

        // Verify member has preview access
        mockMvc.perform(get("/api/documents/" + doc1.getId() + "/preview")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk());

        // Manager revokes the permission
        mockMvc.perform(delete("/api/permissions/" + permId)
                        .header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isNoContent());

        // Access is immediately denied (403 Forbidden)
        mockMvc.perform(get("/api/documents/" + doc1.getId() + "/preview")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isForbidden());

        // Listing project documents now reflects REVOKED / NONE (canRead=false)
        mockMvc.perform(get("/api/documents")
                        .param("projectId", alphaProject.getId().toString())
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == '" + doc1.getId() + "')].canRead").value(false));
    }

    @Test
    @DisplayName("Requirement 10: Cross-client and cross-project metadata remains strictly isolated")
    void test04_crossClientAndCrossProjectMetadataIsolation() throws Exception {
        // 1. Cross-client access attempt: User from Client Beta tries to list documents of Client Alpha project -> 403 Forbidden
        mockMvc.perform(get("/api/documents")
                        .param("projectId", alphaProject.getId().toString())
                        .header("Authorization", "Bearer " + crossClientToken))
                .andExpect(status().isForbidden());

        // 2. Non-member access attempt: User from same client but NOT a member of alphaProject tries to list documents -> 403 Forbidden
        mockMvc.perform(get("/api/documents")
                        .param("projectId", otherAlphaProject.getId().toString())
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isForbidden());

        // 3. Direct metadata retrieval attempt of cross-client document -> 403 Forbidden
        mockMvc.perform(get("/api/documents/" + doc1.getId())
                        .header("Authorization", "Bearer " + crossClientToken))
                .andExpect(status().isForbidden());
    }
}
