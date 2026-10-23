package com.trustvault.repository;

import com.trustvault.model.Project;
import com.trustvault.model.ProjectMember;
import com.trustvault.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProjectMemberRepository extends JpaRepository<ProjectMember, UUID> {
    List<ProjectMember> findByProject(Project project);
    List<ProjectMember> findByProjectId(UUID projectId);
    List<ProjectMember> findByProjectAndStatus(Project project, String status);
    List<ProjectMember> findByUser(User user);
    List<ProjectMember> findByUserId(UUID userId);
    List<ProjectMember> findByUserIdAndCanViewTrue(UUID userId);
    Optional<ProjectMember> findByProjectAndUser(Project project, User user);
    Optional<ProjectMember> findByProjectIdAndUserId(UUID projectId, UUID userId);
    boolean existsByProjectAndUser(Project project, User user);
    boolean existsByProjectIdAndUserId(UUID projectId, UUID userId);
    boolean existsByProjectIdAndUserIdAndCanViewTrue(UUID projectId, UUID userId);
    boolean existsByProjectIdAndUserIdAndCanEditTrue(UUID projectId, UUID userId);
    void deleteByProject(Project project);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(DISTINCT pm.user.id) FROM ProjectMember pm WHERE pm.project.owner = :owner AND pm.status = 'ACTIVE' AND pm.user.active = true")
    long countActiveTeamMembersByProjectOwner(@org.springframework.data.repository.query.Param("owner") User owner);
}
