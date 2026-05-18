package com.authsystem.controller;

import com.authsystem.dto.ApiResponse;
import com.authsystem.model.entity.App;
import com.authsystem.model.entity.User;
import com.authsystem.service.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/public")
public class PublicController {

    @Autowired private AuthService authService;
    @Autowired private AppService appService;
    @Autowired private InitService initService;
    @Autowired private LogService logService;
    @Autowired private HttpServletRequest request;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse> login(@RequestBody Map<String, Object> body) {
        String username = str(body, "username");
        String password = str(body, "password");
        if (isEmpty(username) || isEmpty(password))
            return ok(new ApiResponse(false, null, "用户名和密码不能为空"));
        Map<String, Object> result = authService.login(username, password);
        if (result == null) {
            logService.log(null, "login", "system", null, null, null, "管理员登录失败: " + username, null);
            return ok(new ApiResponse(false, null, "用户名或密码错误，或非管理员账户"));
        }
        User loginUser = authService.validateToken((String) result.get("token"));
        logService.log(loginUser, "login", "system", null, null, null, "管理员登录成功", null);
        return ok(new ApiResponse(true, result, "登录成功"));
    }

    @GetMapping("/init")
    public ResponseEntity<ApiResponse> init() {
        String token = getToken();
        Map<String, Object> initData = initService.getInitData(token);
        if (token != null && !token.isEmpty()) {
            User user = authService.validateToken(token);
            if (user != null && "enabled".equals(user.getStatus())) {
                Map<String, Object> loginStatus = new LinkedHashMap<>();
                loginStatus.put("is_logged_in", true);
                Map<String, Object> userMap = new LinkedHashMap<>();
                userMap.put("id", user.getId());
                userMap.put("username", user.getUsername());
                userMap.put("email", user.getEmail());
                userMap.put("is_superuser", user.getIsSuperuser() == 1);
                userMap.put("status", user.getStatus());
                loginStatus.put("user", userMap);
                initData.put("login_status", loginStatus);
            }
        }
        return ok(new ApiResponse(true, initData, null));
    }

    @GetMapping("/apps")
    public ResponseEntity<ApiResponse> apps(@RequestParam Map<String, String> params) {
        return ok(new ApiResponse(true, appService.getApps(params), "获取应用列表成功"));
    }

    @GetMapping("/apps/{id}")
    public ResponseEntity<ApiResponse> appDetail(@PathVariable Integer id) {
        App app = appService.getAppById(id);
        if (app == null || !"enabled".equals(app.getStatus()))
            return ok(new ApiResponse(false, null, "应用不存在或已下架"));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", app.getId());
        data.put("app_name", app.getAppName());
        data.put("description", app.getDescription());
        data.put("is_free", app.getIsFree() == 1);
        data.put("version", app.getVersion());
        data.put("developer", app.getDeveloper());
        data.put("icon_url", app.getIconUrl());
        data.put("status", app.getStatus());
        data.put("created_at", app.getCreatedAt());
        data.put("stats", Map.of("total_users", 0, "active_users", 0));
        data.put("docs", List.of());
        return ok(new ApiResponse(true, data, "获取应用详情成功"));
    }

    // helpers
    private String getToken() {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) return authHeader.substring(7);
        return request.getParameter("token");
    }

    private String str(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val != null ? val.toString() : null;
    }

    private boolean isEmpty(String s) { return s == null || s.isEmpty(); }

    private ResponseEntity<ApiResponse> ok(ApiResponse res) { return ResponseEntity.ok(res); }
}
