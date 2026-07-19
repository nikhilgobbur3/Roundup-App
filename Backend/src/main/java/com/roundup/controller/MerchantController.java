package com.roundup.controller;

import com.roundup.dto.MerchantResponse;
import com.roundup.dto.TransactionRequest;
import com.roundup.dto.TransactionResponse;
import com.roundup.model.User;
import com.roundup.service.AuthService;
import com.roundup.service.MerchantService;
import com.roundup.service.TransactionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/merchants")
public class MerchantController {

    private final MerchantService merchantService;
    private final TransactionService transactionService;
    private final AuthService authService;

    public MerchantController(MerchantService merchantService,
                               TransactionService transactionService,
                               AuthService authService) {
        this.merchantService = merchantService;
        this.transactionService = transactionService;
        this.authService = authService;
    }

    @GetMapping("/{code}")
    public ResponseEntity<MerchantResponse> getMerchant(@PathVariable String code) {
        return ResponseEntity.ok(merchantService.getMerchantByCode(code));
    }

    @GetMapping
    public ResponseEntity<List<MerchantResponse>> listMerchants() {
        return ResponseEntity.ok(merchantService.getAllMerchants());
    }

    @PostMapping("/pay")
    public ResponseEntity<TransactionResponse> payMerchant(
            Authentication authentication,
            @RequestParam String code,
            @Valid @RequestBody TransactionRequest request) {
        MerchantResponse merchant = merchantService.getMerchantByCode(code);
        String email = authentication.getName();
        User user = authService.getUserByEmail(email);
        String description = request.getDescription() + " @ " + merchant.getName();
        TransactionRequest fullRequest = new TransactionRequest();
        fullRequest.setAmount(request.getAmount());
        fullRequest.setDescription(description);
        TransactionResponse response = transactionService.createExpense(user.getId(), fullRequest);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
