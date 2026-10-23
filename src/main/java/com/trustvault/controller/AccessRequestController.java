package com.trustvault.controller;

import com.trustvault.dto.AccessRequestDtos.*;
import com.trustvault.model.User;
import com.trustvault.security.SecurityUtils;
import com.trustvault.service.AccessRequestService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping({"/api/requests", "/api/access-requests"})
public class AccessRequestController {

    private final AccessRequestService accessRequestService;

    public AccessRequestController(AccessRequestService accessRequestService) {
        this.accessRequestService = accessRequestService;
    }

    @PostMapping
    public ResponseEntity<AccessRequestDto> createRequest(
            @Valid @RequestBody CreateAccessRequest request,
            HttpServletRequest httpRequest
    ) {
        User requester = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(accessRequestService.createRequest(request, requester, httpRequest));
    }

    @GetMapping("/owner")
    public ResponseEntity<List<AccessRequestDto>> getRequestsForOwner() {
        User owner = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(accessRequestService.getRequestsForOwner(owner));
    }

    @GetMapping("/my")
    public ResponseEntity<List<AccessRequestDto>> getMyRequests() {
        User requester = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(accessRequestService.getMyRequests(requester));
    }

    @PostMapping("/{id}/review")
    public ResponseEntity<AccessRequestDto> reviewRequest(
            @PathVariable UUID id,
            @RequestBody ReviewAccessRequest review,
            HttpServletRequest httpRequest
    ) {
        User reviewer = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(accessRequestService.reviewRequest(id, review, reviewer, httpRequest));
    }
}
