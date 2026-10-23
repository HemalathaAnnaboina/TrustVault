package com.trustvault.controller;

import com.trustvault.dto.DocumentDtos.*;
import com.trustvault.model.User;
import com.trustvault.security.SecurityUtils;
import com.trustvault.service.DocumentService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    private final DocumentService documentService;

    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
    }

    @GetMapping
    public ResponseEntity<List<DocumentDto>> getDocuments(
            @RequestParam(value = "query", required = false) String query,
            @RequestParam(value = "projectId", required = false) UUID projectId
    ) {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(documentService.getDocumentsForUser(currentUser, query, projectId));
    }

    @PostMapping(value = {"", "/upload"}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DocumentDto> uploadDocument(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "projectId", required = false) UUID projectId,
            HttpServletRequest httpRequest
    ) {
        User currentUser = SecurityUtils.getCurrentUser();
        DocumentDto dto = documentService.uploadDocument(file, title, category, projectId, currentUser, httpRequest);
        return ResponseEntity.ok(dto);
    }

    @PostMapping(value = "/multi", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<List<DocumentDto>> uploadMultipleDocuments(
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam(value = "folderName", required = false) String folderName,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "projectId", required = false) UUID projectId,
            HttpServletRequest httpRequest
    ) {
        User currentUser = SecurityUtils.getCurrentUser();
        List<DocumentDto> dtos = documentService.uploadMultipleDocuments(files, folderName, category, projectId, currentUser, httpRequest);
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/starred")
    public ResponseEntity<List<DocumentDto>> getStarredDocuments() {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(documentService.getStarredDocuments(currentUser));
    }

    @GetMapping("/recent")
    public ResponseEntity<List<DocumentDto>> getRecentDocuments() {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(documentService.getRecentDocuments(currentUser));
    }

    @GetMapping("/{id}")
    public ResponseEntity<DocumentDto> getDocument(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(documentService.getDocumentMetadata(id, currentUser, httpRequest));
    }

    @PutMapping("/{id}")
    public ResponseEntity<DocumentDto> updateDocument(
            @PathVariable UUID id,
            @RequestBody DocumentUpdateRequest request,
            HttpServletRequest httpRequest
    ) {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(documentService.updateDocument(id, request, currentUser, httpRequest));
    }

    @PostMapping("/{id}/star")
    public ResponseEntity<DocumentDto> starDocument(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(documentService.starDocument(id, currentUser, httpRequest));
    }

    @DeleteMapping("/{id}/star")
    public ResponseEntity<DocumentDto> unstarDocument(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(documentService.unstarDocument(id, currentUser, httpRequest));
    }

    @GetMapping("/{id}/versions")
    public ResponseEntity<List<DocumentVersionDto>> getDocumentVersions(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(documentService.getDocumentVersions(id, currentUser, httpRequest));
    }

    @GetMapping("/{id}/preview")
    public ResponseEntity<DocumentPreviewDto> getDocumentPreview(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(documentService.getDocumentPreview(id, currentUser, httpRequest));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDocument(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        User currentUser = SecurityUtils.getCurrentUser();
        documentService.deleteDocument(id, currentUser, httpRequest);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/download-token")
    public ResponseEntity<DownloadTokenResponse> getDownloadToken(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        User currentUser = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(documentService.createDownloadToken(id, currentUser, httpRequest));
    }

    @GetMapping("/download/{token}")
    public ResponseEntity<Resource> downloadFile(
            @PathVariable String token,
            HttpServletRequest httpRequest
    ) {
        DocumentService.DownloadPayload payload = documentService.downloadFileByToken(token, httpRequest);

        String encodedFilename = URLEncoder.encode(payload.filename(), StandardCharsets.UTF_8).replace("+", "%20");

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(payload.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + encodedFilename + "\"; filename*=UTF-8''" + encodedFilename)
                .body(payload.resource());
    }
}
