package com.trustvault.model;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum Role {
    ROLE_ADMIN,
    ROLE_MANAGER,
    ROLE_WORKSHOP_MEMBER;

    // Backward-compatibility and domain aliases
    public static final Role ROLE_OWNER = ROLE_MANAGER;
    public static final Role ROLE_VIEWER = ROLE_WORKSHOP_MEMBER;
    public static final Role ROLE_EDITOR = ROLE_WORKSHOP_MEMBER;
    public static final Role ROLE_WORKSHOP = ROLE_WORKSHOP_MEMBER;
    public static final Role ADMIN = ROLE_ADMIN;
    public static final Role MANAGER = ROLE_MANAGER;
    public static final Role WORKSHOP_MEMBER = ROLE_WORKSHOP_MEMBER;

    @JsonCreator
    public static Role fromString(String value) {
        if (value == null || value.isBlank()) return null;
        String v = value.trim().toUpperCase();
        if (v.equals("ADMIN") || v.equals("ROLE_ADMIN")) return ROLE_ADMIN;
        if (v.equals("MANAGER") || v.equals("ROLE_MANAGER") || v.equals("OWNER") || v.equals("ROLE_OWNER")) return ROLE_MANAGER;
        if (v.equals("WORKSHOP_MEMBER") || v.equals("ROLE_WORKSHOP_MEMBER") ||
                v.equals("WORKSHOP") || v.equals("ROLE_WORKSHOP") ||
                v.equals("VIEWER") || v.equals("ROLE_VIEWER") ||
                v.equals("EDITOR") || v.equals("ROLE_EDITOR")) {
            return ROLE_WORKSHOP_MEMBER;
        }
        return Role.valueOf(v);
    }
}
