package com.trustvault.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tv_audit_logs", indexes = {
    @Index(name = "idx_audit_timestamp", columnList = "timestamp"),
    @Index(name = "idx_audit_actor", columnList = "actor_id"),
    @Index(name = "idx_audit_action", columnList = "action"),
    @Index(name = "idx_audit_resource", columnList = "resource_type, resource_id")
})
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, updatable = false)
    private Instant timestamp = Instant.now();

    @Column(name = "actor_id", updatable = false)
    private UUID actorId;

    @Column(name = "actor_email", length = 120, updatable = false)
    private String actorEmail;

    @Column(name = "actor_role", length = 30, updatable = false)
    private String actorRole;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40, updatable = false)
    private AuditAction action;

    @Column(name = "resource_type", length = 50, updatable = false)
    private String resourceType;

    @Column(name = "resource_id", length = 64, updatable = false)
    private String resourceId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, updatable = false)
    private AuditResult result;

    @Column(length = 1000, updatable = false)
    private String reason;

    @Column(name = "ip_address", length = 50, updatable = false)
    private String ipAddress;

    @Column(name = "user_agent", length = 255, updatable = false)
    private String userAgent;

    @Column(name = "previous_hash", nullable = false, length = 64, updatable = false)
    private String previousHash;

    @Column(name = "current_hash", nullable = false, length = 64, updatable = false)
    private String currentHash;

    @Column(name = "client_id", updatable = false)
    private UUID clientId;

    @Column(name = "project_id", updatable = false)
    private UUID projectId;

    public AuditLog() {
    }

    public AuditLog(UUID actorId, String actorEmail, String actorRole, AuditAction action,
                    String resourceType, String resourceId, AuditResult result, String reason,
                    String ipAddress, String userAgent, String previousHash, String currentHash) {
        this(Instant.now(), actorId, actorEmail, actorRole, action, resourceType, resourceId, result, reason, ipAddress, userAgent, previousHash, currentHash);
    }

    public AuditLog(Instant timestamp, UUID actorId, String actorEmail, String actorRole, AuditAction action,
                    String resourceType, String resourceId, AuditResult result, String reason,
                    String ipAddress, String userAgent, String previousHash, String currentHash) {
        this.timestamp = timestamp != null ? timestamp : Instant.now();
        this.actorId = actorId;
        this.actorEmail = actorEmail;
        this.actorRole = actorRole;
        this.action = action;
        this.resourceType = resourceType;
        this.resourceId = resourceId;
        this.result = result;
        this.reason = reason;
        this.ipAddress = ipAddress;
        this.userAgent = userAgent;
        this.previousHash = previousHash;
        this.currentHash = currentHash;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public UUID getActorId() {
        return actorId;
    }

    public String getActorEmail() {
        return actorEmail;
    }

    public String getActorRole() {
        return actorRole;
    }

    public AuditAction getAction() {
        return action;
    }

    public String getResourceType() {
        return resourceType;
    }

    public String getResourceId() {
        return resourceId;
    }

    public AuditResult getResult() {
        return result;
    }

    public String getReason() {
        return reason;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public String getPreviousHash() {
        return previousHash;
    }

    public String getCurrentHash() {
        return currentHash;
    }

    public UUID getClientId() {
        return clientId;
    }

    public void setClientId(UUID clientId) {
        this.clientId = clientId;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public void setProjectId(UUID projectId) {
        this.projectId = projectId;
    }
}
