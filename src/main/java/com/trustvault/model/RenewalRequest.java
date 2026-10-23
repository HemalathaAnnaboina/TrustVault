package com.trustvault.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tv_renewal_requests", indexes = {
    @Index(name = "idx_rr_perm_status", columnList = "permission_id, status"),
    @Index(name = "idx_rr_requester", columnList = "requester_id")
})
public class RenewalRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "permission_id", nullable = false)
    private DocumentPermission documentPermission;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requester_id", nullable = false)
    private User requester;

    @Column(nullable = false, length = 1000)
    private String reason;

    @Column(nullable = false)
    private int requestedExtensionDays = 30;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RequestStatus status = RequestStatus.PENDING;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by_id")
    private User reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(length = 500)
    private String reviewNote;

    public RenewalRequest() {
    }

    public RenewalRequest(DocumentPermission documentPermission, User requester, String reason, int requestedExtensionDays) {
        this.documentPermission = documentPermission;
        this.requester = requester;
        this.reason = reason;
        this.requestedExtensionDays = requestedExtensionDays;
        this.status = RequestStatus.PENDING;
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public DocumentPermission getDocumentPermission() {
        return documentPermission;
    }

    public void setDocumentPermission(DocumentPermission documentPermission) {
        this.documentPermission = documentPermission;
    }

    public User getRequester() {
        return requester;
    }

    public void setRequester(User requester) {
        this.requester = requester;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public int getRequestedExtensionDays() {
        return requestedExtensionDays;
    }

    public void setRequestedExtensionDays(int requestedExtensionDays) {
        this.requestedExtensionDays = requestedExtensionDays;
    }

    public RequestStatus getStatus() {
        return status;
    }

    public void setStatus(RequestStatus status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public User getReviewedBy() {
        return reviewedBy;
    }

    public void setReviewedBy(User reviewedBy) {
        this.reviewedBy = reviewedBy;
    }

    public Instant getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(Instant reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public String getReviewNote() {
        return reviewNote;
    }

    public void setReviewNote(String reviewNote) {
        this.reviewNote = reviewNote;
    }
}
