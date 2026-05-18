package com.authsystem.service;

import com.authsystem.model.entity.Api;
import com.authsystem.repository.ApiRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class ApiManageService {

    @Autowired
    private ApiRepository apiRepository;

    public Map<String, Object> getApis(Map<String, String> params) {
        int page = Math.max(1, parseInt(params, "page", 1));
        int perPage = Math.max(1, parseInt(params, "per_page", 20));
        Pageable pageable = PageRequest.of(page - 1, perPage, Sort.by(Sort.Direction.DESC, "createdAt"));

        String keyword = emptyToNull(params.get("keyword"));

        Page<Api> apiPage = apiRepository.findWithFilters(keyword, pageable);

        List<Map<String, Object>> list = new ArrayList<>();
        for (Api a : apiPage.getContent()) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", a.getId());
            map.put("api_name", a.getApiName());
            map.put("api_path", a.getApiPath());
            map.put("api_method", a.getApiMethod());
            map.put("param_count", a.getParamCount());
            map.put("params_config", a.getParamsConfig());
            map.put("return_desc", a.getReturnDesc());
            map.put("description", a.getDescription());
            map.put("created_at", a.getCreatedAt());
            map.put("updated_at", a.getUpdatedAt());
            list.add(map);
        }

        Map<String, Object> pagination = new LinkedHashMap<>();
        pagination.put("current_page", page);
        pagination.put("per_page", perPage);
        pagination.put("total_records", (int) apiPage.getTotalElements());
        pagination.put("total_pages", apiPage.getTotalPages());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", list);
        result.put("pagination", pagination);
        return result;
    }

    public Api createApi(Map<String, Object> data) {
        Api api = new Api();
        api.setApiName((String) data.get("api_name"));
        api.setApiPath((String) data.get("api_path"));
        api.setApiMethod((String) data.getOrDefault("api_method", "POST"));
        api.setParamCount(toInt(data.getOrDefault("param_count", 0)));
        api.setParamsConfig((String) data.getOrDefault("params_config", "[]"));
        api.setReturnDesc((String) data.getOrDefault("return_desc", ""));
        api.setDescription((String) data.getOrDefault("description", ""));
        api.setCreatedAt(LocalDateTime.now());
        api.setUpdatedAt(LocalDateTime.now());
        return apiRepository.save(api);
    }

    public Api updateApi(Integer id, Map<String, Object> data) {
        Api api = apiRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("API不存在"));
        if (data.containsKey("api_name")) api.setApiName((String) data.get("api_name"));
        if (data.containsKey("api_path")) api.setApiPath((String) data.get("api_path"));
        if (data.containsKey("api_method")) api.setApiMethod((String) data.get("api_method"));
        if (data.containsKey("param_count")) api.setParamCount(toInt(data.get("param_count")));
        if (data.containsKey("params_config")) api.setParamsConfig((String) data.get("params_config"));
        if (data.containsKey("return_desc")) api.setReturnDesc((String) data.get("return_desc"));
        if (data.containsKey("description")) api.setDescription((String) data.get("description"));
        api.setUpdatedAt(LocalDateTime.now());
        return apiRepository.save(api);
    }

    public void deleteApi(Integer id) {
        apiRepository.deleteById(id);
    }

    private int parseInt(Map<String, String> params, String key, int def) {
        try { return Integer.parseInt(params.getOrDefault(key, String.valueOf(def))); }
        catch (NumberFormatException e) { return def; }
    }

    private String emptyToNull(String s) { return (s == null || s.isEmpty()) ? null : s; }

    private Integer toInt(Object v) {
        if (v == null) return 0;
        if (v instanceof Number) return ((Number) v).intValue();
        if (v instanceof String && !((String) v).isEmpty()) return Integer.parseInt((String) v);
        return 0;
    }
}
