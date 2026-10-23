-- ====================================================================
-- TrustVault Flyway Migration: V3 Add Groups and Workspace Schema
-- Target: PostgreSQL 17 / ANSI SQL Compatible
-- ====================================================================

-- 1. Groups table (Teams & Departments within Workspace)
CREATE TABLE IF NOT EXISTS tv_groups (
    id UUID PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description VARCHAR(500),
    department VARCHAR(100),
    owner_id UUID NOT NULL REFERENCES tv_users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_group_owner ON tv_groups(owner_id);

-- 2. Group Members (Associates users with groups)
CREATE TABLE IF NOT EXISTS tv_group_members (
    id UUID PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES tv_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES tv_users(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_group_member UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_member_group ON tv_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_member_user ON tv_group_members(user_id);

-- 3. Add optional group_id and category to tv_projects
ALTER TABLE tv_projects ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES tv_groups(id) ON DELETE SET NULL;
ALTER TABLE tv_projects ADD COLUMN IF NOT EXISTS category VARCHAR(60) DEFAULT 'General';
