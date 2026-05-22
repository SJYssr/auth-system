package com.authsystem.controller;

import com.authsystem.dto.ApiResponse;
import com.authsystem.model.entity.*;
import com.authsystem.service.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    @Autowired private AppService appService;
    @Autowired private CardService cardService;
    @Autowired private VersionService versionService;
    @Autowired private DashboardService dashboardService;
    @Autowired private SiteDataService siteDataService;
    @Autowired private LogService logService;
    @Autowired private ApiManageService apiManageService;
    @Autowired private ErrorCodeService errorCodeService;
    @Autowired private HttpServletRequest request;

    // ===== Dashboard =====
    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse> dashboard() {
        return ok(new ApiResponse(true, dashboardService.getDashboard(), null));
    }



    // ===== Apps =====
    @GetMapping("/apps")
    public ResponseEntity<ApiResponse> listApps(@RequestParam Map<String, String> params) {
        Map<String, Object> result = appService.getAdminApps(params);
        @SuppressWarnings("unchecked")
        Map<String, Object> pagination = (Map<String, Object>) result.get("pagination");
        return ok(new ApiResponse(true, result.get("data"), "", pagination));
    }

    @PostMapping("/apps")
    public ResponseEntity<ApiResponse> createApp(@RequestBody Map<String, Object> body) {
        String appName = str(body, "app_name");
        if (isEmpty(appName)) return ok(new ApiResponse(false, null, "app_name不能为空"));
        App app = appService.createApp(body);
        logService.log(currentUser(), "create", "apps", "app", app.getId(), app.getAppName(),
                "创建新应用: " + app.getAppName(), null);
        return ok(new ApiResponse(true, null, "应用添加成功"));
    }

    @PutMapping("/apps/{id}")
    public ResponseEntity<ApiResponse> updateApp(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        if (body.containsKey("app_name") && isEmpty(str(body, "app_name")))
            return ok(new ApiResponse(false, null, "app_name不能为空"));
        App app = appService.updateApp(id, body);
        logService.log(currentUser(), "update", "apps", "app", app.getId(), app.getAppName(),
                "更新应用 " + app.getAppName(), null);
        return ok(new ApiResponse(true, app, "应用更新成功"));
    }

    @DeleteMapping("/apps/{id}")
    public ResponseEntity<ApiResponse> deleteApp(@PathVariable Integer id) {
        App app = appService.getAppById(id);
        if (app == null) return ok(new ApiResponse(false, null, "应用不存在"));
        if (cardService.countByAppId(id) > 0)
            return ok(new ApiResponse(false, null, "无法删除：该应用还有关联的卡密记录"));
        String appName = app.getAppName();
        appService.deleteApp(id);
        logService.log(currentUser(), "delete", "apps", "app", id, appName,
                "删除应用: " + appName + " (ID: " + id + ")", null);
        return ok(new ApiResponse(true, null, "应用删除成功"));
    }

    // ===== Cards =====
    @GetMapping("/cards")
    public ResponseEntity<ApiResponse> listCards(@RequestParam Map<String, String> params) {
        Map<String, Object> result = cardService.getCards(params);
        @SuppressWarnings("unchecked")
        Map<String, Object> pagination = (Map<String, Object>) result.get("pagination");
        return ok(new ApiResponse(true, result.get("data"), "", pagination));
    }

    @PostMapping("/cards")
    public ResponseEntity<ApiResponse> createCards(@RequestBody Map<String, Object> body) {
        if (!body.containsKey("app_id") || !body.containsKey("card_type") || !body.containsKey("points"))
            return ok(new ApiResponse(false, null, "app_id, card_type, points 为必填项"));
        List<Map<String, Object>> cards = cardService.createCards(body);
        logService.log(currentUser(), "create", "cards", "card", null, null,
                "批量生成 " + cards.size() + " 张卡密", null);
        return ok(new ApiResponse(true, cards, "成功生成 " + cards.size() + " 张卡密"));
    }

    @PutMapping("/cards/{id}")
    public ResponseEntity<ApiResponse> updateCard(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        try {
            Card card = cardService.updateCard(id, body);
            logService.log(currentUser(), "update", "cards", "card", card.getId(), card.getCard(),
                    "更新卡密: " + card.getCard(), null);
            return ok(new ApiResponse(true, card, "卡密更新成功"));
        } catch (Exception e) {
            return ok(new ApiResponse(false, null, e.getMessage()));
        }
    }

    @DeleteMapping("/cards/{id}")
    public ResponseEntity<ApiResponse> deleteCard(@PathVariable Integer id) {
        cardService.deleteCard(id);
        logService.log(currentUser(), "delete", "cards", "card", id, null, "删除卡密 ID: " + id, null);
        return ok(new ApiResponse(true, null, "卡密删除成功"));
    }

    // ===== Versions =====
    @GetMapping("/versions")
    public ResponseEntity<ApiResponse> listVersions(@RequestParam Map<String, String> params) {
        Map<String, Object> result = versionService.getVersions(params);
        @SuppressWarnings("unchecked")
        Map<String, Object> pagination = (Map<String, Object>) result.get("pagination");
        return ok(new ApiResponse(true, result.get("data"), "", pagination));
    }

    @PostMapping("/versions")
    public ResponseEntity<ApiResponse> createVersion(@RequestBody Map<String, Object> body) {
        try {
            if (!body.containsKey("app_id") || !body.containsKey("version") || !body.containsKey("version_name"))
                return ok(new ApiResponse(false, null, "app_id, version, version_name 为必填项"));
            AppVersion ver = versionService.createVersion(body);
            logService.log(currentUser(), "create", "versions", "version", ver.getId(), ver.getVersion(),
                    "创建版本: " + ver.getVersion(), null);
            return ok(new ApiResponse(true, Map.of("id", ver.getId()), "版本创建成功"));
        } catch (Exception e) {
            return ok(new ApiResponse(false, null, e.getMessage()));
        }
    }

    @PutMapping("/versions/{id}")
    public ResponseEntity<ApiResponse> updateVersion(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        AppVersion ver = versionService.updateVersion(id, body);
        logService.log(currentUser(), "update", "versions", "version", ver.getId(), ver.getVersion(),
                "更新版本: " + ver.getVersion(), null);
        return ok(new ApiResponse(true, ver, "版本更新成功"));
    }

    @DeleteMapping("/versions/{id}")
    public ResponseEntity<ApiResponse> deleteVersion(@PathVariable Integer id) {
        versionService.deleteVersion(id);
        logService.log(currentUser(), "delete", "versions", "version", id, null, "删除版本 ID: " + id, null);
        return ok(new ApiResponse(true, null, "版本删除成功"));
    }

    // ===== Logs =====
    @GetMapping("/logs")
    public ResponseEntity<ApiResponse> listLogs(@RequestParam Map<String, String> params) {
        Map<String, Object> result = logService.getLogs(params);
        return ok(new ApiResponse(true, result, null));
    }

    @DeleteMapping("/logs")
    public ResponseEntity<ApiResponse> deleteLogs(@RequestBody Map<String, Object> body) {
        Map<String, Object> result = logService.deleteLogs(body);
        logService.log(currentUser(), "delete", "logs", "logs", null, null, "删除日志记录", null);
        return ok(new ApiResponse(true, null, "成功删除 " + result.get("deleted_count") + " 条日志记录"));
    }

    // ===== Site Data =====
    @GetMapping("/site-data")
    public ResponseEntity<ApiResponse> getSiteData() {
        return ok(new ApiResponse(true, siteDataService.getSiteData(), null));
    }

    @PutMapping("/site-data")
    public ResponseEntity<ApiResponse> updateSiteData(@RequestBody Map<String, Object> body) {
        String[] required = {"site_name", "logo_url", "favicon_url", "contact_email", "contact_phone"};
        for (String field : required) {
            if (!body.containsKey(field) || body.get(field) == null || body.get(field).toString().isEmpty())
                return ok(new ApiResponse(false, null, field + "不能为空"));
        }
        String email = str(body, "contact_email");
        if (!email.contains("@")) return ok(new ApiResponse(false, null, "邮箱格式不正确"));
        siteDataService.updateSiteData(body);
        return ok(new ApiResponse(true, null, "网站信息更新成功"));
    }

    // ===== APIs =====
    @GetMapping("/apis")
    public ResponseEntity<ApiResponse> listApis(@RequestParam Map<String, String> params) {
        Map<String, Object> result = apiManageService.getApis(params);
        @SuppressWarnings("unchecked")
        Map<String, Object> pagination = (Map<String, Object>) result.get("pagination");
        return ok(new ApiResponse(true, result.get("data"), "", pagination));
    }

    @PostMapping("/apis")
    public ResponseEntity<ApiResponse> createApi(@RequestBody Map<String, Object> body) {
        try {
            Api api = apiManageService.createApi(body);
            return ok(new ApiResponse(true, api, "API添加成功"));
        } catch (Exception e) {
            return ok(new ApiResponse(false, null, e.getMessage()));
        }
    }

    @PutMapping("/apis/{id}")
    public ResponseEntity<ApiResponse> updateApi(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        try {
            Api api = apiManageService.updateApi(id, body);
            return ok(new ApiResponse(true, api, "API更新成功"));
        } catch (Exception e) {
            return ok(new ApiResponse(false, null, e.getMessage()));
        }
    }

    @DeleteMapping("/apis/{id}")
    public ResponseEntity<ApiResponse> deleteApi(@PathVariable Integer id) {
        apiManageService.deleteApi(id);
        return ok(new ApiResponse(true, null, "API删除成功"));
    }

    // ===== Error Codes =====
    @GetMapping("/error-codes")
    public ResponseEntity<ApiResponse> listErrorCodes(@RequestParam Map<String, String> params) {
        Map<String, Object> result = errorCodeService.getErrorCodes(params);
        @SuppressWarnings("unchecked")
        Map<String, Object> pagination = (Map<String, Object>) result.get("pagination");
        return ok(new ApiResponse(true, result.get("data"), "", pagination));
    }

    @PostMapping("/error-codes")
    public ResponseEntity<ApiResponse> createErrorCode(@RequestBody Map<String, Object> body) {
        try {
            ErrorCode ec = errorCodeService.createErrorCode(body);
            return ok(new ApiResponse(true, ec, "错误码添加成功"));
        } catch (Exception e) {
            return ok(new ApiResponse(false, null, e.getMessage()));
        }
    }

    @PutMapping("/error-codes/{id}")
    public ResponseEntity<ApiResponse> updateErrorCode(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        try {
            ErrorCode ec = errorCodeService.updateErrorCode(id, body);
            return ok(new ApiResponse(true, ec, "错误码更新成功"));
        } catch (Exception e) {
            return ok(new ApiResponse(false, null, e.getMessage()));
        }
    }

    @DeleteMapping("/error-codes/{id}")
    public ResponseEntity<ApiResponse> deleteErrorCode(@PathVariable Integer id) {
        errorCodeService.deleteErrorCode(id);
        return ok(new ApiResponse(true, null, "错误码删除成功"));
    }

    // helpers
    private Admin currentUser() {
        return (Admin) request.getAttribute("currentUser");
    }

    private String str(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val != null ? val.toString() : null;
    }

    private boolean isEmpty(String s) { return s == null || s.isEmpty(); }

    private ResponseEntity<ApiResponse> ok(ApiResponse res) { return ResponseEntity.ok(res); }
}
