package com.trustvault.service;

import com.trustvault.dto.ProjectDtos.*;
import com.trustvault.exception.BadRequestException;
import com.trustvault.exception.ForbiddenException;
import com.trustvault.exception.ResourceNotFoundException;
import com.trustvault.model.*;
import com.trustvault.repository.*;
import com.trustvault.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final DocumentRepository documentRepository;
    private final DocumentPermissionRepository permissionRepository;
    private final UserRepository userRepository;
    private final GroupRepository groupRepository;
    private final AccessRequestRepository accessRequestRepository;
    private final RenewalRequestRepository renewalRequestRepository;
    private final AuditLogRepository auditLogRepository;
    private final AuditService auditService;
    private final StorageService storageService;

    public ProjectService(
            ProjectRepository projectRepository,
            ProjectMemberRepository projectMemberRepository,
            DocumentRepository documentRepository,
            DocumentPermissionRepository permissionRepository,
            UserRepository userRepository,
            GroupRepository groupRepository,
            AccessRequestRepository accessRequestRepository,
            RenewalRequestRepository renewalRequestRepository,
            AuditLogRepository auditLogRepository,
            AuditService auditService,
            StorageService storageService
    ) {
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.documentRepository = documentRepository;
        this.permissionRepository = permissionRepository;
        this.userRepository = userRepository;
        this.groupRepository = groupRepository;
        this.accessRequestRepository = accessRequestRepository;
        this.renewalRequestRepository = renewalRequestRepository;
        this.auditLogRepository = auditLogRepository;
        this.auditService = auditService;
        this.storageService = storageService;
    }

    @Transactional
    public ProjectDto createProject(ProjectCreateRequest request, User owner) {
        if (owner == null) {
            throw new ForbiddenException("Authentication required");
        }
        if (!owner.isAdmin() && !owner.isManager() && owner.getRole() != Role.ROLE_OWNER) {
            throw new ForbiddenException("Only managers and administrators are authorized to create projects");
        }

        Group group = null;
        if (request.groupId() != null) {
            group = groupRepository.findById(request.groupId()).orElse(null);
            if (group != null && owner.getClient() != null && group.getOwner() != null && group.getOwner().getClient() != null) {
                if (!owner.getClient().getId().equals(group.getOwner().getClient().getId())) {
                    throw new ForbiddenException("Access denied: Workshop belongs to another organization");
                }
            }
        }

        String category = request.category() != null && !request.category().isBlank() ? request.category().trim() : "General";
        String status = request.status() != null && !request.status().isBlank() ? request.status().trim().toUpperCase() : "ACTIVE";

        Project project = new Project(request.name().trim(), request.description(), owner, group, category, status);
        if (owner.getClient() != null) {
            project.setClient(owner.getClient());
        } else if (group != null && group.getOwner() != null && group.getOwner().getClient() != null) {
            project.setClient(group.getOwner().getClient());
        }

        Project saved = projectRepository.save(project);

        // Map of added members for quick lookup
        Map<String, User> addedUsers = new HashMap<>();

        // 1. Atomically allocate members
        if (request.members() != null && !request.members().isEmpty()) {
            for (MemberAllocationDto m : request.members()) {
                if (m.userEmail() == null || m.userEmail().isBlank()) continue;
                User memberUser = userRepository.findByEmailIgnoreCase(m.userEmail().trim())
                        .orElseThrow(() -> new ResourceNotFoundException("Member user not found with email: " + m.userEmail()));

                if (saved.getClient() != null && memberUser.getClient() != null && !saved.getClient().getId().equals(memberUser.getClient().getId())) {
                    throw new ForbiddenException("Cannot add member from another client organization: " + memberUser.getEmail());
                }

                if (memberUser.getId().equals(owner.getId())) {
                    continue; // Owner is already project owner
                }

                boolean canView = m.canView();
                boolean canEdit = m.canEdit();
                if (canEdit && !canView) {
                    canView = true;
                }

                ProjectMember pm = new ProjectMember(saved, memberUser, m.responsibility(), canView, canEdit);
                pm.setStatus("ACTIVE");
                projectMemberRepository.save(pm);
                addedUsers.put(memberUser.getEmail().toLowerCase(), memberUser);
            }
        }

        // 2. Attach existing documents if provided
        List<Document> attachedDocs = new ArrayList<>();
        if (request.existingDocumentIds() != null && !request.existingDocumentIds().isEmpty()) {
            for (UUID docId : request.existingDocumentIds()) {
                Document doc = documentRepository.findById(docId)
                        .orElseThrow(() -> new ResourceNotFoundException("Document not found with ID: " + docId));

                if (saved.getClient() != null && doc.getClient() != null && !saved.getClient().getId().equals(doc.getClient().getId())) {
                    throw new ForbiddenException("Cannot attach document from another client organization");
                }

                doc.setProject(saved);
                documentRepository.save(doc);
                attachedDocs.add(doc);
            }
        }

        // 3. Atomically configure individual file permissions
        if (request.permissions() != null && !request.permissions().isEmpty()) {
            for (DocumentPermissionAssignmentDto permDto : request.permissions()) {
                if (permDto.userEmail() == null || permDto.userEmail().isBlank()) continue;

                User targetUser = addedUsers.get(permDto.userEmail().toLowerCase());
                if (targetUser == null) {
                    targetUser = userRepository.findByEmailIgnoreCase(permDto.userEmail().trim()).orElse(null);
                }
                if (targetUser == null) continue;

                Document targetDoc = null;
                if (permDto.documentId() != null) {
                    targetDoc = documentRepository.findById(permDto.documentId()).orElse(null);
                }
                if (targetDoc == null && permDto.documentTitle() != null) {
                    String title = permDto.documentTitle().trim().toLowerCase();
                    targetDoc = attachedDocs.stream()
                            .filter(d -> (d.getTitle() != null && d.getTitle().equalsIgnoreCase(title))
                                    || (d.getOriginalFilename() != null && d.getOriginalFilename().equalsIgnoreCase(title)))
                            .findFirst().orElse(null);
                }

                if (targetDoc != null) {
                    int durDays = permDto.durationDays() != null ? permDto.durationDays() :
                            (request.defaultDocumentDurationDays() != null ? request.defaultDocumentDurationDays() : 30);
                    if (durDays < 1 || durDays > 30) {
                        throw new BadRequestException("Document access duration must be between 1 and 30 days");
                    }
                    Instant calculatedExpiry;
                    if (permDto.expiresAt() != null) {
                        if (permDto.expiresAt().isBefore(Instant.now())) {
                            throw new BadRequestException("Expiry timestamp must be in the future");
                        }
                        if (permDto.expiresAt().isAfter(Instant.now().plusSeconds(30L * 86400L + 120L))) {
                            throw new BadRequestException("Document access duration cannot exceed 30 days");
                        }
                        calculatedExpiry = permDto.expiresAt();
                    } else {
                        calculatedExpiry = Instant.now().plusSeconds((long) durDays * 86400L);
                    }

                    Optional<DocumentPermission> existing = permissionRepository.findByDocumentAndUser(targetDoc, targetUser);
                    DocumentPermission perm;
                    if (existing.isPresent()) {
                        perm = existing.get();
                        perm.setPermissionLevel(permDto.permissionLevel());
                        perm.setExpiresAt(calculatedExpiry);
                        perm.setStatus(PermissionStatus.ACTIVE);
                        perm.setGrantedBy(owner);
                        perm.setGrantedAt(Instant.now());
                    } else {
                        perm = new DocumentPermission(
                                targetDoc,
                                targetUser,
                                permDto.permissionLevel() != null ? permDto.permissionLevel() : PermissionLevel.READ,
                                owner,
                                calculatedExpiry
                        );
                    }
                    permissionRepository.save(perm);
                }
            }
        }

        auditService.logEvent(owner, AuditAction.PROJECT_CREATED, "PROJECT", saved.getId().toString(),
                AuditResult.SUCCESS, "Created project " + saved.getName() + " with " + addedUsers.size() + " members and " + attachedDocs.size() + " documents",
                null, null);

        return mapToDto(saved, owner);
    }

    @Transactional(readOnly = true)
    public List<ProjectDto> getProjectsForUser(User user) {
        if (user == null) {
            return List.of();
        }

        if (user.isAdmin()) {
            List<Project> allProjects = projectRepository.findAll(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"));
            if (user.getClient() != null) {
                allProjects = allProjects.stream()
                        .filter(p -> p.getClient() == null || p.getClient().getId().equals(user.getClient().getId()))
                        .toList();
            }
            return allProjects.stream()
                    .map(p -> mapToDto(p, user))
                    .toList();
        }

        if (user.isManager() || user.getRole() == Role.ROLE_OWNER) {
            List<Project> owned = projectRepository.findByOwnerOrderByCreatedAtDesc(user);
            List<ProjectMember> memberships = projectMemberRepository.findByUserIdAndCanViewTrue(user.getId());
            Set<Project> result = new LinkedHashSet<>(owned);
            for (ProjectMember m : memberships) {
                if (m.getProject() != null && "ACTIVE".equalsIgnoreCase(m.getStatus())) {
                    result.add(m.getProject());
                }
            }
            if (user.getClient() != null) {
                result.removeIf(p -> p.getClient() != null && !p.getClient().getId().equals(user.getClient().getId()));
            }
            return result.stream()
                    .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                    .map(p -> mapToDto(p, user))
                    .toList();
        }

        // Workshop members: discover only assigned projects where canView=true and status is ACTIVE
        List<Project> accessible = projectRepository.findProjectsAccessibleByUser(user.getId());
        if (user.getClient() != null) {
            accessible = accessible.stream()
                    .filter(p -> p.getClient() == null || p.getClient().getId().equals(user.getClient().getId()))
                    .toList();
        }
        return accessible.stream()
                .map(p -> mapToDto(p, user))
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectDto getProjectById(UUID id, User user) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found with ID: " + id));

        if (user.getClient() != null && project.getClient() != null && !user.getClient().getId().equals(project.getClient().getId())) {
            throw new ForbiddenException("Access denied: Project belongs to another client");
        }

        boolean isOwner = project.getOwner() != null && project.getOwner().getId().equals(user.getId());
        boolean isAdmin = user.isAdmin();

        if (!isOwner && !isAdmin) {
            Optional<ProjectMember> memberOpt = projectMemberRepository.findByProjectIdAndUserId(id, user.getId());
            if (memberOpt.isEmpty()) {
                throw new ForbiddenException("Access denied: You are not authorized to view this project");
            }
            ProjectMember member = memberOpt.get();
            if (member.isSuspended()) {
                throw new ForbiddenException("Access denied: Your project membership has been suspended");
            }
            if (!member.isCanView()) {
                throw new ForbiddenException("Access denied: You are not authorized to view this project");
            }
        }

        return mapToDto(project, user);
    }

    @Transactional
    public ProjectMemberDto addMember(UUID projectId, AddMemberRequest request, User owner) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.getOwner().getId().equals(owner.getId()) && !owner.isAdmin()) {
            throw new ForbiddenException("Only the project manager or administrator can add members");
        }

        User memberUser = userRepository.findByEmailIgnoreCase(request.userEmail().trim())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + request.userEmail()));

        if (project.getClient() != null && memberUser.getClient() != null && !project.getClient().getId().equals(memberUser.getClient().getId())) {
            throw new ForbiddenException("Cannot add member from another client organization");
        }

        if (project.getOwner().getId().equals(memberUser.getId())) {
            throw new BadRequestException("User is already the manager of this project");
        }

        if (projectMemberRepository.existsByProjectIdAndUserId(projectId, memberUser.getId())) {
            throw new BadRequestException("User is already a member of this project");
        }

        String responsibility = request.responsibility() != null && !request.responsibility().isBlank()
                ? request.responsibility().trim() : "Contributor";

        boolean canView = request.canView() != null ? request.canView() : true;
        boolean canEdit = request.canEdit() != null ? request.canEdit() : false;
        if (canEdit && !canView) {
            canView = true;
        }

        ProjectMember member = new ProjectMember(project, memberUser, responsibility, canView, canEdit);
        member.setStatus("ACTIVE");
        ProjectMember saved = projectMemberRepository.save(member);

        // Grant individual file permissions if provided
        if (request.documentPermissions() != null && !request.documentPermissions().isEmpty()) {
            for (DocumentPermissionAssignmentDto permDto : request.documentPermissions()) {
                if (permDto.documentId() != null) {
                    Document doc = documentRepository.findById(permDto.documentId()).orElse(null);
                    if (doc != null && doc.getProject() != null && doc.getProject().getId().equals(projectId)) {
                        int durDays = permDto.durationDays() != null ? permDto.durationDays() :
                                (request.documentAccessDurationDays() != null ? request.documentAccessDurationDays() : 30);
                        if (durDays < 1 || durDays > 30) {
                            throw new BadRequestException("Document access duration must be between 1 and 30 days");
                        }
                        Instant calculatedExpiry;
                        if (permDto.expiresAt() != null) {
                            if (permDto.expiresAt().isBefore(Instant.now())) {
                                throw new BadRequestException("Expiry timestamp must be in the future");
                            }
                            if (permDto.expiresAt().isAfter(Instant.now().plusSeconds(30L * 86400L + 120L))) {
                                throw new BadRequestException("Document access duration cannot exceed 30 days");
                            }
                            calculatedExpiry = permDto.expiresAt();
                        } else {
                            calculatedExpiry = Instant.now().plusSeconds((long) durDays * 86400L);
                        }

                        DocumentPermission perm = new DocumentPermission(
                                doc,
                                memberUser,
                                permDto.permissionLevel() != null ? permDto.permissionLevel() : PermissionLevel.READ,
                                owner,
                                calculatedExpiry
                        );
                        permissionRepository.save(perm);
                    }
                }
            }
        }

        auditService.logEvent(owner, AuditAction.PROJECT_MEMBER_ADDED, "PROJECT", project.getId().toString(),
                AuditResult.SUCCESS, "Added member " + memberUser.getEmail() + " as " + responsibility + " (canView=" + canView + ", canEdit=" + canEdit + ") to project " + project.getName(),
                null, null);

        return mapToMemberDto(saved, project);
    }

    @Transactional
    public ProjectMemberDto suspendMember(UUID projectId, UUID memberId, SuspendMemberRequest request, User manager) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.getOwner().getId().equals(manager.getId()) && !manager.isAdmin()) {
            throw new ForbiddenException("Only the project manager or administrator can suspend project members");
        }

        ProjectMember member = projectMemberRepository.findById(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("Project member not found"));

        if (!member.getProject().getId().equals(projectId)) {
            throw new BadRequestException("Member does not belong to this project");
        }

        if (member.getUser().isAdmin() || member.getUser().isManager() || member.getUser().getRole() == Role.ROLE_OWNER) {
            throw new ForbiddenException("Managers cannot suspend Administrators or other Managers");
        }

        member.suspend(manager);
        ProjectMember saved = projectMemberRepository.save(member);

        auditService.logEvent(manager, AuditAction.MEMBER_SUSPENDED, "PROJECT_MEMBER", saved.getId().toString(),
                AuditResult.SUCCESS, "Suspended membership for " + saved.getUser().getEmail() + " in project " + project.getName() + (request != null && request.reason() != null ? " (Reason: " + request.reason() + ")" : ""),
                null, null);

        return mapToMemberDto(saved, project);
    }

    @Transactional
    public ProjectMemberDto reactivateMember(UUID projectId, UUID memberId, User manager) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.getOwner().getId().equals(manager.getId()) && !manager.isAdmin()) {
            throw new ForbiddenException("Only the project manager or administrator can reactivate project members");
        }

        ProjectMember member = projectMemberRepository.findById(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("Project member not found"));

        if (!member.getProject().getId().equals(projectId)) {
            throw new BadRequestException("Member does not belong to this project");
        }

        member.reactivate();
        ProjectMember saved = projectMemberRepository.save(member);

        auditService.logEvent(manager, AuditAction.MEMBER_REACTIVATED, "PROJECT_MEMBER", saved.getId().toString(),
                AuditResult.SUCCESS, "Reactivated membership for " + saved.getUser().getEmail() + " in project " + project.getName(),
                null, null);

        return mapToMemberDto(saved, project);
    }

    @Transactional
    public ProjectMemberDto updateMemberPermissions(UUID projectId, UUID memberId, UpdateMemberPermissionsRequest request, User manager) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.getOwner().getId().equals(manager.getId()) && !manager.isAdmin()) {
            throw new ForbiddenException("Only the project manager or administrator can update member permissions");
        }

        ProjectMember member = projectMemberRepository.findById(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("Project member not found"));

        if (!member.getProject().getId().equals(projectId)) {
            throw new BadRequestException("Member does not belong to this project");
        }

        if (member.getUser().getId().equals(manager.getId())) {
            throw new ForbiddenException("You cannot modify your own permissions");
        }

        if (request.canView() != null) {
            member.setCanView(request.canView());
        }
        if (request.canEdit() != null) {
            member.setCanEdit(request.canEdit());
        }
        if (request.responsibility() != null && !request.responsibility().isBlank()) {
            member.setResponsibility(request.responsibility().trim());
        }
        if (request.status() != null && !request.status().isBlank()) {
            if ("SUSPENDED".equalsIgnoreCase(request.status())) {
                member.suspend(manager);
            } else if ("ACTIVE".equalsIgnoreCase(request.status())) {
                member.reactivate();
            }
        }

        ProjectMember saved = projectMemberRepository.save(member);

        auditService.logEvent(manager, AuditAction.PROJECT_UPDATED, "PROJECT_MEMBER", saved.getId().toString(),
                AuditResult.SUCCESS, "Updated permissions for member " + saved.getUser().getEmail() + " in project " + project.getName() + ": canView=" + saved.isCanView() + ", canEdit=" + saved.isCanEdit() + ", status=" + saved.getStatus(),
                null, null);

        return mapToMemberDto(saved, project);
    }

    @Transactional
    public void removeMember(UUID projectId, UUID memberId, User owner) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.getOwner().getId().equals(owner.getId()) && !owner.isAdmin()) {
            throw new ForbiddenException("Only the project manager or administrator can remove members");
        }

        ProjectMember member = projectMemberRepository.findById(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("Project member not found"));

        if (!member.getProject().getId().equals(projectId)) {
            throw new BadRequestException("Member does not belong to this project");
        }

        String removedEmail = member.getUser().getEmail();
        projectMemberRepository.delete(member);

        auditService.logEvent(owner, AuditAction.PROJECT_MEMBER_REMOVED, "PROJECT", project.getId().toString(),
                AuditResult.SUCCESS, "Removed member " + removedEmail + " from project " + project.getName(),
                null, null);
    }

    @Transactional(readOnly = true)
    public List<ProjectMemberDto> getProjectMembers(UUID projectId, User user) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.getOwner().getId().equals(user.getId()) &&
                !projectMemberRepository.existsByProjectIdAndUserId(projectId, user.getId()) &&
                !user.isAdmin()) {
            throw new ForbiddenException("Access denied: You are not authorized to view members of this project");
        }

        return projectMemberRepository.findByProject(project).stream()
                .map(m -> mapToMemberDto(m, project))
                .toList();
    }

    @Transactional
    public void deleteProject(UUID projectId, User owner) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.getOwner().getId().equals(owner.getId()) && !owner.isAdmin()) {
            throw new ForbiddenException("Only the project manager or administrator can delete this project");
        }

        projectMemberRepository.deleteByProject(project);
        projectRepository.delete(project);

        auditService.logEvent(owner, AuditAction.PROJECT_DELETED, "PROJECT", projectId.toString(),
                AuditResult.SUCCESS, "Deleted project " + project.getName(), null, null);
    }

    @Transactional(readOnly = true)
    public List<ProjectDto> getProjectsForGroup(UUID groupId, User user) {
        if (user == null) {
            return List.of();
        }
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found with ID: " + groupId));

        if (user.getClient() != null && group.getOwner() != null && group.getOwner().getClient() != null && !user.getClient().getId().equals(group.getOwner().getClient().getId())) {
            throw new ForbiddenException("Access denied: Workshop belongs to another organization");
        }

        if (user.isAdmin()) {
            return projectRepository.findByGroupOrderByCreatedAtDesc(group).stream()
                    .map(p -> mapToDto(p, user))
                    .toList();
        }

        List<Project> accessible = projectRepository.findProjectsByGroupAccessibleByUser(groupId, user.getId());
        return accessible.stream()
                .map(p -> mapToDto(p, user))
                .toList();
    }

    @Transactional
    public void shareDocument(UUID projectId, ShareDocumentRequest request, User manager, HttpServletRequest httpRequest) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.getOwner().getId().equals(manager.getId()) && !manager.isAdmin()) {
            throw new ForbiddenException("Only the project manager or administrator can share documents");
        }

        Document document = documentRepository.findById(request.documentId())
                .orElseThrow(() -> new ResourceNotFoundException("Document not found with ID: " + request.documentId()));

        if (request.assignments() == null || request.assignments().isEmpty()) {
            throw new BadRequestException("At least one recipient assignment must be provided");
        }

        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        for (MemberPermissionAssignmentDto assignment : request.assignments()) {
            User targetUser = userRepository.findByEmailIgnoreCase(assignment.userEmail().trim())
                    .orElseThrow(() -> new ResourceNotFoundException("Recipient user not found: " + assignment.userEmail()));

            if (project.getClient() != null && targetUser.getClient() != null && !project.getClient().getId().equals(targetUser.getClient().getId())) {
                throw new ForbiddenException("Cannot share document with user from another client organization");
            }

            Optional<ProjectMember> pmOpt = projectMemberRepository.findByProjectIdAndUserId(project.getId(), targetUser.getId());
            if (pmOpt.isPresent() && pmOpt.get().isSuspended()) {
                throw new BadRequestException("Cannot share document with suspended member: " + targetUser.getEmail());
            }

            Instant calculatedExpiry;
            if (assignment.durationDays() != null) {
                if (assignment.durationDays() < 1 || assignment.durationDays() > 30) {
                    throw new BadRequestException("Document access duration must be between 1 and 30 days");
                }
                calculatedExpiry = Instant.now().plusSeconds((long) assignment.durationDays() * 86400L);
            } else if (assignment.expiresAt() != null) {
                if (assignment.expiresAt().isBefore(Instant.now())) {
                    throw new BadRequestException("Expiry timestamp must be in the future");
                }
                if (assignment.expiresAt().isAfter(Instant.now().plusSeconds(30L * 86400L + 120L))) {
                    throw new BadRequestException("Document access duration cannot exceed 30 days");
                }
                calculatedExpiry = assignment.expiresAt();
            } else {
                calculatedExpiry = Instant.now().plusSeconds(30L * 86400L);
            }

            Optional<DocumentPermission> existing = permissionRepository.findByDocumentAndUser(document, targetUser);
            DocumentPermission perm;
            if (existing.isPresent()) {
                perm = existing.get();
                perm.setPermissionLevel(assignment.permissionLevel());
                perm.setExpiresAt(calculatedExpiry);
                perm.setStatus(PermissionStatus.ACTIVE);
                perm.setGrantedBy(manager);
                perm.setGrantedAt(Instant.now());
            } else {
                perm = new DocumentPermission(
                        document,
                        targetUser,
                        assignment.permissionLevel() != null ? assignment.permissionLevel() : PermissionLevel.READ,
                        manager,
                        calculatedExpiry
                );
            }
            permissionRepository.save(perm);

            auditService.logEvent(manager, AuditAction.DOCUMENT_SHARED, "DOCUMENT", document.getId().toString(),
                    AuditResult.SUCCESS, "Shared document " + document.getTitle() + " with " + targetUser.getEmail() + " (" + assignment.permissionLevel() + ")",
                    clientIp, userAgent);
        }
    }

    @Transactional(readOnly = true)
    public ManagerStatsDto getManagerStats(User manager) {
        if (manager == null) {
            return new ManagerStatsDto(0, 0, 0, 0, 0, 0);
        }

        long totalProjects = projectRepository.countByOwner(manager);
        long vaultDocuments = documentRepository.countByOwner(manager);
        long activeTeamMembers = projectMemberRepository.countActiveTeamMembersByProjectOwner(manager);
        long pendingRequests = accessRequestRepository.countByDocumentOwnerAndStatus(manager, RequestStatus.PENDING)
                + renewalRequestRepository.countByDocumentOwnerAndStatus(manager, RequestStatus.PENDING);

        Instant now = Instant.now();
        Instant threshold = now.plusSeconds(30L * 24 * 3600);
        long expiringPermissions = permissionRepository.findExpiringSoon(manager, now, threshold).size();

        Instant thirtyDaysAgo = now.minusSeconds(30L * 24 * 3600);
        long securityEvents = auditLogRepository.countSecurityEventsForActorSince(manager.getId(), thirtyDaysAgo);

        return new ManagerStatsDto(totalProjects, vaultDocuments, activeTeamMembers, pendingRequests, expiringPermissions, securityEvents);
    }

    private ProjectDto mapToDto(Project p) {
        return mapToDto(p, null);
    }

    private ProjectDto mapToDto(Project p, User currentUser) {
        long docCount = documentRepository.findByProject(p).size();
        long memberCount = projectMemberRepository.findByProject(p).size();

        boolean canView = true;
        boolean canEdit = true;

        if (currentUser != null && !currentUser.isAdmin() && (p.getOwner() == null || !p.getOwner().getId().equals(currentUser.getId()))) {
            Optional<ProjectMember> pm = projectMemberRepository.findByProjectIdAndUserId(p.getId(), currentUser.getId());
            if (pm.isPresent()) {
                canView = pm.get().isCanView() && !pm.get().isSuspended();
                canEdit = pm.get().isCanEdit() && !pm.get().isSuspended();
            } else {
                canView = false;
                canEdit = false;
            }
        }

        return new ProjectDto(
                p.getId(),
                p.getName(),
                p.getDescription(),
                p.getOwner() != null ? p.getOwner().getId() : null,
                p.getOwner() != null ? p.getOwner().getFullName() : "Unassigned",
                p.getGroup() != null ? p.getGroup().getId() : null,
                p.getGroup() != null ? p.getGroup().getName() : null,
                p.getCategory() != null ? p.getCategory() : "General",
                p.getStatus() != null ? p.getStatus() : "ACTIVE",
                docCount,
                memberCount,
                p.getCreatedAt(),
                canView,
                canEdit
        );
    }

    private ProjectMemberDto mapToMemberDto(ProjectMember m, Project project) {
        long accessibleCount = 0;
        if (project != null && !m.isSuspended()) {
            List<Document> pDocs = documentRepository.findByProject(project);
            for (Document d : pDocs) {
                Optional<DocumentPermission> perm = permissionRepository.findByDocumentAndUser(d, m.getUser());
                if (perm.isPresent() && perm.get().isCurrentlyValid()) {
                    accessibleCount++;
                }
            }
        }

        return new ProjectMemberDto(
                m.getId(),
                m.getUser().getId(),
                m.getUser().getEmail(),
                m.getUser().getFullName(),
                m.getResponsibility() != null ? m.getResponsibility() : "Contributor",
                m.getUser().isActive(),
                m.getAddedAt(),
                m.isCanView(),
                m.isCanEdit(),
                m.getProjectRole() != null ? m.getProjectRole() : Role.ROLE_WORKSHOP_MEMBER,
                m.getResponsibility() != null ? m.getResponsibility() : "Contributor",
                m.getStatus() != null ? m.getStatus() : "ACTIVE",
                m.getSuspendedAt(),
                accessibleCount
        );
    }
}
