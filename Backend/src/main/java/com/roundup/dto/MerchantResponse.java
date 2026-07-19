package com.roundup.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class MerchantResponse {
    private String code;
    private String name;
    private String upiId;
}
