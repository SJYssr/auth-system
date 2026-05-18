package com.authsystem.service;

import com.authsystem.model.entity.User;
import com.authsystem.repository.UserRepository;
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
    private UserRepository userRepository;

    private static final String SECRET_KEY = "your_secret_key_here_change_in_production";

    public Map<String, Object> login(String username, String password) {
        String passwordHash = md5(password);

        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isEmpty() || !userOpt.get().getPassword().equals(passwordHash)
                || userOpt.get().getIsSuperuser() != 1
                || !"enabled".equals(userOpt.get().getStatus())) {
            return null;
        }

        User user = userOpt.get();
        String token = generateToken(user.getId());
        user.setToken(token);
        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);

        Map<String, Object> result = new HashMap<>();
        result.put("token", token);
        Map<String, Object> userMap = new HashMap<>();
        userMap.put("id", user.getId());
        userMap.put("username", user.getUsername());
        userMap.put("email", user.getEmail());
        userMap.put("is_superuser", user.getIsSuperuser() == 1);
        result.put("user", userMap);
        return result;
    }

    public User validateToken(String token) {
        return userRepository.findByToken(token).orElse(null);
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
