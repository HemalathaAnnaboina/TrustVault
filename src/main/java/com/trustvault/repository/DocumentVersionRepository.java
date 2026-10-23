package com.trustvault.repository;

import com.trustvault.model.Document;
import com.trustvault.model.DocumentVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DocumentVersionRepository extends JpaRepository<DocumentVersion, UUID> {

    @Query("SELECT v FROM DocumentVersion v JOIN FETCH v.createdBy WHERE v.document = :document ORDER BY v.versionNumber DESC")
    List<DocumentVersion> findByDocumentOrderByVersionNumberDesc(@Param("document") Document document);

    Optional<DocumentVersion> findFirstByDocumentOrderByVersionNumberDesc(Document document);
}
