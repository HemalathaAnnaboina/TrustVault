package com.trustvault.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.trustvault.model.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public class UserDtos {

    public record UserDto(
            UUID id,
            String email,
            String fullName,
            Role role,
            boolean active,
            Instant createdAt,
            java.util.List<String> projectNames,
            String setupToken,
            String setupLink,
            String tempPassword
    ) {
        public UserDto(UUID id, String email, String fullName, Role role, boolean active, Instant createdAt, java.util.List<String> projectNames) {
            this(id, email, fullName, role, active, createdAt, projectNames, null, null, null);
        }

        public UserDto(UUID id, String email, String fullName, Role role, boolean active, Instant createdAt) {
            this(id, email, fullName, role, active, createdAt, java.util.List.of(), null, null, null);
        }
    }

    public record UserUpdateRequest(
            String fullName,
            Role role,
            Boolean active
    ) {}

    public record CreateUserRequest(
            @NotBlank(message = "Corporate email is required")
            @Email(message = "Please enter a valid corporate email address")
            String email,

            @Size(min = 8, message = "Password must be at least 8 characters")
            String password,

            @NotBlank(message = "Full name is required")
            @Size(min = 2, max = 100, message = "Full name must be between 2 and 100 characters")
            String fullName,

            @NotNull(message = "System role is required")
            Role role,

            UUID initialProjectId
    ) {
        @JsonCreator
        public CreateUserRequest(
                @JsonProperty("email") String email,
                @JsonProperty("password") String password,
                @JsonProperty("fullName") String fullName,
                @JsonProperty("role") Role role,
                @JsonProperty("initialProjectId") UUID initialProjectId
        ) {
            this.email = email;
            this.password = password;
            this.fullName = fullName;
            this.role = role;
            this.initialProjectId = initialProjectId;
        }

        public CreateUserRequest(String email, String password, String fullName, Role role) {
            this(email, password, fullName, role, null);
        }
    }

    public record EmployeeDirectoryDto(
            UUID id,
            String email,
            String fullName,
            Role role,
            boolean active,
            java.util.List<String> groups,
            int assignedProjectsCount,
            int activePermissionsCount,
            Instant createdAt
    ) {}
}
