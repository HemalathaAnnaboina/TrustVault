-- ====================================================================
-- TrustVault Relational Database Schema (ANSI SQL / H2 / PostgreSQL)
-- ====================================================================

-- 1. Users table (Stores registered users with secure BCrypt hashes)
CREATE TABLE tv_users (
    id UUID PRIMARY KEY,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(30) NOT NULL, -- ROLE_ADMIN, ROLE_OWNER, ROLE_VIEWER
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_email ON tv_users(email);

-- 2. Projects table (Collaborative workspaces)
CREATE TABLE tv_projects (
    id UUID PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description VARCHAR(500),
    owner_id UUID NOT NULL REFERENCES tv_users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Project Members (Associates users with projects)
-- NOTE: Project membership alone NEVER grants document access!
CREATE TABLE tv_project_members (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES tv_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES tv_users(id) ON DELETE CASCADE,
    responsibility VARCHAR(60) DEFAULT 'Contributor',
    project_role VARCHAR(30) NOT NULL DEFAULT 'ROLE_VIEWER', -- ROLE_VIEWER, ROLE_EDITOR
    added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_project_member UNIQUE (project_id, user_id)
);

-- 4. Documents table (Metadata and checksums for privately stored files)
CREATE TABLE tv_documents (
    id UUID PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    storage_key VARCHAR(64) NOT NULL UNIQUE, -- Server-generated UUID key; never user-controlled
    content_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    sha256checksum VARCHAR(64) NOT NULL,
    category VARCHAR(60) DEFAULT 'General',
    owner_id UUID NOT NULL REFERENCES tv_users(id),
    project_id UUID REFERENCES tv_projects(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_doc_owner ON tv_documents(owner_id);
CREATE INDEX idx_doc_storage_key ON tv_documents(storage_key);

-- 5. Document Permissions table (Explicit READ / EDIT access grants)
CREATE TABLE tv_document_permissions (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES tv_documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES tv_users(id) ON DELETE CASCADE,
    permission_level VARCHAR(20) NOT NULL, -- READ, EDIT
    granted_by_id UUID NOT NULL REFERENCES tv_users(id),
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE, -- Optional UTC expiry timestamp
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' -- ACTIVE, REVOKED, EXPIRED
);

CREATE INDEX idx_perm_doc_user ON tv_document_permissions(document_id, user_id);
CREATE INDEX idx_perm_status ON tv_document_permissions(status);
CREATE INDEX idx_perm_expiry ON tv_document_permissions(expires_at);

-- 6. Access Requests table (Viewer & Editor permission requests)
CREATE TABLE tv_access_requests (
    id UUID PRIMARY KEY,
    document_id UUID REFERENCES tv_documents(id) ON DELETE CASCADE,
    project_id UUID REFERENCES tv_projects(id) ON DELETE CASCADE,
    requested_filename VARCHAR(255),
    requester_id UUID NOT NULL REFERENCES tv_users(id) ON DELETE CASCADE,
    requested_permission VARCHAR(20) NOT NULL, -- READ, EDIT
    reason VARCHAR(1000) NOT NULL,
    duration_days INT NOT NULL DEFAULT 7,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_by_id UUID REFERENCES tv_users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_note VARCHAR(500)
);

CREATE INDEX idx_ar_doc_status ON tv_access_requests(document_id, status);
CREATE INDEX idx_ar_requester ON tv_access_requests(requester_id);

-- 7. Renewal Requests table (Permission expiry extension requests)
CREATE TABLE tv_renewal_requests (
    id UUID PRIMARY KEY,
    permission_id UUID NOT NULL REFERENCES tv_document_permissions(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES tv_users(id) ON DELETE CASCADE,
    reason VARCHAR(1000) NOT NULL,
    requested_extension_days INT NOT NULL DEFAULT 30,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_by_id UUID REFERENCES tv_users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_note VARCHAR(500)
);

CREATE INDEX idx_rr_perm_status ON tv_renewal_requests(permission_id, status);
CREATE INDEX idx_rr_requester ON tv_renewal_requests(requester_id);

-- 8. Audit Logs table (Immutable, append-only, cryptographic SHA-256 hash chaining)
CREATE TABLE tv_audit_logs (
    id UUID PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor_id UUID,
    actor_email VARCHAR(120),
    actor_role VARCHAR(30),
    action VARCHAR(40) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(64),
    result VARCHAR(20) NOT NULL, -- SUCCESS, DENIED
    reason VARCHAR(1000),
    ip_address VARCHAR(50),
    user_agent VARCHAR(255),
    previous_hash VARCHAR(64) NOT NULL,
    current_hash VARCHAR(64) NOT NULL,
    client_id UUID,
    project_id UUID
);

CREATE INDEX idx_audit_timestamp ON tv_audit_logs(timestamp);
CREATE INDEX idx_audit_actor ON tv_audit_logs(actor_id);
CREATE INDEX idx_audit_action ON tv_audit_logs(action);
CREATE INDEX idx_audit_resource ON tv_audit_logs(resource_type, resource_id);

-- 9. Single-Use Download Tokens (Temporary short-lived streaming tokens)
CREATE TABLE tv_download_tokens (
    id UUID PRIMARY KEY,
    token_value VARCHAR(64) NOT NULL UNIQUE,
    document_id UUID NOT NULL REFERENCES tv_documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES tv_users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_token_string ON tv_download_tokens(token_value);
