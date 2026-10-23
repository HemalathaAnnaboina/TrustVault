# TrustVault Threat Model & Security Architecture (THREATS.md)

## 1. Executive Summary

TrustVault is an enterprise-grade secure document sharing and tamper-evident audit system designed under the principle of **Zero-Trust Document Access**. This document outlines the system assets, adversary models, threat vectors, implemented cryptographic and architectural mitigations, and accepted residual risks.

---

## 2. Protected Assets

| Asset | Description | Sensitivity |
| :--- | :--- | :--- |
| **Confidential Document Payloads** | Binary files (PDF, DOCX, XLSX, etc.) stored in the private vault | **Critical** (Integrity & Confidentiality) |
| **Audit Trail Logs** | Cryptographic hash-chained security event logs | **Critical** (Integrity & Non-Repudiation) |
| **Document Access Grants** | Explicit READ / EDIT permissions and expiry timestamps | **High** (Integrity & Authorization) |
| **Access & Renewal Requests** | Requester justifications, approval decisions, review notes | **Medium** (Integrity & Confidentiality) |
| **Authentication Credentials** | Passwords (BCrypt hashed), HMAC-SHA256 JWT signing secret | **Critical** (Confidentiality) |
| **Temporary Download Tokens** | Single-use, time-bounded UUID download references | **High** (Confidentiality & Short Lifetime) |

---

## 3. Threat Model (STRIDE Analysis & Mitigations)

### A. Spoofing (Identity Impersonation)
- **Threat**: Attacker attempts to forge JWT authentication tokens or guess weak credentials.
- **Mitigation**:
  - Stateless JWTs are signed with HMAC-SHA256 using a minimum 256-bit cryptographically secure key.
  - Every incoming token is verified against the database to guarantee the account is currently active (`active = true`).
  - Passwords are salted and hashed using BCrypt.
  - Inactive or disabled users are rejected at both the filter level (`DisabledException`) and service level.

### B. Tampering (Unauthorized Modification)
- **Threat 1**: Attacker alters audit logs in the database to conceal malicious activity.
- **Mitigation**:
  - Append-only cryptographic hash chaining: Each audit entry records `previousHash` and calculates `currentHash = SHA-256(previousHash | timestamp | actor | action | resourceType | resourceId | result | reason)`.
  - The system provides an automated integrity verification API (`/api/audit-logs/verify-integrity`) that traces the chain from the Genesis block to detect any altered, deleted, or inserted records.
  - Code-level immutability: Update and delete methods on audit entities throw `UnsupportedOperationException` (returning HTTP 403 Forbidden).
- **Threat 2**: Attacker uploads malicious files disguised as legitimate documents (e.g. executable `.exe` renamed to `.pdf`).
- **Mitigation**:
  - Whitelist of permitted extensions (`.pdf`, `.docx`, `.xlsx`, `.pptx`, `.txt`, `.png`, `.jpg`, `.fig`, `.csv`).
  - Explicit blacklist rejecting executables and script formats (`.exe`, `.bat`, `.cmd`, `.sh`, `.php`, `.jsp`, etc.).
  - File signature / magic byte inspection: verifies `%PDF` headers for PDF, `PK\x03\x04` for Office OpenXML formats, `\x89PNG` for PNG, and `FF D8 FF` for JPEG.

### C. Repudiation (Denial of Action)
- **Threat**: A user or administrator performs an action (such as revoking permission, deleting a document, or approving access) and later denies having done so.
- **Mitigation**:
  - Comprehensive audit logging on both successful AND denied actions (`UNAUTHORIZED_ACCESS_ATTEMPT`, `LOGIN_FAILURE`, `PERMISSION_GRANT`, `PERMISSION_REVOKE`, `ACCESS_REQUEST_APPROVED`, etc.).
  - Audit logs record actor ID, actor email, role, IP address, user-agent, timestamp, and target resource ID.
  - Logs are persisted in an isolated transaction (`@Transactional(propagation = Propagation.REQUIRES_NEW)`) ensuring that failed/denied attempts are recorded even if the calling transaction rolls back.

### D. Information Disclosure (Data Leaks & Path Traversal)
- **Threat 1**: Path traversal via user-supplied filenames (e.g. `../../etc/passwd.pdf` or Windows `..\..\`).
- **Mitigation**:
  - User-supplied filenames are strictly sanitized and never used on disk.
  - The storage vault generates a cryptographically random UUID key (`storageKey`) for each physical file.
  - Files are stored in an isolated directory (`data/vault/{storageKey}`) outside the web server root.
  - Incoming filenames containing path traversal sequences (`..`, `/`, `\`, null bytes) are rejected with HTTP 400 Bad Request.
- **Threat 2**: Direct Object Reference / ID Manipulation (IDOR).
- **Mitigation**:
  - Document IDs are random UUIDs.
  - Changing a document ID in an API URL cannot bypass security: `DocumentAuthorizationService` verifies active ownership or explicit permission grant on *every* request.
- **Threat 3**: Administrator Document Snooping.
- **Mitigation**:
  - System administrators can inspect system-wide audit logs and user accounts, but **do not automatically gain permission to view or download confidential document contents** without an explicit owner grant.

### E. Denial of Service (DoS)
- **Threat**: Brute-force attacks against the authentication endpoint (`/api/auth/login`) or flooding file uploads.
- **Mitigation**:
  - In-memory sliding-window `RateLimitingFilter` enforces a limit of 10 login attempts per minute per IP address (returning HTTP 429 Too Many Requests).
  - Multipart upload limits capped at 50 MB in both application configuration and Spring Boot servlet settings.

### F. Elevation of Privilege (Privilege Escalation)
- **Threat 1**: A user with `READ` permission attempts to modify document content or metadata.
- **Mitigation**: `requireEditAccess()` verifies `permissionLevel == EDIT` before permitting update operations; `READ` permissions are rejected with HTTP 403 Forbidden.
- **Threat 2**: A user with `EDIT` permission attempts to grant permissions or delete the document.
- **Mitigation**: Only the document owner can grant or revoke permissions (`requireManagementAccess()`).
- **Threat 3**: Project membership used to bypass document-level authorization.
- **Mitigation**: The system explicitly enforces that project membership *never* grants document access; every document requires explicit permissions.
- **Threat 4**: Continued access after permission expiry.
- **Mitigation**: The system evaluates permission expiry dynamically on **every single request**. Access is denied immediately upon expiration, even if the background cleanup scheduler has not yet executed.
- **Threat 5**: Bypassing revocation using old download links.
- **Mitigation**: Direct file URLs do not exist. Download tokens are single-use, valid for 60 seconds, and verified against current active permissions before streaming.

---

## 4. Accepted Risks & Residual Limitations

1. **Storage-at-Rest Encryption (Envelope Encryption)**: In this local deployment, documents are stored with UUID keys on the private filesystem with SHA-256 integrity verification. For cloud deployment (e.g. AWS S3 or GCP GCS), server-side KMS encryption (AES-256-GCM) should be enabled on the storage bucket.
2. **Rate Limiting in Distributed Environments**: The current `RateLimitingFilter` uses a concurrent in-memory sliding window per JVM. For multi-node clustered deployments, a distributed store such as Redis or API Gateway rate limiting should be used.
3. **Database-Level Immutability**: Code-level immutability and cryptographic hash chaining detect any tampering. In high-assurance environments, the audit log database table should be granted `INSERT, SELECT` privileges only to the application database user, revoking `UPDATE` and `DELETE` at the RDBMS user privilege level.
