package com.authsystem.service;

import com.authsystem.model.entity.Card;
import com.authsystem.repository.CardRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import java.math.BigDecimal;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class CardService {

    @Autowired
    private CardRepository cardRepository;

    private static final String CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    private static final Set<String> VALID_CARD_TYPES = Set.of("小时卡", "天卡", "周卡", "月卡", "年卡");

    public Map<String, Object> getCards(Map<String, String> params) {
        int page = Math.max(1, parseIntParam(params, "page", 1));
        int perPage = Math.max(1, parseIntParam(params, "per_page", 20));
        Pageable pageable = PageRequest.of(page - 1, perPage, Sort.by(Sort.Direction.DESC, "createdAt"));

        Integer appId = parseIntegerParam(params, "app_id");
        String cardType = emptyToNull(params.get("card_type"));
        String status = emptyToNull(params.get("status"));
        Integer isActivated = parseIntegerParam(params, "is_activated");
        String cardContent = emptyToNull(params.get("card_content"));
        String cardRemark = emptyToNull(params.get("card_remark"));
        Integer isExpired = parseIntegerParam(params, "is_expired");

        Integer userId = parseUserIdParam(params, "user_id");
        Page<Card> cardPage = cardRepository.findWithFilters(
                appId, userId, cardType, status, isActivated, cardContent, cardRemark, isExpired, pageable);

        Map<String, Object> pagination = new LinkedHashMap<>();
        pagination.put("current_page", page);
        pagination.put("per_page", perPage);
        pagination.put("total_records", (int) cardPage.getTotalElements());
        pagination.put("total_pages", cardPage.getTotalPages());

        List<Map<String, Object>> cardList = new ArrayList<>();
        for (Card c : cardPage.getContent()) {
            Map<String, Object> cardMap = new LinkedHashMap<>();
            cardMap.put("id", c.getId());
            cardMap.put("app_id", c.getAppId());
            cardMap.put("card", c.getCard());
            cardMap.put("card_type", c.getCardType());
            cardMap.put("price", c.getPrice());
            cardMap.put("points", c.getPoints());
            cardMap.put("card_remark", c.getCardRemark());
            cardMap.put("status", c.getStatus());
            cardMap.put("is_activated", c.getIsActivated());
            cardMap.put("activated_at", c.getActivatedAt());
            cardMap.put("expires_at", c.getExpiresAt());
            cardMap.put("mac", c.getMac());
            cardMap.put("login_count", c.getLoginCount());
            cardMap.put("activation_ip", c.getActivationIp());
            cardMap.put("last_login_time", c.getLastLoginTime());
            cardMap.put("last_login_ip", c.getLastLoginIp());
            cardMap.put("created_at", c.getCreatedAt());
            cardMap.put("updated_at", c.getUpdatedAt());
            if (c.getApp() != null) {
                cardMap.put("app_name", c.getApp().getAppName());
                cardMap.put("softid", c.getApp().getSoftid());
            }
            cardList.add(cardMap);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", cardList);
        result.put("pagination", pagination);
        return result;
    }

    public List<Map<String, Object>> createCards(Map<String, Object> data) {
        Integer appId = ((Number) data.get("app_id")).intValue();
        String cardType = (String) data.get("card_type");
        if (!VALID_CARD_TYPES.contains(cardType)) {
            throw new IllegalArgumentException("无效的卡密类型，可选: " + String.join("/", VALID_CARD_TYPES));
        }

        int points = Math.max(1, ((Number) data.get("points")).intValue());
        BigDecimal price = new BigDecimal(data.getOrDefault("price", 0).toString());
        String cardPrefix = (String) data.getOrDefault("card_prefix", "");
        String cardRemark = (String) data.getOrDefault("card_remark", "");
        String status = getValidStatus((String) data.get("status"));
        String expiresAtStr = (String) data.get("expires_at");
        LocalDateTime expiresAt = (expiresAtStr != null && !expiresAtStr.isEmpty())
                ? LocalDateTime.parse(expiresAtStr.replace(" ", "T")) : null;
        int count = Math.max(1, Math.min(100, ((Number) data.getOrDefault("count", 1)).intValue()));

        List<Map<String, Object>> createdCards = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            Card card = new Card();
            card.setAppId(appId);
            if (data.containsKey("user_id")) card.setUserId(((Number) data.get("user_id")).intValue());
            card.setCard(cardPrefix + generateCard());
            card.setCardType(cardType);
            card.setPrice(price);
            card.setPoints(points);
            card.setCardRemark(cardRemark);
            card.setStatus(status);
            card.setExpiresAt(expiresAt);
            card.setIsActivated(0);
            card.setCreatedAt(LocalDateTime.now());
            card.setUpdatedAt(LocalDateTime.now());
            Card saved = cardRepository.save(card);
            createdCards.add(Map.of("id", saved.getId(), "card", saved.getCard()));
        }
        return createdCards;
    }

    public Card updateCard(Integer id, Map<String, Object> data) {
        Card card = cardRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("卡密不存在"));

        if (data.containsKey("card_type")) {
            String cardType = (String) data.get("card_type");
            if (!VALID_CARD_TYPES.contains(cardType)) {
                throw new IllegalArgumentException("无效的卡密类型");
            }
            card.setCardType(cardType);
        }
        if (data.containsKey("price") && data.get("price") != null)
            card.setPrice(new BigDecimal(data.get("price").toString()));
        if (data.containsKey("points") && data.get("points") != null)
            card.setPoints(Math.max(1, ((Number) data.get("points")).intValue()));
        if (data.containsKey("card_remark") && data.get("card_remark") != null)
            card.setCardRemark(data.get("card_remark").toString());
        if (data.containsKey("status") && data.get("status") != null)
            card.setStatus(getValidStatus(data.get("status").toString()));
        if (data.containsKey("expires_at")) {
            Object val = data.get("expires_at");
            if (val != null && !val.toString().isEmpty()) {
                card.setExpiresAt(parseDateTime(val.toString()));
            } else {
                card.setExpiresAt(null);
            }
        }
        if (data.containsKey("mac") && data.get("mac") != null)
            card.setMac(data.get("mac").toString());
        if (data.containsKey("login_count") && data.get("login_count") != null)
            card.setLoginCount(((Number) data.get("login_count")).intValue());
        if (data.containsKey("activation_ip") && data.get("activation_ip") != null)
            card.setActivationIp(data.get("activation_ip").toString());
        if (data.containsKey("last_login_time")) {
            Object val = data.get("last_login_time");
            if (val != null && !val.toString().isEmpty()) {
                card.setLastLoginTime(parseDateTime(val.toString()));
            } else {
                card.setLastLoginTime(null);
            }
        }
        if (data.containsKey("last_login_ip") && data.get("last_login_ip") != null)
            card.setLastLoginIp(data.get("last_login_ip").toString());
        card.setUpdatedAt(LocalDateTime.now());
        return cardRepository.save(card);
    }

    public long countByAppId(Integer appId) {
        return cardRepository.countByAppId(appId);
    }

    public void deleteCard(Integer id) {
        Card card = cardRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("卡密不存在"));
        cardRepository.delete(card);
    }

    private String generateCard() {
        Random random = new Random();
        for (int attempt = 0; attempt < 20; attempt++) {
            StringBuilder sb = new StringBuilder(14);
            for (int i = 0; i < 14; i++) {
                sb.append(CHARS.charAt(random.nextInt(CHARS.length())));
            }
            if (!cardRepository.existsByCard(sb.toString())) {
                return sb.toString();
            }
        }
        throw new RuntimeException("Failed to generate unique card");
    }

    private String getValidStatus(String status) {
        return (status != null && (status.equals("enabled") || status.equals("disabled"))) ? status : "enabled";
    }

    private int parseIntParam(Map<String, String> params, String key, int defaultValue) {
        try { return Integer.parseInt(params.getOrDefault(key, String.valueOf(defaultValue))); }
        catch (NumberFormatException e) { return defaultValue; }
    }

    private Integer parseIntegerParam(Map<String, String> params, String key) {
        String val = params.get(key);
        if (val == null || val.isEmpty()) return null;
        try { return Integer.parseInt(val); } catch (NumberFormatException e) { return null; }
    }

    private LocalDateTime parseDateTime(String s) {
        String t = s.replace(" ", "T");
        if (!t.contains("T")) return null;
        try {
            return LocalDateTime.parse(t, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (Exception e) {
            return null;
        }
    }

    private Integer parseUserIdParam(Map<String, String> params, String key) {
        String val = params.get(key);
        if (val == null || val.isEmpty()) return null;
        if ("__admin__".equals(val)) return -1;
        try { return Integer.parseInt(val); } catch (NumberFormatException e) { return null; }
    }

    private String emptyToNull(String s) {
        return (s == null || s.isEmpty()) ? null : s;
    }
}
