package com.authsystem.service;

import com.authsystem.model.entity.Admin;
import com.authsystem.repository.AdminRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Service
public class AuthService {

    @Autowired
    private AdminRepository adminRepository;

    private static final String SECRET_KEY = "your_secret_key_here_change_in_production";

    public Map<String, Object> login(String username, String password) {
        String passwordHash = md5(password);

        Optional<Admin> adminOpt = adminRepository.findByUsername(username);
        if (adminOpt.isEmpty() || !adminOpt.get().getPassword().equals(passwordHash)
                || adminOpt.get().getIsSuperuser() != 1
                || !"enabled".equals(adminOpt.get().getStatus())) {
            return null;
        }

        Admin admin = adminOpt.get();
        String token = generateToken(admin.getId());
        admin.setToken(token);
        admin.setLastLogin(LocalDateTime.now());
        adminRepository.save(admin);

        Map<String, Object> result = new HashMap<>();
        result.put("token", token);
        Map<String, Object> userMap = new HashMap<>();
        userMap.put("id", admin.getId());
        userMap.put("username", admin.getUsername());
        userMap.put("email", admin.getEmail());
        userMap.put("is_superuser", admin.getIsSuperuser() == 1);
        result.put("user", userMap);
        return result;
    }

    public Admin validateToken(String token) {
        return adminRepository.findByToken(token).orElse(null);
    }

    public static String generateToken(Integer userId) {
        String raw = userId + System.currentTimeMillis() + SECRET_KEY;
        return sha256(raw);
    }

    public static String md5(String input) {
        return hash(input, "MD5");
    }

    public static String sha256(String input) {
        return hash(input, "SHA-256");
    }

    private static String hash(String input, String algorithm) {
        try {
            MessageDigest md = MessageDigest.getInstance(algorithm);
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }
}
