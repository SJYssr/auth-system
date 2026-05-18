package com.authsystem.service;

import com.authsystem.model.entity.ErrorCode;
import com.authsystem.repository.ErrorCodeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class ErrorCodeService {

    @Autowired
    private ErrorCodeRepository errorCodeRepository;

    public Map<String, Object> getErrorCodes(Map<String, String> params) {
        int page = Math.max(1, parseInt(params, "page", 1));
        int perPage = Math.max(1, parseInt(params, "per_page", 20));
        Pageable pageable = PageRequest.of(page - 1, perPage, Sort.by(Sort.Direction.ASC, "code"));

        String keyword = emptyToNull(params.get("keyword"));

        Page<ErrorCode> ecPage = errorCodeRepository.findWithFilters(keyword, pageable);

        Map<String, Object> pagination = new LinkedHashMap<>();
        pagination.put("current_page", page);
        pagination.put("per_page", perPage);
        pagination.put("total_records", (int) ecPage.getTotalElements());
        pagination.put("total_pages", ecPage.getTotalPages());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", ecPage.getContent());
        result.put("pagination", pagination);
        return result;
    }

    public ErrorCode createErrorCode(Map<String, Object> data) {
        ErrorCode ec = new ErrorCode();
        ec.setCode((String) data.get("code"));
        ec.setMessage((String) data.get("message"));
        ec.setDescription((String) data.getOrDefault("description", ""));
        ec.setSolution((String) data.getOrDefault("solution", ""));
        ec.setCreatedAt(LocalDateTime.now());
        ec.setUpdatedAt(LocalDateTime.now());
        return errorCodeRepository.save(ec);
    }

    public ErrorCode updateErrorCode(Integer id, Map<String, Object> data) {
        ErrorCode ec = errorCodeRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("错误码不存在"));
        if (data.containsKey("code")) ec.setCode((String) data.get("code"));
        if (data.containsKey("message")) ec.setMessage((String) data.get("message"));
        if (data.containsKey("description")) ec.setDescription((String) data.get("description"));
        if (data.containsKey("solution")) ec.setSolution((String) data.get("solution"));
        ec.setUpdatedAt(LocalDateTime.now());
        return errorCodeRepository.save(ec);
    }

    public void deleteErrorCode(Integer id) {
        errorCodeRepository.deleteById(id);
    }

    private int parseInt(Map<String, String> params, String key, int def) {
        try { return Integer.parseInt(params.getOrDefault(key, String.valueOf(def))); }
        catch (NumberFormatException e) { return def; }
    }

    private String emptyToNull(String s) { return (s == null || s.isEmpty()) ? null : s; }
}
