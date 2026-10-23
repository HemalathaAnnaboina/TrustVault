-- ====================================================================
-- TrustVault Flyway Migration: V5 Password Setup, Settings & Folder Support
-- ====================================================================

-- 1. Password Setup Tokens (One-time, expiring onboarding tokens for new users/managers)
CREATE TABLE IF NOT EXISTS tv_password_setup_tokens (
    id UUID PRIMARY KEY,
    token_value VARCHAR(64) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES tv_users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pw_setup_token_value ON tv_password_setup_tokens(token_value);
CREATE INDEX IF NOT EXISTS idx_pw_setup_user_id ON tv_password_setup_tokens(user_id);

-- 2. System Settings (Persistent configuration for Admin Console)
CREATE TABLE IF NOT EXISTS tv_system_settings (
    setting_key VARCHAR(80) PRIMARY KEY,
    setting_value VARCHAR(1000) NOT NULL,
    description VARCHAR(255),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by_id UUID REFERENCES tv_users(id)
);

-- 3. Document folder name support for batch/folder uploads
ALTER TABLE tv_documents ADD COLUMN IF NOT EXISTS folder_name VARCHAR(150);
