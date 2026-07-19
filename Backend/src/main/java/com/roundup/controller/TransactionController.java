package com.roundup.controller;

import com.roundup.dto.TransactionRequest;
import com.roundup.dto.TransactionResponse;
import com.roundup.model.User;
import com.roundup.service.TransactionService;
import com.roundup.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

    private final TransactionService transactionService;
    private final AuthService authService;

    public TransactionController(TransactionService transactionService,
                                  AuthService authService) {
        this.transactionService = transactionService;
        this.authService = authService;
    }

    @PostMapping
    public ResponseEntity<TransactionResponse> createTransaction(
            Authentication authentication,
            @Valid @RequestBody TransactionRequest request) {
        String email = authentication.getName();
        User user = authService.getUserByEmail(email);
        TransactionResponse response = transactionService.createExpense(user.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<TransactionResponse>> getTransactions(Authentication authentication) {
        String email = authentication.getName();
        User user = authService.getUserByEmail(email);
        List<TransactionResponse> transactions = transactionService.getUserTransactions(user.getId());
        return ResponseEntity.ok(transactions);
    }

    @GetMapping("/balance")
    public ResponseEntity<Map<String, Object>> getBalance(Authentication authentication) {
        String email = authentication.getName();
        User user = authService.getUserByEmail(email);
        return ResponseEntity.ok(Map.of(
            "balance", user.getBalance(),
            "savings", user.getSavings()
        ));
    }
}
