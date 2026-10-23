package com.trustvault.controller;

import com.trustvault.dto.RenewalRequestDtos.*;
import com.trustvault.model.User;
import com.trustvault.security.SecurityUtils;
import com.trustvault.service.RenewalRequestService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping({"/api/renewals", "/api/renewal-requests"})
public class RenewalRequestController {

    private final RenewalRequestService renewalRequestService;

    public RenewalRequestController(RenewalRequestService renewalRequestService) {
        this.renewalRequestService = renewalRequestService;
    }

    @PostMapping
    public ResponseEntity<RenewalRequestDto> createRenewal(
            @Valid @RequestBody CreateRenewalRequest request,
            HttpServletRequest httpRequest
    ) {
        User requester = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(renewalRequestService.createRenewalRequest(request, requester, httpRequest));
    }

    @GetMapping("/owner")
    public ResponseEntity<List<RenewalRequestDto>> getRenewalsForOwner() {
        User owner = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(renewalRequestService.getPendingRenewalsForOwner(owner));
    }

    @GetMapping("/my")
    public ResponseEntity<List<RenewalRequestDto>> getMyRenewals() {
        User requester = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(renewalRequestService.getMyRenewalRequests(requester));
    }

    @PostMapping("/{id}/review")
    public ResponseEntity<RenewalRequestDto> reviewRenewal(
            @PathVariable UUID id,
            @RequestBody ReviewRenewalRequest review,
            HttpServletRequest httpRequest
    ) {
        User reviewer = SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(renewalRequestService.reviewRenewalRequest(id, review, reviewer, httpRequest));
    }
}
