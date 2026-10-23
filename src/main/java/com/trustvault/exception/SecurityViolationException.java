package com.trustvault.exception;

import org.springframework.http.HttpStatus;

public class SecurityViolationException extends AppException {
    public SecurityViolationException(String message) {
        super(message, HttpStatus.FORBIDDEN);
    }
}
