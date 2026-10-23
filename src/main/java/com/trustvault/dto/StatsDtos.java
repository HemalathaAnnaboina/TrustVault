package com.trustvault.dto;

import java.util.List;
import java.util.Map;

public class StatsDtos {

    public record StatItem(
            String title,
            String value,
            String change,
            String icon,
            String color
    ) {}

    public record RoleStatsResponse(
            String role,
            List<StatItem> stats,
            Map<String, Object> summary
    ) {}
}
