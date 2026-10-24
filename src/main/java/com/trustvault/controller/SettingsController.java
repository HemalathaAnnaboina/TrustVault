package com.trustvault.controller;

import com.trustvault.model.User;
import com.trustvault.security.SecurityUtils;
import com.trustvault.service.SettingsService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/settings")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class SettingsController {

    private final SettingsService settingsService;

    public SettingsController(SettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getSettings() {
        return ResponseEntity.ok(settingsService.getAllSettings());
    }

    @PutMapping
    public ResponseEntity<Map<String, Object>> updateSettings(
            @RequestBody Map<String, Object> updates,
            HttpServletRequest httpRequest
    ) {
        User admin = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(settingsService.updateSettings(updates, admin, httpRequest));
    }

    @PostMapping("/reset")
    public ResponseEntity<Map<String, Object>> resetSettings(HttpServletRequest httpRequest) {
        User admin = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(settingsService.resetSettings(admin, httpRequest));
    }
}
