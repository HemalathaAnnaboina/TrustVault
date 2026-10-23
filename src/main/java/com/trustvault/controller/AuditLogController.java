package com.trustvault.controller;

import com.trustvault.dto.AuditDtos.AuditLogDto;
import com.trustvault.dto.AuditDtos.AuditVerificationResponse;
import com.trustvault.model.User;
import com.trustvault.security.SecurityUtils;
import com.trustvault.service.AuditService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/audit-logs")
@PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER', 'ROLE_OWNER')")
public class AuditLogController {

    private final AuditService auditService;

    public AuditLogController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER', 'ROLE_OWNER')")
    public ResponseEntity<List<AuditLogDto>> getAllLogs(
            @RequestParam(value = "page", required = false) Integer page,
            @RequestParam(value = "size", required = false) Integer size,
            @RequestParam(value = "action", required = false) String action,
            @RequestParam(value = "result", required = false) String result,
            @RequestParam(value = "search", required = false) String search
    ) {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(auditService.getFilteredLogs(page, size, action, result, search, currentUser));
    }

    @GetMapping("/my-activity")
    public ResponseEntity<List<AuditLogDto>> getMyActivity() {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(auditService.getMyActivityLogs(currentUser));
    }

    @GetMapping("/document/{documentId}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER', 'ROLE_OWNER')")
    public ResponseEntity<List<AuditLogDto>> getDocumentLogs(@PathVariable String documentId) {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(auditService.getDocumentLogs(documentId, currentUser));
    }

    @GetMapping("/verify-integrity")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER', 'ROLE_OWNER')")
    public ResponseEntity<AuditVerificationResponse> verifyIntegrity() {
        return ResponseEntity.ok(auditService.verifyChainIntegrity());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER', 'ROLE_OWNER')")
    public ResponseEntity<Void> deleteAuditLog(@PathVariable UUID id) {
        // Enforce audit immutability test requirement
        auditService.deleteAuditRecord(id);
        return ResponseEntity.noContent().build();
    }
}
