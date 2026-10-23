-- ====================================================================
-- TrustVault Flyway Migration: V9 Manager Dashboard, Lifecycle & Member Suspension
-- Target: PostgreSQL 17 / ANSI SQL Compatible
-- ====================================================================

-- 1. Add status column to tv_projects (e.g. ACTIVE, ARCHIVED, COMPLETED)
ALTER TABLE tv_projects ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE';

-- 2. Add status, suspended_at, and suspended_by_id to tv_project_members
ALTER TABLE tv_project_members ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE tv_project_members ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tv_project_members ADD COLUMN IF NOT EXISTS suspended_by_id UUID REFERENCES tv_users(id);

-- 3. Add indices for project status and member status
CREATE INDEX IF NOT EXISTS idx_project_status ON tv_projects(status);
CREATE INDEX IF NOT EXISTS idx_pm_status ON tv_project_members(status);
CREATE INDEX IF NOT EXISTS idx_pm_proj_user_status ON tv_project_members(project_id, user_id, status);
