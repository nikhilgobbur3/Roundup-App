package com.roundup.service;

import com.roundup.dto.AuthResponse;
import com.roundup.dto.LoginRequest;
import com.roundup.dto.SignUpRequest;
import com.roundup.model.User;
import com.roundup.repository.UserRepository;
import com.roundup.security.JwtTokenProvider;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/*
    AuthService - contains ALL the business logic for authentication.

    @Service marks this class as a Spring Bean.
    Spring will auto-detect it and inject it wherever needed (e.g., AuthController).

    Why do we put logic in a Service instead of the Controller?
    - Separation of concerns: Controller handles HTTP, Service handles logic
    - Service can be reused (e.g., called from a test or another service)
    - Service can be transactional (database operations in one unit)
*/
@Service
public class AuthService {

    /*
        Constructor Injection (no @Autowired needed since Spring 4.3+):

        Spring automatically passes these dependencies when creating AuthService.
        This is better than @Autowired on fields because:
        1. Makes testing easier (pass mocks in constructor)
        2. Makes dependencies explicit (clear what this class needs)
        3. Works with final fields (immutable)
    */
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtTokenProvider jwtTokenProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
    }

    /*
        SIGNUP - register a new user.

        Step-by-step:
        1. Check if email is already taken → throw RuntimeException
        2. Hash the password using BCrypt
           (BCrypt adds a random "salt" automatically, making each hash unique)
        3. Create User entity with name, email, hashed password
        4. Save to database (JpaRepository.save() handles both INSERT and UPDATE)
        5. Generate JWT token for the new user (so they're logged in immediately)
        6. Return AuthResponse with token + user info

        Why hash the password?
        - Never store plain text passwords (security breach risk)
        - BCrypt is designed to be slow (harder for hackers to crack)
        - Even if two users have the same password, hashes will differ (salt)
    */
   // here SignupRequest request parameters creates that object and passes it to the signup method
    public AuthResponse signup(SignUpRequest request) {

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already registered");
        }

        String hashedPassword = passwordEncoder.encode(request.getPassword());

        User user = new User(
                request.getName(),
                request.getEmail(),
                hashedPassword
        );
        user.setBalance(0.0);

        userRepository.save(user);

        String token = jwtTokenProvider.generateToken(user.getEmail());

        return AuthResponse.builder()
                .token(token)
                .userId(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .balance(user.getBalance())
                .savings(user.getSavings())
                .build();
    }

    /*
        LOGIN - authenticate an existing user.

        Step-by-step:
        1. Find user by email → throw RuntimeException if not found
        2. Verify password matches the stored hash
           passwordEncoder.matches(plainText, hash) → true/false
        3. If wrong password → throw RuntimeException
        4. Generate JWT token
        5. Return AuthResponse

        Why separate signup and login?
        - Different validation rules
        - Signup checks for duplicate email, login checks for wrong password
        - Cleaner code than one combined method
    */
    public AuthResponse login(LoginRequest request) {

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Invalid email or password");
        }

        String token = jwtTokenProvider.generateToken(user.getEmail());

        return AuthResponse.builder()
                .token(token)
                .userId(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .balance(user.getBalance())
                .savings(user.getSavings())
                .build();
    }

    public User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

}
