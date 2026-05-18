package com.authsystem.service;

import com.authsystem.model.entity.App;
import com.authsystem.model.entity.Card;
import com.authsystem.repository.AppRepository;
import com.authsystem.repository.CardRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;

@Service
public class ClientAuthService {

    @Autowired
    private CardRepository cardRepository;

    @Autowired
    private AppRepository appRepository;

    private static final String TOKEN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    private static final SecureRandom RANDOM = new SecureRandom();

    @Transactional
    public String cardLogin(String softid, String cardNumber, String mac, String ipAddress) {
        App app = appRepository.findBySoftid(softid).orElse(null);
        if (app == null || !"enabled".equals(app.getStatus())) {
            throw new IllegalArgumentException("-1007");
        }

        Card card = cardRepository.findByCard(cardNumber)
                .orElseThrow(() -> new IllegalArgumentException("-1004"));

        if (!card.getAppId().equals(app.getId())) {
            throw new IllegalArgumentException("-1004");
        }

        if ("disabled".equals(card.getStatus())) {
            throw new IllegalArgumentException("-1006");
        }

        String token = generateToken();
        if (card.getIsActivated() == 1) {
            if (!mac.equals(card.getMac())) {
                throw new IllegalArgumentException("-1002");
            }
            if (card.getExpiresAt() != null && card.getExpiresAt().isBefore(LocalDateTime.now())) {
                throw new IllegalArgumentException("-1005");
            }
            card.setLastLoginTime(LocalDateTime.now());
            card.setLastLoginIp(ipAddress);
            card.setLoginCount(card.getLoginCount() + 1);
            card.setToken(token);
            card.setUpdatedAt(LocalDateTime.now());
        } else {
            LocalDateTime now = LocalDateTime.now();
            int points = Math.max(1, card.getPoints());
            card.setMac(mac);
            card.setActivatedAt(now);
            card.setActivationIp(ipAddress);
            card.setLastLoginTime(now);
            card.setLastLoginIp(ipAddress);
            card.setIsActivated(1);
            card.setPoints(0);
            card.setExpiresAt(calcExpiry(card.getCardType(), points, now));
            card.setLoginCount(card.getLoginCount() + 1);
            card.setToken(token);
            card.setUpdatedAt(now);
        }

        cardRepository.save(card);
        return token;
    }

    @Transactional
    public void cardLogout(String softid, String cardNumber, String token) {
        App app = appRepository.findBySoftid(softid).orElse(null);
        if (app == null || !"enabled".equals(app.getStatus())) {
            throw new IllegalArgumentException("-1007");
        }

        Card card = cardRepository.findByCard(cardNumber)
                .orElseThrow(() -> new IllegalArgumentException("-1004"));

        if (!card.getAppId().equals(app.getId())) {
            throw new IllegalArgumentException("-1004");
        }

        if (card.getToken() == null || !card.getToken().equals(token)) {
            throw new IllegalArgumentException("-1002");
        }

        card.setToken(null);
        card.setUpdatedAt(LocalDateTime.now());
        cardRepository.save(card);
    }

    public LocalDateTime getExpiry(String softid, String cardNumber) {
        App app = appRepository.findBySoftid(softid).orElse(null);
        if (app == null || !"enabled".equals(app.getStatus())) {
            throw new IllegalArgumentException("-1007");
        }

        Card card = cardRepository.findByCard(cardNumber)
                .orElseThrow(() -> new IllegalArgumentException("-1004"));

        if (!card.getAppId().equals(app.getId())) {
            throw new IllegalArgumentException("-1004");
        }

        if (card.getExpiresAt() == null) {
            throw new IllegalArgumentException("-1009");
        }

        return card.getExpiresAt();
    }

    private LocalDateTime calcExpiry(String cardType, int points, LocalDateTime base) {
        return switch (cardType) {
            case "小时卡" -> base.plusHours(points);
            case "天卡" -> base.plusDays(points);
            case "周卡" -> base.plusWeeks(points);
            case "月卡" -> base.plusMonths(points);
            case "年卡" -> base.plusYears(points);
            default -> base.plusDays(points);
        };
    }

    private String generateToken() {
        StringBuilder sb = new StringBuilder(16);
        for (int i = 0; i < 16; i++) {
            sb.append(TOKEN_CHARS.charAt(RANDOM.nextInt(TOKEN_CHARS.length())));
        }
        return sb.toString();
    }
}
