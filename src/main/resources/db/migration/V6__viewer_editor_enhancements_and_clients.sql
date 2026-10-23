-- ====================================================================
-- TrustVault Flyway Migration: V6 Viewer & Editor Enhancements, Clients & Versions
-- ====================================================================

-- 1. Clients / Tenants Table (Multi-tenant isolation)
CREATE TABLE IF NOT EXISTS tv_clients (
    id UUID PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed default primary client
INSERT INTO tv_clients (id, name, code, created_at)
SELECT '11111111-1111-1111-1111-111111111111', 'TrustVault Primary Enterprise', 'CLIENT_PRIMARY', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM tv_clients WHERE code = 'CLIENT_PRIMARY');

-- Seed secondary isolated client for cross-tenant testing
INSERT INTO tv_clients (id, name, code, created_at)
SELECT '22222222-2222-2222-2222-222222222222', 'External Isolated Client Beta', 'CLIENT_BETA', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM tv_clients WHERE code = 'CLIENT_BETA');

-- 2. Add client_id column to existing entities
ALTER TABLE tv_users ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES tv_clients(id);
ALTER TABLE tv_documents ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES tv_clients(id);
ALTER TABLE tv_projects ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES tv_clients(id);
ALTER TABLE tv_audit_logs ADD COLUMN IF NOT EXISTS client_id UUID;

-- Associate existing users, documents, and projects with primary client
UPDATE tv_users SET client_id = '11111111-1111-1111-1111-111111111111' WHERE client_id IS NULL;
UPDATE tv_documents SET client_id = '11111111-1111-1111-1111-111111111111' WHERE client_id IS NULL;
UPDATE tv_projects SET client_id = '11111111-1111-1111-1111-111111111111' WHERE client_id IS NULL;

-- 3. Document Versioning Support
ALTER TABLE tv_documents ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS tv_document_versions (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES tv_documents(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    storage_key VARCHAR(64) NOT NULL,
    content_type VARCHAR(100),
    file_size_bytes BIGINT NOT NULL,
    sha256checksum VARCHAR(64) NOT NULL,
    change_summary VARCHAR(500),
    created_by_id UUID NOT NULL REFERENCES tv_users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_version_doc_num ON tv_document_versions(document_id, version_number);

-- 4. Starred / Favorite Documents Table
CREATE TABLE IF NOT EXISTS tv_starred_documents (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES tv_users(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES tv_documents(id) ON DELETE CASCADE,
    starred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_starred_user_doc UNIQUE (user_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_starred_user ON tv_starred_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_starred_doc ON tv_starred_documents(document_id);
