package com.trustvault.repository;

import com.trustvault.model.Document;
import com.trustvault.model.StarredDocument;
import com.trustvault.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StarredDocumentRepository extends JpaRepository<StarredDocument, UUID> {

    Optional<StarredDocument> findByUserAndDocument(User user, Document document);

    boolean existsByUserAndDocument(User user, Document document);

    void deleteByUserAndDocument(User user, Document document);

    long countByUser(User user);

    @Query("SELECT s FROM StarredDocument s JOIN FETCH s.document WHERE s.user = :user ORDER BY s.starredAt DESC")
    List<StarredDocument> findByUserOrderByStarredAtDesc(@Param("user") User user);
}
