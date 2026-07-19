package com.roundup.service;

import com.razorpay.Utils;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Base64;

@Service
public class PaymentService {

    private final String keyId;
    private final String keySecret;
    private final TransactionService transactionService;
    private final RestTemplate restTemplate;

    public PaymentService(
            @Value("${razorpay.key-id}") String keyId,
            @Value("${razorpay.key-secret}") String keySecret,
            TransactionService transactionService) {
        this.keyId = keyId;
        this.keySecret = keySecret;
        this.transactionService = transactionService;
        this.restTemplate = new RestTemplate();
    }

    public JSONObject createOrder(Integer amountPaise, String receipt) {
        String auth = keyId + ":" + keySecret;
        String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Basic " + encodedAuth);

        JSONObject body = new JSONObject();
        body.put("amount", amountPaise);
        body.put("currency", "INR");
        body.put("receipt", receipt);

        HttpEntity<String> request = new HttpEntity<>(body.toString(), headers);

        ResponseEntity<String> response = restTemplate.postForEntity(
                "https://api.razorpay.com/v1/orders",
                request,
                String.class
        );

        JSONObject order = new JSONObject(response.getBody());

        JSONObject result = new JSONObject();
        result.put("orderId", order.getString("id"));
        result.put("keyId", keyId);
        result.put("amount", order.get("amount"));
        return result;
    }

    public boolean verifyPaymentSignature(String orderId, String paymentId, String signature) {
        try {
            JSONObject attributes = new JSONObject();
            attributes.put("razorpay_order_id", orderId);
            attributes.put("razorpay_payment_id", paymentId);
            attributes.put("razorpay_signature", signature);

            Utils.verifyPaymentSignature(attributes, keySecret);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
