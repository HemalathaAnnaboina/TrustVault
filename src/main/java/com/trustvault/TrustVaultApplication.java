package com.trustvault;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class TrustVaultApplication {

    public static void main(String[] args) {
        SpringApplication.run(TrustVaultApplication.class, args);
    }
}
