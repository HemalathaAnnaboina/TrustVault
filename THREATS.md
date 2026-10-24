# TrustVault Threat Model & Security Architecture (THREATS.md)

## 1. Executive Summary

TrustVault is an enterprise-grade secure document management platform built with a Spring Boot backend, private document vault storage, relational database, and a Next.js/React frontend. The system is designed under the principle of **Zero-Trust Document Access**, strict tenant/client isolation, server-enforced role boundaries, and tamper-evident cryptographic audit logging.

This document outlines the assets, adversary models, threat vectors, implemented mitigations, automated verification test evidence, and production deployment controls.

---

## 2. Protected Assets

| Asset | Description | Sensitivity |
| :--- | :--- | :--- |
| **Confidential Document Payloads** | Binary files (PDF, DOCX, XLSX, etc.) stored in the private vault | **Critical** (Integrity & Confidentiality) |
| **Audit Trail Logs** | Cryptographic hash-chained security event logs | **Critical** (Integrity & Non-Repudiation) |
| **Document Access Grants** | Explicit READ / EDIT permissions and expiry timestamps | **High** (Integrity & Authorization) |
| **Access & Renewal Requests** | Requester justifications, approval decisions, review notes | **Medium** (Integrity & Confidentiality) |
| **Authentication Credentials** | Passwords (BCrypt hashed), HMAC-SHA256 JWT signing secret | **Critical** (Confidentiality) |
| **Temporary Download Tokens** | Single-use, time-bounded UUID download references (60s lifetime) | **High** (Confidentiality & Short Lifetime) |

---

## 3. Threat Model (STRIDE Analysis & Verified Mitigations)

### A. Spoofing (Identity Impersonation)
- **Threat 1**: Attacker attempts to forge JWT authentication tokens or use weak/default keys.
  - **Mitigation**: Stateless JWTs are signed with HMAC-SHA256. `JwtTokenProvider` validates on startup that the configured secret is non-null and at least 32 characters (256 bits), throwing an `IllegalStateException` to prevent startup with weak or missing keys.
  - **Test Evidence**: `TrustVaultComprehensiveSecurityAuditTests.testJwtWeakSecretFailFast`
- **Threat 2**: Credential guessing / brute-forcing.
  - **Mitigation**: BCrypt adaptive password hashing is used (`BCryptPasswordEncoder`). Sliding-window `RateLimitingFilter` enforces a limit of 10 requests per minute per IP. Authentication failure messages are unified (`"Invalid email or password"`) to eliminate account enumeration.
  - **Test Evidence**: `TrustVaultSecurityTests.testRateLimitingOnLoginEndpoint`

### B. Tampering (Unauthorized Modification)
- **Threat 1**: Attacker alters audit logs in the database to conceal malicious activity.
  - **Mitigation**: Append-only cryptographic hash chaining: Each audit entry records `previousHash` and calculates `currentHash = SHA-256(previousHash | timestamp | actor | action | resourceType | resourceId | result | reason)`. Automated integrity verification API (`/api/audit-logs/verify-integrity`) traces the chain to detect alteration or deletion. Entity updates and deletes throw `UnsupportedOperationException` (403 Forbidden).
  - **Test Evidence**: `TrustVaultSecurityTests.testAuditLogHashChainingAndTamperDetection`
- **Threat 2**: Attacker uploads malicious files disguised as legitimate documents (e.g. `.exe` renamed to `.pdf`).
  - **Mitigation**: Whitelist of permitted extensions (`pdf`, `docx`, `xlsx`, `pptx`, `txt`, `png`, `jpg`, `jpeg`, `fig`, `csv`). Explicit blacklist rejecting executables (`exe`, `bat`, `cmd`, `sh`, `php`, `jsp`, etc.). File signature / magic byte inspection verifies `%PDF` for PDF, `PK\x03\x04` for Office XML, `\x89PNG` for PNG, and `FF D8 FF` for JPEG.
  - **Test Evidence**: `TrustVaultComprehensiveSecurityAuditTests.testExecutableFileTypeUploadRejected`

### C. Repudiation (Denial of Action)
- **Threat**: A user or administrator performs an action (such as revoking permission, deleting a document, or approving access) and later denies having done so.
  - **Mitigation**: Comprehensive audit logging on both successful AND denied actions (`UNAUTHORIZED_ACCESS_ATTEMPT`, `LOGIN_FAILURE`, `PERMISSION_GRANT`, `PERMISSION_REVOKE`, `ACCESS_REQUEST_APPROVED`, etc.). Audit logs record actor ID, actor email, role, IP address, user-agent, timestamp, and target resource ID in an isolated transaction (`@Transactional(propagation = Propagation.REQUIRES_NEW)`).
  - **Test Evidence**: `TrustVaultSecurityTests.testDeniedAccessIsAudited`

### D. Information Disclosure (Data Leaks & Path Traversal)
- **Threat 1**: Path traversal via user-supplied filenames (e.g. `../../etc/passwd.pdf` or Windows `..\..\`).
  - **Mitigation**: User filenames are strictly sanitized and never used on disk. Storage vault generates a random UUID key (`storageKey`). Files are stored in an isolated directory (`data/vault/{storageKey}`) outside the web server root. Incoming filenames containing traversal sequences (`..`, `/`, `\`, null bytes) are rejected with HTTP 400 Bad Request.
  - **Test Evidence**: `TrustVaultComprehensiveSecurityAuditTests.testMaliciousPathTraversalFilenameUploadRejected`
- **Threat 2**: Direct Object Reference / ID Manipulation (IDOR).
  - **Mitigation**: Document IDs are random UUIDs. `DocumentAuthorizationService` verifies active ownership or explicit permission grant on *every* request. Changing IDs in URL or request parameters is blocked with 403 Forbidden.
  - **Test Evidence**: `TrustVaultComprehensiveSecurityAuditTests.testIDORCrossProjectDocumentAccessBlocked`
- **Threat 3**: Information leakage via stack traces or error responses.
  - **Mitigation**: `GlobalExceptionHandler` intercepts all unhandled exceptions and returns generic JSON error payloads without stack traces, database queries, or server filesystem paths.
- **Threat 4**: Clickjacking, MIME-sniffing, and cross-site framing.
  - **Mitigation**: `SecurityConfig` enforces strict security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'self'; frame-ancestors 'none';`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
  - **Test Evidence**: `TrustVaultComprehensiveSecurityAuditTests.testSecurityHeadersPresentOnResponses`
- **Threat 5**: Log inspection by Workshop Members.
  - **Mitigation**: Audit log navigation and feeds are removed from the Workshop Member UI. Backend endpoints (`/api/audit-logs/**`) enforce `@PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER', 'ROLE_OWNER')")`.
  - **Test Evidence**: `TrustVaultComprehensiveSecurityAuditTests.testWorkshopMemberCannotAccessAuditLogs`

### E. Denial of Service (DoS)
- **Threat**: Brute-force attacks against authentication or flooding file uploads.
  - **Mitigation**: Sliding-window rate limiter throttles authentication to 10 requests/minute/IP. Multipart uploads capped at 50 MB at both application and servlet layers.

### F. Elevation of Privilege (Privilege Escalation)
- **Threat 1**: A user with `READ` permission attempts to modify document content or download files.
  - **Mitigation**: `requireEditAccess()` verifies `permissionLevel == EDIT` before permitting update operations. `requireDownloadAccess()` rejects `READ`-only viewers attempting download.
  - **Test Evidence**: `TrustVaultViewerEditorSecurityTests.testViewerCannotDownloadDocument`
- **Threat 2**: Project membership used to bypass document-level authorization.
  - **Mitigation**: Server-side document access requires an explicit, active `DocumentPermission` grant or document ownership. Project membership alone grants zero file permissions.
  - **Test Evidence**: `TrustVaultWorkshopSecurityTests.test02_sameProjectDifferentDocAccess`
- **Threat 3**: Workshop Member attempts to manage groups, project members, or document permissions.
  - **Mitigation**: Controller-level `@PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER', 'ROLE_OWNER')")` and service-level checks block unauthorized calls with HTTP 403 Forbidden.
  - **Test Evidence**: `TrustVaultComprehensiveSecurityAuditTests.testWorkshopMemberCannotCreateGroup`, `testWorkshopMemberCannotAddProjectMembers`, `testWorkshopMemberCannotManagePermissions`
- **Threat 4**: Self-approval of access or renewal requests.
  - **Mitigation**: Both `AccessRequestService` and `RenewalRequestService` enforce defense-in-depth checks: `if (request.getRequester().getId().equals(reviewer.getId())) throw new ForbiddenException("Self-approval is strictly forbidden");`
  - **Test Evidence**: `TrustVaultComprehensiveSecurityAuditTests.testSelfApprovalOfAccessRequestBlocked`
- **Threat 5**: Continued access after permission expiry.
  - **Mitigation**: `DocumentAuthorizationService` evaluates `expiresAt` dynamically on every single request. Expired grants are blocked immediately, even before the background cleanup scheduler executes.
  - **Test Evidence**: `TrustVaultComprehensiveSecurityAuditTests.testExpiredPermissionDeniesAccessImmediately`
- **Threat 6**: Bypassing revocation using old download links.
  - **Mitigation**: Direct file URLs do not exist. Download tokens are single-use, valid for 60 seconds, and verified against current active permissions before streaming.
  - **Test Evidence**: `TrustVaultSecurityTests.testSingleUseDownloadToken`

---

## 4. Test Verification Summary

All security controls are verified with automated integration tests asserting HTTP status codes, security headers, and data isolation:

| Test Suite | Tests Run | Pass | Fail | Key Assertions Verified |
| :--- | :---: | :---: | :---: | :--- |
| `TrustVaultComprehensiveSecurityAuditTests` | 17 | 17 | 0 | JWT secret fail-fast, Security Headers, Group authorization, Project Member authorization, Permission management, Self-approval prevention, IDOR, Expiry, Path traversal, Executable upload rejection, Admin settings |
| `TrustVaultWorkshopSecurityTests` | 16 | 16 | 0 | Workshop member isolation, READ vs EDIT separation, Access requests, Renewals, Revocation |
| `TrustVaultViewerEditorSecurityTests` | 35 | 35 | 0 | Role and permission matrix, Viewer download denial, Editor file update, Expiry enforcement |
| `TrustVaultSecurityTests` | 29 | 29 | 0 | Audit log hash chaining, Tamper detection, Rate limiting, Single-use download tokens, Path traversal |
| `TrustVaultManagerDurationRegressionTests` | 7 | 7 | 0 | 1–30 day access duration boundaries, Manager workflow regression |
| **Total Verified Security Tests** | **104** | **104** | **0** | **100% Passing** |

---

## 5. Production Security Deployment Checklist

1. **Environment Secrets**: Supply `trustvault.jwt.secret` via an environment variable or secrets manager (minimum 32 characters / 256 bits of cryptographically random entropy). Never commit secrets to version control.
2. **HTTPS / TLS**: Terminate TLS at the reverse proxy (Nginx / Cloudflare / ALB) with HTTP Strict Transport Security (`HSTS: max-age=31536000; includeSubDomains; preload`).
3. **Database Least Privilege**: In production RDBMS, configure database credentials with least privilege. Revoke `UPDATE` and `DELETE` on `tv_audit_logs` table at the database user level to guarantee append-only logs even against compromised application credentials.
4. **Vault Storage Encryption**: For cloud deployments, store vault files in private cloud object storage (AWS S3 / GCP GCS) with server-side KMS encryption (AES-256-GCM) and block all public bucket access.
5. **Distributed Rate Limiting**: If deploying in a multi-instance cluster, replace in-memory sliding window rate limiting with a shared Redis store or API Gateway rate limiter.
6. **CORS Configuration**: Restrict `allowedOriginPatterns` to explicitly trusted production domain origins; reject wildcards.
