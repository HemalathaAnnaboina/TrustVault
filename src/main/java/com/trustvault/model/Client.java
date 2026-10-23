package com.trustvault.model;

import jakarta.persistence.*;
import org.springframework.data.domain.Persistable;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tv_clients", indexes = {
    @Index(name = "idx_client_code", columnList = "code", unique = true)
})
public class Client implements Persistable<UUID> {

    @Id
    private UUID id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Transient
    private boolean isNew = true;

    public Client() {
        this.id = UUID.randomUUID();
    }

    public Client(UUID id, String name, String code) {
        this.id = id != null ? id : UUID.randomUUID();
        this.name = name;
        this.code = code;
        this.createdAt = Instant.now();
        this.isNew = true;
    }

    public Client(String name, String code) {
        this(UUID.randomUUID(), name, code);
    }

    @Override
    public boolean isNew() {
        return isNew;
    }

    @PostPersist
    @PostLoad
    void markNotNew() {
        this.isNew = false;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
