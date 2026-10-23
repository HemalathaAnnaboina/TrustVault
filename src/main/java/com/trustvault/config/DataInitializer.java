package com.trustvault.config;

import com.trustvault.model.*;
import com.trustvault.repository.*;
import com.trustvault.service.AuditService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.UUID;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final DocumentRepository documentRepository;
    private final DocumentPermissionRepository permissionRepository;
    private final AccessRequestRepository accessRequestRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;
    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final ClientRepository clientRepository;
    private final StarredDocumentRepository starredDocumentRepository;
    private final DocumentVersionRepository documentVersionRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final Path vaultPath;

    public DataInitializer(
            UserRepository userRepository,
            ProjectRepository projectRepository,
            DocumentRepository documentRepository,
            DocumentPermissionRepository permissionRepository,
            AccessRequestRepository accessRequestRepository,
            PasswordEncoder passwordEncoder,
            AuditService auditService,
            GroupRepository groupRepository,
            GroupMemberRepository groupMemberRepository,
            ClientRepository clientRepository,
            StarredDocumentRepository starredDocumentRepository,
            DocumentVersionRepository documentVersionRepository,
            ProjectMemberRepository projectMemberRepository,
            @Value("${trustvault.storage.path:./data/vault}") String storagePath
    ) {
        this.userRepository = userRepository;
        this.projectRepository = projectRepository;
        this.documentRepository = documentRepository;
        this.permissionRepository = permissionRepository;
        this.accessRequestRepository = accessRequestRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
        this.groupRepository = groupRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.clientRepository = clientRepository;
        this.starredDocumentRepository = starredDocumentRepository;
        this.documentVersionRepository = documentVersionRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.vaultPath = Paths.get(storagePath).toAbsolutePath().normalize();
    }

    @Override
    public void run(String... args) throws Exception {
        Files.createDirectories(vaultPath);

        // Ensure Clients Exist
        Client primaryClient = ensureClient(UUID.fromString("11111111-1111-1111-1111-111111111111"), "TrustVault Primary Enterprise", "CLIENT_PRIMARY");
        Client betaClient = ensureClient(UUID.fromString("22222222-2222-2222-2222-222222222222"), "External Isolated Client Beta", "CLIENT_BETA");

        seedGroupsIfEmpty();

        if (userRepository.count() > 0) {
            log.info("TrustVault database already contains user data. Ensuring all roles, clients, and demo accounts are up to date...");
            ensureAccountsAndClients(primaryClient, betaClient);
            return;
        }

        log.info("Initializing TrustVault with secure demo accounts and initial vault items...");

        // 1. Seed Demo Users
        String defaultPasswordHash = passwordEncoder.encode("TrustVault@2025!");

        User admin = new User("admin@trustvault.local", defaultPasswordHash, "Sarah Admin", Role.ROLE_ADMIN, true);
        admin.setClient(primaryClient);
        admin = userRepository.save(admin);

        User owner = new User("owner@trustvault.local", defaultPasswordHash, "Elena Vance (Owner)", Role.ROLE_OWNER, true);
        owner.setClient(primaryClient);
        owner = userRepository.save(owner);

        User editor = new User("editor@trustvault.local", defaultPasswordHash, "Jordan Lee (Editor)", Role.ROLE_EDITOR, true);
        editor.setClient(primaryClient);
        editor = userRepository.save(editor);

        User viewer = new User("viewer@trustvault.local", defaultPasswordHash, "Sam Williams (Viewer)", Role.ROLE_VIEWER, true);
        viewer.setClient(primaryClient);
        viewer = userRepository.save(viewer);

        User alex = new User("alex@trustvault.local", defaultPasswordHash, "Alex Morgan", Role.ROLE_VIEWER, true);
        alex.setClient(primaryClient);
        alex = userRepository.save(alex);

        User inactiveUser = new User("inactive@trustvault.local", defaultPasswordHash, "Inactive User", Role.ROLE_VIEWER, false);
        inactiveUser.setClient(primaryClient);
        userRepository.save(inactiveUser);

        // Cross-client isolated user in Beta Client
        User betaUser = new User("clientb_user@trustvault.local", defaultPasswordHash, "Beta Client Auditor", Role.ROLE_VIEWER, true);
        betaUser.setClient(betaClient);
        betaUser = userRepository.save(betaUser);

        auditService.logEvent(admin, AuditAction.USER_CREATED, "USER", admin.getId().toString(),
                AuditResult.SUCCESS, "System initialized with admin account", "127.0.0.1", "DataInitializer/1.0");

        // 2. Seed Projects
        Project acmeProject = new Project("Acme Corp • 2024", "Corporate strategic documents and financial filings", owner);
        acmeProject.setClient(primaryClient);
        acmeProject = projectRepository.save(acmeProject);

        Project launchProject = new Project("Product Launch", "Confidential product launch assets and roadmap", owner);
        launchProject.setClient(primaryClient);
        launchProject = projectRepository.save(launchProject);

        // 3. Seed Physical Files in Private Storage Vault
        byte[] pdfBytes = "%PDF-1.5 TrustVault Secure Document Contents for demonstration.\n%%EOF".getBytes();
        byte[] docxBytes = new byte[] {0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00}; // PK.. OpenXML signature
        byte[] textBytes = "# TrustVault Architecture Guidelines\n\n1. Zero Trust\n2. Least Privilege\n3. SHA-256 Audit Trails\n".getBytes();

        String key1 = createVaultFile("q4_financial_report.pdf", pdfBytes);
        String key2 = createVaultFile("product_roadmap_2025.docx", docxBytes);
        String key3 = createVaultFile("employee_handbook.pdf", pdfBytes);
        String key4 = createVaultFile("brand_guidelines.pdf", pdfBytes);
        String key5 = createVaultFile("architecture_notes.md", textBytes);
        String keyBeta = createVaultFile("beta_confidential.pdf", pdfBytes);

        // 4. Seed Document records
        Document doc1 = createAndSaveDoc("Q4 Financial Report.pdf", "Q4 Financial Report.pdf", key1, "application/pdf",
                2516582L, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "Finance", owner, acmeProject, primaryClient);

        Document doc2 = createAndSaveDoc("Product Roadmap 2025.docx", "Product Roadmap 2025.docx", key2, "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                1153433L, "f4b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "Planning", owner, launchProject, primaryClient);

        Document doc3 = createAndSaveDoc("Employee Handbook.pdf", "Employee Handbook.pdf", key3, "application/pdf",
                5033164L, "d2b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "HR", owner, acmeProject, primaryClient);

        Document doc4 = createAndSaveDoc("Brand Guidelines.fig", "Brand Guidelines.pdf", key4, "application/pdf",
                8598323L, "a1b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "Design", owner, launchProject, primaryClient);

        Document doc5 = createAndSaveDoc("Architecture Guidelines.md", "architecture_notes.md", key5, "text/markdown",
                (long) textBytes.length, "b2b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "Engineering", owner, launchProject, primaryClient);

        // Beta Client isolated document
        createAndSaveDoc("Beta Client Confidential Asset.pdf", "beta_confidential.pdf", keyBeta, "application/pdf",
                1048576L, "c3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "Confidential", betaUser, null, betaClient);

        // 5. Seed Permissions:
        Instant in30Days = Instant.now().plusSeconds(30L * 24 * 3600);
        Instant in7Days = Instant.now().plusSeconds(7L * 24 * 3600);

        // Viewer grants
        permissionRepository.save(new DocumentPermission(doc2, viewer, PermissionLevel.EDIT, owner, in30Days));
        permissionRepository.save(new DocumentPermission(doc3, viewer, PermissionLevel.READ, owner, in7Days));
        permissionRepository.save(new DocumentPermission(doc5, viewer, PermissionLevel.READ, owner, in30Days));

        // Editor grants
        permissionRepository.save(new DocumentPermission(doc2, editor, PermissionLevel.EDIT, owner, in30Days));
        permissionRepository.save(new DocumentPermission(doc3, editor, PermissionLevel.READ, owner, in7Days));
        permissionRepository.save(new DocumentPermission(doc5, editor, PermissionLevel.EDIT, owner, in30Days));

        // Starred documents for demo
        starredDocumentRepository.save(new StarredDocument(viewer, doc3));
        starredDocumentRepository.save(new StarredDocument(editor, doc2));
        starredDocumentRepository.save(new StarredDocument(editor, doc5));

        // 6. Seed Access Requests
        accessRequestRepository.save(new AccessRequest(
                doc2, alex, PermissionLevel.READ, "Need to review product specifications for Q1 marketing plan."
        ));
        accessRequestRepository.save(new AccessRequest(
                doc1, viewer, PermissionLevel.EDIT, "Need access to update appendix tables with finalized Q4 numbers."
        ));

        log.info("TrustVault initialization complete. Demo accounts ready:");
        log.info("  ADMIN:  admin@trustvault.local  / TrustVault@2025!");
        log.info("  OWNER:  owner@trustvault.local  / TrustVault@2025!");
        log.info("  EDITOR: editor@trustvault.local / TrustVault@2025!");
        log.info("  VIEWER: viewer@trustvault.local / TrustVault@2025!");
        log.info("  ALEX:   alex@trustvault.local   / TrustVault@2025!");

        ensureAccountsAndClients(primaryClient, betaClient);
    }

    private Document createAndSaveDoc(String title, String filename, String key, String contentType,
                                      long size, String checksum, String category, User owner, Project project, Client client) {
        Document doc = new Document(title, filename, key, contentType, size, checksum, category, owner, project);
        doc.setClient(client);
        doc.setVersion(1);
        Document saved = documentRepository.save(doc);

        DocumentVersion v1 = new DocumentVersion(saved, 1, title, key, contentType, size, checksum, "Initial release", owner);
        documentVersionRepository.save(v1);
        return saved;
    }

    private Client ensureClient(UUID id, String name, String code) {
        return clientRepository.findByCode(code).orElseGet(() -> {
            Client c = new Client(id, name, code);
            return clientRepository.save(c);
        });
    }

    private void ensureAccountsAndClients(Client primaryClient, Client betaClient) {
        String defaultPasswordHash = passwordEncoder.encode("TrustVault@2025!");

        // Update all existing users with primary client if missing
        userRepository.findAll().forEach(u -> {
            if (u.getClient() == null) {
                u.setClient(primaryClient);
                userRepository.save(u);
            }
        });

        // Ensure editor demo account exists
        User editor = userRepository.findByEmailIgnoreCase("editor@trustvault.local").orElseGet(() -> {
            log.info("Seeding missing editor@trustvault.local demo account...");
            User u = new User("editor@trustvault.local", defaultPasswordHash, "Jordan Lee (Editor)", Role.ROLE_EDITOR, true);
            u.setClient(primaryClient);
            return userRepository.save(u);
        });

        // Ensure clientb_user demo account exists
        User betaUser = userRepository.findByEmailIgnoreCase("clientb_user@trustvault.local").orElseGet(() -> {
            log.info("Seeding missing clientb_user@trustvault.local demo account...");
            User u = new User("clientb_user@trustvault.local", defaultPasswordHash, "Beta Client Auditor", Role.ROLE_VIEWER, true);
            u.setClient(betaClient);
            return userRepository.save(u);
        });

        // Ensure documents have client and versions
        documentRepository.findAll().forEach(d -> {
            if (d.getClient() == null) {
                d.setClient(primaryClient);
                documentRepository.save(d);
            }
            if (documentVersionRepository.findByDocumentOrderByVersionNumberDesc(d).isEmpty()) {
                DocumentVersion v = new DocumentVersion(d, d.getVersion(), d.getTitle(), d.getStorageKey(),
                        d.getContentType(), d.getFileSizeBytes(), d.getSha256Checksum(), "Initial document release", d.getOwner());
                documentVersionRepository.save(v);
            }
        });

        // Ensure editor has permissions on doc2 and doc3
        documentRepository.findAll().forEach(d -> {
            if (d.getTitle().contains("Roadmap")) {
                if (permissionRepository.findByDocumentAndUser(d, editor).isEmpty()) {
                    permissionRepository.save(new DocumentPermission(d, editor, PermissionLevel.EDIT, d.getOwner(), Instant.now().plusSeconds(30L * 86400)));
                }
                if (!starredDocumentRepository.existsByUserAndDocument(editor, d)) {
                    starredDocumentRepository.save(new StarredDocument(editor, d));
                }
            } else if (d.getTitle().contains("Handbook")) {
                if (permissionRepository.findByDocumentAndUser(d, editor).isEmpty()) {
                    permissionRepository.save(new DocumentPermission(d, editor, PermissionLevel.READ, d.getOwner(), Instant.now().plusSeconds(7L * 86400)));
                }
                User viewer = userRepository.findByEmailIgnoreCase("viewer@trustvault.local").orElse(null);
                if (viewer != null && !starredDocumentRepository.existsByUserAndDocument(viewer, d)) {
                    starredDocumentRepository.save(new StarredDocument(viewer, d));
                }
            }
        });

        // Ensure Sita (Workshop user) demo account exists
        User sita = userRepository.findByEmailIgnoreCase("sita@trustvault.local").orElseGet(() -> {
            log.info("Seeding missing sita@trustvault.local (Workshop) demo account...");
            User u = new User("sita@trustvault.local", defaultPasswordHash, "Sita Sharma (Workshop)", Role.ROLE_WORKSHOP, true);
            u.setClient(primaryClient);
            return userRepository.save(u);
        });

        User owner = userRepository.findByEmailIgnoreCase("owner@trustvault.local").orElse(null);
        if (owner != null) {
            Project collegeProject = projectRepository.findAll().stream()
                    .filter(p -> p.getName().equalsIgnoreCase("College Project"))
                    .findFirst()
                    .orElseGet(() -> {
                        Project p = new Project("College Project", "Academic guidelines, curriculum reports, and departmental records", owner);
                        p.setClient(primaryClient);
                        return projectRepository.save(p);
                    });

            Project hospitalProject = projectRepository.findAll().stream()
                    .filter(p -> p.getName().equalsIgnoreCase("Hospital Project"))
                    .findFirst()
                    .orElseGet(() -> {
                        Project p = new Project("Hospital Project", "Clinical policies, patient safety guidelines, and healthcare operations", owner);
                        p.setClient(primaryClient);
                        return projectRepository.save(p);
                    });

            if (!projectMemberRepository.existsByProjectAndUser(collegeProject, sita)) {
                projectMemberRepository.save(new ProjectMember(collegeProject, sita, "Contributor", Role.ROLE_WORKSHOP));
            }
            if (!projectMemberRepository.existsByProjectAndUser(hospitalProject, sita)) {
                projectMemberRepository.save(new ProjectMember(hospitalProject, sita, "Contributor", Role.ROLE_WORKSHOP));
            }

            // Document 1: College Guidelines.pdf -> READ for Sita
            Document collegeDoc = documentRepository.findAll().stream()
                    .filter(d -> d.getTitle().equalsIgnoreCase("College Guidelines.pdf"))
                    .findFirst()
                    .orElseGet(() -> {
                        try {
                            String k = createVaultFile("college_guidelines.pdf", "%PDF-1.5 College Guidelines Documentation\n%%EOF".getBytes());
                            return createAndSaveDoc("College Guidelines.pdf", "College Guidelines.pdf", k, "application/pdf",
                                    1024L, "a1b2c3d4e5f67890123456789012345678901234567890123456789012345671", "Academic", owner, collegeProject, primaryClient);
                        } catch (Exception e) {
                            throw new RuntimeException(e);
                        }
                    });
            if (permissionRepository.findByDocumentAndUser(collegeDoc, sita).isEmpty()) {
                permissionRepository.save(new DocumentPermission(collegeDoc, sita, PermissionLevel.READ, owner, Instant.now().plusSeconds(30L * 86400)));
            }

            // Document 2: Exam Results.xlsx -> EDIT for Sita
            Document examDoc = documentRepository.findAll().stream()
                    .filter(d -> d.getTitle().equalsIgnoreCase("Exam Results.xlsx"))
                    .findFirst()
                    .orElseGet(() -> {
                        try {
                            String k = createVaultFile("exam_results.xlsx", new byte[] {0x50, 0x4B, 0x03, 0x04, 0x14, 0x00});
                            return createAndSaveDoc("Exam Results.xlsx", "Exam Results.xlsx", k, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                    2048L, "a1b2c3d4e5f67890123456789012345678901234567890123456789012345672", "Academic", owner, collegeProject, primaryClient);
                        } catch (Exception e) {
                            throw new RuntimeException(e);
                        }
                    });
            if (permissionRepository.findByDocumentAndUser(examDoc, sita).isEmpty()) {
                permissionRepository.save(new DocumentPermission(examDoc, sita, PermissionLevel.EDIT, owner, Instant.now().plusSeconds(30L * 86400)));
            }

            // Document 3: Internal Report.pdf -> NO ACCESS for Sita (belongs to College Project, but no permission grant!)
            documentRepository.findAll().stream()
                    .filter(d -> d.getTitle().equalsIgnoreCase("Internal Report.pdf"))
                    .findFirst()
                    .orElseGet(() -> {
                        try {
                            String k = createVaultFile("internal_report.pdf", "%PDF-1.5 Internal Confidential College Report\n%%EOF".getBytes());
                            return createAndSaveDoc("Internal Report.pdf", "Internal Report.pdf", k, "application/pdf",
                                    3072L, "a1b2c3d4e5f67890123456789012345678901234567890123456789012345673", "Confidential", owner, collegeProject, primaryClient);
                        } catch (Exception e) {
                            throw new RuntimeException(e);
                        }
                    });

            // Document 4: Patient Policy.pdf -> READ for Sita (belongs to Hospital Project)
            Document patientDoc = documentRepository.findAll().stream()
                    .filter(d -> d.getTitle().equalsIgnoreCase("Patient Policy.pdf"))
                    .findFirst()
                    .orElseGet(() -> {
                        try {
                            String k = createVaultFile("patient_policy.pdf", "%PDF-1.5 Hospital Patient Policy Documentation\n%%EOF".getBytes());
                            return createAndSaveDoc("Patient Policy.pdf", "Patient Policy.pdf", k, "application/pdf",
                                    4096L, "a1b2c3d4e5f67890123456789012345678901234567890123456789012345674", "Medical", owner, hospitalProject, primaryClient);
                        } catch (Exception e) {
                            throw new RuntimeException(e);
                        }
                    });
            if (permissionRepository.findByDocumentAndUser(patientDoc, sita).isEmpty()) {
                permissionRepository.save(new DocumentPermission(patientDoc, sita, PermissionLevel.READ, owner, Instant.now().plusSeconds(30L * 86400)));
            }

            // Ensure Ram, Lakshman, and Ravi exist
            User ram = userRepository.findByEmailIgnoreCase("ram@trustvault.local").orElseGet(() -> {
                User u = new User("ram@trustvault.local", defaultPasswordHash, "Ram Kumar", Role.ROLE_WORKSHOP_MEMBER, true);
                u.setClient(primaryClient);
                return userRepository.save(u);
            });
            User lakshman = userRepository.findByEmailIgnoreCase("lakshman@trustvault.local").orElseGet(() -> {
                User u = new User("lakshman@trustvault.local", defaultPasswordHash, "Lakshman Singh", Role.ROLE_WORKSHOP_MEMBER, true);
                u.setClient(primaryClient);
                return userRepository.save(u);
            });
            User ravi = userRepository.findByEmailIgnoreCase("ravi@trustvault.local").orElseGet(() -> {
                User u = new User("ravi@trustvault.local", defaultPasswordHash, "Ravi Verma", Role.ROLE_WORKSHOP_MEMBER, true);
                u.setClient(primaryClient);
                return userRepository.save(u);
            });

            // TrustVault Security Review Project
            Project secReview = projectRepository.findAll().stream()
                    .filter(p -> p.getName().equalsIgnoreCase("TrustVault Security Review"))
                    .findFirst()
                    .orElseGet(() -> {
                        Project p = new Project("TrustVault Security Review", "Multi-tenant access control and encryption evaluation", owner, null, "Security", "ACTIVE");
                        p.setClient(primaryClient);
                        return projectRepository.save(p);
                    });

            if (!projectMemberRepository.existsByProjectIdAndUserId(secReview.getId(), ram.getId())) {
                ProjectMember pmRam = new ProjectMember(secReview, ram, "Senior Reviewer", true, true);
                pmRam.setStatus("ACTIVE");
                projectMemberRepository.save(pmRam);
            }
            if (!projectMemberRepository.existsByProjectIdAndUserId(secReview.getId(), lakshman.getId())) {
                ProjectMember pmLakshman = new ProjectMember(secReview, lakshman, "Security Auditor", true, false);
                pmLakshman.setStatus("ACTIVE");
                projectMemberRepository.save(pmLakshman);
            }

            // Project Alpha with File A (READ), File B (EDIT), File C (NO ACCESS)
            Project projectAlpha = projectRepository.findAll().stream()
                    .filter(p -> p.getName().equalsIgnoreCase("Project Alpha"))
                    .findFirst()
                    .orElseGet(() -> {
                        Project p = new Project("Project Alpha", "Core security validation workspace", owner, null, "General", "ACTIVE");
                        p.setClient(primaryClient);
                        return projectRepository.save(p);
                    });

            if (!projectMemberRepository.existsByProjectIdAndUserId(projectAlpha.getId(), ram.getId())) {
                ProjectMember pm = new ProjectMember(projectAlpha, ram, "Reviewer", true, false);
                pm.setStatus("ACTIVE");
                projectMemberRepository.save(pm);
            }

            Document fileA = documentRepository.findAll().stream()
                    .filter(d -> d.getTitle().equalsIgnoreCase("admission.pdf"))
                    .findFirst()
                    .orElseGet(() -> {
                        try {
                            String k = createVaultFile("admission.pdf", "%PDF-1.5 Admission Guidelines\n%%EOF".getBytes());
                            return createAndSaveDoc("admission.pdf", "admission.pdf", k, "application/pdf",
                                    1024L, "a1b2c3d4e5f67890123456789012345678901234567890123456789012345675", "Admission", owner, projectAlpha, primaryClient);
                        } catch (Exception e) {
                            throw new RuntimeException(e);
                        }
                    });
            if (permissionRepository.findByDocumentAndUser(fileA, ram).isEmpty()) {
                permissionRepository.save(new DocumentPermission(fileA, ram, PermissionLevel.READ, owner, Instant.now().plusSeconds(30L * 86400)));
            }

            Document fileB = documentRepository.findAll().stream()
                    .filter(d -> d.getTitle().equalsIgnoreCase("notes.txt"))
                    .findFirst()
                    .orElseGet(() -> {
                        try {
                            String k = createVaultFile("notes.txt", "TrustVault Security Audit Notes\nAll controls validated.".getBytes());
                            return createAndSaveDoc("notes.txt", "notes.txt", k, "text/plain",
                                    512L, "a1b2c3d4e5f67890123456789012345678901234567890123456789012345676", "Notes", owner, projectAlpha, primaryClient);
                        } catch (Exception e) {
                            throw new RuntimeException(e);
                        }
                    });
            if (permissionRepository.findByDocumentAndUser(fileB, ram).isEmpty()) {
                permissionRepository.save(new DocumentPermission(fileB, ram, PermissionLevel.EDIT, owner, Instant.now().plusSeconds(30L * 86400)));
            }

            documentRepository.findAll().stream()
                    .filter(d -> d.getTitle().equalsIgnoreCase("confidential.pdf"))
                    .findFirst()
                    .orElseGet(() -> {
                        try {
                            String k = createVaultFile("confidential.pdf", "%PDF-1.5 Confidential Financial Ledger\n%%EOF".getBytes());
                            return createAndSaveDoc("confidential.pdf", "confidential.pdf", k, "application/pdf",
                                    2048L, "a1b2c3d4e5f67890123456789012345678901234567890123456789012345677", "Finance", owner, projectAlpha, primaryClient);
                        } catch (Exception e) {
                            throw new RuntimeException(e);
                        }
                    });
        }
    }

    private String createVaultFile(String name, byte[] content) throws IOException {
        String key = UUID.randomUUID().toString();
        Path file = vaultPath.resolve(key);
        Files.write(file, content);
        return key;
    }

    private void seedGroupsIfEmpty() {
        if (groupRepository.count() == 0) {
            User ownerUser = userRepository.findByEmailIgnoreCase("owner@trustvault.local").orElse(null);
            User viewerUser = userRepository.findByEmailIgnoreCase("viewer@trustvault.local").orElse(null);
            User alexUser = userRepository.findByEmailIgnoreCase("alex@trustvault.local").orElse(null);

            if (ownerUser != null) {
                log.info("Seeding initial workspace groups and teams...");
                Group financeGroup = groupRepository.save(new Group("Finance Team", "Q4 filings, audit records and ledger reviews", "Finance", ownerUser));
                Group launchGroup = groupRepository.save(new Group("Product Launch Team", "Roadmaps, sprint planning and product collateral", "Engineering", ownerUser));
                Group hrGroup = groupRepository.save(new Group("HR & People Ops", "Handbooks, benefits, and compliance documentation", "People", ownerUser));

                if (viewerUser != null) {
                    groupMemberRepository.save(new GroupMember(financeGroup, viewerUser));
                    groupMemberRepository.save(new GroupMember(launchGroup, viewerUser));
                }
                if (alexUser != null) {
                    groupMemberRepository.save(new GroupMember(financeGroup, alexUser));
                    groupMemberRepository.save(new GroupMember(hrGroup, alexUser));
                }
            }
        }
    }
}
