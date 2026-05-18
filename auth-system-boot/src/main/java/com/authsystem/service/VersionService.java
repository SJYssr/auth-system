package com.authsystem.service;

import com.authsystem.model.entity.AppVersion;
import com.authsystem.repository.AppVersionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class VersionService {

    @Autowired
    private AppVersionRepository versionRepository;

    public Map<String, Object> getVersions(Map<String, String> params) {
        int page = Math.max(1, parseIntParam(params, "page", 1));
        int perPage = Math.max(1, parseIntParam(params, "per_page", 20));
        Pageable pageable = PageRequest.of(page - 1, perPage, Sort.by(Sort.Direction.DESC, "createdAt"));

        Integer appId = parseIntegerParam(params, "app_id");
        String status = emptyToNull(params.get("status"));
        String keyword = emptyToNull(params.get("keyword"));

        Page<AppVersion> versionPage = versionRepository.findWithFilters(appId, status, keyword, pageable);

        List<Map<String, Object>> versionList = new ArrayList<>();
        for (AppVersion v : versionPage.getContent()) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", v.getId());
            map.put("app_id", v.getAppId());
            map.put("version", v.getVersion());
            map.put("version_name", v.getVersionName());
            map.put("status", v.getStatus());
            map.put("force_update", v.getForceUpdate());
            map.put("created_at", v.getCreatedAt());
            map.put("updated_at", v.getUpdatedAt());
            if (v.getApp() != null) {
                map.put("app_name", v.getApp().getAppName());
                map.put("softid", v.getApp().getSoftid());
            }
            versionList.add(map);
        }

        Map<String, Object> pagination = new LinkedHashMap<>();
        pagination.put("current_page", page);
        pagination.put("per_page", perPage);
        pagination.put("total_records", (int) versionPage.getTotalElements());
        pagination.put("total_pages", versionPage.getTotalPages());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", versionList);
        result.put("pagination", pagination);
        return result;
    }

    public AppVersion createVersion(Map<String, Object> data) {
        Integer appId = toInt(data.get("app_id"));
        String version = (String) data.get("version");
        String versionName = (String) data.get("version_name");

        if (appId == null || version == null || versionName == null) {
            throw new IllegalArgumentException("app_id, version, version_name 为必填项");
        }

        if (versionRepository.existsByAppIdAndVersion(appId, version)) {
            throw new IllegalArgumentException("该版本号已存在");
        }

        AppVersion ver = new AppVersion();
        ver.setAppId(appId);
        ver.setVersion(version);
        ver.setVersionName(versionName);
        ver.setStatus(getValidStatus((String) data.getOrDefault("status", "enabled")));
        Object fu = data.get("force_update");
        ver.setForceUpdate((fu instanceof Number && ((Number) fu).intValue() == 1) || Boolean.TRUE.equals(fu) ? 1 : 0);
        ver.setCreatedAt(LocalDateTime.now());
        ver.setUpdatedAt(LocalDateTime.now());
        return versionRepository.save(ver);
    }

    public AppVersion updateVersion(Integer id, Map<String, Object> data) {
        AppVersion ver = versionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("版本不存在"));

        String newVersion = (String) data.getOrDefault("version", ver.getVersion());
        if (!newVersion.equals(ver.getVersion()) &&
                versionRepository.existsByAppIdAndVersionExcludingId(ver.getAppId(), newVersion, id)) {
            throw new IllegalArgumentException("该版本号已存在");
        }

        ver.setVersion(newVersion);
        if (data.containsKey("version_name")) ver.setVersionName((String) data.get("version_name"));
        if (data.containsKey("status")) ver.setStatus(getValidStatus((String) data.get("status")));
        if (data.containsKey("force_update")) ver.setForceUpdate(Boolean.TRUE.equals(data.get("force_update")) ? 1 : 0);
        ver.setUpdatedAt(LocalDateTime.now());
        return versionRepository.save(ver);
    }

    public void deleteVersion(Integer id) {
        AppVersion ver = versionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("版本不存在"));
        versionRepository.delete(ver);
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

    private String emptyToNull(String s) {
        return (s == null || s.isEmpty()) ? null : s;
    }

    private Integer toInt(Object value) {
        if (value == null) return null;
        if (value instanceof Number) return ((Number) value).intValue();
        if (value instanceof String && !((String) value).isEmpty()) {
            try { return Integer.parseInt((String) value); } catch (NumberFormatException e) { return null; }
        }
        return null;
    }
}
