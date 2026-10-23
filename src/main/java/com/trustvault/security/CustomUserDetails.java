package com.trustvault.security;

import com.trustvault.model.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Collections;
import java.util.UUID;

public class CustomUserDetails implements UserDetails {

    private final User user;

    public CustomUserDetails(User user) {
        this.user = user;
    }

    public User getUser() {
        return user;
    }

    public UUID getId() {
        return user.getId();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        java.util.List<GrantedAuthority> authorities = new java.util.ArrayList<>();
        String roleName = user.getRole().name();
        authorities.add(new SimpleGrantedAuthority(roleName));
        authorities.add(new SimpleGrantedAuthority(roleName.replace("ROLE_", "")));

        if (user.getRole() == com.trustvault.model.Role.ROLE_MANAGER) {
            authorities.add(new SimpleGrantedAuthority("ROLE_OWNER"));
            authorities.add(new SimpleGrantedAuthority("OWNER"));
        } else if (user.getRole() == com.trustvault.model.Role.ROLE_WORKSHOP_MEMBER) {
            authorities.add(new SimpleGrantedAuthority("ROLE_WORKSHOP"));
            authorities.add(new SimpleGrantedAuthority("WORKSHOP"));
            authorities.add(new SimpleGrantedAuthority("ROLE_VIEWER"));
            authorities.add(new SimpleGrantedAuthority("ROLE_EDITOR"));
        }

        return authorities;
    }


    @Override
    public String getPassword() {
        return user.getPasswordHash();
    }

    @Override
    public String getUsername() {
        return user.getEmail();
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return user.isActive();
    }
}
