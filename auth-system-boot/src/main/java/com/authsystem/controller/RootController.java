package com.authsystem.controller;

import com.authsystem.service.AppService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
public class RootController {

    @Autowired
    private AppService appService;

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

    private String str(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val != null ? val.toString() : null;
    }

    private boolean isEmpty(String s) { return s == null || s.isEmpty(); }
}
