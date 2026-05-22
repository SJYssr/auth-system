package com.authsystem.service;

import com.authsystem.model.entity.App;
import com.authsystem.model.entity.AppVersion;
import com.authsystem.repository.AppRepository;
import com.authsystem.repository.AppVersionRepository;
import com.authsystem.repository.CardRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class AppService {

    @Autowired
    private AppRepository appRepository;

    @Autowired
    private CardRepository cardRepository;

    @Autowired
    private AppVersionRepository versionRepository;

    private static final String CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

    public Map<String, Object> getApps(Map<String, String> params) {
        int page = Math.max(1, parseIntParam(params, "page", 1));
        int perPage = Math.max(1, Math.min(50, parseIntParam(params, "per_page", 12)));
        Pageable pageable = PageRequest.of(page - 1, perPage, Sort.by(Sort.Direction.DESC, "createdAt"));

        String keyword = emptyToNull(params.get("keyword"));
        String status = emptyToNull(params.get("status"));

        Page<App> appPage = appRepository.findWithFilters(keyword, status, pageable);

        Map<String, Object> pagination = new LinkedHashMap<>();
        pagination.put("page", page);
        pagination.put("per_page", perPage);
        pagination.put("total", (int) appPage.getTotalElements());
        pagination.put("total_pages", appPage.getTotalPages());
        pagination.put("has_next", page < appPage.getTotalPages());
        pagination.put("has_prev", page > 1);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", appPage.getContent());
        result.put("pagination", pagination);
        result.put("categories", getCategories());
        return result;
    }

    public Map<String, Object> getAdminApps(Map<String, String> params) {
        int page = Math.max(1, parseIntParam(params, "page", 1));
        int perPage = Math.max(1, parseIntParam(params, "per_page", 10));
        Pageable pageable = PageRequest.of(page - 1, perPage, Sort.by(Sort.Direction.DESC, "createdAt"));

        String keyword = emptyToNull(params.get("keyword"));
        String status = emptyToNull(params.get("status"));
        String startDate = emptyToNull(params.get("start_date"));
        String endDate = emptyToNull(params.get("end_date"));
        Integer userId = parseUserIdParam(params, "user_id");

        Page<App> appPage = appRepository.findWithAdminFilters(keyword, status, userId, startDate, endDate, pageable);

        List<Map<String, Object>> appList = new ArrayList<>();
        for (App a : appPage.getContent()) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", a.getId());
            map.put("softid", a.getSoftid());
            map.put("app_name", a.getAppName());
            map.put("description", a.getDescription());
            map.put("version", a.getVersion());
            map.put("version_name", a.getVersionName());
            map.put("developer", a.getDeveloper());
            map.put("is_free", a.getIsFree());
            map.put("icon_url", a.getIconUrl());
            map.put("download_url", a.getDownloadUrl());
            map.put("usage_guide", a.getUsageGuide());
            map.put("purchase_url", a.getPurchaseUrl());
            map.put("announcement", a.getAnnouncement());
            map.put("status", a.getStatus());
            map.put("created_at", a.getCreatedAt());
            map.put("updated_at", a.getUpdatedAt());
            long totalCards = cardRepository.countByAppId(a.getId());
            map.put("total_cards", (int) totalCards);
            long activatedCards = cardRepository.countByAppIdAndIsActivated(a.getId(), 1);
            map.put("activated_cards", (int) activatedCards);

            // 从版本管理取最新启用的版本号
            AppVersion latestVer = versionRepository.findTopByAppIdAndStatusOrderByCreatedAtDesc(a.getId(), "enabled");
            if (latestVer != null) {
                map.put("version", latestVer.getVersion());
                map.put("version_name", latestVer.getVersionName());
            }

            appList.add(map);
        }

        Map<String, Object> pagination = new LinkedHashMap<>();
        pagination.put("current_page", page);
        pagination.put("per_page", perPage);
        pagination.put("total_records", (int) appPage.getTotalElements());
        pagination.put("total_pages", appPage.getTotalPages());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", appList);
        result.put("pagination", pagination);
        return result;
    }

    public App getAppById(Integer id) {
        return appRepository.findById(id).orElse(null);
    }

    public App createApp(Map<String, Object> data) {
        if (appRepository.existsByAppName((String) data.get("app_name"))) {
            throw new IllegalArgumentException("应用名称已存在");
        }

        String version = (String) data.getOrDefault("version", "1.0.0");
        String versionName = (String) data.getOrDefault("version_name", "");

        App app = new App();
        app.setAppName((String) data.get("app_name"));
        app.setDescription((String) data.getOrDefault("description", ""));
        app.setIsFree(Boolean.TRUE.equals(data.get("is_free")) ? 1 : 0);
        app.setVersion(version);
        app.setVersionName(versionName);
        app.setDeveloper((String) data.getOrDefault("developer", ""));
        app.setIconUrl((String) data.getOrDefault("icon_url", ""));
        app.setDownloadUrl((String) data.getOrDefault("download_url", ""));
        app.setUsageGuide((String) data.getOrDefault("usage_guide", ""));
        app.setPurchaseUrl((String) data.getOrDefault("purchase_url", ""));
        app.setAnnouncement((String) data.getOrDefault("announcement", ""));
        app.setForceUpdate(toInt(data.getOrDefault("force_update", 0)));
        app.setStatus(getValidStatus((String) data.get("status")));
        if (data.containsKey("user_id")) app.setUserId(toInt(data.get("user_id")));
        app.setSoftid(generateSoftid());
        app.setCreatedAt(LocalDateTime.now());
        app.setUpdatedAt(LocalDateTime.now());
        App saved = appRepository.save(app);

        // 同步创建版本管理记录
        AppVersion ver = new AppVersion();
        ver.setAppId(saved.getId());
        ver.setVersion(version);
        ver.setVersionName(versionName.isEmpty() ? version : versionName);
        ver.setStatus("enabled");
        ver.setForceUpdate(0);
        ver.setCreatedAt(LocalDateTime.now());
        ver.setUpdatedAt(LocalDateTime.now());
        versionRepository.save(ver);

        return saved;
    }

    public App updateApp(Integer id, Map<String, Object> data) {
        App app = appRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("应用不存在"));

        if (data.containsKey("app_name")) {
            String newName = (String) data.get("app_name");
            if (newName != null && !newName.equals(app.getAppName()) && appRepository.existsByAppName(newName)) {
                throw new IllegalArgumentException("应用名称已存在");
            }
            app.setAppName(newName);
        }
        if (data.containsKey("description")) app.setDescription((String) data.get("description"));
        if (data.containsKey("is_free")) app.setIsFree(Boolean.TRUE.equals(data.get("is_free")) ? 1 : 0);
        if (data.containsKey("developer")) app.setDeveloper((String) data.get("developer"));
        if (data.containsKey("icon_url")) app.setIconUrl((String) data.get("icon_url"));
        if (data.containsKey("download_url")) app.setDownloadUrl((String) data.get("download_url"));
        if (data.containsKey("usage_guide")) app.setUsageGuide((String) data.get("usage_guide"));
        if (data.containsKey("purchase_url")) app.setPurchaseUrl((String) data.get("purchase_url"));
        if (data.containsKey("announcement")) app.setAnnouncement((String) data.get("announcement"));
        if (data.containsKey("force_update")) app.setForceUpdate(toInt(data.getOrDefault("force_update", 0)));
        if (data.containsKey("version")) app.setVersion((String) data.get("version"));
        if (data.containsKey("version_name")) app.setVersionName((String) data.get("version_name"));
        if (data.containsKey("status")) app.setStatus(getValidStatus((String) data.get("status")));
        app.setUpdatedAt(LocalDateTime.now());
        return appRepository.save(app);
    }

    public void deleteApp(Integer id) {
        App app = appRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("应用不存在"));
        appRepository.delete(app);
    }

    public App getBySoftid(String softid) {
        return appRepository.findBySoftid(softid).orElse(null);
    }

    public String getAnnouncement(String softid) {
        App app = getBySoftid(softid);
        if (app == null) {
            throw new IllegalArgumentException("-1007");
        }
        if (!"enabled".equals(app.getStatus())) {
            throw new IllegalArgumentException("-1007");
        }
        return app.getAnnouncement() != null ? app.getAnnouncement() : "";
    }

    public int getForceUpdate(String softid) {
        App app = getBySoftid(softid);
        if (app == null || !"enabled".equals(app.getStatus())) {
            throw new IllegalArgumentException("-1007");
        }
        return app.getForceUpdate() != null ? app.getForceUpdate() : 0;
    }

    public String getLatestVersion(String softid) {
        App app = getBySoftid(softid);
        if (app == null) {
            throw new IllegalArgumentException("-1007");
        }
        if (!"enabled".equals(app.getStatus())) {
            throw new IllegalArgumentException("-1007");
        }
        AppVersion latest = versionRepository.findTopByAppIdAndStatusOrderByCreatedAtDesc(app.getId(), "enabled");
        return latest != null ? latest.getVersion() : "";
    }

    public String getDownloadUrl(String softid) {
        App app = getBySoftid(softid);
        if (app == null || !"enabled".equals(app.getStatus())) {
            throw new IllegalArgumentException("-1007");
        }
        return app.getDownloadUrl() != null ? app.getDownloadUrl() : "";
    }

    public String getUsageGuide(String softid) {
        App app = getBySoftid(softid);
        if (app == null || !"enabled".equals(app.getStatus())) {
            throw new IllegalArgumentException("-1007");
        }
        return app.getUsageGuide() != null ? app.getUsageGuide() : "";
    }

    public String getPurchaseUrl(String softid) {
        App app = getBySoftid(softid);
        if (app == null || !"enabled".equals(app.getStatus())) {
            throw new IllegalArgumentException("-1007");
        }
        return app.getPurchaseUrl() != null ? app.getPurchaseUrl() : "";
    }

    public long countByStatus(String status) {
        return appRepository.countByStatus(status);
    }

    private String generateSoftid() {
        Random random = new Random();
        for (int attempt = 0; attempt < 20; attempt++) {
            StringBuilder sb = new StringBuilder(18);
            for (int i = 0; i < 18; i++) {
                sb.append(CHARS.charAt(random.nextInt(CHARS.length())));
            }
            String softid = sb.toString();
            if (appRepository.findBySoftid(softid).isEmpty()) {
                return softid;
            }
        }
        throw new RuntimeException("Failed to generate unique Softid");
    }

    private String getValidStatus(String status) {
        return (status != null && (status.equals("enabled") || status.equals("disabled"))) ? status : "enabled";
    }

    private int parseIntParam(Map<String, String> params, String key, int defaultValue) {
        try { return Integer.parseInt(params.getOrDefault(key, String.valueOf(defaultValue))); }
        catch (NumberFormatException e) { return defaultValue; }
    }

    private Integer toInt(Object v) {
        if (v == null) return 0;
        if (v instanceof Number) return ((Number) v).intValue();
        if (v instanceof String && !((String) v).isEmpty()) return Integer.parseInt((String) v);
        return 0;
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

    private List<Map<String, String>> getCategories() {
        return List.of(
                Map.of("value", "general", "label", "通用"),
                Map.of("value", "office", "label", "办公"),
                Map.of("value", "development", "label", "开发"),
                Map.of("value", "design", "label", "设计"),
                Map.of("value", "entertainment", "label", "娱乐"),
                Map.of("value", "education", "label", "教育"),
                Map.of("value", "business", "label", "商务"),
                Map.of("value", "tools", "label", "工具")
        );
    }
}
