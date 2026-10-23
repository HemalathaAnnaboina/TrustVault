package com.trustvault.dto;

import com.trustvault.model.AuditAction;
import com.trustvault.model.AuditResult;

import java.time.Instant;
import java.util.UUID;

public class AuditDtos {

    public record AuditLogDto(
            UUID id,
            Instant timestamp,
            UUID actorId,
            String actorEmail,
            String actorRole,
            AuditAction action,
            String resourceType,
            String resourceId,
            AuditResult result,
            String reason,
            String ipAddress,
            String userAgent,
            String previousHash,
            String currentHash
    ) {}

    public record AuditVerificationResponse(
            boolean valid,
            long totalRecords,
            long verifiedCount,
            UUID brokenRecordId,
            String message
    ) {}
}
