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



