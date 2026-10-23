# TrustVault — Complete Secure Document Sharing and Audit System

TrustVault is an enterprise-grade secure document management and audit platform engineered with zero-trust document security, role-based and document-level authorization, private vault storage, dynamic permission expiry, access request/renewal workflows, and tamper-evident SHA-256 hash-chained audit trails.

---

## 1. System Architecture

TrustVault is composed of two seamlessly integrated tiers:
- **Backend Service (`synova_proj`)**: Spring Boot 3.4.3 (Java 23), Spring Security 6, Spring Data JPA, Hibernate, file-backed persistent H2 relational database, JJWT (HMAC-SHA256), and an isolated Private Storage Vault (`data/vault`).
- **Frontend Application (`trust1`)**: Next.js 16.4.0 (Turbopack), React 19, Tailwind CSS, Lucide icons, responsive dashboards for `ADMIN`, `OWNER`, and `VIEWER`, live API connectivity with local fallback preview mode.

```
       ┌───────────────────────────────┐
       │   Next.js 16 Frontend (3000)  │
       │   - Admin Security Console    │
       │   - Owner Vault Dashboard     │
       │   - Viewer Workspace          │
       └──────────────┬────────────────┘
                      │ REST API + Bearer JWT
       ┌──────────────▼────────────────┐
       │  Spring Boot 3 Backend (8080) │
       │  - Rate Limiting Filter       │
       │  - Stateless Security Engine  │
       │  - Doc Authorization Service  │
       │  - Dynamic Expiry Evaluator   │
       │  - Background Scheduler       │
       └───────┬──────────────┬────────┘
               │              │
    ┌──────────▼─────┐  ┌─────▼──────────┐
    │  Relational DB │  │ Private Vault  │
    │  - Users & RBAC│  │ - UUID Keys    │
    │  - Hash Chained│  │ - Magic Bytes  │
    │    Audit Logs  │  │ - SHA-256 Hash │
    └────────────────┘  └────────────────┘
```

---

## 2. Demo Accounts (Pre-Seeded in Development)

All demo accounts are pre-seeded with encrypted BCrypt passwords:

| Role | Email | Password | Primary Capabilities |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@trustvault.local` | `TrustVault@2025!` | User management, system audit logs, tamper verification |
| **OWNER** | `owner@trustvault.local` | `TrustVault@2025!` | Document upload, project management, grants, approvals |
| **VIEWER** | `viewer@trustvault.local` | `TrustVault@2025!` | Discovering granted docs, downloading, renewal requests |
| **VIEWER 2** | `alex@trustvault.local` | `TrustVault@2025!` | Requesting access with business justifications |
| **INACTIVE** | `inactive@trustvault.local` | `TrustVault@2025!` | Deactivated account (tests rejected login & access) |

---

## 3. Getting Started & Execution

### Prerequisites
- Java 21 or Java 23
- Node.js 18+ (Node 22 recommended) and npm
- Windows PowerShell or cmd.exe / bash

### Step 1: Run the Secure Backend
Open a terminal in `d:\AI_Agents\synova_proj`:
```powershell
# Set JAVA_HOME (if not set in system environment)
$env:JAVA_HOME = "C:\Program Files\Java\jdk-23"

# Start the Spring Boot backend
.\mvnw.cmd spring-boot:run
```
The backend initializes the persistent relational database at `./data/trustvault_db`, creates the private storage vault at `./data/vault`, seeds initial demo accounts, and starts Tomcat on **`http://localhost:8080`**.

### Step 2: Run the Frontend
Open a second terminal in `d:\AI_Agents\trust1`:
```powershell
# Start the Next.js dev server
npm run dev
```
Open **`http://localhost:3000`** in your browser. The frontend connects to the live backend, featuring a fast demo role switcher in the sidebar to test Owner, Admin, and Viewer flows.

---

## 4. Running the Automated Security Test Suite

The automated security test suite verifies all 14 mandatory security rules specified in the project requirements:

```powershell
cd d:\AI_Agents\synova_proj
$env:JAVA_HOME = "C:\Program Files\Java\jdk-23"
.\mvnw.cmd test
```

### Verified Security Test Matrix:
1. `test1_userACannotAccessUserBPrivateDocumentsWithoutGrant` — Proves User A cannot access User B's documents without an explicit grant.
2. `test2_changingDocumentIdCannotBypassAuthorization` — Proves URL/IDOR manipulation is blocked.
3. `test3_projectMembershipAloneDoesNotGrantDocumentAccess` — Proves project members do NOT inherit document access.
4. `test4_readCannotEditDeleteOrShareDocument` — Proves READ grants cannot edit, delete, or share.
5. `test5_editCannotManagePermissionsUnlessSeparatelyAuthorized` — Proves EDIT grants cannot manage permissions.
6. `test6_revokedPermissionBlocksSubsequentRequestsImmediately` — Proves revoked grants block access immediately.
7. `test7_expiredPermissionBlocksViewDownloadAndEdit` — Proves dynamic expiry blocks view, download, and edit immediately.
8. `test8_oldUrlOrTokenCannotBypassCurrentAuthorizationPolicy` — Proves expired or used download tokens are rejected.
9. `test9_inactiveUsersCannotAccessProtectedResources` — Proves deactivated accounts cannot access resources.
10. `test10_unauthorizedUsersCannotApproveRequestsOrGrantPermissions` — Proves non-owners cannot approve requests.
11. `test11_renewalRequestsDoNotExtendAccessUntilApproved` — Proves pending renewals do not extend access.
12. `test12_deniedAccessAttemptsAreRecordedInAuditLogs` — Proves denied attempts generate audit trail entries.
13. `test13_uploadValidationRejectsDisallowedOrMalformedFiles` — Proves `.exe`, path traversal, and spoofed files are rejected.
14. `test14_usersCannotModifyOrDeleteProtectedAuditRecords` — Proves audit records are immutable and append-only.

---

## 5. API Reference & Examples

### Authentication (`/api/auth`)
- `POST /api/auth/login`: Authenticate and receive stateless Bearer JWT.
  ```json
  // Request
  {
    "email": "admin@trustvault.local",
    "password": "TrustVault@2025!"
  }
  // Response (200 OK)
  {
    "token": "eyJhbGciOiJIUzUxMiJ9...",
    "tokenType": "Bearer",
    "id": "b3c63357-7368-4de6-a2c1-ccac71ee795b",
    "email": "admin@trustvault.local",
    "fullName": "Sarah Admin",
    "role": "ROLE_ADMIN",
    "active": true
  }
  ```

### Document Management (`/api/documents`)
- `GET /api/documents?query={optional}`: Discovers accessible documents for current user.
- `POST /api/documents`: Multipart file upload with title, category, and project selection.
- `GET /api/documents/{id}`: Document metadata with access level check.
- `PUT /api/documents/{id}`: Update metadata (requires OWNER or EDIT).
- `DELETE /api/documents/{id}`: Delete document and private storage payload (requires OWNER).
- `POST /api/documents/{id}/download-token`: Generates short-lived (60s) single-use download token.
- `GET /api/documents/download/{token}`: Streams binary file payload.

### Permissions (`/api/documents/{id}/permissions` & `/api/permissions`)
- `POST /api/documents/{id}/permissions`: Grant READ/EDIT access with optional ISO expiry.
- `DELETE /api/permissions/{id}`: Immediately revokes an active permission grant.

### Access & Renewal Workflows (`/api/requests` & `/api/renewals`)
- `POST /api/requests`: Submit access request with justification.
- `POST /api/requests/{id}/review`: Approve or reject request (Owner only).
- `POST /api/renewals`: Submit renewal extension request.
- `POST /api/renewals/{id}/review`: Approve or reject renewal (Owner only).

### Audit Logs & Tamper Verification (`/api/audit-logs`)
- `GET /api/audit-logs`: Admin system-wide audit records.
- `GET /api/audit-logs/verify-integrity`: Cryptographic hash chain verification.
  ```json
  // Response (200 OK)
  {
    "valid": true,
    "totalRecords": 32,
    "verifiedCount": 32,
    "brokenRecordId": null,
    "message": "All 32 audit log records verified intact and untampered."
  }
  ```
