package com.roundup.dto;

import lombok.Builder;
import lombok.Data;

/*
    AuthResponse - sent back to the mobile app after successful login/signup.

    @Data → generates getters, setters, toString, equals, hashCode
    @Builder → generates a builder pattern:
        AuthResponse response = AuthResponse.builder()
            .token("eyJhbGciOiJIUzI1NiJ9...")
            .userId(1L)
            .name("John")
            .email("john@example.com")
            .build();

    Why do we return user info (name, email) in the response?
    - The mobile app needs this immediately after login
    - Avoids making a separate API call to fetch user profile
    - The app can save user info in AuthContext right away
*/
@Data
@Builder
public class AuthResponse {

    private String token;
    private Long userId;
    private String name;
    private String email;
    private Double balance;
    private Double savings;

}
