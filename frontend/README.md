# TrustVault

TrustVault is a responsive frontend prototype for secure document sharing, permission management, access requests, and audit visibility across Owner, Admin, and Viewer roles.

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Demo behavior

The current preview uses clearly labeled demo data and a role switcher to demonstrate the Owner, Admin, and Viewer experiences. Upload, request, permission, and delete actions show UI feedback only.

## Backend integration

Set `VITE_API_BASE_URL` in the eventual Vite frontend environment, or adapt the existing UI to the Spring Boot API base URL. Authentication, role resolution, document access, downloads, and permission mutations must be enforced by the backend; do not trust frontend role state or expose private documents through public URLs. Use secure HttpOnly session or token handling rather than `localStorage` for credentials.

Recommended API modules are separate by concern: authentication, users, projects, documents, permissions, access requests, and audit logs. Handle 401, 403, 404, and 500 responses with dedicated UI states.

## Validation

```bash
pnpm build
```
