Entry 01 — Document-Level Authorization and IDOR Prevention

Date: [20/10/2026]
Role: Manager / Workshop Member
Category: Security — Authorization and Access Control
Technology: Java, Spring Boot, Spring Security, PostgreSQL

1. Development Context

While building TrustVault, I wanted managers to share confidential documents with workshop members without exposing other documents in the same project.

Initially, I was mainly focused on implementing role-based access control for Admin, Manager, and Workshop users. But I realized that checking the user's role alone would not be enough to protect individual documents.

For example, a workshop member might have permission to read one document but should not automatically receive access to every document uploaded by the manager.

This made me focus on document-level authorization rather than relying only on project membership.

2. My Prompt to AI

Act as a senior Java Spring Boot security developer and review the existing document authorization flow in my TrustVault application.

I have three roles: Admin, Manager, and Workshop Member. Managers create projects, upload confidential files, and grant READ or EDIT permissions to selected workshop members.

Here's my concern: Suppose Manager A uploads salary.pdf and contract.pdf into the same project. Sita is a workshop member who has READ access only to salary.pdf.

What happens if Sita changes the document ID in the API URL and tries to open contract.pdf?

For example:

GET /api/documents/101/download — Allowed
GET /api/documents/102/download — Must be denied

Act like a security reviewer. Inspect the controller, service, and permission-checking logic. Identify possible IDOR vulnerabilities and explain the root cause before making changes.

Constraints:

Enforce permissions in the Spring Boot backend, not only in React.

Keep READ and EDIT permissions separate.

Do not introduce project-level passwords.

Check project membership and document permissions independently.

Do not expose documents belonging to another client or project.

Preserve legitimate Manager and Admin functionality.

Add negative authorization tests for direct API requests.

Fix the problem without unnecessarily rewriting existing working features.

3. What AI Produced

The AI suggested enforcing authorization at the service layer before returning document metadata or content.

The proposed approach involved checking the authenticated user's identity, the document's project, and the user's document-specific READ or EDIT permissions.

The recommendation also highlighted that authorization must apply to direct API calls, not just the document list displayed in the frontend.

This is a summary of the proposed approach; the original AI output should be checked before submission.

4. What Went Wrong

The main security concern was that role-based authorization and document-level authorization solve different problems.

For example, a check such as:

@PreAuthorize("hasRole('WORKSHOP')")
@GetMapping("/{documentId}/download")

only checks whether the user has the Workshop role.

It does not automatically verify whether the user is permitted to download the requested document.

If no additional authorization exists in the service layer, this can lead to an Insecure Direct Object Reference (IDOR) vulnerability.

A workshop member could potentially attempt to access another document by changing its identifier.

Important: This is an illustrative unsafe pattern, not a confirmed excerpt from my repository.

5. My Correction and Refined Instructions

I wanted the application to validate the actual document permission rather than trusting the user's role.

I refined the instructions to require the following checks:

Identify the authenticated user from the verified security context.

Load the requested document and its project information.

Verify that the user's account is active.

Verify that the user has an active, authorized relationship with the project.

Check whether the user owns the document or has an applicable READ/EDIT permission.

Check whether the permission has expired or been revoked.

Deny unauthorized requests and record the attempt in the audit trail.

I also emphasized that an expired or revoked permission must not remain usable just because the user has a valid JWT.

6. Example Security Logic

The following is simplified Java pseudocode illustrating the intended authorization approach, not a claim about the exact implementation.

public void requireDocumentAccess(
        User currentUser,
        Document document,
        PermissionType requiredPermission) {

    if (!currentUser.isActive()) {
        throw new AccessDeniedException(
            "Account is inactive");
    }

    if (!membershipService.hasActiveMembership(
            currentUser.getId(),
            document.getProject().getId())) {

        throw new AccessDeniedException(
            "Project access denied");
    }

    boolean allowed =
        permissionService.hasActivePermission(
            currentUser.getId(),
            document.getId(),
            requiredPermission
        );

    if (!allowed) {
        throw new AccessDeniedException(
            "Document access denied");
    }
}

In the actual implementation, document ownership and any legitimate administrative access must be handled according to the application's security policy. READ/EDIT implications, expiry, revocation, and cross-project isolation must also be enforced consistently.

7. Security Verification

I defined the following scenarios to verify the authorization behavior:

Test scenario

Expected result

Sita downloads salary.pdf with READ permission

Allowed

Sita downloads contract.pdf without permission

Denied

Sita changes the document ID in the URL

Denied if unauthorized

Sita tries to edit with READ-only permission

Denied

Sita's permission expires

Access denied

Sita is suspended from the project

Access through that membership denied

A member requests a document from another client's project

Denied

An active authorized Manager accesses their own document

Allowed



Entry 02 — Manager Access Requests and Automatic Permission Expiry

Date: 20/10/2026
Role: Manager / Workshop Member
Category: Security — Permission Management and Access Expiration
Technology: Java, Spring Boot, Spring Security, PostgreSQL

1. Development Context

While developing TrustVault, I wanted workshop members to request access to confidential documents instead of automatically receiving permission to every file in a project.

A manager should be able to review each request and decide whether to approve or reject it. Even after approval, access should not remain active forever.

For example, a workshop member may need a confidential document for only seven days. After that period, the permission should expire automatically without requiring the manager to manually remove it.

My main concern was ensuring that pending requests, rejected requests, expired permissions, and revoked permissions could never be used to access a document.

2. My Prompt to AI

Act as a senior Java Spring Boot security developer and review the access-request and permission-expiration workflow in my TrustVault application.

TrustVault has three roles: Admin, Manager, and Workshop Member.

Managers create projects and upload confidential documents. Workshop members should request access to individual documents, and the responsible manager must approve or reject those requests.

Consider this scenario:

Manager A uploads financial-report.pdf into Project Alpha.

Sita, a workshop member assigned to Project Alpha, requests READ access to this document.

The manager approves her request for seven days.

Expected behavior:

Before approval, Sita cannot view or download the document.

If the request is rejected, Sita must not receive permission.

After approval, Sita can access only the approved document.

Sita must not receive EDIT access when only READ was approved.

After seven days, access must expire automatically.

If the manager revokes permission earlier, access must stop immediately.

Sita must not approve her own access request.

My security concern is that the frontend might hide expired permissions while the backend still accepts direct download requests.

Inspect the existing access-request controller, approval service, document-permission service, and database entities. Explain any authorization or expiration problems before modifying the code.

Constraints:

Enforce all permission checks in the Spring Boot backend.

Only the authorized project manager can approve or reject requests.

Keep document-specific READ and EDIT permissions separate.

Validate project membership and account status.

Use server-side expiration timestamps.

Reject revoked or expired permissions even when the JWT is valid.

Record approval, rejection, revocation, and denied-access events in the audit trail.

Prevent duplicate active permissions and unauthorized cross-project approvals.

Preserve existing project and document functionality.

Implement the necessary corrections and add negative security tests without unnecessarily rewriting working code.

3. What AI Produced

The proposed approach was to manage access requests and document permissions separately.

An access request would have a status such as PENDING, APPROVED, or REJECTED. An approved request would result in a document-specific permission with an expiration timestamp.

The backend would then check the permission status and expiration time whenever a member attempted to access the document.

The approach also included restricting approval actions to authorized managers and recording permission changes in audit logs.

This is a draft summary of the intended AI-assisted approach. It should be checked against the original AI response before submission.

4. What Went Wrong

The main security risk was treating an approved request as permanent authorization.

For example, suppose Sita received READ access to financial-report.pdf until October 23.

If the backend checked only whether a permission record existed, Sita might still be able to download the document on October 24.

An unsafe authorization condition could look like:

boolean allowed =
    permissionRepository.existsByUserIdAndDocumentId(
        userId, documentId);

This condition does not independently verify whether the permission has expired, been revoked, or allows the requested operation.

Another concern was trusting frontend request status or approval buttons instead of checking the manager's authority in the backend.

Important: This is an illustrative unsafe pattern, not a confirmed excerpt from my repository.

5. My Correction and Refined Instructions

I refined the instructions to require the following checks:

Verify that the requesting workshop member has an active account and valid project membership.

Store access requests as PENDING until an authorized manager makes a decision.

Ensure only the manager responsible for the document's project can approve or reject a request.

Create or update document-specific permission only after approval.

Store the expiration timestamp on the server.

Check the permission type, expiration timestamp, and revocation status on every protected document request.

Reject access immediately after expiration, revocation, or project suspension.

Record permission changes and denied attempts in the audit trail.

Prevent members from approving their own requests or modifying approval status through direct API calls.

I also emphasized that a valid JWT proves authentication but does not override an expired document permission.

6. Example Security Logic

The following is simplified Java pseudocode illustrating the intended permission-expiration check, not a claim about the exact implementation.

public boolean hasValidDocumentPermission(
        DocumentPermission permission,
        PermissionType requiredPermission,
        Instant now) {

    if (permission == null) {
        return false;
    }

    if (permission.isRevoked()) {
        return false;
    }

    if (permission.getExpiresAt() != null
            && !now.isBefore(permission.getExpiresAt())) {
        return false;
    }

    if (requiredPermission == PermissionType.EDIT) {
        return permission.getType() == PermissionType.EDIT;
    }

    return permission.getType() == PermissionType.READ
            || permission.getType() == PermissionType.EDIT;
}

This example checks only the permission's validity and type. The actual backend must additionally verify authenticated identity, active account status, project membership, manager approval authority, and document/project isolation.

7. Security Verification

I defined the following scenarios to verify the access-request workflow:

Test scenario

Expected result

Sita requests READ access

Request remains PENDING

Sita downloads before approval

Denied

Manager approves READ for seven days

READ access granted

Sita attempts to edit with READ-only access

Denied

Manager rejects the request

No permission granted

Seven-day permission expires

Access denied

Manager revokes permission early

Access denied immediately

Sita tries to approve her own request

Denied

Another project's manager attempts approval

Denied

Sita uses a valid JWT after permission expiry

Access denied

Suspended member attempts to download

Denied

These are expected outcomes; actual test results must be confirmed from the application or test reports.

Entry 03 — Suspended Workshop Member Access Control

Date: 20/10/2026
Role: Manager / Workshop Member
Category: Security — Project Suspension and Authorization
Technology: Java, Spring Boot, Spring Security, PostgreSQL, React

1. Development Context

While testing TrustVault's Manager and Workshop Member dashboards, I encountered an issue involving project suspension.

In TrustVault, managers can add workshop members to projects and suspend their project membership when they should no longer have access.

I tested this functionality using a workshop member named Sita.

After the manager suspended Sita from a project, I observed that project documents were still visible on her Workshop Member dashboard.

This was a serious concern because suspension should immediately prevent a member from accessing confidential documents belonging to that project.

My objective was to ensure that project suspension was enforced in the backend, not merely reflected as a status in the manager's dashboard.

2. My Prompt to AI

Act as a senior Java Spring Boot security engineer and perform a focused security investigation into project membership suspension in my TrustVault application.

Actual issue I encountered:

I have a Manager dashboard and a Workshop Member dashboard.

A manager created Project Alpha and added Sita as a workshop member. Sita could initially see the project's documents because she was an active member.

The manager then suspended Sita from Project Alpha.

However, after suspension, Sita could still see documents associated with that project on her Workshop dashboard.

This is a security problem. Suspended members must immediately lose access to that project's documents, even if they previously had READ or EDIT permissions.

Expected behavior:

An active workshop member can access only the documents they are authorized to use.

A suspended workshop member cannot list, preview, download, edit, or search documents from the suspended project.

Existing document permissions must not override suspended project membership.

A valid JWT must not allow a suspended member to bypass authorization.

Direct API requests using document IDs must also be denied.

Suspension from Project Alpha must not automatically revoke access to an unrelated Project Beta where the member remains active and authorized.

The manager should still be able to view and manage the project.

Unauthorized access attempts should be recorded in the audit trail.

Investigation instructions:

Inspect the project membership entity and suspension status.

Trace how membership status is checked in document controllers and services.

Check document listing, metadata, preview, download, search, and edit endpoints.

Identify whether any endpoint checks only the user's role or document permission without verifying active project membership.

Inspect whether the Workshop dashboard displays stale or unauthorized documents.

Explain the root cause before modifying code.

Constraints:

Fix the issue in Spring Boot authorization logic.

Do not rely only on hiding documents in React.

Do not delete document records or permanently remove permissions just to enforce suspension.

Preserve Admin and Manager functionality.

Do not introduce project-level passwords.

Enforce isolation between different projects and clients.

Add regression tests for suspended membership and direct API access.

Make the smallest secure changes necessary and explain which endpoints and services were modified.

3. What AI Produced

The AI-assisted investigation focused on verifying project membership status before allowing document operations.

The intended correction was to ensure that a workshop member's previously granted document permission would not be sufficient when their project membership was suspended.

The frontend also needed to reflect the updated access state rather than continuing to display documents that were no longer authorized.

I continued working on the issue until the suspension behavior was corrected.

The exact files modified and original AI response should be confirmed from the repository history before submission.

4. What Went Wrong

The observed problem was that Sita continued seeing project documents after being suspended.

A possible underlying authorization mistake is checking only whether a document permission exists:

boolean allowed =
    permissionService.hasReadPermission(
        userId, documentId);

Such a check may incorrectly allow access when the user still has a document permission but no longer has active project membership.

A separate frontend issue can occur if previously loaded documents remain visible after membership status changes.

However, removing documents from the frontend alone would not prevent direct API access.

Important: The code above illustrates a possible failure pattern. It is not a confirmed excerpt or proven root cause from the repository.

5. My Correction and Refined Instructions

I emphasized that suspension must override document-level permissions for the affected project.

I required the authorization flow to:

Identify the authenticated user using the verified security context.

Load the requested document and identify its project.

Check whether the user's account is active.

Verify that the user has an active membership in that specific project.

Reject the operation if the membership is suspended, even when READ or EDIT permission exists.

Validate the document-specific permission only after the membership check.

Apply these checks to document listing, preview, download, search, and editing.

Record denied attempts without exposing confidential document content.

Refresh or invalidate frontend data after a membership change.

Preserve access to unrelated projects where the user remains authorized.

I also requested regression tests to ensure that the same suspension issue would not return after future changes.

6. Example Security Logic

The following simplified Java pseudocode demonstrates the intended membership validation. It is illustrative rather than a verified copy of the project's source code.

public void requireActiveProjectMembership(
        Long userId,
        Long projectId) {

    ProjectMembership membership =
        membershipRepository
            .findByUserIdAndProjectId(
                userId, projectId)
            .orElseThrow(() ->
                new AccessDeniedException(
                    "Project access denied"));

    if (membership.getStatus()
            != MembershipStatus.ACTIVE) {

        throw new AccessDeniedException(
            "Project membership is not active");
    }
}

This check must be combined with document-specific authorization, account status, and cross-project isolation. Legitimate Manager and Admin access must follow the application's defined security policy.

7. Security Verification

I defined the following regression scenarios:

Test scenario

Expected result

Sita is an active member with READ permission

Allowed to read the approved document

Manager suspends Sita from Project Alpha

Membership becomes suspended

Sita opens Project Alpha document list

Documents no longer returned

Sita downloads a Project Alpha document by ID

Denied

Sita attempts to edit a Project Alpha document

Denied

Sita uses an existing JWT after suspension

Denied for Project Alpha

Sita has an old READ permission in Project Alpha

Permission cannot bypass suspension

Sita is still active in Project Beta

Authorized Project Beta access remains available

Manager views their own project

Allowed

Suspended Sita makes a denied request

Denied attempt recorded in audit trail

These are expected results. Actual automated test outcomes should be added only after checking test reports.



Entry 04 — Admin Account Deactivation and Login Blocking

Date: 21/10/206
Role: Admin / Manager / Workshop Member
Category: Security — Authentication and Account Deactivation
Technology: Java, Spring Boot, Spring Security, JWT, PostgreSQL

1. Development Context

While developing the Admin dashboard in TrustVault, I wanted administrators to manage Manager and Workshop Member accounts securely.

The Admin should be able to create users, assign roles, and deactivate accounts when a person leaves the organization or should no longer use the platform.

My main concern was that deactivating an account should do more than hide the user from the Admin dashboard.

For example, if an Admin deactivates Sita's account, Sita must not be able to log in using her correct email and password. If she already has a valid JWT from an earlier login, that token should not allow her to continue accessing protected resources.

This made me focus on enforcing account status during authentication and authorization.

2. My Prompt to AI

Act as a senior Java Spring Boot and Spring Security developer. Review the Admin account-management and authentication workflow in my TrustVault application.

TrustVault has three roles: Admin, Manager, and Workshop Member.

The Admin can create Manager and Workshop Member accounts, assign roles, and deactivate user accounts.

Security scenario:

Sita is an active Workshop Member who can log in and access documents for which she has permission.

The Admin opens the user-management page and deactivates Sita's account.

Now suppose Sita tries to log in again using her correct email and password.

Expected behavior:

The login must be rejected because the account is inactive.

Correct credentials must not override account deactivation.

The application must not issue a new JWT to a deactivated user.

Existing JWTs must not provide continued access to protected APIs.

Sita must not view, download, upload, edit, or search documents after deactivation.

Deactivation must not delete Sita's historical audit records.

Admin must still be able to review the account and its activity.

Deactivating one account must not affect unrelated active accounts.

Investigation instructions:

Inspect the User entity and account-status field.

Review the login controller, authentication service, and Spring Security configuration.

Check whether account status is validated before issuing JWTs.

Inspect the JWT authentication filter and determine whether existing tokens remain usable after account deactivation.

Check whether protected services independently enforce active-account status.

Review the Admin user-deactivation endpoint and its authorization rules.

Explain any security gaps and their root causes before modifying the implementation.

Constraints:

Only authorized Admin users can deactivate accounts.

Enforce account status in the Spring Boot backend.

Do not rely on hiding the Login button or dashboard in React.

Prevent users from deactivating or reactivating accounts through unauthorized API requests.

Reject inactive users even when their password is correct.

Ensure previously issued JWTs cannot bypass account deactivation.

Preserve historical audit logs and document ownership records.

Record account deactivation and denied access attempts in the audit trail.

Preserve existing Manager and Workshop Member functionality.

Add regression tests for login, JWT reuse, and Admin-only account management.

Make the smallest secure changes necessary without rewriting unrelated application features.

3. What AI Produced

The proposed AI-assisted approach was to make account status part of the authentication and authorization process.

This involved checking whether the account was active before allowing login and issuing a JWT.

The approach also required protected requests to verify that the authenticated account remained active, rather than trusting the JWT's signature and expiration alone.

Another recommendation was to restrict account-deactivation operations to the Admin role and preserve historical records for auditing.

This is a draft summary of the intended approach. The original AI response and actual changes should be checked before submission.

4. What Went Wrong

The security risk was assuming that a valid email, password, or JWT automatically meant the user should still be allowed into the application.

For example, authentication logic that only validates credentials could overlook the account's current status.

Similarly, a JWT may remain cryptographically valid after the Admin deactivates the user.

An unsafe authorization pattern could look like:

if (jwtService.isTokenValid(token)) {
    allowRequest();
}

This checks token validity but does not independently confirm whether the account has been deactivated.

If the application does not recheck account status, an inactive user could potentially continue using an existing session or token.

Important: This is an illustrative unsafe pattern, not a confirmed excerpt from my repository or proof that this vulnerability existed.

5. My Correction and Refined Instructions

I refined the security requirements to ensure account deactivation takes effect across the application.

The expected authorization flow was:

Allow only authenticated Admin users to deactivate accounts.

Store the updated account status in the database.

Reject login attempts when the account is inactive, even with correct credentials.

Avoid issuing new JWTs to inactive accounts.

Recheck current account status when validating authenticated requests.

Reject previously issued JWTs when the associated account is inactive.

Block inactive accounts from all protected document and project operations.

Preserve document ownership information and historical audit records.

Record deactivation actions and subsequent denied access attempts.

Verify that unrelated active accounts continue working normally.

I also emphasized that frontend redirects or logout messages are useful for the user experience but cannot replace backend authorization checks.

6. Example Security Logic

The following simplified Java pseudocode illustrates the intended account-status validation. It is not a verified copy of the project's implementation.

public void requireActiveAccount(User user) {

    if (user == null || !user.isActive()) {
        throw new AccessDeniedException(
            "Account is inactive or unavailable");
    }
}

For authenticated API requests, the application should obtain the current user record from a trusted source and validate the active status before allowing protected operations.

User user = userRepository.findById(userId)
    .orElseThrow(() ->
        new AccessDeniedException(
            "Account unavailable"));

requireActiveAccount(user);

These checks are illustrative. In the actual application, JWT signature and expiration validation, secure identity lookup, account-status checks, and authorization rules must work together. The login flow must also reject inactive users before a new token is issued.

7. Security Verification

I defined the following scenarios to verify account deactivation:

Test scenario

Expected result

Active Sita logs in with correct credentials

Login allowed

Admin deactivates Sita

Account becomes inactive

Sita logs in with correct credentials after deactivation

Login denied

Sita logs in with an incorrect password

Login denied

Sita uses an existing JWT after deactivation

Protected API access denied

Sita attempts to download a previously authorized document

Denied

Sita attempts to view project documents

Denied

Workshop Member attempts to deactivate another user

Denied

Manager attempts to call an Admin-only deactivation API

Denied

Admin reviews Sita's historical audit records

Allowed

Another active Workshop Member logs in

Allowed

Unauthorized user attempts account reactivation

Denied

Entry 05 — Secure Audit Logs and Denied Access Attempts

Date: 21/10/2026
Role: Admin / Manager / Workshop Member
Category: Security — Audit Logging, Accountability and Access Control
Technology: Java, Spring Boot, Spring Security, PostgreSQL

1. Development Context

While developing TrustVault, I focused on two important security problems: preventing unauthorized document access and maintaining a reliable record of document activity.

Even if a system successfully blocks unauthorized access, administrators still need to know who attempted the operation, which document was involved, and when the attempt occurred.

For example, if Sita tries to download salary.pdf without permission, the backend should deny the request. However, simply returning an error is not enough for an administrator investigating suspicious activity.

I wanted TrustVault to record successful and denied document operations, including uploads, downloads, edits, deletions, and permission changes.

Another concern was audit-log visibility. Admin users should be able to investigate system-wide activity, while Managers should see only activity related to projects they are authorized to manage. Workshop Members should not be able to access confidential system audit logs.

2. My Prompt to AI

Act as a senior Java Spring Boot security engineer and audit-logging specialist. Review the audit trail implementation in my TrustVault document-management application.

TrustVault has three roles: Admin, Manager, and Workshop Member.

Managers create projects, upload documents, manage permissions, and suspend project members. Workshop Members can access only documents for which they have valid permissions.

I want the application to maintain a reliable audit trail for security investigations.

Consider this scenario:

Manager A uploads salary.pdf into Project Alpha and grants Sita READ permission.

Sita downloads the document successfully.

Later, Manager A revokes Sita's permission.

Sita then tries to download the same document again using its API URL.

Expected audit behavior:

The original upload is recorded.

The successful download is recorded as ALLOWED.

The permission revocation is recorded with the responsible Manager.

Sita's later unauthorized download attempt is recorded as DENIED.

Each record identifies the actor, action, resource, timestamp, and outcome.

Audit records must not expose passwords, JWTs, or confidential document contents.

Audit-log access rules:

Admin can review system-wide audit events.

Manager can review events related only to projects they are authorized to manage.

Workshop Members cannot access administrative audit-log endpoints.

A Manager must not retrieve another Manager's private project audit logs by changing a project ID in the URL.

Investigation instructions:

Inspect the existing audit-log entity, repository, service, and controller.

Check whether successful and denied document operations are recorded.

Review upload, download, edit, delete, permission grant, revocation, and membership suspension flows.

Inspect Spring Security restrictions on /api/audit-logs/** and other audit endpoints.

Check whether the audit controller accepts user-controlled project IDs without verifying Manager ownership.

Determine whether denied requests are still logged when the main operation fails or a transaction rolls back.

Review how audit events are stored and whether unauthorized users can modify or delete them.

Explain the root causes of any identified issues before changing the code.

Constraints:

Enforce audit-log access restrictions in the Spring Boot backend.

Do not rely on hiding audit navigation in React.

Record both ALLOWED and DENIED security-sensitive operations.

Obtain actor identity from the verified security context, not from client-supplied fields.

Use server-generated timestamps.

Preserve historical audit events when accounts are deactivated or permissions are revoked.

Prevent unauthorized modification or deletion of audit records.

Do not expose confidential file contents or authentication secrets in logs.

Preserve existing Admin and Manager functionality.

Add security regression tests for cross-project audit access and denied-event recording.

Make the smallest secure changes necessary and explain which controllers, services, and security rules require modification.

3. What AI Produced

The AI-assisted review focused on centralizing audit-event creation and applying backend authorization to audit-log retrieval.

The proposed design recorded the authenticated actor, target resource, action, timestamp, and result for security-sensitive operations.

It also distinguished between Admin access to system-wide logs and Manager access to project-scoped logs.

Another important recommendation was to ensure denied attempts were captured even when the requested document operation was rejected.

This is a draft summary of the intended AI-assisted approach. The exact original response and implemented changes should be verified before submission.

4. What Went Wrong

During the security review, an important concern involved audit-log endpoint authorization.

The /api/audit-logs/** route lacked explicit authority restrictions in the reviewed Spring Security configuration, and the /my-activity route was reachable by Viewer users. The Workshop Member interface also exposed audit-log navigation.

This created a risk of unauthorized users observing sensitive security information, including actions performed by other users and projects.

Another possible issue was recording only successful operations while overlooking denied attempts.

For example, if Sita attempted to download a document without permission, the request might be rejected correctly but leave no audit evidence if the denial was not logged.

A simplified unsafe endpoint could look like:

@GetMapping("/api/audit-logs")
public List<AuditLog> getAuditLogs() {
    return auditLogRepository.findAll();
}

Without appropriate backend authorization and project scoping, this pattern could expose system-wide audit events.

Important: This code is an illustrative unsafe pattern, not a confirmed excerpt from the TrustVault repository.

5. My Correction and Refined Instructions

I focused on ensuring that audit logs were both complete and protected.

I refined the instructions to require the following:

Restrict system-wide audit-log retrieval to authorized Admin users.

Allow Managers to retrieve only logs for projects they are authorized to manage.

Prevent Workshop Members from accessing administrative audit endpoints.

Validate project ownership or management authority in the backend before returning audit records.

Record successful and denied document access attempts.

Record permission grants, revocations, membership suspension, and account deactivation.

Derive actor identity from the authenticated security context.

Generate timestamps on the server and store a consistent ALLOWED or DENIED outcome.

Prevent unauthorized modification or deletion of historical audit events.

Ensure denied events remain recorded even when the protected operation fails.

I also emphasized that audit logs themselves contain sensitive information and therefore require authorization controls similar to those protecting confidential documents.

6. Example Security Logic

The following simplified Java pseudocode demonstrates an intended audit-logging pattern. It is illustrative rather than a verified copy of the implementation.

public void recordAuditEvent(
        Long actorId,
        Long documentId,
        String action,
        String result) {

    AuditLog event = new AuditLog();

    event.setActorId(actorId);
    event.setDocumentId(documentId);
    event.setAction(action);
    event.setResult(result);
    event.setTimestamp(Instant.now());

    auditLogRepository.save(event);
}

An authorization denial might be handled as follows:

try {
    authorizationService.requireReadAccess(
        currentUser, document);

    auditService.recordAuditEvent(
        currentUser.getId(),
        document.getId(),
        "DOWNLOAD",
        "ALLOWED");

} catch (AccessDeniedException ex) {

    auditService.recordDeniedAttempt(
        currentUser.getId(),
        document.getId(),
        "DOWNLOAD");

    throw ex;
}

The real implementation must ensure that denied-event recording is not rolled back with the failed operation. It must also avoid recording an ALLOWED download before the actual operation succeeds.

Audit writes should be protected from unauthorized changes, and the application should avoid leaking sensitive details through error messages.

7. Security Verification

I defined the following scenarios to verify the audit system:

Test scenario

Expected result

Manager uploads a document

Upload event recorded

Sita downloads with READ permission

ALLOWED download event recorded

Sita downloads without permission

Request denied and DENIED event recorded

Manager revokes document permission

Permission-change event recorded

Sita downloads after revocation

Denied attempt recorded

Manager suspends Sita from a project

Suspension event recorded

Admin deactivates a user account

Deactivation event recorded

Admin requests system-wide audit logs

Allowed

Manager requests their own project audit logs

Allowed

Manager requests another project's private audit logs

Denied

Workshop Member calls /api/audit-logs/**

Denied

Unauthorized user attempts to modify audit records

Denied

An account is deactivated

Historical audit events remain available to authorized reviewers




Entry 06 — Role-Based Access Control for Admin, Manager and Workshop Member

Date: 22/10/2026
Role: Admin / Manager / Workshop Member
Category: Security — Role-Based Access Control (RBAC)
Technology: Java, Spring Boot, Spring Security, JWT, PostgreSQL, Next.js

1. Development Context

While building TrustVault, I needed to separate the responsibilities of administrators, managers, and workshop members.

Initially, I focused on designing separate dashboards for each role. However, I realized that displaying different pages does not automatically secure the underlying backend APIs.

For example, a Workshop Member should not be able to create Manager accounts simply by calling an Admin API directly. Similarly, a Manager should not be able to deactivate another user's account, and a Workshop Member should not be able to approve their own document-access request.

My goal was to enforce role-based authorization consistently across the backend while preserving document-level permissions and project-specific access rules.

2. My Prompt to AI

Act as a senior Java Spring Boot and Spring Security engineer. Review and strengthen the role-based access control implementation in my TrustVault application.

TrustVault has three roles:

ADMIN

Create Manager and Workshop Member accounts.

Assign user roles.

Activate or deactivate user accounts.

View system-wide audit logs and security events.

Manage administrative account settings.

MANAGER

Create and manage their own projects.

Upload and organize project documents.

Add and suspend Workshop Members within their projects.

Review and approve or reject document-access requests.

Grant, revoke, and expire document-specific READ or EDIT permissions.

View audit activity associated with projects they are authorized to manage.

WORKSHOP MEMBER

View projects where they have active membership.

Request access to individual documents.

View or download documents with valid READ permission.

Edit documents only when EDIT permission is granted.

Update their own profile and password.

Security scenario:

Sita logs in as a Workshop Member and receives a valid JWT.

She cannot see Admin functionality in her dashboard.

However, suppose she manually sends an API request to create a Manager account or approve her own document-access request.

The backend must reject these operations even though she is authenticated.

Similarly, Manager A must not be able to manage Manager B's projects simply by changing a project ID in an API request.

Investigation instructions:

Inspect the existing Spring Security configuration and JWT authentication filter.

Review how ADMIN, MANAGER, and WORKSHOP MEMBER roles are stored and mapped to Spring Security authorities.

Inspect Admin, Manager, Project, Document, Permission, and Access Request controllers.

Identify endpoints that require explicit role restrictions.

Check whether sensitive service methods can be called without verifying the authenticated user's role and resource ownership.

Review the frontend route protection and role-specific navigation.

Identify any privilege-escalation or cross-role authorization risks.

Explain the root cause of each confirmed issue before modifying the code.

Constraints:

Enforce authorization in the Spring Boot backend.

Do not depend only on hiding buttons or pages in Next.js.

Use a deny-by-default policy for sensitive endpoints.

Ensure Workshop Members cannot invoke Admin or Manager-only operations.

Ensure Managers cannot perform Admin-only account management.

Ensure Managers cannot modify another Manager's projects.

Validate document-specific permissions independently of user roles.

Preserve project suspension, account deactivation, and permission-expiration checks.

Obtain the current user's identity from the verified authentication context.

Record unauthorized access attempts in the audit trail.

Add negative security tests for role escalation and direct API requests.

Apply the smallest secure changes necessary without breaking legitimate workflows.

3. What AI Produced

The proposed approach was to apply role-based restrictions at the Spring Security and controller/service levels.

The AI-assisted design distinguished between endpoint-level role checks and resource-specific authorization.

For example, only Admin users should reach account-management operations, while Manager users should reach project-management operations only for projects they are authorized to manage.

The approach also recommended protecting the backend independently of frontend navigation and validating JWT roles against the application's current authorization rules.

This is a draft summary of the intended AI-assisted approach. Confirm the original response and actual implementation before submission.

4. What Went Wrong

The main security concern was relying on frontend dashboard separation as proof that the application was secure.

A Workshop Member might not see an Admin button, but the associated API could still be reachable if the backend lacked proper authorization.

For example, an unsafe endpoint could look like:

@PostMapping("/api/admin/users")
public User createUser(@RequestBody UserRequest request) {
    return userService.createUser(request);
}

If no other security layer restricts this endpoint, an authenticated non-Admin user might be able to invoke it directly.

Another concern was checking only the MANAGER role without confirming that the Manager actually controlled the requested project.

Important: This is an illustrative unsafe pattern, not a confirmed excerpt from the TrustVault repository.

5. My Correction and Refined Instructions

I refined the authorization requirements to ensure that each role could perform only its intended operations.

The expected security flow was:

Authenticate the user using a verified JWT and current account information.

Confirm that the account is active.

Check whether the user has the role required for the requested operation.

For Manager operations, verify authority over the specific project.

For Workshop Member document operations, verify active project membership.

Check document-specific READ or EDIT permission before returning protected content.

Reject access requests that violate role or resource-ownership restrictions.

Ensure Workshop Members cannot approve their own requests.

Prevent unauthorized role assignment or account deactivation.

Record denied attempts without exposing confidential data.

I also emphasized that a user having the MANAGER role does not automatically give them permission to manage every project.

6. Example Security Logic

The following Java code illustrates the intended role restrictions. It is an example, not a verified excerpt from the repository.

@PreAuthorize("hasRole('ADMIN')")
@PostMapping("/api/admin/users")
public ResponseEntity<?> createUser(
        @RequestBody UserRequest request) {

    return ResponseEntity.ok(
        userService.createUser(request));
}

A Manager endpoint also requires project-specific authorization:

@PreAuthorize("hasRole('MANAGER')")
@PostMapping("/api/projects/{projectId}/members")
public ResponseEntity<?> addMember(
        @PathVariable Long projectId,
        @RequestBody MemberRequest request) {

    projectSecurity.requireManagerAccess(
        projectId);

    projectService.addMember(projectId, request);

    return ResponseEntity.ok().build();
}

In the actual application, method security must be enabled, and authority names must match the role mapping used by Spring Security. Controller restrictions must also be supported by service-level checks where necessary.

7. Security Verification

I defined the following scenarios to verify role-based authorization:

Test scenario

Expected result

Admin creates a Manager account

Allowed

Admin deactivates a Workshop Member account

Allowed

Manager creates a project

Allowed

Manager manages their own project members

Allowed

Manager tries to deactivate a user account

Denied

Manager attempts to modify another Manager's project

Denied

Workshop Member calls an Admin account-creation API

Denied

Workshop Member attempts to create a project

Denied

Workshop Member tries to approve their own access request

Denied

Workshop Member downloads a document with valid READ access

Allowed

Workshop Member attempts to edit with READ-only permission

Denied

Suspended Workshop Member accesses a project

Denied

Deactivated account uses an existing JWT

Denied

Unauthorized role-escalation attempt

Denied and audited

Entry 07 — Cross-Project Isolation and Direct URL Authorization

Date: 23/10/2026
Role: Manager / Workshop Member
Category: Security — Project Isolation, Broken Access Control and IDOR Prevention
Technology: Java, Spring Boot, Spring Security, PostgreSQL, JWT, Next.js

1. Development Context

While developing TrustVault, I wanted to ensure that documents belonging to one project could not be accessed by users from another project without explicit authorization.

TrustVault allows Managers to create projects, add Workshop Members, upload confidential documents, and manage document-specific permissions.

However, having separate projects in the database or showing different projects on each user's dashboard does not automatically guarantee isolation.

For example, Manager A may create Project Alpha for Client A, while Manager B creates Project Beta for Client B.

If Manager A changes a project ID in an API request, the backend must not return Project Beta's confidential information.

Similarly, a Workshop Member who belongs to Project Alpha must not gain access to Project Beta's documents simply by guessing a document ID or using a copied download URL.

My goal was to ensure that project and client isolation was enforced consistently in backend queries and authorization checks.

2. My Prompt to AI

Act as a senior Java Spring Boot application-security engineer and investigate cross-project authorization risks in my TrustVault platform.

TrustVault is a security-focused document-management application with three roles: Admin, Manager, and Workshop Member.

Managers create projects and upload documents. Workshop Members receive document-specific READ or EDIT permissions after approval.

Security scenario:

Manager A creates Project Alpha for Client A and uploads client-a-contract.pdf.

Manager B creates Project Beta for Client B and uploads client-b-contract.pdf.

Sita is a Workshop Member assigned only to Project Alpha.

Suppose Sita discovers the document ID or direct download URL for client-b-contract.pdf.

She must not be able to access the document, even if she is logged in and has a valid JWT.

Similarly, Manager A must not be able to read, edit, delete, or manage Project Beta's documents or members by changing IDs in API requests.

Expected behavior:

Each Manager can manage only projects they are authorized to control.

Workshop Members can view only projects where they have active membership.

Document READ or EDIT access requires an active, valid permission for the specific document.

A permission for Project Alpha must not provide access to Project Beta.

Direct download, preview, metadata, search, edit, and delete requests must enforce authorization.

Unauthorized project IDs and document IDs must not expose confidential data.

Suspended memberships, revoked permissions, and expired grants must remain ineffective.

Unauthorized access attempts should be recorded in the audit trail.

Investigation instructions:

Inspect project, document, membership, and permission entities and their database relationships.

Review ProjectController, DocumentController, and their associated services.

Identify endpoints that load resources by ID without checking the authenticated user's authority over the associated project.

Inspect document search and listing queries for missing project restrictions.

Verify that project IDs and document IDs are not trusted as proof of authorization.

Review download, preview, edit, delete, and permission-management operations.

Check whether Manager ownership and Workshop Member membership are enforced consistently.

Explain any confirmed authorization gaps before modifying code.

Constraints:

Enforce project isolation in the Spring Boot backend.

Do not rely on hiding projects or documents in Next.js.

Use authenticated identity from the verified security context.

Never accept a client-supplied user ID as proof of ownership.

Apply deny-by-default authorization to sensitive resources.

Verify account status, project authority or membership, and document-level permissions.

Preserve legitimate Admin oversight without unintentionally granting broad document access.

Do not introduce project-level passwords.

Prevent cross-project access through guessed URLs, modified IDs, or direct API calls.

Record denied access attempts in the audit trail.

Add negative regression tests for cross-project data isolation.

Implement only necessary security corrections and preserve existing project workflows.

3. What AI Produced

The proposed approach was to treat every project and document request as a resource-specific authorization decision.

Instead of assuming that an authenticated user could access a requested project ID, the backend should identify the project's authorized Manager or verify the Workshop Member's active membership.

For document operations, the backend should load the document, identify its parent project, and verify both project-level eligibility and document-specific permission.

The proposed review also covered filtering document lists and search results so unauthorized resources were not returned.

This is a retrospective summary of the intended AI-assisted approach. Verify the original AI output and actual code changes before submission.

4. What Went Wrong

The security concern was that database identifiers could potentially become a way to access another user's resources.

For example, suppose an endpoint retrieves a document using only its ID:

Document document = documentRepository
    .findById(documentId)
    .orElseThrow();

Retrieving the document is not itself a security failure. The vulnerability occurs if the application returns its contents or performs an operation without checking whether the authenticated user is authorized to access it.

A user might change a request such as:

GET /api/documents/101/download

to:

GET /api/documents/102/download

If document 102 belongs to another project, the backend must reject the request unless the user has valid authorization.

Another concern was project listing and search APIs returning records outside the user's authorized scope.

Important: These examples illustrate potential IDOR risks. They do not establish that these exact vulnerabilities existed in the repository.

5. My Correction and Refined Instructions

I refined the authorization requirements to ensure that every protected resource was checked against the authenticated user's identity.

The intended security flow was:

Authenticate the request and identify the current user.

Verify that the account is active.

Load the requested project or document using its identifier.

Determine which project owns the requested document.

Verify that a Manager is authorized to manage that project, or that a Workshop Member has active membership.

For Workshop Member document operations, check the exact document's READ or EDIT permission.

Reject expired, revoked, or insufficient permissions.

Filter document lists and search results to authorized resources.

Apply equivalent authorization checks to direct download, preview, edit, and delete operations.

Record denied attempts without exposing confidential document metadata or contents.

I emphasized that a valid JWT identifies an authenticated user but does not automatically authorize access to every project or document.

6. Example Security Logic

The following simplified Java pseudocode illustrates the intended project-isolation check. It is not a verified excerpt from TrustVault's source code.

public void requireProjectAccess(
        User currentUser,
        Project project) {

    if (currentUser == null
            || !currentUser.isActive()) {
        throw new AccessDeniedException(
            "Access denied");
    }

    boolean authorizedManager =
        projectSecurity.isAuthorizedManager(
            currentUser.getId(),
            project.getId());

    boolean activeMember =
        membershipService.hasActiveMembership(
            currentUser.getId(),
            project.getId());

    if (!authorizedManager && !activeMember) {
        throw new AccessDeniedException(
            "Project access denied");
    }
}

For document access, an additional document-specific check is required:

Document document = documentRepository
    .findById(documentId)
    .orElseThrow(() ->
        new ResourceNotFoundException(
            "Document unavailable"));

requireProjectAccess(
    currentUser, document.getProject());

documentSecurity.requirePermission(
    currentUser, document, PermissionType.READ);

The real implementation must distinguish Manager and Workshop Member privileges correctly. Active project membership alone must never be treated as sufficient permission to read every document.

For applications with multiple clients or tenants, authorization must also verify the relevant client or tenant boundary, not only the project ID.

7. Security Verification

I defined the following negative and positive test scenarios:

Test scenario

Expected result

Manager A opens Project Alpha

Allowed

Manager A attempts to manage Project Beta

Denied

Manager A modifies Project Beta's members through a direct API

Denied

Sita lists projects where she has active membership

Authorized projects only

Sita requests Project Beta's document by guessed ID

Denied

Sita attempts to download a document without READ permission

Denied

Sita downloads an approved Project Alpha document

Allowed

Sita attempts to edit with READ-only permission

Denied

Sita uses a revoked document permission

Denied

Sita accesses a project after suspension

Denied

Document search includes another client's records

Unauthorized records excluded

Unauthorized user attempts direct document deletion

Denied

Cross-project access attempt is rejected

Denied event recorded in audit trail

Entry 08 — Next.js Security Warning and Dependency Review

Date: 24/10/2026
Role: Developer / Security Reviewer
Category: Security — Dependency Management and Deployment
Technology: Next.js, React, npm, Vercel, GitHub

1. Development Context

While preparing TrustVault for deployment, I encountered a security warning related to the Next.js version used by the frontend.

TrustVault uses Next.js for the user interface and Java Spring Boot for backend authentication, document authorization, and audit logging.

The warning raised an important concern: even when application-level authorization is implemented carefully, outdated framework dependencies can introduce additional security risks.

I wanted to investigate the warning without blindly upgrading packages or introducing breaking changes before the project submission deadline.

My objective was to identify the installed Next.js version, understand the reported vulnerability, determine whether a patched release was available, and verify that the application still worked after any necessary update.

2. My Prompt to AI

Act as a senior Next.js security engineer and help me investigate a security warning in my TrustVault frontend deployment.

My project uses:

Next.js and React for the frontend.

Java Spring Boot and Spring Security for the backend.

PostgreSQL for application data.

Vercel for frontend deployment.

Render for backend deployment.

I received a warning indicating that the installed Next.js version might be insecure or affected by a known vulnerability.

My requirements:

Inspect package.json and the package lockfile to identify the installed Next.js and React versions.

Determine which advisory or vulnerability applies to the installed version.

Check whether the affected feature is used in my application.

Identify the smallest compatible patched version.

Explain the risk before changing dependencies.

Avoid unnecessary major-version upgrades.

Preserve the existing Admin, Manager, and Workshop Member dashboards.

Preserve frontend communication with the Spring Boot API.

Check for dependency conflicts and breaking changes.

Verify that the production build succeeds after any upgrade.

Security constraints:

Do not disable security checks simply to make deployment succeed.

Do not suppress the warning without understanding its cause.

Do not use npm audit fix --force without reviewing the proposed dependency changes.

Do not expose API secrets or JWT values in frontend environment variables.

Do not assume that a successful build proves the vulnerability has been fixed.

Preserve backend authorization and audit logging.

Explain the recommended fix, the exact files that need modification, and the verification commands.

3. What AI Produced

The intended AI-assisted approach was to inspect the frontend dependency versions and compare them against the relevant security advisory.

Rather than immediately upgrading every package, the proposed process focused on selecting an appropriate patched version and reviewing compatibility.

The suggested verification steps included checking the dependency tree, running a production build, and testing the main application workflows after deployment.

This is a retrospective summary of the intended investigation. The original AI response, affected version, advisory, and final changes must be confirmed before submission.

4. What Went Wrong

The warning indicated a potential dependency-security issue during the deployment process.

However, a warning alone does not establish that the deployed application was exploitable. The actual risk depends on the installed version, the specific advisory, and the application's configuration.

One possible mistake would be to ignore the warning because the frontend still builds successfully.

Another mistake would be to run an unrestricted dependency upgrade that changes unrelated packages and breaks existing functionality.

For example:

npm audit fix --force

This command can introduce major-version changes, so it should not be used blindly as a security fix.

The exact Next.js vulnerability and affected package version have not been verified in this journal entry.

5. My Correction and Refined Instructions

I refined the investigation process to prioritize evidence and compatibility.

The intended steps were:

Confirm the installed Next.js version from the project files.

Identify the official security advisory associated with the warning.

Check whether the installed version falls within the affected range.

Determine whether the application uses the vulnerable feature.

Select a patched version compatible with the existing application.

Update the dependency and lockfile together.

Run the production build and review errors.

Test login and role-based dashboard navigation.

Test frontend API communication with the Spring Boot backend.

Confirm that the deployed build uses the corrected dependency version.

I also emphasized that framework updates do not replace application-level security controls such as document permissions, project isolation, and backend audit logging.

6. Example Investigation Commands

The following commands illustrate a safe dependency-review workflow. They are not proof that these exact commands were executed during development.

npm ls next react react-dom

This command displays the installed versions of Next.js and related React packages.

npm audit

This command checks installed dependencies against known vulnerability advisories available to npm.

npm run build

This command verifies whether the application can produce a production build.

After confirming an appropriate patched version, a targeted update may be performed:

npm install next@<verified-patched-version>

The placeholder must be replaced with a version verified against the relevant advisory and compatibility requirements.

After updating, the dependency tree, lockfile, build output, and deployment should be reviewed again.

7. Security Verification

I defined the following verification scenarios:

Verification scenario

Expected result

Inspect installed Next.js version

Exact version identified

Review relevant security advisory

Affected versions understood

Compare installed version with advisory

Exposure assessed

Apply an appropriate patched version

Dependency updated

Inspect lockfile

Updated version recorded

Run production build

Build completes successfully

Open Admin dashboard

Existing functionality preserved

Open Manager dashboard

Existing functionality preserved

Open Workshop Member dashboard

Existing functionality preserved

Test frontend-to-backend API calls

Requests function as intended

Recheck vulnerability warning

Relevant warning resolved if the patch applies

Review deployment output

Correct build deployed

Entry 09 — Document API 400 Bad Request Debugging

Date: 24/10/2026
Role: Developer / Manager
Category: Backend Debugging — API Validation and Error Handling
Technology: Java, Spring Boot, Spring Security, PostgreSQL, Next.js, REST APIs

1. Development Context

While testing TrustVault's Manager dashboard, I encountered an API error while loading document information.

The browser console reported a 400 Bad Request response for a request involving the document API.

The endpoint involved was:

GET http://localhost:8080/api/documents

This affected the document-management workflow because the Manager dashboard depended on backend responses to display uploaded documents.

My objective was to identify why the backend rejected the request and correct the underlying issue without weakening authentication, document authorization, or project isolation.

2. My Prompt to AI

Act as a senior Java Spring Boot and Next.js debugging engineer. Help me investigate a 400 Bad Request error in my TrustVault document-management application.

Technology stack:

Frontend: Next.js and React.

Backend: Java Spring Boot with Spring Security.

Database: PostgreSQL.

Authentication: JWT.

Observed issue:

The Manager dashboard makes a request to:

http://localhost:8080/api/documents

The request returns HTTP 400 Bad Request.

As a result, the frontend cannot reliably load the document list.

Investigation instructions:

Locate the controller method handling GET /api/documents.

Check whether the endpoint requires query parameters such as projectId, category, or pagination values.

Compare the frontend request with the controller's actual method signature.

Inspect Spring Boot logs for missing parameters, invalid values, binding errors, or validation failures.

Check whether the frontend is sending undefined, null, or incorrectly formatted parameter values.

Verify that the frontend uses the correct HTTP method and API base URL.

Inspect the response body to identify the exact validation failure.

Review JWT authentication and authorization separately from request validation.

Identify the root cause before proposing code changes.

Apply the smallest correction and explain why it resolves the error.

Security constraints:

Do not remove required parameters simply to bypass validation.

Do not disable Spring Security or authorization checks.

Do not expose all documents when a project identifier is missing.

Do not trust client-supplied user IDs as proof of ownership.

Preserve Manager project ownership and Workshop Member document permissions.

Return safe, understandable error responses without exposing internal database details.

Add regression tests for valid, missing, and malformed request parameters.

Explain the investigation process, confirmed root cause, necessary changes, and verification steps.

3. What AI Produced

The proposed AI-assisted debugging approach was to compare the frontend API request with the backend controller's expected parameters.

It focused on inspecting request mappings, required query parameters, parameter types, and the server's error response.

The approach also separated HTTP request-validation failures from authentication and authorization failures.

For example, an HTTP 400 response may indicate invalid request input, whereas authentication and authorization failures commonly result in HTTP 401 or 403 responses.

This is a retrospective summary of the intended debugging approach. The original AI output and actual fix must be verified before submission.

4. What Went Wrong

The observed problem was that the document API returned HTTP 400.

One possible explanation is a mismatch between the frontend request and the backend controller's expected parameters.

For example, consider this illustrative controller:

@GetMapping("/api/documents")
public ResponseEntity<?> getDocuments(
        @RequestParam Long projectId) {

    return ResponseEntity.ok(
        documentService.getDocuments(projectId));
}

If the frontend sends:

fetch("http://localhost:8080/api/documents");

without the required projectId, Spring Boot may reject the request with HTTP 400.

However, this is only one possible cause. The actual error could also involve malformed parameters, request binding, validation, or another controller-level issue.

Important: The controller and frontend examples above are illustrative. They are not verified excerpts from the TrustVault repository, and the exact root cause has not been established here.

5. My Correction and Refined Instructions

I refined the debugging requirements to ensure the API contract was corrected without creating a security vulnerability.

The intended steps were:

Inspect the exact browser Network request.

Read the backend's HTTP 400 response body.

Check the Spring Boot console for the corresponding error.

Compare frontend parameters with the controller method signature.

Verify that required parameters are present and correctly formatted.

Validate project IDs and other request inputs.

Confirm that the authenticated Manager is authorized to access the requested project.

Avoid replacing restricted document queries with unrestricted database queries.

Update the frontend or backend contract only after identifying the cause.

Retest both valid requests and unauthorized access attempts.

The main requirement was that fixing a functional API error must not weaken document-level security.

6. Example Debugging and Correction

The following example illustrates how a frontend request might supply a required project identifier:

const response = await fetch(
  `${API_BASE_URL}/api/documents?projectId=${encodeURIComponent(projectId)}`,
  {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
);

if (!response.ok) {
  throw new Error(
    `Document request failed: ${response.status}`
  );
}

This example is appropriate only if the actual backend API requires projectId as a query parameter.

The backend must still validate the project and authorize the authenticated user before returning documents.

A simplified authorization-aware service flow could be:

public List<DocumentDto> getProjectDocuments(
        Long projectId,
        User currentUser) {

    projectSecurity.requireManagerAccess(
        currentUser,
        projectId);

    return documentRepository
        .findByProjectId(projectId)
        .stream()
        .map(documentMapper::toDto)
        .toList();
}

T


