-- ====================================================================
-- TrustVault Flyway Migration: V4 Project Member Responsibility
-- Adds responsibility attribute to project membership
-- ====================================================================

ALTER TABLE tv_project_members ADD COLUMN IF NOT EXISTS responsibility VARCHAR(60) DEFAULT 'Contributor';
