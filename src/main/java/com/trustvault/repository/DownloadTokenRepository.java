package com.trustvault.repository;

import com.trustvault.model.DownloadToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DownloadTokenRepository extends JpaRepository<DownloadToken, UUID> {
    Optional<DownloadToken> findByTokenValue(String tokenValue);
    void deleteByExpiresAtBefore(Instant time);
}
