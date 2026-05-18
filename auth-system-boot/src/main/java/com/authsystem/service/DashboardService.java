package com.authsystem.service;

import com.authsystem.model.entity.App;
import com.authsystem.model.entity.Card;
import com.authsystem.model.entity.Log;
import com.authsystem.repository.AppRepository;
import com.authsystem.repository.CardRepository;
import com.authsystem.repository.LogRepository;
import com.authsystem.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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
    private UserRepository userRepository;

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
        long onlineCount = cardRepository.countRecentlyActive(LocalDateTime.now().minusMinutes(30));
        overview.put("online", Map.of("count", (int) onlineCount));

        var recentCardsPage = cardRepository.findAll(
                PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "createdAt")));
        List<Map<String, Object>> recentCards = new ArrayList<>();
        for (Card c : recentCardsPage.getContent()) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("card", c.getCard());
            map.put("card_type", c.getCardType());
            map.put("points", c.getPoints());
            map.put("status", c.getStatus());
            map.put("is_activated", c.getIsActivated());
            map.put("created_at", c.getCreatedAt() != null ? c.getCreatedAt().toString() : null);
            map.put("app_name", c.getApp() != null ? c.getApp().getAppName() : "");
            recentCards.add(map);
        }

        List<App> apps = appRepository.findAll();
        List<Map<String, Object>> appDistribution = new ArrayList<>();
        for (App a : apps) {
            long count = cardRepository.countByAppId(a.getId());
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("app_name", a.getAppName());
            map.put("total_cards", (int) count);
            map.put("activated_cards", 0);
            map.put("expired_cards", 0);
            appDistribution.add(map);
        }
        appDistribution.sort((a, b) -> Integer.compare((int) b.get("total_cards"), (int) a.get("total_cards")));
        if (appDistribution.size() > 10) {
            appDistribution = appDistribution.subList(0, 10);
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
        dashboard.put("recent_logs", recentLogs);
        return dashboard;
    }
}
