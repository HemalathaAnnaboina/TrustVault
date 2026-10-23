package com.trustvault.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tv_project_members", uniqueConstraints = {
    @UniqueConstraint(name = "uk_project_member", columnNames = {"project_id", "user_id"})
})
public class ProjectMember {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, updatable = false)
    private Instant addedAt = Instant.now();

    @Column(length = 60)
    private String responsibility = "Contributor";

    @Column(name = "can_view", nullable = false)
    private boolean canView = true;

    @Column(name = "can_edit", nullable = false)
    private boolean canEdit = false;

    @Convert(converter = RoleConverter.class)
    @Column(name = "project_role", length = 30)
    private Role projectRole = Role.ROLE_WORKSHOP_MEMBER;

    @Column(nullable = false, length = 30)
    private String status = "ACTIVE";

    @Column(name = "suspended_at")
    private Instant suspendedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "suspended_by_id")
    private User suspendedBy;

    public ProjectMember() {
    }

    public ProjectMember(Project project, User user) {
        this(project, user, "Contributor", true, false);
    }

    public ProjectMember(Project project, User user, String responsibility) {
        this(project, user, responsibility, true, (responsibility != null && responsibility.toLowerCase().contains("editor")));
    }

    public ProjectMember(Project project, User user, String responsibility, boolean canView, boolean canEdit) {
        this.project = project;
        this.user = user;
        this.responsibility = (responsibility != null && !responsibility.isBlank()) ? responsibility : "Contributor";
        this.canView = canView;
        this.canEdit = canEdit;
        if (this.canEdit && !this.canView) {
            this.canView = true;
        }
        this.projectRole = Role.ROLE_WORKSHOP_MEMBER;
        this.addedAt = Instant.now();
    }

    public ProjectMember(Project project, User user, String responsibility, Role legacyRole) {
        this.project = project;
        this.user = user;
        this.responsibility = (responsibility != null && !responsibility.isBlank()) ? responsibility : "Contributor";
        this.projectRole = Role.ROLE_WORKSHOP_MEMBER;
        this.canView = true;
        boolean isViewer = (this.responsibility.toLowerCase().contains("viewer") || this.responsibility.toLowerCase().contains("reader") || this.responsibility.toLowerCase().contains("observer"));
        this.canEdit = !isViewer;
        this.addedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Project getProject() {
        return project;
    }

    public void setProject(Project project) {
        this.project = project;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public Instant getAddedAt() {
        return addedAt;
    }

    public void setAddedAt(Instant addedAt) {
        this.addedAt = addedAt;
    }

    public String getResponsibility() {
        return responsibility;
    }

    public void setResponsibility(String responsibility) {
        this.responsibility = responsibility;
    }

    public boolean isCanView() {
        return canView;
    }

    public void setCanView(boolean canView) {
        this.canView = canView;
        if (!canView) {
            this.canEdit = false;
        }
    }

    public boolean isCanEdit() {
        return canEdit;
    }

    public void setCanEdit(boolean canEdit) {
        this.canEdit = canEdit;
        if (canEdit) {
            this.canView = true;
        }
    }

    public Role getProjectRole() {
        return projectRole;
    }

    public void setProjectRole(Role projectRole) {
        this.projectRole = projectRole;
        if (projectRole != null && projectRole.name().contains("EDITOR")) {
            this.canEdit = true;
            this.canView = true;
        }
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status != null && !status.isBlank() ? status.trim().toUpperCase() : "ACTIVE";
    }

    public boolean isSuspended() {
        return "SUSPENDED".equalsIgnoreCase(status);
    }

    public void suspend(User by) {
        this.status = "SUSPENDED";
        this.suspendedAt = Instant.now();
        this.suspendedBy = by;
    }

    public void reactivate() {
        this.status = "ACTIVE";
        this.suspendedAt = null;
        this.suspendedBy = null;
    }

    public Instant getSuspendedAt() {
        return suspendedAt;
    }

    public void setSuspendedAt(Instant suspendedAt) {
        this.suspendedAt = suspendedAt;
    }

    public User getSuspendedBy() {
        return suspendedBy;
    }

    public void setSuspendedBy(User suspendedBy) {
        this.suspendedBy = suspendedBy;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ProjectMember that)) return false;
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
