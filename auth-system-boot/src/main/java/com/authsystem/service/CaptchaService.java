package com.authsystem.service;

import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class CaptchaService {

    private static final String CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int WIDTH = 120;
    private static final int HEIGHT = 44;
    private static final int LENGTH = 4;

    private final Map<String, String> store = new ConcurrentHashMap<>();

    public Map<String, String> generate() {
        String key = UUID.randomUUID().toString().replace("-", "");
        String code = randomCode();
        store.put(key, code);
        return Map.of("key", key, "image", "data:image/png;base64," + generateImage(code));
    }

    public boolean verify(String key, String code) {
        if (key == null || code == null) return false;
        String stored = store.remove(key);
        return stored != null && stored.equalsIgnoreCase(code);
    }

    private String randomCode() {
        StringBuilder sb = new StringBuilder(LENGTH);
        for (int i = 0; i < LENGTH; i++) {
            sb.append(CHARS.charAt(RANDOM.nextInt(CHARS.length())));
        }
        return sb.toString();
    }

    private String generateImage(String code) {
        BufferedImage image = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();

        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

        g.setColor(new Color(245, 247, 250));
        g.fillRect(0, 0, WIDTH, HEIGHT);

        for (int i = 0; i < 8; i++) {
            g.setColor(new Color(180 + RANDOM.nextInt(50), 180 + RANDOM.nextInt(50), 200 + RANDOM.nextInt(50)));
            int x1 = RANDOM.nextInt(WIDTH);
            int y1 = RANDOM.nextInt(HEIGHT);
            g.drawLine(x1, y1, x1 + RANDOM.nextInt(30) - 15, y1 + RANDOM.nextInt(20) - 10);
        }

        for (int i = 0; i < 30; i++) {
            g.setColor(new Color(150 + RANDOM.nextInt(80), 150 + RANDOM.nextInt(80), 180 + RANDOM.nextInt(70)));
            g.fillOval(RANDOM.nextInt(WIDTH), RANDOM.nextInt(HEIGHT), 2, 2);
        }

        int x = 8;
        for (int i = 0; i < code.length(); i++) {
            g.setColor(new Color(30 + RANDOM.nextInt(50), 80 + RANDOM.nextInt(40), 160 + RANDOM.nextInt(60)));
            g.setFont(new Font("Arial", Font.BOLD, 24 + RANDOM.nextInt(6)));
            double angle = (RANDOM.nextDouble() - 0.5) * 0.4;
            g.rotate(angle, x + 12, 28);
            g.drawString(String.valueOf(code.charAt(i)), x, 30);
            g.rotate(-angle, x + 12, 28);
            x += 24 + RANDOM.nextInt(4);
        }

        g.dispose();

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            ImageIO.write(image, "png", baos);
            return Base64.getEncoder().encodeToString(baos.toByteArray());
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate captcha image", e);
        }
    }
}
