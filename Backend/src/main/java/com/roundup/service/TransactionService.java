package com.roundup.service;

import com.roundup.dto.TransactionRequest;
import com.roundup.dto.TransactionResponse;
import com.roundup.model.Transaction;
import com.roundup.model.User;
import com.roundup.repository.TransactionRepository;
import com.roundup.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    public TransactionService(TransactionRepository transactionRepository,
                              UserRepository userRepository) {
        this.transactionRepository = transactionRepository;
        this.userRepository = userRepository;
    }

    public Double calculateRoundup(Double amount) {
        double rounded = Math.ceil(amount / 10.0) * 10.0;
        return rounded - amount;
    }

    @Transactional
    public TransactionResponse createExpense(Long userId, TransactionRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Double amount = request.getAmount();
        Double roundupAmount = calculateRoundup(amount);

        user.setBalance(user.getBalance() - amount);
        user.setSavings(user.getSavings() + roundupAmount);
        userRepository.save(user);

        Transaction expense = new Transaction(userId, amount, request.getDescription(), "EXPENSE", roundupAmount);
        transactionRepository.save(expense);

        if (roundupAmount > 0) {
            Transaction saving = new Transaction(userId, roundupAmount,
                    "RoundUp savings from: " + request.getDescription(),
                    "ROUNDUP_SAVING", null);
            transactionRepository.save(saving);
        }

        return toResponse(expense);
    }

    @Transactional
    public TransactionResponse createVerifiedExpense(Long userId, Double amount, String description,
                                                      String paymentId, String razorpayOrderId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Double roundupAmount = calculateRoundup(amount);

        user.setBalance(user.getBalance() - amount);
        user.setSavings(user.getSavings() + roundupAmount);
        userRepository.save(user);

        Transaction expense = new Transaction(userId, amount, description, "EXPENSE", roundupAmount);
        expense.setPaymentId(paymentId);
        expense.setRazorpayOrderId(razorpayOrderId);
        transactionRepository.save(expense);

        if (roundupAmount > 0) {
            Transaction saving = new Transaction(userId, roundupAmount,
                    "RoundUp savings from: " + description,
                    "ROUNDUP_SAVING", null);
            transactionRepository.save(saving);
        }

        return toResponse(expense);
    }

    public List<TransactionResponse> getUserTransactions(Long userId) {
        return transactionRepository.findByUserIdOrderByDateDesc(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private TransactionResponse toResponse(Transaction t) {
        return TransactionResponse.builder()
                .id(t.getId())
                .userId(t.getUserId())
                .amount(t.getAmount())
                .description(t.getDescription())
                .date(t.getDate())
                .type(t.getType())
                .roundupAmount(t.getRoundupAmount())
                .build();
    }
}
