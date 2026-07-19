package com.roundup.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/*
    JwtAuthenticationFilter - runs on EVERY HTTP request (once per request).

    What does it do?
    1. Read the "Authorization" header from the HTTP request
    2. Extract the JWT token from the header (removes "Bearer " prefix)
    3. Validate the token using JwtTokenProvider
    4. If valid, load the user's details from the database
    5. Set the user in Spring Security's SecurityContext
       (this marks the request as "authenticated")
    6. If invalid or missing, do nothing (request proceeds as unauthenticated)

    Why extend OncePerRequestFilter?
    - Guarantees this filter runs exactly once per request
    - Even if the request goes through multiple filter chains
*/
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final CustomUserDetailsService customUserDetailsService;

    public JwtAuthenticationFilter(JwtTokenProvider jwtTokenProvider,
                                   CustomUserDetailsService customUserDetailsService) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.customUserDetailsService = customUserDetailsService;
    }

    /*
        doFilterInternal() - the main logic of the filter.

        This method is called by Spring for every incoming HTTP request.
    */
    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        try {
            // Step 1: Extract JWT token from the request header
            String token = getTokenFromRequest(request);

            // Step 2: If token exists and is valid, authenticate the user
            if (StringUtils.hasText(token) && jwtTokenProvider.validateToken(token)) {

                // Get the user's email from the token
                String email = jwtTokenProvider.getEmailFromToken(token);

                /*
                    Load the full user details from the database.
                    This returns a UserDetails object with:
                    - username (email)
                    - password (hashed)
                    - authorities (roles/permissions)
                */
                UserDetails userDetails = customUserDetailsService.loadUserByUsername(email);

                /*
                    Create an authentication token for Spring Security.
                    UsernamePasswordAuthenticationToken is Spring's standard
                    way to represent an authenticated user.

                    Parameters:
                    1. principal = the user details object
                    2. credentials = null (JWT auth doesn't use password here)
                    3. authorities = user's roles (empty for now)
                */
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(
                                userDetails,
                                null,
                                userDetails.getAuthorities()
                        );

                /*
                    Add request details (IP, session ID) to the authentication.
                    This is optional but good practice.
                */
                authentication.setDetails(
                        new WebAuthenticationDetailsSource().buildDetails(request)
                );

                /*
                    THE KEY LINE: Set the authentication in the SecurityContext.

                    After this line, Spring Security considers the request
                    as "authenticated". Controllers can now use:
                    - @AuthenticationPrincipal to get the user
                    - SecurityContextHolder.getContext().getAuthentication()
                    - @PreAuthorize annotations (for future role-based access)
                */
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        } catch (Exception e) {
            /*
                If anything goes wrong (invalid token, DB error, etc.),
                we DON'T throw an exception. We just let the request proceed
                as unauthenticated. The SecurityConfig will decide which
                endpoints require authentication.
            */
            logger.error("Could not set user authentication", e);
        }

        /*
            IMPORTANT: Always continue the filter chain.
            If we don't call filterChain.doFilter(), the request stops here
            and the client gets an empty response.
        */
        filterChain.doFilter(request, response);
    }

    /*
        getTokenFromRequest() - extracts the JWT token from the HTTP header.

        The mobile app will send the token like this:
            Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...

        This method:
        1. Gets the "Authorization" header value
        2. Checks if it starts with "Bearer "
        3. If yes, removes "Bearer " (7 characters) and returns the token
        4. If no, returns null

        Why "Bearer"?
        - It's the standard HTTP authentication scheme for tokens
        - "Bearer" means "whoever bears this token is authorized"
    */
    private String getTokenFromRequest(HttpServletRequest request) {

        String bearerToken = request.getHeader("Authorization");

        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            /*
                substring(7) removes the "Bearer " prefix.
                "Bearer abc123".substring(7) → "abc123"
            */
            return bearerToken.substring(7);
        }

        return null;
    }

}
