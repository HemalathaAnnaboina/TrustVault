package com.trustvault.repository;

import com.trustvault.model.Document;
import com.trustvault.model.Project;
import com.trustvault.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DocumentRepository extends JpaRepository<Document, UUID> {
    List<Document> findByOwnerOrderByCreatedAtDesc(User owner);
    long countByOwner(User owner);
    List<Document> findByProject(Project project);
    Optional<Document> findByStorageKey(String storageKey);

    @Query("SELECT d FROM Document d WHERE LOWER(d.title) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(d.category) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<Document> searchDocuments(@Param("query") String query);

    @Query("SELECT DISTINCT p.document FROM DocumentPermission p WHERE p.user = :user AND p.status = 'ACTIVE' AND (p.expiresAt IS NULL OR p.expiresAt > CURRENT_TIMESTAMP)")
    List<Document> findDocumentsAccessibleByUser(@Param("user") User user);
}
