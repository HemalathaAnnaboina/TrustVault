package com.trustvault.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tv_starred_documents", uniqueConstraints = {
    @UniqueConstraint(name = "uk_starred_user_doc", columnNames = {"user_id", "document_id"})
}, indexes = {
    @Index(name = "idx_starred_user", columnList = "user_id"),
    @Index(name = "idx_starred_doc", columnList = "document_id")
})
public class StarredDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "document_id", nullable = false)
    private Document document;

    @Column(name = "starred_at", nullable = false, updatable = false)
    private Instant starredAt = Instant.now();

    public StarredDocument() {
    }

    public StarredDocument(User user, Document document) {
        this.user = user;
        this.document = document;
        this.starredAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public Document getDocument() {
        return document;
    }

    public void setDocument(Document document) {
        this.document = document;
    }

    public Instant getStarredAt() {
        return starredAt;
    }

    public void setStarredAt(Instant starredAt) {
        this.starredAt = starredAt;
    }
}
