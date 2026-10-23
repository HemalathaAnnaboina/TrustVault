package com.trustvault.dto;

import com.trustvault.model.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public class AuthDtos {

    public record LoginRequest(
            @NotBlank(message = "Email is required")
            @Email(message = "Must be a valid email address")
            String email,

            @NotBlank(message = "Password is required")
            String password
    ) {}

    public record LoginResponse(
            String token,
            String tokenType,
            UUID id,
            String email,
            String fullName,
            Role role,
            boolean active
    ) {}

    public record RegisterRequest(
            @NotBlank(message = "Email is required")
            @Email(message = "Must be a valid email address")
            String email,

            @NotBlank(message = "Password is required")
            @Size(min = 8, message = "Password must be at least 8 characters")
            String password,

            @NotBlank(message = "Full name is required")
            String fullName,

            Role role
    ) {}

    public record UserProfileResponse(
            UUID id,
            String email,
            String fullName,
            Role role,
            boolean active
    ) {}

    public record ChangePasswordRequest(
            @NotBlank(message = "Current password is required")
            String oldPassword,

            @NotBlank(message = "New password is required")
            @Size(min = 8, message = "New password must be at least 8 characters")
            String newPassword
    ) {}

    public record SetupPasswordRequest(
            @NotBlank(message = "Setup token is required")
            String token,

            @NotBlank(message = "New password is required")
            @Size(min = 8, message = "New password must be at least 8 characters")
            String newPassword
    ) {}
}
