package com.trustvault.controller;

import com.trustvault.dto.ProjectDtos.ManagerStatsDto;
import com.trustvault.dto.StatsDtos.RoleStatsResponse;
import com.trustvault.model.User;
import com.trustvault.security.SecurityUtils;
import com.trustvault.service.ProjectService;
import com.trustvault.service.StatsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final StatsService statsService;
    private final ProjectService projectService;

    public StatsController(StatsService statsService, ProjectService projectService) {
        this.statsService = statsService;
        this.projectService = projectService;
    }

    @GetMapping({"", "/summary"})
    public ResponseEntity<RoleStatsResponse> getStats() {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(statsService.getStatsForUser(currentUser));
    }

    @GetMapping("/manager")
    public ResponseEntity<ManagerStatsDto> getManagerStats() {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(projectService.getManagerStats(currentUser));
    }
}
