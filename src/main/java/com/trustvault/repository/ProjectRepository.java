package com.trustvault.repository;

import com.trustvault.model.Group;
import com.trustvault.model.Project;
import com.trustvault.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ProjectRepository extends JpaRepository<Project, UUID> {
    List<Project> findByOwnerOrderByCreatedAtDesc(User owner);
    List<Project> findByOwnerIdOrderByCreatedAtDesc(UUID ownerId);
    List<Project> findByGroupOrderByCreatedAtDesc(Group group);
    long countByOwner(User owner);

    @Query("SELECT DISTINCT p FROM Project p LEFT JOIN ProjectMember pm ON pm.project = p WHERE (p.owner.id = :userId OR (pm.user.id = :userId AND pm.canView = true AND pm.status = 'ACTIVE')) ORDER BY p.createdAt DESC")
    List<Project> findProjectsAccessibleByUser(@Param("userId") UUID userId);

    @Query("SELECT DISTINCT p FROM Project p LEFT JOIN ProjectMember pm ON pm.project = p WHERE p.group.id = :groupId AND (p.owner.id = :userId OR (pm.user.id = :userId AND pm.canView = true AND pm.status = 'ACTIVE')) ORDER BY p.createdAt DESC")
    List<Project> findProjectsByGroupAccessibleByUser(@Param("groupId") UUID groupId, @Param("userId") UUID userId);
}
