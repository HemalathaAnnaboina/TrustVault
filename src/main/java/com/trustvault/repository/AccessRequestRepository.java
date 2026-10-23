package com.trustvault.repository;

import com.trustvault.model.AccessRequest;
import com.trustvault.model.Document;
import com.trustvault.model.RequestStatus;
import com.trustvault.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AccessRequestRepository extends JpaRepository<AccessRequest, UUID> {

    List<AccessRequest> findByDocumentOrderByCreatedAtDesc(Document document);

    List<AccessRequest> findByRequesterOrderByCreatedAtDesc(User requester);

    @Query("SELECT r FROM AccessRequest r LEFT JOIN r.document d LEFT JOIN r.project p WHERE (d.owner = :owner OR (r.document IS NULL AND p.owner = :owner)) ORDER BY r.createdAt DESC")
    List<AccessRequest> findByDocumentOwner(@Param("owner") User owner);

    @Query("SELECT r FROM AccessRequest r LEFT JOIN r.document d LEFT JOIN r.project p WHERE (d.owner = :owner OR (r.document IS NULL AND p.owner = :owner)) AND r.status = :status ORDER BY r.createdAt DESC")
    List<AccessRequest> findByDocumentOwnerAndStatus(@Param("owner") User owner, @Param("status") RequestStatus status);

    Optional<AccessRequest> findByDocumentAndRequesterAndStatus(Document document, User requester, RequestStatus status);

    boolean existsByDocumentAndRequesterAndStatus(Document document, User requester, RequestStatus status);

    boolean existsByProjectAndRequestedFilenameIgnoreCaseAndRequesterAndStatus(com.trustvault.model.Project project, String requestedFilename, User requester, RequestStatus status);

    @Query("SELECT COUNT(r) FROM AccessRequest r LEFT JOIN r.document d LEFT JOIN r.project p WHERE (d.owner = :owner OR (r.document IS NULL AND p.owner = :owner)) AND r.status = :status")
    long countByDocumentOwnerAndStatus(@Param("owner") User owner, @Param("status") RequestStatus status);

    long countByStatus(RequestStatus status);

    void deleteByDocument(Document document);
}
