package com.roundup.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class CreateOrderRequest {

    @NotNull(message = "Amount is required")
    @Min(value = 100, message = "Minimum amount is ₹1 (100 paise)")
    private Integer amount;

    @NotBlank(message = "Description is required")
    private String description;

    public Integer getAmount() { return amount; }
    public void setAmount(Integer amount) { this.amount = amount; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
