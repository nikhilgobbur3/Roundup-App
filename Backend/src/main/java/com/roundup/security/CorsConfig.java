package com.roundup.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/*
    CorsConfig - handles Cross-Origin Resource Sharing (CORS).

    What is CORS?
    - A browser security mechanism that prevents websites from making
      requests to a different domain than the one that served the page
    - Example: If your web app is at http://localhost:3000 and your API
      is at http://localhost:8080, the browser BLOCKS the request by default

    Do we need CORS for a mobile app?
    - React Native on a real device: NO, CORS is a browser-only concept
    - React Native in Expo web mode: YES, the browser enforces CORS
    - During development with Expo Go: SOMETIMES (depends on setup)

    We configure it now so it works regardless of how the app is running.

    What this config allows:
    - All origins (*) → any domain can call our API
        Change this in production to your actual domain
    - All methods (GET, POST, PUT, DELETE, PATCH, OPTIONS)
    - All headers (including custom ones like Authorization)
    - Allow credentials (cookies, authorization headers)
*/
@Configuration
public class CorsConfig {

    /*
        WebMvcConfigurer - an interface from Spring MVC.

        addCorsMappings() lets us configure CORS globally.
        We return a WebMvcConfigurer bean that Spring discovers automatically.

        .allowedOrigins("*"):
        - In production, change to: .allowedOrigins("https://yourapp.com")
        - The "*" wildcard allows requests from ANY origin

        .allowedMethods("*"):
        - Allows all HTTP methods
        - You can restrict to: "GET", "POST", "PUT", "DELETE"

        .allowedHeaders("*"):
        - Allows all HTTP headers
        - Required for "Authorization" header (sends JWT token)

        .allowCredentials(true):
        - Allows cookies and authorization headers
        - Note: when true, you CANNOT use allowedOrigins("*")
          You must specify exact origins

        For our mobile app, we keep it open during development.
        We'll lock it down before production release.
    */
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**")
                        .allowedOrigins("*")
                        .allowedMethods("*")
                        .allowedHeaders("*")
                        .allowCredentials(false);
            }
        };
    }

}
