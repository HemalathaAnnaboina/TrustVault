package com.trustvault.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tv_document_permissions", indexes = {
    @Index(name = "idx_perm_doc_user", columnList = "document_id, user_id"),
    @Index(name = "idx_perm_status", columnList = "status"),
    @Index(name = "idx_perm_expiry", columnList = "expires_at")
})
public class DocumentPermission {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "document_id", nullable = false)
    private Document document;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PermissionLevel permissionLevel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "granted_by_id", nullable = false)
    private User grantedBy;

    @Column(nullable = false, updatable = false)
    private Instant grantedAt = Instant.now();

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PermissionStatus status = PermissionStatus.ACTIVE;

    public DocumentPermission() {
    }

    public DocumentPermission(Document document, User user, PermissionLevel permissionLevel,
                              User grantedBy, Instant expiresAt) {
        this.document = document;
        this.user = user;
        this.permissionLevel = permissionLevel;
        this.grantedBy = grantedBy;
        this.expiresAt = expiresAt;
        this.status = PermissionStatus.ACTIVE;
        this.grantedAt = Instant.now();
    }

    /**
     * Checks dynamically if the permission is currently active and not expired.
     */
    public boolean isCurrentlyValid() {
        if (status != PermissionStatus.ACTIVE) {
            return false;
        }
        if (expiresAt != null && Instant.now().isAfter(expiresAt)) {
            return false;
        }
        return true;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Document getDocument() {
        return document;
    }

    public void setDocument(Document document) {
        this.document = document;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public PermissionLevel getPermissionLevel() {
        return permissionLevel;
    }

    public void setPermissionLevel(PermissionLevel permissionLevel) {
        this.permissionLevel = permissionLevel;
    }

    public User getGrantedBy() {
        return grantedBy;
    }

    public void setGrantedBy(User grantedBy) {
        this.grantedBy = grantedBy;
    }

    public Instant getGrantedAt() {
        return grantedAt;
    }

    public void setGrantedAt(Instant grantedAt) {
        this.grantedAt = grantedAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public boolean isReadAllowed() {
        return isCurrentlyValid() && (permissionLevel == PermissionLevel.READ || permissionLevel == PermissionLevel.EDIT || permissionLevel == PermissionLevel.DOWNLOAD);
    }

    public boolean isEditAllowed() {
        return isCurrentlyValid() && permissionLevel == PermissionLevel.EDIT;
    }

    public boolean isDownloadAllowed() {
        return isCurrentlyValid() && (permissionLevel == PermissionLevel.DOWNLOAD || permissionLevel == PermissionLevel.EDIT);
    }

    public PermissionStatus getStatus() {
        return status;
    }

    public void setStatus(PermissionStatus status) {
        this.status = status;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof DocumentPermission that)) return false;
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}

