package com.trustvault.repository;

import com.trustvault.model.PasswordSetupToken;
import com.trustvault.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PasswordSetupTokenRepository extends JpaRepository<PasswordSetupToken, UUID> {
    Optional<PasswordSetupToken> findByTokenValue(String tokenValue);
    Optional<PasswordSetupToken> findByUserAndUsedFalse(User user);
    void deleteByUser(User user);
}
