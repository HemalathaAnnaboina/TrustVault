-- ====================================================================
-- TrustVault Flyway Migration: V7 Project Roles, Access Requests & Scoped Auditing
-- ====================================================================

-- 1. Add project_role to tv_project_members (enables per-project roles: VIEWER vs EDITOR)
ALTER TABLE tv_project_members ADD COLUMN IF NOT EXISTS project_role VARCHAR(30) DEFAULT 'ROLE_VIEWER';

-- 2. Add project_id to tv_audit_logs for project-scoped audit filtering
ALTER TABLE tv_audit_logs ADD COLUMN IF NOT EXISTS project_id UUID;

-- 3. Enhance tv_access_requests for manual typed filenames and project-directed requests
ALTER TABLE tv_access_requests ALTER COLUMN document_id DROP NOT NULL;
ALTER TABLE tv_access_requests ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES tv_projects(id) ON DELETE CASCADE;
ALTER TABLE tv_access_requests ADD COLUMN IF NOT EXISTS requested_filename VARCHAR(255);
ALTER TABLE tv_access_requests ADD COLUMN IF NOT EXISTS duration_days INT DEFAULT 7;
