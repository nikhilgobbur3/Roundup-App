package com.roundup.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class TransactionResponse {
    private Long id;
    private Long userId;
    private Double amount;
    private String description;
    private LocalDateTime date;
    private String type;
    private Double roundupAmount;
}
