package com.trustvault.service;

import com.trustvault.model.AuditAction;
import com.trustvault.model.AuditResult;
import com.trustvault.model.SystemSetting;
import com.trustvault.model.User;
import com.trustvault.repository.SystemSettingRepository;
import com.trustvault.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class SettingsService {

    private final SystemSettingRepository settingRepository;
    private final AuditService auditService;

    // Default configuration values
    private static final Map<String, String> DEFAULTS = Map.of(
            "systemName", "TrustVault Enterprise Vault",
            "maxUploadSizeMb", "50",
            "defaultPageSize", "20",
            "downloadTokenExpirationSeconds", "60",
            "passwordSetupTokenExpirationHours", "24",
            "requireMfa", "false",
            "auditTamperAutoCheck", "true",
            "sessionTimeoutMinutes", "60",
            "securityAlertEmail", "security-team@trustvault.corp",
            "maintenanceMode", "false"
    );

    public SettingsService(SystemSettingRepository settingRepository, AuditService auditService) {
        this.settingRepository = settingRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getAllSettings() {
        Map<String, Object> current = new HashMap<>(DEFAULTS);
        List<SystemSetting> persisted = settingRepository.findAll();
        for (SystemSetting s : persisted) {
            String val = s.getSettingValue();
            if ("true".equalsIgnoreCase(val) || "false".equalsIgnoreCase(val)) {
                current.put(s.getSettingKey(), Boolean.parseBoolean(val));
            } else {
                try {
                    current.put(s.getSettingKey(), Long.parseLong(val));
                } catch (NumberFormatException e) {
                    current.put(s.getSettingKey(), val);
                }
            }
        }
        return current;
    }

    @Transactional
    public Map<String, Object> updateSettings(Map<String, Object> updates, User admin, HttpServletRequest httpRequest) {
        if (updates == null || updates.isEmpty()) {
            return getAllSettings();
        }

        // Server-side validation
        if (updates.containsKey("maxUploadSizeMb")) {
            try {
                long maxMb = Long.parseLong(String.valueOf(updates.get("maxUploadSizeMb")));
                if (maxMb < 1 || maxMb > 500) {
                    throw new com.trustvault.exception.BadRequestException("Max upload size must be between 1 and 500 MB");
                }
            } catch (NumberFormatException e) {
                throw new com.trustvault.exception.BadRequestException("Invalid number format for maxUploadSizeMb");
            }
        }

        if (updates.containsKey("sessionTimeoutMinutes")) {
            try {
                long timeout = Long.parseLong(String.valueOf(updates.get("sessionTimeoutMinutes")));
                if (timeout < 5 || timeout > 1440) {
                    throw new com.trustvault.exception.BadRequestException("Session timeout must be between 5 and 1440 minutes");
                }
            } catch (NumberFormatException e) {
                throw new com.trustvault.exception.BadRequestException("Invalid number format for sessionTimeoutMinutes");
            }
        }

        if (updates.containsKey("defaultPageSize")) {
            try {
                long pageSize = Long.parseLong(String.valueOf(updates.get("defaultPageSize")));
                if (pageSize < 5 || pageSize > 100) {
                    throw new com.trustvault.exception.BadRequestException("Default page size must be between 5 and 100");
                }
            } catch (NumberFormatException e) {
                throw new com.trustvault.exception.BadRequestException("Invalid number format for defaultPageSize");
            }
        }

        if (updates.containsKey("systemName")) {
            String name = String.valueOf(updates.get("systemName")).trim();
            if (name.isEmpty() || name.length() > 100) {
                throw new com.trustvault.exception.BadRequestException("System name cannot be empty or exceed 100 characters");
            }
        }

        for (Map.Entry<String, Object> entry : updates.entrySet()) {
            String key = entry.getKey();
            if (entry.getValue() == null) continue;
            String val = String.valueOf(entry.getValue()).trim();

            SystemSetting setting = settingRepository.findById(key)
                    .orElse(new SystemSetting(key, val, "Configured via Admin Console", admin));

            setting.setSettingValue(val);
            setting.setUpdatedBy(admin);
            setting.setUpdatedAt(Instant.now());
            settingRepository.save(setting);
        }

        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);
        auditService.logEvent(admin, AuditAction.SYSTEM_SETTING_UPDATED, "SYSTEM_CONFIG", "SETTINGS",
                AuditResult.SUCCESS, "Admin updated " + updates.size() + " system configuration parameter(s)", clientIp, userAgent);

        return getAllSettings();
    }

    @Transactional
    public Map<String, Object> resetSettings(User admin, HttpServletRequest httpRequest) {
        settingRepository.deleteAll();
        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);
        auditService.logEvent(admin, AuditAction.SYSTEM_SETTING_UPDATED, "SYSTEM_CONFIG", "SETTINGS",
                AuditResult.SUCCESS, "Admin reset system settings to defaults", clientIp, userAgent);
        return getAllSettings();
    }
}
