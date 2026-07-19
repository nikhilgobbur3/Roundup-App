package com.roundup.repository;

import com.roundup.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

/*
    UserRepository - the database access layer for the "users" table.

    What is JpaRepository<User, Long>?
    - User: the entity class this repository manages
    - Long: the type of the Primary Key (id field)

    JpaRepository already provides these methods FOR FREE (no code needed):
    - save(User user)           → INSERT or UPDATE
    - findById(Long id)        → SELECT by primary key
    - findAll()                 → SELECT all users
    - deleteById(Long id)       → DELETE by primary key
    - count()                   → SELECT COUNT(*)

    How does Spring implement findByEmail() without us writing SQL?
    Spring Data JPA parses the method name:
    - "findBy"  → SELECT
    - "Email"   → WHERE email = ?

    It generates this query automatically:
        SELECT * FROM users WHERE email = ?
*/
public interface UserRepository extends JpaRepository<User, Long> {

    /*
        We use Optional<User> instead of just User because:
        - Optional forces the caller to handle "user not found" case
        - Prevents NullPointerException (NullPointerException)
        - Caller uses .isPresent() and .get(), or .orElseThrow()

        Usage in AuthService:
            Optional<User> user = userRepository.findByEmail(email);
            if (user.isEmpty()) {
                throw new RuntimeException("User not found");
            }
    */
    Optional<User> findByEmail(String email);

    /*
        Checks if an email already exists in the database.
        Returns true/false.

        Method name breakdown:
        - "existsBy" → generates: SELECT COUNT(*) > 0 FROM users WHERE email = ?
        - More efficient than findByEmail().isPresent() because it doesn't fetch the entire row

        Usage:
            if (userRepository.existsByEmail(email)) {
                throw new RuntimeException("Email already taken");
            }
    */
    boolean existsByEmail(String email);

}
