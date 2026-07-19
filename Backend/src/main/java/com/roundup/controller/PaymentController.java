package com.roundup.controller;

import com.roundup.dto.CreateOrderRequest;
import com.roundup.dto.PaymentOrderResponse;
import com.roundup.dto.PaymentVerifyRequest;
import com.roundup.dto.TransactionResponse;
import com.roundup.model.User;
import com.roundup.service.AuthService;
import com.roundup.service.PaymentService;
import com.roundup.service.TransactionService;
import jakarta.validation.Valid;
import org.json.JSONObject;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final PaymentService paymentService;
    private final TransactionService transactionService;
    private final AuthService authService;

    public PaymentController(PaymentService paymentService,
                             TransactionService transactionService,
                             AuthService authService) {
        this.paymentService = paymentService;
        this.transactionService = transactionService;
        this.authService = authService;
    }

    @PostMapping("/order")
    public ResponseEntity<?> createOrder(
            Authentication authentication,
            @Valid @RequestBody CreateOrderRequest request) {
        try {
            String email = authentication.getName();
            User user = authService.getUserByEmail(email);

            JSONObject order = paymentService.createOrder(
                    request.getAmount(),
                    "user_" + user.getId()
            );

            PaymentOrderResponse response = new PaymentOrderResponse(
                    order.getString("orderId"),
                    order.getString("keyId"),
                    order.getInt("amount")
            );

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to create order: " + e.getMessage()));
        }
    }

    @PostMapping("/verify")
    public ResponseEntity<?> verifyPayment(
            Authentication authentication,
            @Valid @RequestBody PaymentVerifyRequest request) {
        String email = authentication.getName();
        User user = authService.getUserByEmail(email);

        boolean isValid = paymentService.verifyPaymentSignature(
                request.getOrderId(),
                request.getPaymentId(),
                request.getSignature()
        );

        if (!isValid) {
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Invalid payment signature"));
        }

        Double amountInRupees = request.getAmount() / 100.0;

        TransactionResponse transaction = transactionService.createVerifiedExpense(
                user.getId(),
                amountInRupees,
                request.getDescription(),
                request.getPaymentId(),
                request.getOrderId()
        );

        return ResponseEntity.ok(transaction);
    }
}
