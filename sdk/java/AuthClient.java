// 卡密授权系统 Java 客户端（JDK 11+，仅标准库 java.net.http）
//
// 用法：
//   var client = new AuthClient("http://your-server:3000", "1460MREWAFMB3XQFEP");
//   var result = client.login("Ab3xK9mPq2Rt5W", getMac());
//   if (!result.ok()) throw new RuntimeException("[" + result.errcode() + "] 登录失败");
//   System.out.println("会话 token: " + result.token());
//
// 接口契约见仓库 docs/openapi.json。
package authsystem;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

public class AuthClient {

    private static final Map<String, String> MESSAGES = new LinkedHashMap<>();

    static {
        MESSAGES.put("-1001", "参数缺失或格式错误");
        MESSAGES.put("-1002", "认证失败（请重新登录）");
        MESSAGES.put("-1004", "卡密不存在");
        MESSAGES.put("-1005", "卡密已过期");
        MESSAGES.put("-1006", "卡密已禁用");
        MESSAGES.put("-1007", "应用不存在或已下架");
        MESSAGES.put("-1008", "版本不匹配，需强制更新");
        MESSAGES.put("-1009", "服务器内部错误");
        MESSAGES.put("-1010", "机器码不匹配");
        MESSAGES.put("-1011", "卡密已在其他设备登录");
        MESSAGES.put("-1012", "管理员激活配额已满");
    }

    /** 业务错误。errcode 含义见 MESSAGES。 */
    public static class AuthException extends RuntimeException {
        public final String errcode;
        public AuthException(String errcode) {
            super("[" + errcode + "] " + MESSAGES.getOrDefault(errcode, "未知错误"));
            this.errcode = errcode;
        }
    }

    /** 登录结果。 */
    public record LoginResult(boolean ok, String token, String errcode) {}

    private final HttpClient http;
    private final String baseUrl;
    private final String softid;
    private String token;

    public AuthClient(String baseUrl, String softid) {
        if (softid == null || softid.length() != 18) {
            throw new IllegalArgumentException("softid 必须为 18 位字母数字");
        }
        this.baseUrl = baseUrl.replaceAll("/$", "") + "/";
        this.softid = softid;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    /** 卡密登录。成功后 token 保存在实例字段。 */
    public LoginResult login(String card, String mac, String version) {
        StringBuilder json = new StringBuilder()
            .append("{\"Softid\":\"").append(esc(softid)).append("\",\"Card\":\"").append(esc(card))
            .append("\",\"Mac\":\"").append(esc(mac)).append("\"");
        if (version != null) json.append(",\"Version\":\"").append(esc(version)).append("\"");
        json.append("}");
        Map<String, Object> data = post("login", json.toString());
        Object t = data.get("token");
        if (t != null && !t.toString().isEmpty()) {
            this.token = t.toString();
            return new LoginResult(true, token, null);
        }
        return new LoginResult(false, null, str(data.get("errcode"), "-1009"));
    }

    public void heartbeat(String card) {
        requireToken();
        Map<String, Object> data = post("heartbeat", tokenPayload(card));
        if (data.containsKey("errcode")) throw new AuthException(str(data.get("errcode"), "-1009"));
    }

    public void logout(String card) {
        if (token == null) return;
        post("logout", tokenPayload(card));
        token = null;
    }

    /** 获取到期时间（YYYY-MM-DD HH:mm:ss）。 */
    public String expiry(String card) {
        requireToken();
        Map<String, Object> data = post("expiry", tokenPayload(card));
        if (data.containsKey("errcode")) throw new AuthException(str(data.get("errcode"), "-1009"));
        Object v = data.get("expires_at");
        return v == null ? "" : v.toString();
    }

    /** 获取最新版本号。 */
    public String latestVersion() {
        Map<String, Object> data = post("version", "{\"Softid\":\"" + esc(softid) + "\"}");
        Object v = data.get("version");
        return v == null ? "1.0.0" : v.toString();
    }

    // ===== 内部 =====
    private Map<String, Object> post(String path, String json) {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + path))
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(10))
            .POST(HttpRequest.BodyPublishers.ofString(json))
            .build();
        HttpResponse<String> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException | InterruptedException e) {
            throw new AuthException("-1009");
        }
        // 限流（429）与服务端错误统一映射为 -1009，与 Python SDK 行为一致
        if (response.statusCode() == 429) {
            throw new AuthException("-1009");
        }
        return SimpleJson.parse(response.body());
    }

    private String tokenPayload(String card) {
        return "{\"Softid\":\"" + esc(softid) + "\",\"Card\":\"" + esc(card)
            + "\",\"Token\":\"" + esc(token == null ? "" : token) + "\"}";
    }

    private void requireToken() {
        if (token == null) throw new AuthException("-1002");
    }

    private static String esc(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static String str(Object o, String fallback) {
        return o == null ? fallback : o.toString();
    }

    /** 极简 JSON 解析（仅本 SDK 所需的扁平对象结构；复杂场景请换 Jackson/Gson）。 */
    static final class SimpleJson {
        static Map<String, Object> parse(String json) {
            Map<String, Object> dict = new LinkedHashMap<>();
            int i = 0;
            i = skipWs(json, i);
            if (i >= json.length() || json.charAt(i) != '{') throw new IllegalArgumentException("非 JSON 对象");
            i = skipWs(json, i + 1);
            if (json.charAt(i) == '}') return dict;
            while (true) {
                i = skipWs(json, i);
                int[] p = {i};
                String key = parseString(json, p);
                i = skipWs(json, p[0]);
                if (json.charAt(i) != ':') throw new IllegalArgumentException("格式错误");
                i = skipWs(json, i + 1);
                Object value;
                if (json.charAt(i) == '"') {
                    value = parseString(json, new int[] {i});
                    i = p[0];
                } else {
                    int start = i;
                    while (i < json.length() && json.charAt(i) != ',' && json.charAt(i) != '}') i++;
                    value = json.substring(start, i).trim();
                }
                dict.put(key, value);
                i = skipWs(json, i);
                if (json.charAt(i) == ',') { i++; continue; }
                if (json.charAt(i) == '}') break;
                throw new IllegalArgumentException("格式错误");
            }
            return dict;
        }

        private static int skipWs(String s, int i) {
            while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++;
            return i;
        }

        private static String parseString(String s, int[] p) {
            int i = p[0];
            if (s.charAt(i) != '"') throw new IllegalArgumentException("期望字符串");
            i++;
            StringBuilder sb = new StringBuilder();
            while (s.charAt(i) != '"') {
                if (s.charAt(i) == '\\') {
                    i++;
                    char c = s.charAt(i);
                    sb.append(c == 'n' ? '\n' : c);
                } else {
                    sb.append(s.charAt(i));
                }
                i++;
            }
            p[0] = i + 1;
            return sb.toString();
        }
    }
}
