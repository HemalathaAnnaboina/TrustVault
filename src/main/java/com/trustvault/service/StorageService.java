package com.trustvault.service;

import com.trustvault.exception.BadRequestException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;

@Service
public class StorageService {

    private static final Logger log = LoggerFactory.getLogger(StorageService.class);

    private final Path rootLocation;
    private final long maxFileSizeBytes;

    // Allowed extensions
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "pdf", "docx", "xlsx", "pptx", "txt", "png", "jpg", "jpeg", "fig", "csv"
    );

    // Disallowed dangerous extensions explicitly blocked
    private static final Set<String> BLOCKED_EXTENSIONS = Set.of(
            "exe", "bat", "cmd", "sh", "php", "jsp", "asp", "aspx", "cgi", "pl",
            "py", "jar", "war", "vbs", "ps1", "com", "scr", "msi", "dll"
    );

    public StorageService(
            @Value("${trustvault.storage.path:./data/vault}") String storagePath,
            @Value("${trustvault.storage.max-file-size:52428800}") long maxFileSizeBytes
    ) {
        this.rootLocation = Paths.get(storagePath).toAbsolutePath().normalize();
        this.maxFileSizeBytes = maxFileSizeBytes;
        try {
            Files.createDirectories(this.rootLocation);
        } catch (IOException e) {
            throw new RuntimeException("Could not initialize storage directory", e);
        }
    }

    public record StorageResult(
            String storageKey,
            String sha256Checksum,
            long sizeBytes,
            String validatedContentType
    ) {}

    /**
     * Stores an uploaded multipart file after comprehensive security validations:
     * - Path traversal prevention
     * - Extension whitelist & dangerous extension blacklist
     * - File size limits
     * - Magic bytes / signature verification
     * - SHA-256 calculation
     * - Private UUID storage key generation
     */
    public StorageResult store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Uploaded file is empty");
        }

        if (file.getSize() > maxFileSizeBytes) {
            throw new BadRequestException("File size exceeds maximum allowed size (" + (maxFileSizeBytes / (1024 * 1024)) + " MB)");
        }

        String rawFilename = file.getOriginalFilename();
        if (rawFilename == null || rawFilename.isBlank()) {
            throw new BadRequestException("Filename cannot be blank");
        }

        // Prevent path traversal on incoming filename
        if (rawFilename.contains("..") || rawFilename.contains("/") || rawFilename.contains("\\") || rawFilename.contains("\0")) {
            throw new BadRequestException("Filename contains invalid or dangerous path traversal characters");
        }

        String cleanedFilename = Paths.get(rawFilename).getFileName().toString();

        // Validate extension
        String extension = getFileExtension(cleanedFilename).toLowerCase();
        if (BLOCKED_EXTENSIONS.contains(extension)) {
            throw new BadRequestException("Dangerous file extension rejected: ." + extension);
        }
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new BadRequestException("Unsupported file type: ." + extension + ". Allowed: PDF, DOCX, XLSX, PPTX, TXT, PNG, JPG, FIG, CSV");
        }

        try (InputStream inputStream = file.getInputStream()) {
            byte[] fileBytes = inputStream.readAllBytes();

            // Validate magic bytes for common formats
            validateMagicBytes(fileBytes, extension);

            // Compute SHA-256
            String checksum = computeSha256(fileBytes);

            // Generate private UUID storage key
            String storageKey = UUID.randomUUID().toString();
            Path destinationFile = this.rootLocation.resolve(storageKey).normalize();

            // Prevent path traversal outside root
            if (!destinationFile.getParent().equals(this.rootLocation)) {
                throw new BadRequestException("Cannot store file outside current storage directory");
            }

            Files.write(destinationFile, fileBytes, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

            String detectedContentType = file.getContentType();
            if (detectedContentType == null || detectedContentType.isBlank()) {
                detectedContentType = "application/octet-stream";
            }

            return new StorageResult(storageKey, checksum, fileBytes.length, detectedContentType);
        } catch (IOException e) {
            log.error("Failed to store file securely", e);
            throw new RuntimeException("Failed to store file securely", e);
        }
    }

    /**
     * Loads a file as a Spring Resource from the private vault.
     */
    public Resource loadAsResource(String storageKey) {
        try {
            if (storageKey == null || storageKey.contains("/") || storageKey.contains("\\") || storageKey.contains("..")) {
                throw new BadRequestException("Invalid storage key format");
            }

            Path file = rootLocation.resolve(storageKey).normalize();
            if (!file.getParent().equals(this.rootLocation)) {
                throw new BadRequestException("Invalid storage path access");
            }

            Resource resource = new UrlResource(file.toUri());
            if (resource.exists() && resource.isReadable()) {
                return resource;
            } else {
                throw new BadRequestException("File not found in storage vault");
            }
        } catch (Exception e) {
            throw new BadRequestException("Could not read file from storage vault");
        }
    }

    /**
     * Deletes a file from the private vault.
     */
    public void delete(String storageKey) {
        if (storageKey == null) return;
        try {
            Path file = rootLocation.resolve(storageKey).normalize();
            if (file.getParent().equals(this.rootLocation)) {
                Files.deleteIfExists(file);
            }
        } catch (IOException e) {
            log.warn("Failed to delete file from vault with key: {}", storageKey);
        }
    }

    /**
     * Stores byte array (e.g. edited text content) securely in the private storage vault.
     */
    public StorageResult storeBytes(byte[] fileBytes, String filename, String contentType) {
        if (fileBytes == null) {
            throw new BadRequestException("File content cannot be null");
        }
        if (fileBytes.length > maxFileSizeBytes) {
            throw new BadRequestException("Content size exceeds maximum allowed size");
        }

        String checksum = computeSha256(fileBytes);
        String storageKey = UUID.randomUUID().toString();
        Path destinationFile = this.rootLocation.resolve(storageKey).normalize();

        try {
            Files.write(destinationFile, fileBytes, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            return new StorageResult(storageKey, checksum, fileBytes.length, contentType != null ? contentType : "text/plain");
        } catch (IOException e) {
            log.error("Failed to store updated bytes securely in vault", e);
            throw new RuntimeException("Failed to store updated bytes securely in vault", e);
        }
    }

    private void validateMagicBytes(byte[] bytes, String extension) {
        if (bytes == null || bytes.length < 4) {
            throw new BadRequestException("File is empty or too small to be valid");
        }

        // PDF: %PDF (0x25 0x50 0x44 0x46)
        if ("pdf".equals(extension)) {
            if (bytes[0] != 0x25 || bytes[1] != 0x50 || bytes[2] != 0x44 || bytes[3] != 0x46) {
                throw new BadRequestException("File content does not match valid PDF signature");
            }
        }
        // PNG: \x89PNG
        else if ("png".equals(extension)) {
            if ((bytes[0] & 0xFF) != 0x89 || bytes[1] != 0x50 || bytes[2] != 0x4E || bytes[3] != 0x47) {
                throw new BadRequestException("File content does not match valid PNG signature");
            }
        }
        // ZIP-based Office formats (DOCX, XLSX, PPTX): PK\x03\x04
        else if ("docx".equals(extension) || "xlsx".equals(extension) || "pptx".equals(extension)) {
            if (bytes[0] != 0x50 || bytes[1] != 0x4B || bytes[2] != 0x03 || bytes[3] != 0x04) {
                throw new BadRequestException("File content does not match valid Office OpenXML signature");
            }
        }
        // JPEG: FF D8 FF
        else if ("jpg".equals(extension) || "jpeg".equals(extension)) {
            if ((bytes[0] & 0xFF) != 0xFF || (bytes[1] & 0xFF) != 0xD8 || (bytes[2] & 0xFF) != 0xFF) {
                throw new BadRequestException("File content does not match valid JPEG signature");
            }
        }
    }

    private String getFileExtension(String filename) {
        int dotIndex = filename.lastIndexOf('.');
        return (dotIndex == -1 || dotIndex == filename.length() - 1) ? "" : filename.substring(dotIndex + 1);
    }

    private String computeSha256(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data);
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }
}
