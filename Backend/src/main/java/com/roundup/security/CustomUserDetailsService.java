package com.roundup.security;

import com.roundup.model.User;
import com.roundup.repository.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Collections;

/*
    CustomUserDetailsService - bridges our User entity with Spring Security.

    Spring Security has its own UserDetails interface.
    This service loads a user from our database and converts it
    into Spring Security's format.

    It implements UserDetailsService (a Spring Security interface).
    Spring Security calls loadUserByUsername() during authentication.
*/
@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /*
        loadUserByUsername() - Spring Security calls this when it needs
        to authenticate a user.

        Parameters:
        - email: the "username" parameter (we use email as username)

        Returns a UserDetails object with:
        - username (email)
        - password (hashed password from DB)
        - authorities (empty list for now — we'll add roles later)

        Spring Security uses the returned UserDetails to:
        1. Check if the user exists
        2. Verify the password (in login flow)
        3. Set up the SecurityContext (in JWT filter flow)
    */
    @Override
    public UserDetails loadUserByUsername(String email)
            throws UsernameNotFoundException {

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "User not found with email: " + email
                ));

        /*
            Return Spring Security's User (built-in implementation of UserDetails).

            Parameters:
            1. user.getEmail() → the "username"
            2. user.getPassword() → the hashed password
            3. Collections.emptyList() → empty authorities (no roles yet)

            Why Collections.emptyList()?
            - We haven't added roles/permissions yet
            - We'll add them when we build admin/user roles
        */
        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPassword(),
                Collections.emptyList()
        );
    }

}
