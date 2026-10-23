-- ====================================================================
-- TrustVault Flyway Migration: V8 Workshop Access, Permissions & Roles Refactor
-- Target: PostgreSQL 17 / ANSI SQL Compatible
-- ====================================================================

-- 1. Add can_view and can_edit boolean flags to tv_project_members
ALTER TABLE tv_project_members ADD COLUMN IF NOT EXISTS can_view BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE tv_project_members ADD COLUMN IF NOT EXISTS can_edit BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Migrate existing project member records to independent VIEW / EDIT permissions
UPDATE tv_project_members
SET can_view = TRUE, can_edit = TRUE
WHERE project_role IN ('ROLE_EDITOR', 'EDITOR');

UPDATE tv_project_members
SET can_view = TRUE, can_edit = FALSE
WHERE project_role IN ('ROLE_VIEWER', 'VIEWER', 'ROLE_WORKSHOP', 'WORKSHOP');

-- 3. Migrate legacy account roles to canonical application-level roles:
--    - Map ROLE_OWNER -> ROLE_MANAGER
--    - Map ROLE_VIEWER, ROLE_EDITOR, ROLE_WORKSHOP -> ROLE_WORKSHOP_MEMBER
UPDATE tv_users SET role = 'ROLE_MANAGER' WHERE role = 'ROLE_OWNER';
UPDATE tv_users SET role = 'ROLE_WORKSHOP_MEMBER' WHERE role IN ('ROLE_VIEWER', 'ROLE_EDITOR', 'ROLE_WORKSHOP');

-- 4. Update audit logs actor_role history
UPDATE tv_audit_logs SET actor_role = 'ROLE_MANAGER' WHERE actor_role = 'ROLE_OWNER';
UPDATE tv_audit_logs SET actor_role = 'ROLE_WORKSHOP_MEMBER' WHERE actor_role IN ('ROLE_VIEWER', 'ROLE_EDITOR', 'ROLE_WORKSHOP');

-- 5. Add performance and filtering indices
CREATE INDEX IF NOT EXISTS idx_pm_user_can_view ON tv_project_members(user_id, can_view);
CREATE INDEX IF NOT EXISTS idx_pm_proj_can_view ON tv_project_members(project_id, can_view);
CREATE INDEX IF NOT EXISTS idx_project_group ON tv_projects(group_id);
