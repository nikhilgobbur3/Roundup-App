package com.roundup.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public class TransactionRequest {

    @Positive(message = "Amount must be positive")
    private Double amount;

    @NotBlank(message = "Description is required")
    private String description;

    public Double getAmount() { return amount; }
    public void setAmount(Double amount) { this.amount = amount; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
