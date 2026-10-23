package com.trustvault.repository;

import com.trustvault.model.Group;
import com.trustvault.model.GroupMember;
import com.trustvault.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface GroupMemberRepository extends JpaRepository<GroupMember, UUID> {
    List<GroupMember> findByGroupOrderByAddedAtDesc(Group group);
    List<GroupMember> findByUser(User user);
    Optional<GroupMember> findByGroupAndUser(Group group, User user);
    long countByGroup(Group group);
    void deleteByGroupAndUser(Group group, User user);

    @Query("SELECT gm.group.name FROM GroupMember gm WHERE gm.user = :user")
    List<String> findGroupNamesByUser(@Param("user") User user);
}
