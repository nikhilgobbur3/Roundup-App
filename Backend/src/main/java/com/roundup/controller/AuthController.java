package com.roundup.controller;

import com.roundup.dto.AuthResponse;
import com.roundup.dto.LoginRequest;
import com.roundup.dto.SignUpRequest;
import com.roundup.model.User;
import com.roundup.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

/*
    AuthController - handles HTTP requests for authentication.

    @RestController combines @Controller + @ResponseBody.
    It tells Spring: "This class handles web requests,
    and the return values are HTTP responses (not view names)."

    @RequestMapping("/api/auth") sets the base URL.
    All endpoints in this class will start with /api/auth.

    Why put it in a controller package?
    - Separation of concerns: Controllers handle HTTP,
      Services handle business logic.
    - Makes it easy to find all API endpoints.
*/
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /*
        POST /api/auth/signup

        Registers a new user.

        @Valid triggers the validation annotations on SignUpRequest:
        - @NotBlank name, email, password
        - @Email on email
        - @Size(min = 6) on password

        If validation fails, Spring returns 400 Bad Request
        with error details automatically. We never enter this method
        with invalid data.

        @RequestBody tells Spring to read the HTTP request body
        and convert it into a SignUpRequest object (JSON → Java).

        ResponseEntity lets us control:
        - HTTP status code (201 Created)
        - Response body (AuthResponse with token + user info)
        - Headers (if needed)

        Why 201 instead of 200?
        - 201 Created is the standard for resource creation
        - 200 OK is for general success (we use it for login)
    */
    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signup(
            @Valid @RequestBody SignUpRequest request) {

        AuthResponse response = authService.signup(request);

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /*
        POST /api/auth/login

        Authenticates an existing user.

        Same flow as signup but:
        - 200 OK instead of 201 Created (not creating a resource)
        - LoginRequest only needs email + password

        If credentials are wrong:
        - AuthService throws RuntimeException
        - The exception propagates up
        - Spring returns 500 Internal Server Error (for now)
        - We'll add proper error handling later
    */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest request) {

        AuthResponse response = authService.login(request);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(Authentication authentication) {
        String email = authentication.getName();
        User user = authService.getUserByEmail(email);
        return ResponseEntity.ok(Map.of(
            "id", user.getId(),
            "name", user.getName(),
            "email", user.getEmail(),
            "balance", user.getBalance(),
            "savings", user.getSavings()
        ));
    }

}
