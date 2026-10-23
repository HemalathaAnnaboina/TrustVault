package com.trustvault.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private final int maxLoginAttemptsPerMinute;
    private final Map<String, ConcurrentLinkedQueue<Instant>> loginAttempts = new ConcurrentHashMap<>();

    public RateLimitingFilter(@Value("${trustvault.rate-limit.login-per-minute:10}") int maxLoginAttemptsPerMinute) {
        this.maxLoginAttemptsPerMinute = maxLoginAttemptsPerMinute;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String uri = request.getRequestURI();
        String method = request.getMethod();

        if ("/api/auth/login".equalsIgnoreCase(uri) && "POST".equalsIgnoreCase(method)) {
            String clientIp = getClientIp(request);
            Instant now = Instant.now();
            Instant oneMinuteAgo = now.minusSeconds(60);

            ConcurrentLinkedQueue<Instant> timestamps = loginAttempts.computeIfAbsent(clientIp, k -> new ConcurrentLinkedQueue<>());

            // Evict entries older than 60 seconds
            while (!timestamps.isEmpty() && timestamps.peek().isBefore(oneMinuteAgo)) {
                timestamps.poll();
            }

            if (timestamps.size() >= maxLoginAttemptsPerMinute) {
                response.setStatus(429);
                response.setContentType("application/json");
                response.getWriter().write("{\"status\":429,\"error\":\"Too Many Requests\",\"message\":\"Rate limit exceeded. Please try again after 1 minute.\"}");
                return;
            }

            timestamps.add(now);
        }

        filterChain.doFilter(request, response);
    }

    private String getClientIp(HttpServletRequest request) {
        String xf = request.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            return xf.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
