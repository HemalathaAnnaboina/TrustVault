-- ====================================================================
-- TrustVault Flyway Migration: V2 Align Document Checksum Schema
-- Target: PostgreSQL 17 / ANSI SQL Compatible
-- Resolves Hibernate schema-validation mismatch for sha256checksum
-- ====================================================================

ALTER TABLE tv_documents RENAME COLUMN sha256_checksum TO sha256checksum;
