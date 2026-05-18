package com.authsystem.controller;

import com.authsystem.service.AppService;
import com.authsystem.service.ClientAuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
public class RootController {

    @Autowired
    private AppService appService;

    @Autowired
    private ClientAuthService clientAuthService;

    @Autowired
    private HttpServletRequest request;

    @PostMapping(value = "/announcement", produces = "text/plain;charset=UTF-8")
    public ResponseEntity<String> announcement(@RequestBody Map<String, Object> body) {
        String softid = str(body, "Softid");
        if (isEmpty(softid)) {
            return ResponseEntity.ok("-1001");
        }
        try {
            String announcement = appService.getAnnouncement(softid);
            return ResponseEntity.ok(announcement);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.ok(e.getMessage());
        }
    }

    @PostMapping("/version")
    public ResponseEntity<Map<String, Object>> getVersion(@RequestBody Map<String, Object> body) {
        String softid = str(body, "Softid");
        if (isEmpty(softid)) {
            return ResponseEntity.ok(Map.of("errcode", "-1001"));
        }
        try {
            String version = appService.getLatestVersion(softid);
            return ResponseEntity.ok(Map.of("version", version));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.ok(Map.of("errcode", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, Object> body) {
        String softid = str(body, "Softid");
        String card = str(body, "Card");
        String mac = str(body, "Mac");
        if (isEmpty(softid) || isEmpty(card) || isEmpty(mac)) {
            return ResponseEntity.ok(Map.of("errcode", "-1001"));
        }
        try {
            String ip = getClientIp();
            String token = clientAuthService.cardLogin(softid, card, mac, ip);
            return ResponseEntity.ok(Map.of("token", token));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.ok(Map.of("errcode", e.getMessage()));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(@RequestBody Map<String, Object> body) {
        String softid = str(body, "Softid");
        String card = str(body, "Card");
        String token = str(body, "Token");
        if (isEmpty(softid) || isEmpty(card) || isEmpty(token)) {
            return ResponseEntity.ok(Map.of("errcode", "-1001"));
        }
        try {
            clientAuthService.cardLogout(softid, card, token);
            return ResponseEntity.ok(Map.of("result", "1"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.ok(Map.of("errcode", e.getMessage()));
        }
    }

    private String getClientIp() {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip != null && !ip.isEmpty() && !"unknown".equalsIgnoreCase(ip)) {
            return ip.split(",")[0].trim();
        }
        ip = request.getHeader("X-Real-IP");
        if (ip != null && !ip.isEmpty()) return ip;
        return request.getRemoteAddr();
    }

    private String str(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val != null ? val.toString() : null;
    }

    private boolean isEmpty(String s) { return s == null || s.isEmpty(); }
}
