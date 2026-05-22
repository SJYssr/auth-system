package com.authsystem.service;

import com.authsystem.model.entity.Admin;
import com.authsystem.repository.AdminRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
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

    private static final BCryptPasswordEncoder ENCODER = new BCryptPasswordEncoder();

    @Value("${auth.secret-key}")
    private String secretKey;

    public String getSecret() { return secretKey; }

    public Map<String, Object> login(String username, String password) {
        Optional<Admin> adminOpt = adminRepository.findByUsername(username);
        if (adminOpt.isEmpty() || !"enabled".equals(adminOpt.get().getStatus())) {
            return null;
        }

        Admin admin = adminOpt.get();
        String stored = admin.getPassword();

        if (!verifyPassword(password, stored)) {
            return null;
        }

        if (admin.getIsSuperuser() != 1) {
            return null;
        }

        // 如果是旧 MD5 格式，升级为 BCrypt
        if (stored != null && stored.length() == 32) {
            admin.setPassword(ENCODER.encode(password));
        }

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

    private boolean verifyPassword(String raw, String stored) {
        if (stored == null) return false;
        // BCrypt hash 以 $2a$ 开头
        if (stored.startsWith("$2a$")) {
            return ENCODER.matches(raw, stored);
        }
        // 旧 MD5 兼容
        return md5(raw).equals(stored);
    }

    public Admin validateToken(String token) {
        return adminRepository.findByToken(token).orElse(null);
    }

    public String generateToken(Integer userId) {
        String raw = userId + System.currentTimeMillis() + secretKey;
        return sha256(raw);
    }

    public static BCryptPasswordEncoder getEncoder() {
        return ENCODER;
    }

    public static String encodePassword(String raw) {
        return ENCODER.encode(raw);
    }

    public static String generateTokenStatic(Integer userId, String secret) {
        String raw = userId + System.currentTimeMillis() + secret;
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
