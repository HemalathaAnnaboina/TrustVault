package com.trustvault.repository;

import com.trustvault.model.Group;
import com.trustvault.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface GroupRepository extends JpaRepository<Group, UUID> {
    List<Group> findByOwnerOrderByCreatedAtDesc(User owner);
    long countByOwner(User owner);
    Optional<Group> findByNameIgnoreCaseAndOwner(String name, User owner);
}
