# TrustVault — Secure Document Sharing & Audit Platform

**TrustVault** is a security-focused document management platform built for the **Snovasys Fresher Hiring Challenge 2026**. It is designed to prevent unauthorized document access and provide accountability through security audit records.

> **Core objectives:** (1) A user must not access another user's or project's confidential documents without authorization, even by changing URLs or IDs. (2) Security-relevant actions and denied attempts should be recorded and reviewable by authorized personnel.

## Live Links

- **Backend API:** https://trustvault-7tsu.onrender.com
- **Source repository:** https://github.com/HemalathaAnnaboina/TrustVault
- **Frontend demo (Vercel):** https://trust-vault-881v.vercel.app/
- **Demo video:https://www.loom.com/share/c805335c79394da6918667d6e1b866cc

**Deployment note:** The Render free instance may take time to wake after inactivity. An HTTP 404 at the backend root (`/`) does not necessarily mean the API is unavailable; test a defined API endpoint instead.

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Backend | Java, Spring Boot, Spring Security, REST APIs |
| Authentication | JWT-based authentication |
| Database | PostgreSQL in the discussed deployed setup; verify the local development profile before documenting its database |
| Document storage | Private file storage; verify the deployed storage path and persistence behavior |
| Deployment | Vercel (frontend), Render (backend) |

> **Configuration varies by environment.** Confirm exact dependency versions, active database profiles, storage implementation, and environment variables against the checked-in source before treating this table as a deployment specification.

## Roles & Permissions

TrustVault uses **three application roles**:

| Application role | Responsibilities |
| --- | --- |
| **ADMIN** | Manage and deactivate accounts, assign roles, review authorized system-wide audit and security activity, and manage account settings. |
| **MANAGER** | Create and manage projects, upload and organize documents, manage project members, review access and renewal requests, and grant/revoke authorized document access. |
| **WORKSHOP MEMBER** | Participate in assigned projects, request access to documents, and perform operations permitted by active document-specific grants. |

**Viewer and Editor are permission levels, not separate application roles:**

- **READ (Viewer):** Access the document for viewing/downloading when the grant is active.
- **EDIT (Editor):** Access and edit the document where expressly authorized. EDIT does not automatically grant permission-management or deletion authority.
- **No active grant:** No access to confidential document content.

Project membership alone does **not** imply access to every document. Authorization must be enforced on the **backend**, not just by hiding buttons in the UI. TrustVault does **not** use project-level passwords as an access-control substitute.

## Key Features

- Project and document organization, upload, search, and management.
- Per-document READ/EDIT access grants, revocation, and expiry rules.
- Access requests, manager approval/rejection, and renewal workflows.
- Role-based dashboards for Admin, Manager, and Workshop Member.
- Account deactivation and suspended-member restrictions.
- Audit views for authorized security and document activity, including denied attempts.
- Protection against direct-object-reference (IDOR) and cross-project access attempts.
- Upload validation and private document storage.
- Audit integrity mechanisms described in [THREATS.md](THREATS.md); see that document for design and residual risks.

> These are project capabilities and security objectives. Exact behavior and coverage should be checked against the current backend code and passing tests. Do not infer successful security verification solely from a UI screenshot or this README.

## High-Level Architecture

```text
Browser
  |
  v
Next.js / React frontend (Vercel)
  | HTTPS REST requests + JWT
  v
Spring Boot / Spring Security backend (Render)
  |                  |
  v                  v
PostgreSQL        Private document storage
(metadata, users,   (binary document payloads;
permissions, logs)   deployment persistence to verify)
```

**Document access flow:** Authenticate the user → resolve their role and project context → check document ownership or active explicit grant → validate expiry/revocation → allow or deny the operation → record relevant audit activity.

## Security Design

### Authorization and isolation

- Check permissions on every protected backend document operation.
- Reject guessed document IDs and direct URL attempts without the required grant.
- Scope manager operations to their authorized projects and users.
- Restrict global audit logs and administrative operations to authorized administrators.
- Treat expired, revoked, inactive, and suspended access as unauthorized according to the applicable backend policy.

### Auditability

- Capture security-relevant events, including allowed and denied actions.
- Restrict audit-log visibility to appropriate roles and scopes.
- Verify audit integrity where cryptographic hash-chain functionality is implemented.

**Security limitations:** A hash chain is tamper-evident, not automatically tamper-proof against a privileged attacker who can rewrite the full chain. SHA-256 file hashes do not encrypt document content. Consult [THREATS.md](THREATS.md) for the STRIDE threat model and residual risks.

## Run Locally

### Prerequisites

- Compatible JDK (the project has used Java 23)
- Maven wrapper included with the backend repository
- Node.js and npm compatible with the checked-in Next.js version
- Database and application environment variables configured for the active profile

### Backend

From the backend project directory (`D:\AI_Agents\synova_proj` on the development machine):

```powershell
cd D:\AI_Agents\synova_proj
.\mvnw.cmd spring-boot:run
```

Expected local backend port (when configured as previously used): `http://localhost:8080`.

### Frontend

From the frontend project directory (previously `D:\AI_Agents\trust1`):

```powershell
cd D:\AI_Agents\trust1
npm install
npm run dev
```

Open `http://localhost:3000`, if that is the configured development port. Configure the frontend API base URL to point to the running backend using the environment variable name actually defined in the frontend source.

**Do not commit secrets:** Configure JWT signing secrets, database credentials, and other private values using local environment configuration or hosting provider secrets. Do not publish reusable passwords or production demo credentials in this README.

## Security Testing

Run the backend test suite:

```powershell
cd D:\AI_Agents\synova_proj
.\mvnw.cmd test
```

The security scenarios to verify include:

1. A user cannot read another user's private document without a grant.
2. Changing a document ID or URL cannot bypass authorization.
3. Project membership alone does not grant document access.
4. READ permission does not permit unauthorized edit, delete, or sharing.
5. EDIT permission does not automatically permit grant management.
6. Revoked and expired permissions deny subsequent access.
7. Deactivated and suspended accounts/members lose prohibited access.
8. Unauthorized users cannot approve access or renewal requests.
9. Pending renewal does not silently extend a grant.
10. Denied access attempts are captured in appropriate audit records.
11. Invalid or disallowed uploads are rejected.
12. Cross-project document and request isolation is enforced.
13. Audit-log endpoints reject unauthorized roles.
14. Audit integrity checks identify relevant tampering, where implemented.

**Test status:** This list is a security verification checklist, **not a claim that all 14 tests passed**. Add the actual Maven test summary, test class names, and evidence only after verifying the current repository.

## Development & Debugging Evidence

The screenshots below document **observed development issues**. They are *before-fix evidence*, not proof that a correction has passed regression testing. The paths assume the images are uploaded to `docs/screenshots/` with these filenames.

| Issue observed | Screenshot |
| --- | --- |
| Pending-request badge/list mismatch | [Pending request mismatch](docs/screenshots/10-pending-request-count-mismatch.png) |
| Deployment static-resource 404 responses | [Deployment resource errors](docs/screenshots/08-vercel-deployment-404-errors.png) |
| Document API HTTP 400 response | [Document API error](docs/screenshots/09-document-api-400-before-fix.png) |
| React duplicate document-key warning | [Duplicate key warning](docs/screenshots/10-duplicate-document-key-before-fix.png) |
| React duplicate-key code location | [Duplicate key details](docs/screenshots/10-react-duplicate-key-error-details.png) |

> In the duplicate-key detail screenshot, the component already shows `key={doc.id}`. The cause should be investigated in the actual document IDs/data rather than assuming filenames are directly used as React keys.

## Documentation

- [PROMPTS.md](PROMPTS.md) — AI-assisted development journal, prompts, debugging, and corrections.
- [THREATS.md](THREATS.md) — STRIDE threat model, mitigations, and accepted residual risks.
- `docs/screenshots/` — Development and security evidence (as uploaded).

## Known Limitations & Verification Items

- Confirm that local and deployed database settings are documented accurately; earlier drafts referred to H2 while the deployed setup was discussed as PostgreSQL.
- Confirm that document binaries survive restarts/redeployments in the production storage environment.
- Confirm the exact API routes and HTTP response contracts against Spring controllers before publishing a definitive API reference.
- Confirm the current audit-chain algorithm and integrity-verification endpoint from code and tests.
- Add the demo video link and verified test results when available.
- Ensure screenshots and logs do not expose JWTs, credentials, personal information, or confidential document contents.

---

**TrustVault — Protect access to documents and preserve accountability for security-sensitive actions.**
