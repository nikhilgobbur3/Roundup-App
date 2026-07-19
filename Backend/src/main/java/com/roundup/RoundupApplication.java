package com.roundup;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/*
    @SpringBootApplication is a shortcut for 3 annotations:

    1. @Configuration
       - Marks this class as a source of bean definitions
       - "Beans" are objects Spring manages (services, controllers, etc.)

    2. @EnableAutoConfiguration
       - Spring Boot automatically configures things based on what it finds
       - Example: sees "spring-boot-starter-web" in pom.xml
         → auto-configures Tomcat + DispatcherServlet
       - Example: sees "postgresql" driver on classpath
         → auto-configures DataSource (database connection)
t
    3. @ComponentScan
       - Tells Spring to scan the "com.roundup" package and sub-packages
       - Finds all classes annotated with @Service, @Controller, @Repository
       - Registers them as beans automatically
*/
@SpringBootApplication
public class RoundupApplication {

    /*
        main() – the entry point of our Java application.
        JVM looks for "public static void main(String[] args)" to start.

        SpringApplication.run() does 2 things:
        1. Creates the Spring ApplicationContext (IoC container)
        2. Starts the embedded Tomcat server on port 8080 (default)
    */
    public static void main(String[] args) {
        SpringApplication.run(RoundupApplication.class, args);
    }

}
