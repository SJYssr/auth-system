package com.authsystem.service;

import com.authsystem.model.entity.App;
import com.authsystem.model.entity.Card;
import com.authsystem.model.entity.Log;
import com.authsystem.repository.AppRepository;
import com.authsystem.repository.CardRepository;
import com.authsystem.repository.LogRepository;
import com.authsystem.repository.AdminRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class DashboardService {

    @Autowired
    private AppRepository appRepository;

    @Autowired
    private CardRepository cardRepository;

    @Autowired
    private LogRepository logRepository;

    @Autowired
    private AdminRepository adminRepository;

    public Map<String, Object> getDashboard() {
        long totalApps = appRepository.count();
        long enabledApps = appRepository.countByStatus("enabled");
        long disabledApps = totalApps - enabledApps;

        long totalCards = cardRepository.count();
        long activatedCards = cardRepository.countActivated();
        long inactiveCards = cardRepository.countInactive();
        long expiredCards = cardRepository.countExpired();
        long enabledCards = cardRepository.countEnabled();

        Map<String, Object> overview = new LinkedHashMap<>();
        overview.put("apps", Map.of(
                "total", (int) totalApps,
                "enabled", (int) enabledApps,
                "disabled", (int) disabledApps
        ));
        overview.put("cards", Map.of(
                "total", (int) totalCards,
                "activated", (int) activatedCards,
                "inactive", (int) inactiveCards,
                "expired", (int) expiredCards,
                "enabled", (int) enabledCards
        ));
        long onlineCount = cardRepository.countOnline(LocalDateTime.now().minusHours(24));
        overview.put("online", Map.of("count", (int) onlineCount));

        var recentCardsPage = cardRepository.findByIsActivatedOrderByActivatedAtDesc(1,
                PageRequest.of(0, 10));
        List<Map<String, Object>> recentCards = new ArrayList<>();
        for (Card c : recentCardsPage.getContent()) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("card", c.getCard());
            map.put("card_type", c.getCardType());
            map.put("status", c.getStatus());
            map.put("app_name", c.getApp() != null ? c.getApp().getAppName() : "");
            map.put("mac", c.getMac() != null ? c.getMac() : "");
            map.put("activated_at", c.getActivatedAt() != null ? c.getActivatedAt().toString() : "");
            recentCards.add(map);
        }

        List<String> cardTypes = List.of("小时卡", "天卡", "月卡", "年卡");
        List<App> apps = appRepository.findAll();

        List<Map<String, Object>> appDistribution = new ArrayList<>();
        for (App a : apps) {
            List<Object[]> rows = cardRepository.revenueByCardType(a.getId());
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("app_name", a.getAppName());
            int total = 0;
            for (String ct : cardTypes) {
                map.put(ct, 0);
            }
            for (Object[] row : rows) {
                String type = (String) row[0];
                if (cardTypes.contains(type)) {
                    int count = ((Number) row[1]).intValue();
                    map.put(type, count);
                    total += count;
                }
            }
            map.put("total", total);
            appDistribution.add(map);
        }
        appDistribution.sort((a, b) -> Integer.compare((int) b.get("total"), (int) a.get("total")));
        if (appDistribution.size() > 10) {
            appDistribution = appDistribution.subList(0, 10);
        }

        List<Map<String, Object>> revenue = new ArrayList<>();
        for (App a : apps) {
            List<Object[]> rows = cardRepository.revenueByCardType(a.getId());
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("app_name", a.getAppName());
            for (String ct : cardTypes) {
                map.put(ct, 0);
            }
            for (Object[] row : rows) {
                String type = (String) row[0];
                if (cardTypes.contains(type)) {
                    map.put(type, ((Number) row[2]).intValue());
                }
            }
            revenue.add(map);
        }
        revenue.sort((a, b) -> {
            int sumA = cardTypes.stream().mapToInt(t -> (int) a.get(t)).sum();
            int sumB = cardTypes.stream().mapToInt(t -> (int) b.get(t)).sum();
            return Integer.compare(sumB, sumA);
        });
        if (revenue.size() > 10) {
            revenue = revenue.subList(0, 10);
        }

        var recentLogsPage = logRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 10));
        List<Map<String, Object>> recentLogs = new ArrayList<>();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        for (Log l : recentLogsPage.getContent()) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("username", l.getUsername());
            map.put("action", l.getAction());
            map.put("module", l.getModule());
            map.put("description", l.getDescription());
            map.put("created_at", l.getCreatedAt() != null ? l.getCreatedAt().format(fmt) : null);
            map.put("ip_address", l.getIpAddress());
            map.put("response_status", l.getResponseStatus());
            recentLogs.add(map);
        }

        Map<String, Object> dashboard = new LinkedHashMap<>();
        dashboard.put("overview", overview);
        dashboard.put("recent_cards", recentCards);
        dashboard.put("app_distribution", appDistribution);
        dashboard.put("revenue", revenue);
        dashboard.put("recent_logs", recentLogs);
        return dashboard;
    }
}
