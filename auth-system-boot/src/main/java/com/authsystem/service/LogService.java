package com.authsystem.service;

import com.authsystem.model.entity.Log;
import com.authsystem.model.entity.Admin;
import com.authsystem.repository.LogRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class LogService {

    @Autowired
    private LogRepository logRepository;

    @Autowired
    private HttpServletRequest request;

    public Map<String, Object> getLogs(Map<String, String> params) {
        int page = Math.max(1, parseIntParam(params, "page", 1));
        int pageSize = clampPageSize(parseIntParam(params, "pageSize", 20));
        Pageable pageable = PageRequest.of(page - 1, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        String username = params.get("username");
        String actionType = params.get("actionType");
        String module = params.get("module");
        String status = params.get("status");
        String startDateStr = params.get("start_date");
        String endDateStr = params.get("end_date");

        LocalDateTime startDate = parseDate(startDateStr, true);
        LocalDateTime endDate = parseDate(endDateStr, false);

        Page<Log> logPage = logRepository.findWithFilters(
                username, actionType, module, status, startDate, endDate, pageable);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("logs", logPage.getContent());
        Map<String, Object> pagination = new LinkedHashMap<>();
        pagination.put("current", page);
        pagination.put("pageSize", pageSize);
        pagination.put("total", (int) logPage.getTotalElements());
        pagination.put("pages", logPage.getTotalPages());
        result.put("pagination", pagination);
        return result;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> deleteLogs(Map<String, Object> data) {
        int deletedCount;
        if (data.containsKey("ids") && data.get("ids") instanceof List) {
            List<Integer> ids = ((List<Number>) data.get("ids")).stream()
                    .map(Number::intValue).toList();
            deletedCount = logRepository.deleteByIds(ids);
        } else if (data.containsKey("days") && data.get("days") instanceof Number) {
            int days = ((Number) data.get("days")).intValue();
            LocalDateTime before = LocalDateTime.now().minusDays(days);
            deletedCount = logRepository.deleteOlderThan(before);
        } else if (data.containsKey("all") && Boolean.TRUE.equals(data.get("all"))) {
            deletedCount = logRepository.deleteAllLogs();
        } else {
            throw new IllegalArgumentException("无效的删除参数");
        }

        Map<String, Object> result = new HashMap<>();
        result.put("deleted_count", deletedCount);
        return result;
    }

    private static final int MAX_LOG_COUNT = 500;

    @Transactional
    public void log(Admin admin, String action, String module, String targetType,
                    Integer targetId, String targetName, String description, String requestData) {
        log(admin, action, module, targetType, targetId, targetName, description, requestData, "success");
    }

    @Transactional
    public void log(Admin admin, String action, String module, String targetType,
                    Integer targetId, String targetName, String description, String requestData, String responseStatus) {
        Log log = new Log();
        log.setUserId(admin != null ? admin.getId() : null);
        log.setUsername(admin != null ? admin.getUsername() : null);
        log.setAction(action);
        log.setModule(module);
        log.setTargetType(targetType);
        log.setTargetId(targetId);
        log.setTargetName(targetName);
        log.setDescription(description);
        log.setIpAddress(getClientIP());
        log.setUserAgent(request.getHeader("User-Agent"));
        log.setRequestData(requestData);
        log.setResponseStatus(responseStatus);
        log.setCreatedAt(LocalDateTime.now());
        logRepository.saveAndFlush(log);
        logRepository.deleteOldestExceeding(MAX_LOG_COUNT);
    }

    private String getClientIP() {
        String[] headers = {"X-Forwarded-For", "X-Real-IP", "Proxy-Client-IP", "WL-Proxy-Client-IP"};
        for (String header : headers) {
            String ip = request.getHeader(header);
            if (ip != null && !ip.isEmpty() && !"unknown".equalsIgnoreCase(ip)) {
                return ip.split(",")[0].trim();
            }
        }
        return request.getRemoteAddr();
    }

    private int parseIntParam(Map<String, String> params, String key, int defaultValue) {
        try {
            return Integer.parseInt(params.getOrDefault(key, String.valueOf(defaultValue)));
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    private int clampPageSize(int pageSize) {
        return Math.max(5, Math.min(100, pageSize));
    }

    private LocalDateTime parseDate(String dateStr, boolean startOfDay) {
        if (dateStr == null || dateStr.isEmpty()) return null;
        try {
            LocalDate date = LocalDate.parse(dateStr, DateTimeFormatter.ofPattern("yyyy-MM-dd"));
            return startOfDay ? date.atStartOfDay() : date.atTime(LocalTime.MAX);
        } catch (Exception e) {
            return null;
        }
    }
}
