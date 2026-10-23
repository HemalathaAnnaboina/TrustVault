package com.trustvault.repository;

import com.trustvault.model.DocumentPermission;
import com.trustvault.model.RenewalRequest;
import com.trustvault.model.RequestStatus;
import com.trustvault.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RenewalRequestRepository extends JpaRepository<RenewalRequest, UUID> {

    List<RenewalRequest> findByRequesterOrderByCreatedAtDesc(User requester);

    List<RenewalRequest> findByDocumentPermission(DocumentPermission documentPermission);

    @Query("SELECT r FROM RenewalRequest r WHERE r.documentPermission.document.owner = :owner ORDER BY r.createdAt DESC")
    List<RenewalRequest> findByDocumentOwner(@Param("owner") User owner);

    @Query("SELECT r FROM RenewalRequest r WHERE r.documentPermission.document.owner = :owner AND r.status = :status ORDER BY r.createdAt DESC")
    List<RenewalRequest> findByDocumentOwnerAndStatus(@Param("owner") User owner, @Param("status") RequestStatus status);

    @Query("SELECT COUNT(r) FROM RenewalRequest r WHERE r.documentPermission.document.owner = :owner AND r.status = :status")
    long countByDocumentOwnerAndStatus(@Param("owner") User owner, @Param("status") RequestStatus status);

    boolean existsByDocumentPermissionAndStatus(DocumentPermission documentPermission, RequestStatus status);
}
