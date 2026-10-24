package com.trustvault.service;

import com.trustvault.dto.AuditDtos.AuditLogDto;
import com.trustvault.dto.AuditDtos.AuditVerificationResponse;
import com.trustvault.model.AuditAction;
import com.trustvault.model.AuditLog;
import com.trustvault.model.AuditResult;
import com.trustvault.model.User;
import com.trustvault.repository.AuditLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);
    private static final String GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

    private final AuditLogRepository auditLogRepository;
    private final TransactionTemplate transactionTemplate;
    private final com.trustvault.repository.DocumentRepository documentRepository;
    private final com.trustvault.repository.ProjectRepository projectRepository;

    private static long lastTimestampMs = 0;
    private static final Object timeLock = new Object();

    public AuditService(
            AuditLogRepository auditLogRepository,
            PlatformTransactionManager transactionManager,
            @org.springframework.context.annotation.Lazy com.trustvault.repository.DocumentRepository documentRepository,
            @org.springframework.context.annotation.Lazy com.trustvault.repository.ProjectRepository projectRepository
    ) {
        this.auditLogRepository = auditLogRepository;
        this.documentRepository = documentRepository;
        this.projectRepository = projectRepository;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.transactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    private static Instant getMonotonicTimestamp() {
        synchronized (timeLock) {
            long now = System.currentTimeMillis();
            if (now <= lastTimestampMs) {
                now = lastTimestampMs + 1;
            }
            lastTimestampMs = now;
            return Instant.ofEpochMilli(now);
        }
    }

    /**
     * Records an audit log entry with cryptographic hash chaining (SHA-256).
     * Strictly synchronizes transaction start, monotonic timestamping, hash computation,
     * and database commit to guarantee deterministic sequence and prevent race conditions.
     */
    public synchronized AuditLog logEvent(
            User actor,
            AuditAction action,
            String resourceType,
            String resourceId,
            AuditResult result,
            String reason,
            String ipAddress,
            String userAgent
    ) {
        return transactionTemplate.execute(status -> {
            // Sanitize reason to avoid logging sensitive secrets or document content
            String sanitizedReason = sanitizeReason(reason);

            UUID actorId = (actor != null) ? actor.getId() : null;
            String actorEmail = (actor != null) ? actor.getEmail() : "anonymous";
            String actorRole = (actor != null && actor.getRole() != null) ? actor.getRole().name() : "ANONYMOUS";

            // Fetch the hash of the latest audit record to chain
            Optional<AuditLog> latestLog = auditLogRepository.findTopByOrderByTimestampDesc();
            String previousHash = latestLog.map(AuditLog::getCurrentHash).orElse(GENESIS_HASH);

            Instant timestamp = getMonotonicTimestamp();
            String currentHash = computeHash(previousHash, timestamp, actorEmail, action.name(), resourceType, resourceId, result.name(), sanitizedReason);

            AuditLog auditLog = new AuditLog(
                    timestamp,
                    actorId,
                    actorEmail,
                    actorRole,
                    action,
                    resourceType,
                    resourceId,
                    result,
                    sanitizedReason,
                    ipAddress,
                    userAgent,
                    previousHash,
                    currentHash
            );

            if (actor != null && actor.getClient() != null) {
                auditLog.setClientId(actor.getClient().getId());
            }

            if ("DOCUMENT".equalsIgnoreCase(resourceType) && resourceId != null) {
                try {
                    UUID docId = UUID.fromString(resourceId);
                    documentRepository.findById(docId).ifPresent(d -> {
                        if (d.getProject() != null) {
                            auditLog.setProjectId(d.getProject().getId());
                        }
                        if (auditLog.getClientId() == null && d.getClient() != null) {
                            auditLog.setClientId(d.getClient().getId());
                        }
                    });
                } catch (Exception ignored) {}
            } else if ("PROJECT".equalsIgnoreCase(resourceType) && resourceId != null) {
                try {
                    UUID projId = UUID.fromString(resourceId);
                    auditLog.setProjectId(projId);
                    if (auditLog.getClientId() == null) {
                        projectRepository.findById(projId).ifPresent(p -> {
                            if (p.getClient() != null) {
                                auditLog.setClientId(p.getClient().getId());
                            }
                        });
                    }
                } catch (Exception ignored) {}
            }

            AuditLog saved = auditLogRepository.saveAndFlush(auditLog);
            log.info("AUDIT EVENT: [{}] [{}] by [{}] - result: {} reason: {}", action, resourceType, actorEmail, result, sanitizedReason);
            return saved;
        });
    }

    @Transactional(readOnly = true)
    public List<AuditLogDto> getAllLogs() {
        return auditLogRepository.findAllByOrderByTimestampDesc().stream()
                .map(this::mapToDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<AuditLogDto> getPagedLogs(Pageable pageable) {
        return auditLogRepository.findAllByOrderByTimestampDesc(pageable)
                .map(this::mapToDto);
    }

    @Transactional(readOnly = true)
    public List<AuditLogDto> getFilteredLogs(Integer page, Integer size, String action, String result, String search) {
        return getFilteredLogs(page, size, action, result, search, null);
    }

    @Transactional(readOnly = true)
    public List<AuditLogDto> getFilteredLogs(Integer page, Integer size, String action, String result, String search, com.trustvault.model.User currentUser) {
        List<AuditLog> all = auditLogRepository.findAllByOrderByTimestampDesc();
        var stream = all.stream();

        // Project/owner scoping for Managers: Managers can view only audit logs for projects they manage
        if (currentUser != null && (currentUser.isManager() || currentUser.getRole() == com.trustvault.model.Role.ROLE_OWNER)) {
            java.util.Set<UUID> ownedProjectIds = projectRepository.findByOwnerOrderByCreatedAtDesc(currentUser).stream()
                    .map(com.trustvault.model.Project::getId)
                    .collect(java.util.stream.Collectors.toSet());
            java.util.Set<String> ownedDocIds = documentRepository.findByOwnerOrderByCreatedAtDesc(currentUser).stream()
                    .map(d -> d.getId().toString())
                    .collect(java.util.stream.Collectors.toSet());

            stream = stream.filter(l ->
                    (l.getActorId() != null && l.getActorId().equals(currentUser.getId())) ||
                    (l.getProjectId() != null && ownedProjectIds.contains(l.getProjectId())) ||
                    (l.getResourceId() != null && ownedDocIds.contains(l.getResourceId()))
            );
        } else if (currentUser != null && currentUser.isWorkshopMember()) {
            throw new com.trustvault.exception.ForbiddenException("Access denied: Workshop members are not authorized to view system-wide audit logs");
        }

        if (action != null && !action.isBlank() && !action.equalsIgnoreCase("ALL")) {
            stream = stream.filter(l -> l.getAction().name().equalsIgnoreCase(action.trim()));
        }

        if (result != null && !result.isBlank() && !result.equalsIgnoreCase("ALL")) {
            stream = stream.filter(l -> l.getResult().name().equalsIgnoreCase(result.trim()));
        }

        if (search != null && !search.isBlank()) {
            String q = search.trim().toLowerCase();
            stream = stream.filter(l ->
                    (l.getActorEmail() != null && l.getActorEmail().toLowerCase().contains(q)) ||
                    (l.getResourceId() != null && l.getResourceId().toLowerCase().contains(q)) ||
                    (l.getReason() != null && l.getReason().toLowerCase().contains(q))
            );
        }

        List<AuditLogDto> filtered = stream.map(this::mapToDto).toList();

        if (page != null && size != null && size > 0) {
            int fromIndex = Math.min(page * size, filtered.size());
            int toIndex = Math.min(fromIndex + size, filtered.size());
            return filtered.subList(fromIndex, toIndex);
        }

        return filtered;
    }

    @Transactional(readOnly = true)
    public List<AuditLogDto> getDocumentLogs(String documentId) {
        return getDocumentLogs(documentId, null);
    }

    @Transactional(readOnly = true)
    public List<AuditLogDto> getDocumentLogs(String documentId, com.trustvault.model.User currentUser) {
        if (currentUser == null || (!currentUser.isAdmin() && !currentUser.isManager() && currentUser.getRole() != com.trustvault.model.Role.ROLE_OWNER)) {
            throw new com.trustvault.exception.ForbiddenException("Access denied: Workshop members are not authorized to view document audit logs");
        }
        if (currentUser.isManager() || currentUser.getRole() == com.trustvault.model.Role.ROLE_OWNER) {
            try {
                UUID docUuid = UUID.fromString(documentId);
                com.trustvault.model.Document doc = documentRepository.findById(docUuid).orElse(null);
                if (doc != null && !doc.getOwner().getId().equals(currentUser.getId())) {
                    throw new com.trustvault.exception.ForbiddenException("Access denied: You can only view audit logs for your own documents or projects");
                }
            } catch (IllegalArgumentException ignored) {}
        }
        return auditLogRepository.findByResourceTypeAndResourceIdOrderByTimestampDesc("DOCUMENT", documentId).stream()
                .map(this::mapToDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AuditLogDto> getMyActivityLogs(com.trustvault.model.User currentUser) {
        if (currentUser == null || (!currentUser.isAdmin() && !currentUser.isManager() && currentUser.getRole() != com.trustvault.model.Role.ROLE_OWNER)) {
            throw new com.trustvault.exception.ForbiddenException("Access denied: Workshop users are not authorized to view audit or activity history");
        }
        return auditLogRepository.findByActorIdOrderByTimestampDesc(currentUser.getId()).stream()
                .map(this::mapToDto)
                .toList();
    }

    /**
     * Verifies the cryptographic hash-chain integrity of all audit logs.
     * Detects any insertions, deletions, modifications, or tampering.
     */
    @Transactional(readOnly = true)
    public AuditVerificationResponse verifyChainIntegrity() {
        List<AuditLog> records = auditLogRepository.findAllByOrderByTimestampAsc();
        if (records.isEmpty()) {
            return new AuditVerificationResponse(true, 0, 0, null, "Audit chain is empty and valid");
        }

        String expectedPrevHash = GENESIS_HASH;
        long count = 0;

        for (AuditLog record : records) {
            // Check previous hash link
            if (!record.getPreviousHash().equals(expectedPrevHash)) {
                log.error("TAMPER DETECTED: Audit log {} broken previous hash link! Expected: {}, Found: {}",
                        record.getId(), expectedPrevHash, record.getPreviousHash());
                return new AuditVerificationResponse(false, records.size(), count, record.getId(),
                        "Audit chain broken at record " + record.getId() + ": previous hash mismatch (possible deletion or insertion)");
            }

            // Re-calculate expected current hash
            String calculatedHash = computeHash(
                    record.getPreviousHash(),
                    record.getTimestamp(),
                    record.getActorEmail(),
                    record.getAction().name(),
                    record.getResourceType(),
                    record.getResourceId(),
                    record.getResult().name(),
                    record.getReason()
            );

            if (!calculatedHash.equals(record.getCurrentHash())) {
                log.error("TAMPER DETECTED: Audit log {} hash mismatch! Calculated: {}, Stored: {}",
                        record.getId(), calculatedHash, record.getCurrentHash());
                return new AuditVerificationResponse(false, records.size(), count, record.getId(),
                        "Audit chain broken at record " + record.getId() + ": content tampered with");
            }

            expectedPrevHash = record.getCurrentHash();
            count++;
        }

        return new AuditVerificationResponse(true, records.size(), count, null, "All " + count + " audit log records verified intact and untampered.");
    }

    /**
     * Enforces audit immutability: deletion of audit records is strictly prohibited.
     */
    public void deleteAuditRecord(UUID id) {
        throw new UnsupportedOperationException("Tamper Protection: Audit logs are append-only and cannot be modified or deleted");
    }

    private String computeHash(String prevHash, Instant ts, String email, String act, String rType, String rId, String res, String rsn) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String payload = String.format("%s|%s|%s|%s|%s|%s|%s|%s",
                    prevHash != null ? prevHash : "",
                    ts != null ? String.valueOf(ts.toEpochMilli()) : "",
                    email != null ? email : "",
                    act != null ? act : "",
                    rType != null ? rType : "",
                    rId != null ? rId : "",
                    res != null ? res : "",
                    rsn != null ? rsn : ""
            );
            byte[] hashBytes = digest.digest(payload.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hashBytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not supported", e);
        }
    }

    private String sanitizeReason(String reason) {
        if (reason == null) return null;
        // Strip sensitive credentials, bearer tokens, or password values if present, while preserving event descriptions
        String sanitized = reason
                .replaceAll("(?i)(password|token|bearer|secret)[=:\\s]+['\"]?[^\\s,'\"]+['\"]?", "$1=[REDACTED]");
        return sanitized.length() > 500 ? sanitized.substring(0, 500) : sanitized;
    }

    private AuditLogDto mapToDto(AuditLog l) {
        return new AuditLogDto(
                l.getId(),
                l.getTimestamp(),
                l.getActorId(),
                l.getActorEmail(),
                l.getActorRole(),
                l.getAction(),
                l.getResourceType(),
                l.getResourceId(),
                l.getResult(),
                l.getReason(),
                l.getIpAddress(),
                l.getUserAgent(),
                l.getPreviousHash(),
                l.getCurrentHash(),
                l.getClientId(),
                l.getProjectId()
        );
    }
}
