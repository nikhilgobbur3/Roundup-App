package com.roundup.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import jakarta.servlet.http.HttpServletResponse;

/*
    SecurityConfig - master switchboard for Spring Security.

    @Configuration tells Spring: "This class contains bean definitions."
    @EnableWebSecurity enables Spring Security's web security support.

    What this config does:
    1. Disables CSRF (not needed for JWT-based APIs)
    2. Sets session management to STATELESS (no server-side sessions)
    3. Makes /api/auth/** endpoints public (signup + login)
    4. Requires authentication for ALL other endpoints
    5. Registers our JwtAuthenticationFilter
    6. Provides a PasswordEncoder bean (BCrypt)
*/
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    /*
        SecurityFilterChain - the core of Spring Security configuration.

        This method creates a "filter chain" that every HTTP request passes through.
        Each filter in the chain checks something about the request.

        Order of filters (after this config):
        1. JwtAuthenticationFilter (OUR filter - checks JWT token)
        2. UsernamePasswordAuthenticationFilter (Spring's built-in login form)
        3. ... more Spring Security internal filters ...
        4. The actual Controller method

        Key settings:

        csrf.disable():
        - CSRF protects against form submission attacks from other websites
        - We don't need it because:
          a) We use JWT tokens (not cookies)
          b) Our mobile app isn't a web browser
          c) JWTs are sent in headers, not auto-attached by browsers

        sessionManagement:
        - STATELESS means Spring never creates HttpSession objects
        - Each request is completely independent
        - The JWT token IS our "session" - it contains all the info we need
        - No server memory needed for sessions (scales better)

        authorizeHttpRequests:
        - Defines URL-based access rules
        - .requestMatchers("/api/auth/**").permitAll() - anyone can access
        - .anyRequest().authenticated() - everything else needs a valid JWT

        addFilterBefore:
        - Inserts our JwtAuthenticationFilter BEFORE Spring's login filter
        - This means our filter runs first, checks the JWT, and sets up
          the authentication BEFORE Spring tries to redirect to a login page
    */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/signup", "/api/auth/login").permitAll()
                .anyRequest().authenticated()
            )
            .exceptionHandling(ex -> ex.authenticationEntryPoint((request, response, authException) -> {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                response.getWriter().write("{\"message\":\"Authentication required\"}");
            }))
            .addFilterBefore(jwtAuthenticationFilter,
                             UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /*
        PasswordEncoder bean - used by Spring Security for password hashing.

        BCryptPasswordEncoder:
        - Implementation of the BCrypt strong hashing function
        - Automatically generates a random salt for each password
        - Designed to be slow (tunable "strength" parameter, default 10 rounds)
        - Output format: $2a$10$[22-char-salt][31-char-hash]

        Spring Security will use this encoder automatically when we call:
        - passwordEncoder.encode(password) - to hash
        - passwordEncoder.matches(rawPassword, encodedPassword) - to verify

        We declare it as a @Bean so Spring can inject it into AuthService.
        AuthService already has: private final PasswordEncoder passwordEncoder;
    */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

}
