package com.trustvault.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tv_access_requests", indexes = {
    @Index(name = "idx_ar_doc_status", columnList = "document_id, status"),
    @Index(name = "idx_ar_requester", columnList = "requester_id")
})
public class AccessRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id")
    private Document document;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    private Project project;

    @Column(name = "requested_filename", length = 255)
    private String requestedFilename;

    @Column(name = "duration_days", nullable = false)
    private int durationDays = 7;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requester_id", nullable = false)
    private User requester;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PermissionLevel requestedPermission;

    @Column(nullable = false, length = 1000)
    private String reason;

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

    public AccessRequest() {
    }

    public AccessRequest(Document document, User requester, PermissionLevel requestedPermission, String reason) {
        this(document, document != null ? document.getProject() : null, document != null ? document.getOriginalFilename() : null, requester, requestedPermission, reason, 7);
    }

    public AccessRequest(Document document, Project project, String requestedFilename, User requester, PermissionLevel requestedPermission, String reason, int durationDays) {
        this.document = document;
        this.project = project;
        this.requestedFilename = requestedFilename;
        this.requester = requester;
        this.requestedPermission = requestedPermission;
        this.reason = reason;
        this.durationDays = durationDays > 0 ? durationDays : 7;
        this.status = RequestStatus.PENDING;
        this.createdAt = Instant.now();
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

    public User getRequester() {
        return requester;
    }

    public void setRequester(User requester) {
        this.requester = requester;
    }

    public PermissionLevel getRequestedPermission() {
        return requestedPermission;
    }

    public void setRequestedPermission(PermissionLevel requestedPermission) {
        this.requestedPermission = requestedPermission;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
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

    public Project getProject() {
        return project;
    }

    public void setProject(Project project) {
        this.project = project;
    }

    public String getRequestedFilename() {
        return requestedFilename;
    }

    public void setRequestedFilename(String requestedFilename) {
        this.requestedFilename = requestedFilename;
    }

    public int getDurationDays() {
        return durationDays;
    }

    public void setDurationDays(int durationDays) {
        this.durationDays = durationDays;
    }
}
