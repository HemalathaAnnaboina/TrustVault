package com.trustvault.service;

import com.trustvault.model.AuditAction;
import com.trustvault.model.AuditResult;
import com.trustvault.model.DocumentPermission;
import com.trustvault.model.PermissionStatus;
import com.trustvault.repository.DocumentPermissionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Component
public class PermissionExpiryScheduler {

    private static final Logger log = LoggerFactory.getLogger(PermissionExpiryScheduler.class);

    private final DocumentPermissionRepository permissionRepository;
    private final AuditService auditService;

    public PermissionExpiryScheduler(DocumentPermissionRepository permissionRepository, AuditService auditService) {
        this.permissionRepository = permissionRepository;
        this.auditService = auditService;
    }

    /**
     * Runs every 60 seconds to clean up, update statuses to EXPIRED, and audit logs.
     * Note: As per security requirements, the application does NOT rely on this scheduler
     * for access enforcement; DocumentAuthorizationService checks expiry dynamically on every request.
     */
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void processExpiredPermissions() {
        Instant now = Instant.now();
        List<DocumentPermission> expiredPermissions = permissionRepository.findByStatusAndExpiresAtBefore(
                PermissionStatus.ACTIVE,
                now
        );

        if (!expiredPermissions.isEmpty()) {
            log.info("Scheduler detected {} expired permissions. Updating status and audit trail...", expiredPermissions.size());
            for (DocumentPermission perm : expiredPermissions) {
                perm.setStatus(PermissionStatus.EXPIRED);
                permissionRepository.save(perm);

                auditService.logEvent(
                        null,
                        AuditAction.PERMISSION_EXPIRED,
                        "PERMISSION",
                        perm.getId().toString(),
                        AuditResult.SUCCESS,
                        "Permission expired for " + perm.getUser().getEmail() + " on " + perm.getDocument().getTitle(),
                        "SYSTEM_SCHEDULER",
                        "TrustVault-Scheduler/1.0"
                );
            }
        }
    }
}
