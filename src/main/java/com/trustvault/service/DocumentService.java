package com.trustvault.service;

import com.trustvault.dto.DocumentDtos.*;
import com.trustvault.exception.BadRequestException;
import com.trustvault.exception.ForbiddenException;
import com.trustvault.exception.ResourceNotFoundException;
import com.trustvault.model.*;
import com.trustvault.repository.*;
import com.trustvault.security.DocumentAuthorizationService;
import com.trustvault.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.*;

@Service
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final DocumentPermissionRepository permissionRepository;
    private final DownloadTokenRepository downloadTokenRepository;
    private final AccessRequestRepository accessRequestRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;
    private final DocumentAuthorizationService authorizationService;
    private final AuditService auditService;
    private final StarredDocumentRepository starredDocumentRepository;
    private final DocumentVersionRepository documentVersionRepository;
    private final AuditLogRepository auditLogRepository;
    private final ClientRepository clientRepository;
    private final long downloadTokenValiditySeconds;

    public DocumentService(
            DocumentRepository documentRepository,
            ProjectRepository projectRepository,
            ProjectMemberRepository projectMemberRepository,
            DocumentPermissionRepository permissionRepository,
            DownloadTokenRepository downloadTokenRepository,
            AccessRequestRepository accessRequestRepository,
            UserRepository userRepository,
            StorageService storageService,
            DocumentAuthorizationService authorizationService,
            AuditService auditService,
            StarredDocumentRepository starredDocumentRepository,
            DocumentVersionRepository documentVersionRepository,
            AuditLogRepository auditLogRepository,
            ClientRepository clientRepository,
            @Value("${trustvault.download-token.expiration-seconds:60}") long downloadTokenValiditySeconds
    ) {
        this.documentRepository = documentRepository;
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.permissionRepository = permissionRepository;
        this.downloadTokenRepository = downloadTokenRepository;
        this.accessRequestRepository = accessRequestRepository;
        this.userRepository = userRepository;
        this.storageService = storageService;
        this.authorizationService = authorizationService;
        this.auditService = auditService;
        this.starredDocumentRepository = starredDocumentRepository;
        this.documentVersionRepository = documentVersionRepository;
        this.auditLogRepository = auditLogRepository;
        this.clientRepository = clientRepository;
        this.downloadTokenValiditySeconds = downloadTokenValiditySeconds;
    }

    @Transactional
    public DocumentDto uploadDocument(
            MultipartFile file,
            String title,
            String category,
            UUID projectId,
            User uploader,
            HttpServletRequest httpRequest
    ) {
        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        Project project = null;
        if (projectId != null) {
            project = projectRepository.findById(projectId).orElse(null);
        }

        validateUploadAuthorization(uploader, project, httpRequest);

        if (title == null || title.isBlank()) {
            title = file.getOriginalFilename();
        }

        // Store file in private vault with magic bytes validation and SHA-256 calculation
        StorageService.StorageResult storageResult;
        try {
            storageResult = storageService.store(file);
        } catch (BadRequestException e) {
            auditService.logEvent(uploader, AuditAction.MALFORMED_UPLOAD_REJECTED, "DOCUMENT", null,
                    AuditResult.DENIED, "Upload rejected: " + e.getMessage(), clientIp, userAgent);
            throw e;
        }

        Document document = new Document(
                title.trim(),
                file.getOriginalFilename(),
                storageResult.storageKey(),
                storageResult.validatedContentType(),
                storageResult.sizeBytes(),
                storageResult.sha256Checksum(),
                category != null ? category.trim() : "General",
                uploader,
                project
        );
        if (uploader.getClient() != null) {
            UUID cid = uploader.getClient().getId();
            if (cid != null) {
                clientRepository.findById(cid).ifPresent(document::setClient);
            }
        }

        Document saved = documentRepository.save(document);

        DocumentVersion initialVersion = new DocumentVersion(
                saved, 1, saved.getTitle(), saved.getStorageKey(),
                saved.getContentType(), saved.getFileSizeBytes(), saved.getSha256Checksum(),
                "Initial document upload", uploader
        );
        documentVersionRepository.save(initialVersion);

        auditService.logEvent(uploader, AuditAction.DOCUMENT_UPLOAD, "DOCUMENT", saved.getId().toString(),
                AuditResult.SUCCESS, "Uploaded document: " + saved.getTitle() + " (" + formatFileSize(saved.getFileSizeBytes()) + ")",
                clientIp, userAgent);

        return mapToDto(saved, uploader);
    }

    @Transactional
    public List<DocumentDto> uploadMultipleDocuments(
            List<MultipartFile> files,
            String folderName,
            String category,
            UUID projectId,
            User uploader,
            HttpServletRequest httpRequest
    ) {
        if (files == null || files.isEmpty()) {
            throw new BadRequestException("At least one file must be selected for upload");
        }

        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        Project project = null;
        if (projectId != null) {
            project = projectRepository.findById(projectId).orElse(null);
        }

        validateUploadAuthorization(uploader, project, httpRequest);

        List<DocumentDto> results = new ArrayList<>();
        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                continue;
            }

            StorageService.StorageResult storageResult;
            try {
                storageResult = storageService.store(file);
            } catch (BadRequestException e) {
                auditService.logEvent(uploader, AuditAction.MALFORMED_UPLOAD_REJECTED, "DOCUMENT", null,
                        AuditResult.DENIED, "Upload rejected for " + file.getOriginalFilename() + ": " + e.getMessage(), clientIp, userAgent);
                throw e;
            }

            String title = file.getOriginalFilename();
            Document document = new Document(
                    title,
                    file.getOriginalFilename(),
                    storageResult.storageKey(),
                    storageResult.validatedContentType(),
                    storageResult.sizeBytes(),
                    storageResult.sha256Checksum(),
                    category != null && !category.isBlank() ? category.trim() : "General",
                    uploader,
                    project
            );

            if (folderName != null && !folderName.isBlank()) {
                document.setFolderName(folderName.trim());
            }
            if (uploader.getClient() != null) {
                UUID cid = uploader.getClient().getId();
                if (cid != null) {
                    clientRepository.findById(cid).ifPresent(document::setClient);
                }
            }

            Document saved = documentRepository.save(document);

            DocumentVersion initialVersion = new DocumentVersion(
                    saved, 1, saved.getTitle(), saved.getStorageKey(),
                    saved.getContentType(), saved.getFileSizeBytes(), saved.getSha256Checksum(),
                    "Batch uploaded file" + (folderName != null ? " in folder [" + folderName + "]" : ""),
                    uploader
            );
            documentVersionRepository.save(initialVersion);

            auditService.logEvent(uploader, AuditAction.DOCUMENT_UPLOAD, "DOCUMENT", saved.getId().toString(),
                    AuditResult.SUCCESS, "Batch uploaded file" + (folderName != null ? " in folder [" + folderName + "]" : "") + ": " + saved.getTitle(),
                    clientIp, userAgent);

            results.add(mapToDto(saved, uploader));
        }

        if (results.isEmpty()) {
            throw new BadRequestException("No valid non-empty files were provided in the upload batch");
        }

        return results;
    }

    private void validateUploadAuthorization(User uploader, Project project, HttpServletRequest httpRequest) {
        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        if (uploader == null || !uploader.isActive()) {
            auditService.logEvent(uploader, AuditAction.INACTIVE_USER_ACCESS_ATTEMPT, "DOCUMENT", null,
                    AuditResult.DENIED, "Upload rejected: Account is inactive", clientIp, userAgent);
            throw new ForbiddenException("Your account is deactivated. Contact your administrator.");
        }

        // Project must be specified for non-admin/non-manager users (Workshop members / Viewers)
        if (project == null) {
            if (uploader.isAdmin() || uploader.isManager() || uploader.getRole() == Role.ROLE_OWNER) {
                return;
            }
            auditService.logEvent(uploader, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "DOCUMENT", null,
                    AuditResult.DENIED, "Upload rejected: Viewers cannot upload documents without an authorized project", clientIp, userAgent);
            throw new ForbiddenException("Access denied: Viewers are not permitted to upload documents");
        }

        // Tenant isolation
        if (uploader.getClient() != null && project.getClient() != null && !uploader.getClient().getId().equals(project.getClient().getId())) {
            auditService.logEvent(uploader, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "DOCUMENT", null,
                    AuditResult.DENIED, "Upload rejected: Project belongs to another client", clientIp, userAgent);
            throw new ForbiddenException("Access denied: Project does not belong to your organization");
        }

        // Check if uploader is project owner or system admin
        boolean isOwner = project.getOwner() != null && project.getOwner().getId().equals(uploader.getId());
        if (isOwner || uploader.isAdmin()) {
            return;
        }

        // For workshop members / contributors, verify project membership
        Optional<ProjectMember> memberOpt = projectMemberRepository.findByProjectAndUser(project, uploader);
        if (memberOpt.isEmpty()) {
            auditService.logEvent(uploader, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "DOCUMENT", null,
                    AuditResult.DENIED, "Upload rejected: User not a member of project " + project.getName(), clientIp, userAgent);
            throw new ForbiddenException("Access denied: You are not an authorized member of project " + project.getName());
        }

        ProjectMember member = memberOpt.get();
        if (member.isSuspended()) {
            throw new ForbiddenException("Access denied: Your membership in project " + project.getName() + " is suspended");
        }

        // Member must have Editor (canEdit=true) permissions to upload documents to the project
        if (!member.isCanEdit()) {
            auditService.logEvent(uploader, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "DOCUMENT", null,
                    AuditResult.DENIED, "Upload rejected: Viewer role in project " + project.getName(), clientIp, userAgent);
            throw new ForbiddenException("Access denied: You only have Viewer permissions in project " + project.getName() + " and cannot upload documents");
        }
    }

    @Transactional(readOnly = true)
    public List<DocumentDto> getDocumentsForUser(User user, String query) {
        return getDocumentsForUser(user, query, null, null);
    }

    @Transactional(readOnly = true)
    public List<DocumentDto> getDocumentsForUser(User user, String query, UUID projectId) {
        return getDocumentsForUser(user, query, projectId, null);
    }

    @Transactional(readOnly = true)
    public List<DocumentDto> getDocumentsForUser(User user, String query, UUID projectId, HttpServletRequest httpRequest) {
        String clientIp = httpRequest != null ? SecurityUtils.getClientIp(httpRequest) : null;
        String userAgent = httpRequest != null ? SecurityUtils.getUserAgent(httpRequest) : null;

        if (user == null || !user.isActive()) {
            auditService.logEvent(user, AuditAction.INACTIVE_USER_ACCESS_ATTEMPT, "DOCUMENT", null,
                    AuditResult.DENIED, "Document list rejected: Account is inactive", clientIp, userAgent);
            throw new ForbiddenException("Your account is deactivated. Contact your administrator.");
        }

        if (projectId != null) {
            Project project = projectRepository.findById(projectId)
                    .orElseThrow(() -> new ResourceNotFoundException("Project not found with ID: " + projectId));

            // Tenant isolation
            if (user.getClient() != null && project.getClient() != null && !user.getClient().getId().equals(project.getClient().getId())) {
                auditService.logEvent(user, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "PROJECT", project.getId().toString(),
                        AuditResult.DENIED, "Access denied: Project belongs to another client", clientIp, userAgent);
                throw new ForbiddenException("Access denied: Project belongs to another client");
            }

            boolean isProjectOwner = project.getOwner() != null && project.getOwner().getId().equals(user.getId());
            boolean isAdmin = user.isAdmin();

            if (!isProjectOwner && !isAdmin) {
                Optional<ProjectMember> memberOpt = projectMemberRepository.findByProjectAndUser(project, user);
                if (memberOpt.isEmpty()) {
                    auditService.logEvent(user, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "PROJECT", project.getId().toString(),
                            AuditResult.DENIED, "Access denied: Not a member of project " + project.getName(), clientIp, userAgent);
                    throw new ForbiddenException("Access denied: You are not authorized to view documents in this project");
                }
                ProjectMember member = memberOpt.get();
                if (member.isSuspended()) {
                    auditService.logEvent(user, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "PROJECT", project.getId().toString(),
                            AuditResult.DENIED, "Access denied: Project membership is suspended for project " + project.getName(), clientIp, userAgent);
                    throw new ForbiddenException("Access denied: Your project membership has been suspended");
                }
                if (!member.isCanView()) {
                    auditService.logEvent(user, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "PROJECT", project.getId().toString(),
                            AuditResult.DENIED, "Access denied: No view permission for project " + project.getName(), clientIp, userAgent);
                    throw new ForbiddenException("Access denied: You do not have view access to this project");
                }
            }

            List<Document> projectDocs = documentRepository.findByProject(project);
            if (query != null && !query.isBlank()) {
                String q = query.trim().toLowerCase();
                projectDocs = projectDocs.stream().filter(d -> (d.getTitle() != null && d.getTitle().toLowerCase().contains(q)) || (d.getCategory() != null && d.getCategory().toLowerCase().contains(q))).toList();
            }
            return projectDocs.stream().map(d -> mapToDto(d, user)).toList();
        }

        List<Document> docs;

        if (user.getRole() == Role.ROLE_ADMIN) {
            docs = (query != null && !query.isBlank()) ?
                    documentRepository.searchDocuments(query.trim()) :
                    documentRepository.findAll();
        } else if (user.getRole() == Role.ROLE_OWNER || user.getRole() == Role.ROLE_EDITOR || user.getRole() == Role.ROLE_WORKSHOP) {
            // Owner, Editor, Workshop see owned docs + docs explicitly shared with them
            Set<Document> docSet = new LinkedHashSet<>(documentRepository.findByOwnerOrderByCreatedAtDesc(user));
            docSet.addAll(documentRepository.findDocumentsAccessibleByUser(user));
            docs = new ArrayList<>(docSet);
        } else {
            // Viewer only discovers documents where active, valid permission exists
            docs = documentRepository.findDocumentsAccessibleByUser(user);
        }

        if (user.getRole() != Role.ROLE_ADMIN) {
            docs = docs.stream()
                    .filter(d -> authorizationService.hasActiveAccess(user, d))
                    .toList();
        }

        if (query != null && !query.isBlank()) {
            String q = query.trim().toLowerCase();
            docs = docs.stream().filter(d -> (d.getTitle() != null && d.getTitle().toLowerCase().contains(q)) || (d.getCategory() != null && d.getCategory().toLowerCase().contains(q))).toList();
        }

        return docs.stream().map(d -> mapToDto(d, user)).toList();
    }

    @Transactional(readOnly = true)
    public DocumentDto getDocumentMetadata(UUID documentId, User user, HttpServletRequest httpRequest) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found"));

        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        // Verify access: owner, active permission, or admin
        if (!authorizationService.isDocumentOwner(user, document) && user.getRole() != Role.ROLE_ADMIN) {
            try {
                authorizationService.requireReadAccess(user, document);
            } catch (ForbiddenException e) {
                auditService.logEvent(user, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "DOCUMENT", documentId.toString(),
                        AuditResult.DENIED, "Attempted to view metadata of unauthorized document: " + e.getMessage(), clientIp, userAgent);
                throw e;
            }
        }

        auditService.logEvent(user, AuditAction.DOCUMENT_VIEW, "DOCUMENT", documentId.toString(),
                AuditResult.SUCCESS, "Viewed metadata for document: " + document.getTitle(), clientIp, userAgent);

        return mapToDto(document, user);
    }

    @Transactional
    public DocumentDto updateDocument(UUID documentId, DocumentUpdateRequest request, User user, HttpServletRequest httpRequest) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found"));

        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        try {
            authorizationService.requireEditAccess(user, document);
        } catch (ForbiddenException e) {
            auditService.logEvent(user, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "DOCUMENT", documentId.toString(),
                    AuditResult.DENIED, "Edit denied: " + e.getMessage(), clientIp, userAgent);
            throw e;
        }

        if (request.expectedVersion() != null && document.getVersion() != request.expectedVersion()) {
            auditService.logEvent(user, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "DOCUMENT", documentId.toString(),
                    AuditResult.DENIED, "Concurrent edit conflict: Document version is " + document.getVersion() + " but request expected " + request.expectedVersion(), clientIp, userAgent);
            throw new com.trustvault.exception.ConflictException("Conflict: Document version mismatch. Expected " + request.expectedVersion() + " but current is " + document.getVersion());
        }

        if (request.title() != null && !request.title().isBlank()) {
            document.setTitle(request.title().trim());
        }
        if (request.category() != null && !request.category().isBlank()) {
            document.setCategory(request.category().trim());
        }

        if (request.content() != null) {
            byte[] contentBytes = request.content().getBytes(java.nio.charset.StandardCharsets.UTF_8);
            StorageService.StorageResult storageResult = storageService.storeBytes(contentBytes, document.getOriginalFilename(), document.getContentType());
            document.setStorageKey(storageResult.storageKey());
            document.setSha256Checksum(storageResult.sha256Checksum());
            document.setFileSizeBytes(storageResult.sizeBytes());
        }

        int nextVersion = document.getVersion() + 1;
        document.setVersion(nextVersion);

        Document updated = documentRepository.save(document);

        DocumentVersion versionRecord = new DocumentVersion(
                updated,
                nextVersion,
                updated.getTitle(),
                updated.getStorageKey(),
                updated.getContentType(),
                updated.getFileSizeBytes(),
                updated.getSha256Checksum(),
                request.changeSummary() != null && !request.changeSummary().isBlank() ? request.changeSummary() : "Updated document",
                user
        );
        documentVersionRepository.save(versionRecord);

        auditService.logEvent(user, AuditAction.DOCUMENT_UPDATE, "DOCUMENT", documentId.toString(),
                AuditResult.SUCCESS, "Updated document: " + updated.getTitle() + " to version " + nextVersion, clientIp, userAgent);

        return mapToDto(updated, user);
    }

    @Transactional
    public void deleteDocument(UUID documentId, User user, HttpServletRequest httpRequest) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found"));

        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        try {
            authorizationService.requireManagementAccess(user, document);
        } catch (ForbiddenException e) {
            auditService.logEvent(user, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "DOCUMENT", documentId.toString(),
                    AuditResult.DENIED, "Delete denied: " + e.getMessage(), clientIp, userAgent);
            throw e;
        }

        // Delete physical file from vault
        storageService.delete(document.getStorageKey());

        // Remove related permissions and requests
        permissionRepository.deleteByDocument(document);
        accessRequestRepository.deleteByDocument(document);
        documentRepository.delete(document);

        auditService.logEvent(user, AuditAction.DOCUMENT_DELETE, "DOCUMENT", documentId.toString(),
                AuditResult.SUCCESS, "Deleted document: " + document.getTitle(), clientIp, userAgent);
    }

    @Transactional
    public DownloadTokenResponse createDownloadToken(UUID documentId, User user, HttpServletRequest httpRequest) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found"));

        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        try {
            authorizationService.requireDownloadAccess(user, document);
        } catch (ForbiddenException e) {
            auditService.logEvent(user, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "DOCUMENT", documentId.toString(),
                    AuditResult.DENIED, "Download token denied: " + e.getMessage(), clientIp, userAgent);
            throw e;
        }

        String tokenString = UUID.randomUUID().toString();
        Instant expiresAt = Instant.now().plusSeconds(downloadTokenValiditySeconds);

        DownloadToken token = new DownloadToken(tokenString, document.getId(), user.getId(), expiresAt);
        downloadTokenRepository.save(token);

        return new DownloadTokenResponse(tokenString, "/api/documents/download/" + tokenString, expiresAt);
    }

    @Transactional
    public DownloadPayload downloadFileByToken(String tokenString, HttpServletRequest httpRequest) {
        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        DownloadToken token = downloadTokenRepository.findByTokenValue(tokenString).orElse(null);
        if (token == null) {
            auditService.logEvent(null, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "DOCUMENT", null,
                    AuditResult.DENIED, "Download rejected: Invalid or unknown download token", clientIp, userAgent);
            throw new BadRequestException("Invalid or expired download token");
        }

        if (!token.isValid()) {
            auditService.logEvent(null, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "DOCUMENT", token.getDocumentId() != null ? token.getDocumentId().toString() : null,
                    AuditResult.DENIED, "Download token is expired or has already been used", clientIp, userAgent);
            throw new BadRequestException("Download token is expired or has already been used");
        }

        Document document = documentRepository.findById(token.getDocumentId())
                .orElseThrow(() -> new ResourceNotFoundException("Document no longer exists"));

        // Re-validate user account status and current permission grant
        User tokenUser = userRepository.findById(token.getUserId())
                .orElseThrow(() -> new ForbiddenException("User associated with download token no longer exists"));


        if (!tokenUser.isActive()) {
            auditService.logEvent(tokenUser, AuditAction.INACTIVE_USER_ACCESS_ATTEMPT, "DOCUMENT", document.getId().toString(),
                    AuditResult.DENIED, "Download token rejected: Account is deactivated", clientIp, userAgent);
            throw new ForbiddenException("Your account is deactivated. Contact your administrator.");
        }

        try {
            authorizationService.requireDownloadAccess(tokenUser, document);
        } catch (ForbiddenException e) {
            auditService.logEvent(tokenUser, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "DOCUMENT", document.getId().toString(),
                    AuditResult.DENIED, "Download token denied: " + e.getMessage(), clientIp, userAgent);
            throw e;
        }

        // Single-use token: invalidate immediately
        token.setUsed(true);
        downloadTokenRepository.save(token);

        // Load file resource from vault
        Resource resource = storageService.loadAsResource(document.getStorageKey());

        auditService.logEvent(tokenUser, AuditAction.DOCUMENT_DOWNLOAD, "DOCUMENT", document.getId().toString(),
                AuditResult.SUCCESS, "File downloaded via token: " + document.getOriginalFilename(), clientIp, userAgent);

        return new DownloadPayload(resource, document.getOriginalFilename(), document.getContentType());
    }

    public record DownloadPayload(Resource resource, String filename, String contentType) {}

    public DocumentDto mapToDto(Document d, User currentUser) {
        String accessLevel = authorizationService.determineAccessLevel(currentUser, d);
        Instant expiresAt = null;
        boolean isExpiringSoon = false;

        if (currentUser != null && !authorizationService.isDocumentOwner(currentUser, d)) {
            Optional<DocumentPermission> perm = permissionRepository.findByDocumentAndUser(d, currentUser);
            if (perm.isPresent()) {
                expiresAt = perm.get().getExpiresAt();
                if (expiresAt != null) {
                    Instant now = Instant.now();
                    Instant threshold = now.plusSeconds(7 * 24 * 3600); // within 7 days
                    if (expiresAt.isAfter(now) && expiresAt.isBefore(threshold)) {
                        isExpiringSoon = true;
                    }
                }
            }
        }

        boolean isStarred = currentUser != null && starredDocumentRepository.existsByUserAndDocument(currentUser, d);
        UUID clientId = null;
        String clientName = null;
        if (d.getClient() != null) {
            try {
                clientId = d.getClient().getId();
                clientName = d.getClient().getName();
            } catch (Exception e) {
                if (d.getClient().getId() != null) {
                    clientId = d.getClient().getId();
                    clientName = clientRepository.findById(clientId).map(Client::getName).orElse(null);
                }
            }
        }

        boolean canRead = "OWNER".equals(accessLevel) || "EDIT".equals(accessLevel) || "READ".equals(accessLevel);
        boolean canEdit = "OWNER".equals(accessLevel) || "EDIT".equals(accessLevel);

        if (canEdit && d.getProject() != null && currentUser != null && !authorizationService.isDocumentOwner(currentUser, d) && !currentUser.isAdmin()) {
            Optional<ProjectMember> pm = projectMemberRepository.findByProjectIdAndUserId(d.getProject().getId(), currentUser.getId());
            if (pm.isPresent() && !pm.get().isCanEdit()) {
                canEdit = false;
            }
        }

        return new DocumentDto(
                d.getId(),
                d.getTitle(),
                d.getOriginalFilename(),
                d.getCategory(),
                d.getContentType(),
                d.getFileSizeBytes(),
                formatFileSize(d.getFileSizeBytes()),
                d.getSha256Checksum(),
                d.getOwner().getId(),
                d.getOwner().getFullName(),
                d.getOwner().getEmail(),
                d.getProject() != null ? d.getProject().getId() : null,
                d.getProject() != null ? d.getProject().getName() : null,
                accessLevel,
                expiresAt,
                isExpiringSoon,
                d.getCreatedAt(),
                d.getUpdatedAt(),
                d.getVersion(),
                isStarred,
                clientId,
                clientName,
                canRead,
                canEdit
        );
    }

    @Transactional
    public DocumentDto starDocument(UUID documentId, User user, HttpServletRequest httpRequest) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found"));

        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        try {
            authorizationService.requireReadAccess(user, document);
        } catch (ForbiddenException e) {
            auditService.logEvent(user, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "DOCUMENT", documentId.toString(),
                    AuditResult.DENIED, "Star document denied: " + e.getMessage(), clientIp, userAgent);
            throw e;
        }

        if (!starredDocumentRepository.existsByUserAndDocument(user, document)) {
            starredDocumentRepository.save(new StarredDocument(user, document));
        }

        auditService.logEvent(user, AuditAction.DOCUMENT_VIEW, "DOCUMENT", documentId.toString(),
                AuditResult.SUCCESS, "Starred document: " + document.getTitle(), clientIp, userAgent);

        return mapToDto(document, user);
    }

    @Transactional
    public DocumentDto unstarDocument(UUID documentId, User user, HttpServletRequest httpRequest) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found"));

        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        try {
            authorizationService.requireReadAccess(user, document);
        } catch (ForbiddenException e) {
            auditService.logEvent(user, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "DOCUMENT", documentId.toString(),
                    AuditResult.DENIED, "Unstar document denied: " + e.getMessage(), clientIp, userAgent);
            throw e;
        }

        starredDocumentRepository.deleteByUserAndDocument(user, document);

        auditService.logEvent(user, AuditAction.DOCUMENT_VIEW, "DOCUMENT", documentId.toString(),
                AuditResult.SUCCESS, "Unstarred document: " + document.getTitle(), clientIp, userAgent);

        return mapToDto(document, user);
    }

    @Transactional(readOnly = true)
    public List<DocumentDto> getStarredDocuments(User user) {
        List<StarredDocument> starred = starredDocumentRepository.findByUserOrderByStarredAtDesc(user);
        return starred.stream()
                .map(StarredDocument::getDocument)
                .filter(d -> authorizationService.hasActiveAccess(user, d))
                .map(d -> mapToDto(d, user))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<DocumentDto> getRecentDocuments(User user) {
        if (user.getRole() == Role.ROLE_WORKSHOP || user.getRole() == Role.ROLE_VIEWER) {
            Set<Document> accessible = new LinkedHashSet<>(documentRepository.findDocumentsAccessibleByUser(user));
            accessible.addAll(documentRepository.findByOwnerOrderByCreatedAtDesc(user));
            return accessible.stream()
                    .filter(d -> authorizationService.hasActiveAccess(user, d))
                    .sorted((d1, d2) -> {
                        Instant t1 = d1.getUpdatedAt() != null ? d1.getUpdatedAt() : d1.getCreatedAt();
                        Instant t2 = d2.getUpdatedAt() != null ? d2.getUpdatedAt() : d2.getCreatedAt();
                        return t2.compareTo(t1);
                    })
                    .limit(10)
                    .map(d -> mapToDto(d, user))
                    .toList();
        }

        List<AuditLog> userLogs = auditLogRepository.findByActorIdOrderByTimestampDesc(user.getId());
        Set<UUID> seenDocIds = new LinkedHashSet<>();

        for (AuditLog log : userLogs) {
            if ("DOCUMENT".equals(log.getResourceType()) && log.getResourceId() != null
                    && (log.getAction() == AuditAction.DOCUMENT_VIEW
                    || log.getAction() == AuditAction.DOCUMENT_DOWNLOAD
                    || log.getAction() == AuditAction.DOCUMENT_UPDATE
                    || log.getAction() == AuditAction.DOCUMENT_UPLOAD)) {
                try {
                    seenDocIds.add(UUID.fromString(log.getResourceId()));
                } catch (Exception ignored) {}
            }
            if (seenDocIds.size() >= 15) break;
        }

        List<DocumentDto> recents = new ArrayList<>();
        for (UUID docId : seenDocIds) {
            documentRepository.findById(docId).ifPresent(d -> {
                if (authorizationService.hasActiveAccess(user, d)) {
                    recents.add(mapToDto(d, user));
                }
            });
            if (recents.size() >= 10) break;
        }

        return recents;
    }

    @Transactional(readOnly = true)
    public List<DocumentVersionDto> getDocumentVersions(UUID documentId, User user, HttpServletRequest httpRequest) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found"));

        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        try {
            authorizationService.requireReadAccess(user, document);
        } catch (ForbiddenException e) {
            auditService.logEvent(user, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "DOCUMENT", documentId.toString(),
                    AuditResult.DENIED, "Document versions denied: " + e.getMessage(), clientIp, userAgent);
            throw e;
        }

        List<DocumentVersion> versions = documentVersionRepository.findByDocumentOrderByVersionNumberDesc(document);
        return versions.stream().map(v -> new DocumentVersionDto(
                v.getId(),
                document.getId(),
                v.getVersionNumber(),
                v.getTitle(),
                v.getContentType(),
                v.getFileSizeBytes(),
                formatFileSize(v.getFileSizeBytes()),
                v.getSha256Checksum(),
                v.getChangeSummary(),
                v.getCreatedBy().getId(),
                v.getCreatedBy().getFullName(),
                v.getCreatedAt()
        )).toList();
    }

    @Transactional(readOnly = true)
    public DocumentPreviewDto getDocumentPreview(UUID documentId, User user, HttpServletRequest httpRequest) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found"));

        String clientIp = SecurityUtils.getClientIp(httpRequest);
        String userAgent = SecurityUtils.getUserAgent(httpRequest);

        try {
            authorizationService.requireReadAccess(user, document);
        } catch (ForbiddenException e) {
            auditService.logEvent(user, AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT, "DOCUMENT", documentId.toString(),
                    AuditResult.DENIED, "Document preview denied: " + e.getMessage(), clientIp, userAgent);
            throw e;
        }

        auditService.logEvent(user, AuditAction.DOCUMENT_VIEW, "DOCUMENT", documentId.toString(),
                AuditResult.SUCCESS, "Accessed document preview: " + document.getTitle(), clientIp, userAgent);

        String accessLevel = authorizationService.determineAccessLevel(user, document);
        boolean isTextEditable = ("EDIT".equals(accessLevel) || "OWNER".equals(accessLevel));

        String ext = getFileExtension(document.getOriginalFilename()).toLowerCase();
        String ct = document.getContentType() != null ? document.getContentType().toLowerCase() : "";

        boolean isText = ext.equals("txt") || ext.equals("md") || ext.equals("json") || ext.equals("csv")
                || ext.equals("xml") || ext.equals("log") || ext.equals("html") || ext.equals("js")
                || ct.contains("text") || ct.contains("json") || ct.contains("csv");

        boolean isPdf = ext.equals("pdf") || ct.contains("pdf");
        boolean isImage = ext.equals("png") || ext.equals("jpg") || ext.equals("jpeg") || ct.contains("image");

        if (isText) {
            String textContent = "";
            try {
                Resource resource = storageService.loadAsResource(document.getStorageKey());
                try (var is = resource.getInputStream()) {
                    byte[] bytes = is.readNBytes(262144); // Up to 256 KB preview
                    textContent = new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
                }
            } catch (Exception e) {
                textContent = "Preview error: " + e.getMessage();
            }
            return new DocumentPreviewDto(
                    document.getId(),
                    document.getTitle(),
                    document.getOriginalFilename(),
                    document.getContentType(),
                    isTextEditable,
                    true,
                    textContent,
                    null,
                    document.getVersion(),
                    accessLevel
            );
        } else if (isPdf) {
            return new DocumentPreviewDto(
                    document.getId(),
                    document.getTitle(),
                    document.getOriginalFilename(),
                    document.getContentType(),
                    false,
                    true,
                    null,
                    "PDF document preview active. Use authorized single-use download token to view or save full document.",
                    document.getVersion(),
                    accessLevel
            );
        } else if (isImage) {
            return new DocumentPreviewDto(
                    document.getId(),
                    document.getTitle(),
                    document.getOriginalFilename(),
                    document.getContentType(),
                    false,
                    true,
                    null,
                    "Image document preview active. Use authorized single-use download token to inspect high resolution asset.",
                    document.getVersion(),
                    accessLevel
            );
        } else {
            return new DocumentPreviewDto(
                    document.getId(),
                    document.getTitle(),
                    document.getOriginalFilename(),
                    document.getContentType(),
                    false,
                    false,
                    null,
                    "In-browser editing and preview is not supported for binary file type (" + document.getOriginalFilename() + "). Download the file to inspect.",
                    document.getVersion(),
                    accessLevel
            );
        }
    }

    private String getFileExtension(String filename) {
        if (filename == null) return "";
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot + 1) : "";
    }

    private String formatFileSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        int exp = (int) (Math.log(bytes) / Math.log(1024));
        char pre = "KMGTPE".charAt(exp - 1);
        return String.format("%.1f %sB", bytes / Math.pow(1024, exp), pre);
    }
}
