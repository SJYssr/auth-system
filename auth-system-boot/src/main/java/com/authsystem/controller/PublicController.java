package com.authsystem.controller;

import com.authsystem.dto.ApiResponse;
import com.authsystem.model.entity.App;
import com.authsystem.model.entity.Admin;
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
    @Autowired private CaptchaService captchaService;
    @Autowired private com.authsystem.repository.UserRepository userRepository;
    @Autowired private HttpServletRequest request;

    @GetMapping("/captcha")
    public ResponseEntity<ApiResponse> captcha() {
        return ok(new ApiResponse(true, captchaService.generate(), null));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse> login(@RequestBody Map<String, Object> body) {
        String username = str(body, "username");
        String password = str(body, "password");
        String captchaKey = str(body, "captcha_key");
        String captchaCode = str(body, "captcha_code");
        if (isEmpty(username) || isEmpty(password) || isEmpty(captchaKey) || isEmpty(captchaCode))
            return ok(new ApiResponse(false, null, "用户名、密码和验证码不能为空"));
        if (!captchaService.verify(captchaKey, captchaCode)) {
            return ok(new ApiResponse(false, null, "验证码错误"));
        }
        Map<String, Object> result = authService.login(username, password);
        if (result == null) {
            logService.log(null, "login", "system", null, null, null, "管理员登录失败: " + username, null, "failure");
            return ok(new ApiResponse(false, null, "用户名或密码错误，或非管理员账户"));
        }
        Admin loginAdmin = authService.validateToken((String) result.get("token"));
        logService.log(loginAdmin, "login", "system", null, null, null, "管理员登录成功", null);
        return ok(new ApiResponse(true, result, "登录成功"));
    }

    @PostMapping("/user-login")
    public ResponseEntity<ApiResponse> userLogin(@RequestBody Map<String, Object> body) {
        String username = str(body, "username");
        String password = str(body, "password");
        String captchaKey = str(body, "captcha_key");
        String captchaCode = str(body, "captcha_code");
        if (isEmpty(username) || isEmpty(password) || isEmpty(captchaKey) || isEmpty(captchaCode))
            return ok(new ApiResponse(false, null, "用户名、密码和验证码不能为空"));
        if (!captchaService.verify(captchaKey, captchaCode))
            return ok(new ApiResponse(false, null, "验证码错误"));

        java.util.Optional<com.authsystem.model.entity.User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isEmpty() || !"enabled".equals(userOpt.get().getStatus())
                || !AuthService.getEncoder().matches(password, userOpt.get().getPassword())) {
            return ok(new ApiResponse(false, null, "用户名或密码错误"));
        }

        com.authsystem.model.entity.User user = userOpt.get();
        String token = AuthService.generateTokenStatic(user.getId(), authService.getSecret());
        user.setToken(token);
        user.setLastLogin(java.time.LocalDateTime.now());
        userRepository.save(user);

        Map<String, Object> result = new HashMap<>();
        result.put("token", token);
        result.put("username", user.getUsername());
        return ok(new ApiResponse(true, result, "登录成功"));
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse> register(@RequestBody Map<String, Object> body) {
        String username = str(body, "username");
        String email = str(body, "email");
        String password = str(body, "password");
        if (isEmpty(username) || isEmpty(email) || isEmpty(password))
            return ok(new ApiResponse(false, null, "用户名、邮箱和密码不能为空"));
        if (username.length() < 3)
            return ok(new ApiResponse(false, null, "用户名至少3位"));
        if (password.length() < 6)
            return ok(new ApiResponse(false, null, "密码至少6位"));
        if (userRepository.findByUsername(username).isPresent())
            return ok(new ApiResponse(false, null, "用户名已存在"));
        com.authsystem.model.entity.User user = new com.authsystem.model.entity.User();
        user.setUsername(username);
        user.setPassword(AuthService.encodePassword(password));
        user.setStatus("enabled");
        user.setCreatedAt(java.time.LocalDateTime.now());
        user.setUpdatedAt(java.time.LocalDateTime.now());
        userRepository.save(user);
        return ok(new ApiResponse(true, null, "注册成功"));
    }

    @GetMapping("/init")
    public ResponseEntity<ApiResponse> init() {
        String token = getToken();
        Map<String, Object> initData = initService.getInitData(token);
        if (token != null && !token.isEmpty()) {
            Map<String, Object> loginStatus = new LinkedHashMap<>();
            Admin admin = authService.validateToken(token);
            if (admin != null && "enabled".equals(admin.getStatus())) {
                loginStatus.put("is_logged_in", true);
                Map<String, Object> userMap = new LinkedHashMap<>();
                userMap.put("id", admin.getId());
                userMap.put("username", admin.getUsername());
                userMap.put("email", admin.getEmail());
                userMap.put("is_superuser", admin.getIsSuperuser() == 1);
                userMap.put("status", admin.getStatus());
                userMap.put("role", "admin");
                loginStatus.put("user", userMap);
            } else {
                java.util.Optional<com.authsystem.model.entity.User> userOpt = userRepository.findByToken(token);
                if (userOpt.isPresent() && "enabled".equals(userOpt.get().getStatus())) {
                    loginStatus.put("is_logged_in", true);
                    Map<String, Object> userMap = new LinkedHashMap<>();
                    userMap.put("id", userOpt.get().getId());
                    userMap.put("username", userOpt.get().getUsername());
                    userMap.put("role", "user");
                    loginStatus.put("user", userMap);
                }
            }
            if (!loginStatus.isEmpty()) {
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
