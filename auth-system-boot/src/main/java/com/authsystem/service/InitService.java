package com.authsystem.service;

import com.authsystem.model.entity.SiteData;
import com.authsystem.repository.AppRepository;
import com.authsystem.repository.CardRepository;
import com.authsystem.repository.SiteDataRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class InitService {

    @Autowired
    private SiteDataRepository siteDataRepository;

    @Autowired
    private AppRepository appRepository;

    @Autowired
    private CardRepository cardRepository;

    public Map<String, Object> getInitData(String token) {
        SiteData site = siteDataRepository.findFirstByOrderByIdAsc().orElse(null);

        long totalApps = appRepository.count();
        long activeApps = appRepository.countByStatus("enabled");
        long totalCards = cardRepository.count();
        long activeCards = cardRepository.countEnabled();
        long activatedCards = cardRepository.countActivated();

        Map<String, Object> initData = new LinkedHashMap<>();

        if (site != null) {
            Map<String, Object> website = new LinkedHashMap<>();
            website.put("site_name", site.getSiteName());
            website.put("site_title", site.getSiteTitle());
            website.put("keywords", site.getKeywords());
            website.put("description", site.getDescription());
            website.put("logo_url", site.getLogoUrl());
            website.put("favicon_url", site.getFaviconUrl());
            website.put("icp_number", site.getIcpNumber());
            website.put("contact_email", site.getContactEmail());
            website.put("contact_phone", site.getContactPhone());
            website.put("contact_address", site.getContactAddress());
            website.put("copyright", site.getCopyright());
            website.put("status", site.getStatus());
            website.put("created_at", site.getCreatedAt());
            initData.put("website", website);
        }

        Map<String, Object> system = new LinkedHashMap<>();
        system.put("apps", Map.of("total", (int) totalApps, "active", (int) activeApps));
        system.put("cards", Map.of("total", (int) totalCards, "active", (int) activeCards, "activated", (int) activatedCards));
        initData.put("system", system);

        Map<String, Object> loginStatus = new LinkedHashMap<>();
        loginStatus.put("is_logged_in", false);
        loginStatus.put("user", null);
        initData.put("login_status", loginStatus);

        initData.put("server_time", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));

        return initData;
    }
}
