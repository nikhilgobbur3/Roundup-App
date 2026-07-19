package com.roundup.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/*
    @Entity tells Spring: "This class represents a database table."
    Spring Data JPA will auto-create a table named "users" from this class.

    @Table(name = "users"):
    - "user" is a reserved keyword in PostgreSQL, so we name our table "users"
    - You can optionally add uniqueConstraints here (we'll handle email uniqueness in the repository)
*/
@Entity
@Table(name = "users")
public class User {

    /*
        @Id marks this field as the Primary Key.
        @GeneratedValue(strategy = GenerationType.IDENTITY):
        - "IDENTITY" means the database will auto-increment this value
        - Each new user gets id = 1, 2, 3, ... automatically
    */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /*
        @Column(nullable = false) means this column cannot be NULL in the database.
        name: user's full display name
    */
    @Column(nullable = false)
    private String name;

    /*
        unique = true ensures no two users can register with the same email.
        This is checked at the database level (not just in Java code).
    */
    @Column(nullable = false, unique = true)
    private String email;

    /*
        This stores the BCRYPT-HASHED password, never the plain text password.
        The password column can hold up to 255 characters (default @Column size).
    */
    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private Double balance = 0.0;

    @Column(nullable = false)
    private Double savings = 0.0;

    /*
        createdAt and updatedAt:

        @CreationTimestamp and @UpdateTimestamp are from Hibernate.
        They auto-set the timestamp when:
        - createdAt: the row is first inserted
        - updatedAt: the row is inserted OR updated

        We use LocalDateTime (Java 8+) which stores both date AND time.
    */
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    /*
        @PrePersist and @PreUpdate are "lifecycle callbacks".
        They run BEFORE the entity is saved or updated in the database.

        Why use these instead of @CreationTimestamp?
        - More explicit, beginner-friendly
        - Gives us full control over timestamps
        - Works even if we switch database providers
    */
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    /*
        Default constructor (required by JPA).
        JPA needs a no-arg constructor to create entity instances via reflection.
    */
    public User() {}

    /*
        Constructor with fields (convenience for creating new User objects).
    */
    public User(String name, String email, String password) {
        this.name = name;
        this.email = email;
        this.password = password;
    }

    /*
        Getters and Setters (required by JPA and Spring).

        JPA uses getters/setters to read/write field values.
        Spring MVC also uses them for JSON serialization/deserialization.

        Why not use Lombok @Data here?
        - I want you to see the actual getters/setters for learning
        - We'll use Lombok later for DTOs where boilerplate is higher
    */
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public Double getBalance() {
        return balance;
    }

    public void setBalance(Double balance) {
        this.balance = balance;
    }

    public Double getSavings() {
        return savings;
    }

    public void setSavings(Double savings) {
        this.savings = savings;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

}
