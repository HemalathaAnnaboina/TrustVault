package com.trustvault.repository;

import com.trustvault.model.AuditAction;
import com.trustvault.model.AuditLog;
import com.trustvault.model.AuditResult;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    Optional<AuditLog> findTopByOrderByTimestampDesc();

    List<AuditLog> findAllByOrderByTimestampAsc();

    List<AuditLog> findAllByOrderByTimestampDesc();

    Page<AuditLog> findAllByOrderByTimestampDesc(Pageable pageable);

    List<AuditLog> findByActorIdOrderByTimestampDesc(UUID actorId);

    List<AuditLog> findByResourceTypeAndResourceIdOrderByTimestampDesc(String resourceType, String resourceId);

    List<AuditLog> findByActionOrderByTimestampDesc(AuditAction action);

    Optional<AuditLog> findFirstByActorEmailAndActionOrderByTimestampDesc(String actorEmail, AuditAction action);

    long count();

    long countByResult(AuditResult result);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(a) FROM AuditLog a WHERE (a.actorId = :actorId OR a.result = 'DENIED') AND a.timestamp >= :since")
    long countSecurityEventsForActorSince(@org.springframework.data.repository.query.Param("actorId") UUID actorId, @org.springframework.data.repository.query.Param("since") java.time.Instant since);
}
