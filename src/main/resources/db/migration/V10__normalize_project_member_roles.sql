-- V10: Normalize legacy roles and project member roles to canonical enums
UPDATE tv_project_members
SET project_role = 'ROLE_WORKSHOP_MEMBER'
WHERE project_role IN ('ROLE_VIEWER', 'ROLE_WORKSHOP', 'ROLE_EDITOR');

UPDATE tv_users
SET role = 'ROLE_WORKSHOP_MEMBER'
WHERE role IN ('ROLE_VIEWER', 'ROLE_WORKSHOP', 'ROLE_EDITOR');

UPDATE tv_users
SET role = 'ROLE_MANAGER'
WHERE role IN ('ROLE_OWNER', 'OWNER');
