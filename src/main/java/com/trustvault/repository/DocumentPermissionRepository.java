package com.trustvault.repository;

import com.trustvault.model.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DocumentPermissionRepository extends JpaRepository<DocumentPermission, UUID> {

    List<DocumentPermission> findByDocumentOrderByGrantedAtDesc(Document document);

    List<DocumentPermission> findByUserOrderByGrantedAtDesc(User user);

    Optional<DocumentPermission> findByDocumentAndUser(Document document, User user);

    Optional<DocumentPermission> findByDocumentAndUserAndStatus(Document document, User user, PermissionStatus status);

    List<DocumentPermission> findByStatusAndExpiresAtBefore(PermissionStatus status, Instant time);

    @Query("SELECT p FROM DocumentPermission p WHERE p.user = :user AND p.status = 'ACTIVE' AND p.expiresAt IS NOT NULL AND p.expiresAt > :now AND p.expiresAt <= :threshold")
    List<DocumentPermission> findExpiringSoon(@Param("user") User user, @Param("now") Instant now, @Param("threshold") Instant threshold);

    @Query("SELECT COUNT(DISTINCT p.user) FROM DocumentPermission p WHERE p.document.owner = :owner AND p.status = 'ACTIVE'")
    long countDistinctSharedUsersByOwner(@Param("owner") User owner);

    long countByUserAndStatus(User user, PermissionStatus status);

    long countByUserAndPermissionLevelAndStatus(User user, PermissionLevel level, PermissionStatus status);

    @Query("SELECT p FROM DocumentPermission p WHERE p.document.owner = :owner ORDER BY p.grantedAt DESC")
    List<DocumentPermission> findByDocumentOwnerOrderByGrantedAtDesc(@Param("owner") User owner);

    void deleteByDocument(Document document);
}
