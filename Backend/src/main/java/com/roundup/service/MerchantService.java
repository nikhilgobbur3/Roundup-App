package com.roundup.service;

import com.roundup.dto.MerchantResponse;
import com.roundup.model.Merchant;
import com.roundup.repository.MerchantRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MerchantService {

    private final MerchantRepository merchantRepository;

    public MerchantService(MerchantRepository merchantRepository) {
        this.merchantRepository = merchantRepository;
    }

    @PostConstruct
    public void seedMerchants() {
        if (merchantRepository.count() > 0) return;

        merchantRepository.save(new Merchant("COFFEE01", "Blue Tokai Coffee", "bluetokai@upi"));
        merchantRepository.save(new Merchant("STORE01", "D-Mart", "dmart@upi"));
        merchantRepository.save(new Merchant("FOOD01", "Zomato", "zomato@upi"));
        merchantRepository.save(new Merchant("FUEL01", "Indian Oil", "iocl@upi"));
        merchantRepository.save(new Merchant("MEDIA01", "Netflix", "netflix@upi"));
    }

    public MerchantResponse getMerchantByCode(String code) {
        Merchant merchant = merchantRepository.findByCode(code)
                .orElseThrow(() -> new RuntimeException("Merchant not found"));
        return toResponse(merchant);
    }

    public List<MerchantResponse> getAllMerchants() {
        return merchantRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    private MerchantResponse toResponse(Merchant m) {
        return MerchantResponse.builder()
                .code(m.getCode())
                .name(m.getName())
                .upiId(m.getUpiId())
                .build();
    }
}
