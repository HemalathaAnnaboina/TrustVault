package com.trustvault.service;

import com.trustvault.dto.StatsDtos.RoleStatsResponse;
import com.trustvault.dto.StatsDtos.StatItem;
import com.trustvault.model.*;
import com.trustvault.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class StatsService {

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final DocumentRepository documentRepository;
    private final DocumentPermissionRepository permissionRepository;
    private final AccessRequestRepository accessRequestRepository;
    private final AuditLogRepository auditLogRepository;
    private final StarredDocumentRepository starredDocumentRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final RenewalRequestRepository renewalRequestRepository;

    public StatsService(
            UserRepository userRepository,
            ProjectRepository projectRepository,
            DocumentRepository documentRepository,
            DocumentPermissionRepository permissionRepository,
            AccessRequestRepository accessRequestRepository,
            AuditLogRepository auditLogRepository,
            StarredDocumentRepository starredDocumentRepository,
            ProjectMemberRepository projectMemberRepository,
            RenewalRequestRepository renewalRequestRepository
    ) {
        this.userRepository = userRepository;
        this.projectRepository = projectRepository;
        this.documentRepository = documentRepository;
        this.permissionRepository = permissionRepository;
        this.accessRequestRepository = accessRequestRepository;
        this.auditLogRepository = auditLogRepository;
        this.starredDocumentRepository = starredDocumentRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.renewalRequestRepository = renewalRequestRepository;
    }

    @Transactional(readOnly = true)
    public RoleStatsResponse getStatsForUser(User user) {
        Role role = user.getRole();
        List<StatItem> stats = new ArrayList<>();
        Map<String, Object> summary = new HashMap<>();

        if (role == Role.ROLE_ADMIN) {
            long totalUsers = userRepository.count();
            long totalProjects = projectRepository.count();
            long pendingRequests = accessRequestRepository.countByStatus(RequestStatus.PENDING);
            long securityAlerts = auditLogRepository.countByResult(AuditResult.DENIED);
            long totalAuditLogs = auditLogRepository.count();

            stats.add(new StatItem("Total users", String.valueOf(totalUsers), "All registered accounts", "Users", "blue"));
            stats.add(new StatItem("Total projects", String.valueOf(totalProjects), "Active workspaces", "FolderKanban", "purple"));
            stats.add(new StatItem("Pending requests", String.valueOf(pendingRequests), "Awaiting review", "Clock3", "orange"));
            stats.add(new StatItem("Security alerts", String.valueOf(securityAlerts), "Access violations", "ShieldAlert", "red"));

            summary.put("totalUsers", totalUsers);
            summary.put("totalProjects", totalProjects);
            summary.put("pendingRequests", pendingRequests);
            summary.put("securityAlerts", securityAlerts);
            summary.put("totalAuditLogs", totalAuditLogs);
        } else if (role == Role.ROLE_OWNER) {
            long ownedDocs = documentRepository.countByOwner(user);
            long projects = projectRepository.countByOwner(user);
            long sharedUsers = permissionRepository.countDistinctSharedUsersByOwner(user);
            long pendingRequests = accessRequestRepository.countByDocumentOwnerAndStatus(user, RequestStatus.PENDING);

            Instant now = Instant.now();
            Instant threshold = now.plusSeconds(30L * 24 * 3600);
            long expiringSoon = permissionRepository.findByDocumentOwnerOrderByGrantedAtDesc(user).stream()
                    .filter(p -> p.getStatus() == PermissionStatus.ACTIVE && p.getExpiresAt() != null
                            && p.getExpiresAt().isAfter(now) && p.getExpiresAt().isBefore(threshold))
                    .count();

            long securityEventsCount = auditLogRepository.findAll().stream()
                    .filter(l -> l.getResult() == AuditResult.DENIED)
                    .count();

            stats.add(new StatItem("Total documents", String.valueOf(ownedDocs), "+12% this month", "FileText", "blue"));
            stats.add(new StatItem("Projects", String.valueOf(projects), "+2 this month", "FolderKanban", "purple"));
            stats.add(new StatItem("People shared with", String.valueOf(sharedUsers), "+8% this month", "Users", "green"));
            stats.add(new StatItem("Pending requests", String.valueOf(pendingRequests), "Needs attention", "Clock3", "orange"));

            summary.put("totalProjects", projects);
            summary.put("totalDocuments", ownedDocs);
            summary.put("activeTeamMembers", sharedUsers);
            summary.put("pendingRequests", pendingRequests);
            summary.put("expiringPermissions", expiringSoon);
            summary.put("securityEventsCount", securityEventsCount);
        } else {
            // ROLE_WORKSHOP_MEMBER (encompasses Workshop Members, Editors, and Viewers)
            long assignedProjects = projectMemberRepository.findByUser(user).stream()
                    .map(ProjectMember::getProject)
                    .filter(java.util.Objects::nonNull)
                    .distinct().count() + projectRepository.countByOwner(user);

            Set<Document> accessibleSet = new LinkedHashSet<>(documentRepository.findDocumentsAccessibleByUser(user));
            accessibleSet.addAll(documentRepository.findByOwnerOrderByCreatedAtDesc(user));
            long accessibleFiles = accessibleSet.size();

            long pendingAccess = accessRequestRepository.findByRequesterOrderByCreatedAtDesc(user).stream()
                    .filter(r -> r.getStatus() == RequestStatus.PENDING).count();
            long pendingRenewals = renewalRequestRepository.findByRequesterOrderByCreatedAtDesc(user).stream()
                    .filter(r -> r.getStatus() == RequestStatus.PENDING).count();
            long pendingRequests = pendingAccess + pendingRenewals;

            long approvedAccess = accessRequestRepository.findByRequesterOrderByCreatedAtDesc(user).stream()
                    .filter(r -> r.getStatus() == RequestStatus.APPROVED).count();
            long approvedRenewals = renewalRequestRepository.findByRequesterOrderByCreatedAtDesc(user).stream()
                    .filter(r -> r.getStatus() == RequestStatus.APPROVED).count();
            long approvedRequests = approvedAccess + approvedRenewals;

            long readGrants = permissionRepository.countByUserAndPermissionLevelAndStatus(user, PermissionLevel.READ, PermissionStatus.ACTIVE);
            long editGrants = permissionRepository.countByUserAndPermissionLevelAndStatus(user, PermissionLevel.EDIT, PermissionStatus.ACTIVE);
            long starredDocs = starredDocumentRepository.countByUser(user);
            long recentlyAccessed = auditLogRepository.findByActorIdOrderByTimestampDesc(user.getId()).stream()
                    .filter(l -> "DOCUMENT".equals(l.getResourceType()))
                    .map(AuditLog::getResourceId)
                    .filter(java.util.Objects::nonNull)
                    .distinct().count();

            stats.add(new StatItem("Assigned Projects", String.valueOf(assignedProjects), "Active assigned workspaces", "FolderKanban", "blue"));
            stats.add(new StatItem("Accessible Files", String.valueOf(accessibleFiles), "Documents with active permissions", "FileCheck2", "emerald"));
            stats.add(new StatItem("Documents I Can Edit", String.valueOf(editGrants), "Active EDIT grants", "Edit3", "amber"));
            stats.add(new StatItem("Pending Requests", String.valueOf(pendingRequests), "Awaiting manager review", "Clock3", "orange"));

            summary.put("assignedProjects", assignedProjects);
            summary.put("accessibleFiles", accessibleFiles);
            summary.put("totalProjects", assignedProjects);
            summary.put("totalFiles", accessibleFiles);
            summary.put("pendingRequests", pendingRequests);
            summary.put("approvedRequests", approvedRequests);
            summary.put("documentsAvailable", accessibleFiles);
            summary.put("documentsCanEdit", editGrants);
            summary.put("readGrants", readGrants);
            summary.put("editGrants", editGrants);
            summary.put("starredDocuments", starredDocs);
            summary.put("recentlyAccessed", recentlyAccessed);
        }

        return new RoleStatsResponse(role.name(), stats, summary);
    }
}
