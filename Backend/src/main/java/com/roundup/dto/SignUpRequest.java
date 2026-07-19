package com.roundup.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/*
    SignUpRequest - receives data from the mobile app when a user signs up.

    Validation annotations (jakarta.validation):
    These run BEFORE the method executes. If validation fails,
    Spring returns 400 Bad Request automatically — we never
    reach the service layer with bad data.

    @NotBlank  → field cannot be null, empty "", or whitespace "   "
    @Email     → must look like an email (user@example.com)
    @Size(min, max) → restricts string length

    Lombok @Data generates:
    - getters for all fields
    - setters for all fields
    - toString(), equals(), hashCode()
    - No constructor (we use the default no-arg constructor + setters)

    Why Lombok here but not in User.java?
    - User.java was for learning (hand-written getters/setters)
    - DTOs are pure data carriers — Lombok is perfect for them
*/
import lombok.Data;

@Data
public class SignUpRequest {

    @NotBlank(message = "Name is required")
    @Size(min = 2, max = 50, message = "Name must be 2-50 characters")
    private String name;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 6, max = 100, message = "Password must be 6-100 characters")
    private String password;

}
