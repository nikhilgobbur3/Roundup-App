package com.roundup.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/*
    LoginRequest - receives credentials from the mobile app login form.

    Simpler than SignUpRequest — only needs email + password.
    We still validate both fields are present and email format is valid.
*/
@Data
public class LoginRequest {

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Password is required")
    private String password;

}
