package com.roundup.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/*
    JwtTokenProvider - handles ALL JWT operations.

    @Component marks this as a Spring Bean (like @Service).
    Spring will auto-detect it and inject it into AuthService.

    What is a JWT?
    - A JSON Web Token is a string with 3 parts separated by dots:
        header.payload.signature
    - Example: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJlbWFpbEB0ZXN0LmNvbSJ9.abc123...
    - The token contains claims (data) like "user email", "issued at", "expires at"
    - The signature proves the token wasn't tampered with
*/
@Component
public class JwtTokenProvider {

    /*
        We inject values from application.yml.
        If we haven't created application.yml yet, these will use the defaults.
        @Value reads properties by name: ${jwt.secret} and ${jwt.expiration}
    */
    @Value("${jwt.secret:MySuperSecretKeyForJWTTokenGeneration2026RoundUpApp}")
    private String jwtSecret;

    /*
        Expiration time in milliseconds.
        Default: 86400000 ms = 24 hours (1 day).
        After 24 hours, the user must log in again.
    */
    @Value("${jwt.expiration:86400000}")
    private long jwtExpiration;

    /*
        generateToken(String email) - creates a JWT for the given user.

        Steps:
        1. Get the current time
        2. Calculate expiration time = now + 24 hours
        3. Build the JWT with:
           - subject (sub) = user's email
           - issuedAt (iat) = when token was created
           - expiration (exp) = when token expires
           - signWith = cryptographic signature using HMAC-SHA256

        The SecretKey is created from our secret string using HMAC-SHA256.
        This key is used for BOTH signing and verification.
    */
    public String generateToken(String email) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpiration);

        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));

        return Jwts.builder()
                .subject(email)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(key)
                .compact();
    }

    /*
        getEmailFromToken(String token) - extracts the user's email from the token.

        How?
        - Parses the token using the same secret key
        - Calls .getPayload().getSubject()
        - Subject = the email we set in generateToken()

        This is used by JwtAuthenticationFilter to identify the user making the request.
    */
    public String getEmailFromToken(String token) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));

        JwtParser parser = Jwts.parser()
                .verifyWith(key)
                .build();

        return parser.parseSignedClaims(token)
                .getPayload()
                .getSubject();
    }

    /*
        validateToken(String token) - checks if the token is valid.

        Returns true if:
        - The token's signature matches (not tampered with)
        - The token hasn't expired

        If ANY exception occurs (malformed token, expired, wrong signature),
        we return false — security fails closed.
    */
    public boolean validateToken(String token) {
        try {
            SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));

            JwtParser parser = Jwts.parser()
                    .verifyWith(key)
                    .build();

            parser.parseSignedClaims(token);
            return true;

        } catch (JwtException | IllegalArgumentException e) {
            /*
                JwtException covers:
                - ExpiredJwtException (token expired → user must log in again)
                - MalformedJwtException (token is garbage → possibly tampered)
                - SecurityException (signature doesn't match → definitely tampered)

                IllegalArgumentException (token is null or empty)
            */
            return false;
        }
    }

}
