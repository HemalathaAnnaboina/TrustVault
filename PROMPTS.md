# TrustVault AI Engineering Journal & Decisions Log (PROMPTS.md)

**Project**: TrustVault — Complete Secure Document Sharing and Audit System  
**Date**: October 19, 2026  
**Stack**: Java 23, Spring Boot 3.4.3, Spring Security, JPA/Hibernate, H2 Relational DB, Next.js 16.4.0 (Turbopack), Tailwind CSS  

---

## 1. Architectural & Security Decisions

### 1.1 Dynamic Permission Expiry vs. Scheduled Cleanup
- **Decision**: In `DocumentAuthorizationService`, permission expiry is checked dynamically on *every single request* (`if (expiresAt != null && Instant.now().isAfter(expiresAt)) throw ForbiddenException`).
- **Rationale**: Relying solely on a periodic cron job or background scheduler introduces a vulnerability window where an expired permission could still be used to view, download, or edit documents between scheduler intervals. The background scheduler (`PermissionExpiryScheduler`) is utilized strictly for status updates, notifications, and audit synchronization—not as the security perimeter.

### 1.2 Cryptographic Hash-Chained Audit Trail (Tamper Detection)
- **Decision**: Implemented an append-only cryptographic hash chain where each audit entry calculates:  
  `currentHash = SHA-256(previousHash | timestamp | actorEmail | action | resourceType | resourceId | result | reason)`.
- **Rationale**: Prevents undetected modifications, insertions, or deletions within the database. The system includes an automated integrity verification API (`/api/audit-logs/verify-integrity`) that traces the chain from the Genesis block (`00000000...`) to the latest record.

### 1.3 Private Storage Vault Architecture
- **Decision**: Files are never stored under public web folders or with user-provided names. Uploaded files receive a cryptographically random UUID (`storageKey`) and are written to an isolated directory (`data/vault/{storageKey}`).
- **Rationale**: Neutralizes directory traversal attacks, prevents unauthorized file overwriting, and guarantees that every document download requires passing through backend authentication and authorization filters.

### 1.4 Single-Use Time-Bounded Download Tokens
- **Decision**: File downloads utilize short-lived (60-second), single-use UUID download tokens generated only after explicit permission verification.
- **Rationale**: Eliminates long-lived or permanent document URLs. Even if a user generates a token, immediately revoking their permission will prevent reuse once the token is consumed.

---

## 2. AI Mistakes, Failure Logs & Corrections

### Mistake 1: Rate Limiter Tripping in Automated Test Setup
- **Symptom**: During initial execution of `TrustVaultSecurityTests`, 12 out of 14 tests failed with `Status expected:<200> but was:<429> (Too Many Requests)`.
- **Root Cause**: The production configuration limited login attempts to 10 per minute per IP address. The test suite's `setUp()` method executed 4 MockMvc HTTP logins before each of the 14 tests (56 rapid logins in < 2 seconds), tripping the rate limiter.
- **Correction**: Updated `TrustVaultSecurityTests.setUp()` to generate signed JWT tokens directly using `jwtTokenProvider.generateToken(user)` (a standard unit/integration testing best practice) and added `src/test/resources/application.properties` with an elevated test rate limit.

### Mistake 2: Path Traversal Validation Order in File Uploads
- **Symptom**: Security Test 13 (`test13_uploadValidationRejectsDisallowedOrMalformedFiles`) failed because uploading `../../etc/passwd.pdf` returned HTTP 200 instead of HTTP 400.
- **Root Cause**: `StorageService` called `Paths.get(rawFilename).getFileName().toString()` before checking for `..`. On Windows/Java, `Paths.get("../../etc/passwd.pdf").getFileName()` stripped the traversal path and returned `passwd.pdf`, which then passed the subsequent traversal check.
- **Correction**: Added an immediate path-traversal check directly on `rawFilename` before path normalization:
  ```java
  if (rawFilename.contains("..") || rawFilename.contains("/") || rawFilename.contains("\\") || rawFilename.contains("\0")) {
      throw new BadRequestException("Filename contains invalid or dangerous path traversal characters");
  }
  ```

### Mistake 3: Unhandled Exception in Audit Immutability Test
- **Symptom**: Security Test 14 (`test14_usersCannotModifyOrDeleteProtectedAuditRecords`) failed with `Status expected:<403> but was:<500>`.
- **Root Cause**: `auditService.deleteAuditRecord()` threw `UnsupportedOperationException`, which fell through `GlobalExceptionHandler` to the generic 500 error handler.
- **Correction**: Added an explicit `@ExceptionHandler(UnsupportedOperationException.class)` in `GlobalExceptionHandler` returning HTTP 403 Forbidden with the tamper protection reason.

---

## 3. Verification & Test Execution Results

- **Compiler**: Java 23 (javac), Spring Boot 3.4.3 Maven Plugin
- **Surefire Test Suite**: `TrustVaultSecurityTests.java` (14 automated security tests)
- **Result**:
  ```text
  [INFO] Running com.trustvault.TrustVaultSecurityTests
  [INFO] Tests run: 14, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 17.86 s
  [INFO] BUILD SUCCESS
  ```
- **Live Server Test**:
  - Spring Boot Tomcat running at `http://localhost:8080` (HTTP 200 on login & API routes)
  - Next.js Turbopack dev server running at `http://localhost:3000` (HTTP 200 on `/`)
