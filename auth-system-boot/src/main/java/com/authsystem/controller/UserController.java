package com.authsystem.controller;

import com.authsystem.dto.ApiResponse;
import com.authsystem.model.entity.User;
import com.authsystem.service.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/user")
public class UserController {

    @Autowired private AppService appService;
    @Autowired private CardService cardService;
    @Autowired private VersionService versionService;
    @Autowired private HttpServletRequest request;

    private Integer userId() {
        User u = (User) request.getAttribute("currentUser");
        return u.getId();
    }

    private Map<String, String> userParams(Map<String, String> params) {
        if (params == null) params = new HashMap<>();
        params.put("user_id", String.valueOf(userId()));
        return params;
    }

    private Map<String, Object> userBody(Map<String, Object> body) {
        body.put("user_id", userId());
        return body;
    }

    // ===== Apps =====
    @GetMapping("/apps")
    public ResponseEntity<ApiResponse> listApps(@RequestParam Map<String, String> params) {
        return ok(appService.getAdminApps(userParams(params)));
    }

    @PostMapping("/apps")
    public ResponseEntity<ApiResponse> createApp(@RequestBody Map<String, Object> body) {
        return ok(appService.createApp(userBody(body)));
    }

    @PutMapping("/apps/{id}")
    public ResponseEntity<ApiResponse> updateApp(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        return ok(appService.updateApp(id, body));
    }

    @DeleteMapping("/apps/{id}")
    public ResponseEntity<ApiResponse> deleteApp(@PathVariable Integer id) {
        appService.deleteApp(id);
        return ok(new ApiResponse(true, null, "删除成功"));
    }

    // ===== Cards =====
    @GetMapping("/cards")
    public ResponseEntity<ApiResponse> listCards(@RequestParam Map<String, String> params) {
        Map<String, Object> result = cardService.getCards(userParams(params));
        return ok(new ApiResponse(true, result.get("data"), "", (Map) result.get("pagination")));
    }

    @PostMapping("/cards")
    public ResponseEntity<ApiResponse> createCards(@RequestBody Map<String, Object> body) {
        return ok(new ApiResponse(true, cardService.createCards(userBody(body)), "生成成功"));
    }

    @PutMapping("/cards/{id}")
    public ResponseEntity<ApiResponse> updateCard(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        return ok(new ApiResponse(true, cardService.updateCard(id, body), "更新成功"));
    }

    @DeleteMapping("/cards/{id}")
    public ResponseEntity<ApiResponse> deleteCard(@PathVariable Integer id) {
        cardService.deleteCard(id);
        return ok(new ApiResponse(true, null, "删除成功"));
    }

    // ===== Versions =====
    @GetMapping("/versions")
    public ResponseEntity<ApiResponse> listVersions(@RequestParam Map<String, String> params) {
        Map<String, Object> result = versionService.getVersions(userParams(params));
        return ok(new ApiResponse(true, result.get("data"), "", (Map) result.get("pagination")));
    }

    @PostMapping("/versions")
    public ResponseEntity<ApiResponse> createVersion(@RequestBody Map<String, Object> body) {
        return ok(new ApiResponse(true, versionService.createVersion(userBody(body)), "创建成功"));
    }

    @PutMapping("/versions/{id}")
    public ResponseEntity<ApiResponse> updateVersion(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        return ok(new ApiResponse(true, versionService.updateVersion(id, body), "更新成功"));
    }

    @DeleteMapping("/versions/{id}")
    public ResponseEntity<ApiResponse> deleteVersion(@PathVariable Integer id) {
        versionService.deleteVersion(id);
        return ok(new ApiResponse(true, null, "删除成功"));
    }

    // ===== Dashboard =====
    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse> dashboard() {
        Map<String, String> params = userParams(new HashMap<>());
        Map<String, Object> appsResult = appService.getAdminApps(new HashMap<>(params));
        Map<String, Object> cardsResult = cardService.getCards(new HashMap<>(params));

        List appsList = (List) appsResult.get("data");
        List cardsList = (List) cardsResult.get("data");
        long totalCards = cardsList != null ? cardsList.size() : 0;

        Map<String, Object> overview = new HashMap<>();
        overview.put("apps", Map.of("total", appsList != null ? appsList.size() : 0, "enabled", 0, "disabled", 0));
        overview.put("cards", Map.of("total", (int) totalCards, "activated", 0, "inactive", 0, "expired", 0, "enabled", 0));
        overview.put("online", Map.of("count", 0));

        Map<String, Object> data = new HashMap<>();
        data.put("overview", overview);
        data.put("recent_cards", cardsList != null ? cardsList : List.of());
        data.put("app_distribution", List.of());
        data.put("revenue", List.of());
        data.put("recent_logs", List.of());
        return ResponseEntity.ok(new ApiResponse(true, data, null));
    }

    @SuppressWarnings("unchecked")
    private ResponseEntity<ApiResponse> ok(Object result) {
        if (result instanceof ApiResponse) return ResponseEntity.ok((ApiResponse) result);
        return ResponseEntity.ok(new ApiResponse(true, result, null));
    }
}
