package com.roundup.dto;

public class PaymentOrderResponse {

    private String orderId;
    private String keyId;
    private Integer amount;

    public PaymentOrderResponse(String orderId, String keyId, Integer amount) {
        this.orderId = orderId;
        this.keyId = keyId;
        this.amount = amount;
    }

    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }

    public String getKeyId() { return keyId; }
    public void setKeyId(String keyId) { this.keyId = keyId; }

    public Integer getAmount() { return amount; }
    public void setAmount(Integer amount) { this.amount = amount; }
}
