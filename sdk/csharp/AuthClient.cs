// 卡密授权系统 C# 客户端（.NET Standard 2.0+，仅标准库）
//
// 用法：
//   var client = new AuthClient("http://your-server:3000", "1460MREWAFMB3XQFEP");
//   var result = client.Login("Ab3xK9mPq2Rt5W", GetMac());
//   if (!result.Ok) throw new Exception($"[{result.Errcode}] {result.Message}");
//   Console.WriteLine($"会话 token: {result.Token}");
//
// 接口契约见仓库 docs/openapi.json。
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

namespace AuthSystem
{
    public class AuthException : Exception
    {
        public string Errcode { get; }

        private static readonly Dictionary<string, string> Messages = new Dictionary<string, string>
        {
            ["-1001"] = "参数缺失或格式错误",
            ["-1002"] = "认证失败（请重新登录）",
            ["-1004"] = "卡密不存在",
            ["-1005"] = "卡密已过期",
            ["-1006"] = "卡密已禁用",
            ["-1007"] = "应用不存在或已下架",
            ["-1008"] = "版本不匹配，需强制更新",
            ["-1009"] = "服务器内部错误",
            ["-1010"] = "机器码不匹配",
            ["-1011"] = "卡密已在其他设备登录",
            ["-1012"] = "管理员激活配额已满",
        };

        public AuthException(string errcode)
            : base($"[{errcode}] {(Messages.TryGetValue(errcode, out var m) ? m : "未知错误")}")
        {
            Errcode = errcode;
        }
    }

    public class LoginResult
    {
        public bool Ok { get; init; }
        public string Token { get; init; }
        public string Errcode { get; init; }
        public string Message { get; init; }
    }

    public sealed class AuthClient : IDisposable
    {
        private readonly HttpClient _http;
        private readonly string _softid;

        public string Token { get; private set; }

        public AuthClient(string baseUrl, string softid)
        {
            if (string.IsNullOrEmpty(softid) || softid.Length != 18)
                throw new ArgumentException("softid 必须为 18 位字母数字");
            _softid = softid;
            _http = new HttpClient { BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/"), Timeout = TimeSpan.FromSeconds(10) };
        }

        private async Task<Dictionary<string, object>> PostAsync(string path, string json)
        {
            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            using var resp = await _http.PostAsync(path, content);
            var body = await resp.Content.ReadAsStringAsync();
            return SimpleJson.Parse(body);
        }

        /// <summary>卡密登录。成功后 Token 保存在实例属性。</summary>
        public async Task<LoginResult> Login(string card, string mac, string version = null)
        {
            var json = version != null
                ? $"{{\"Softid\":\"{_softid}\",\"Card\":\"{Escape(card)}\",\"Mac\":\"{Escape(mac)}\",\"Version\":\"{Escape(version)}\"}}"
                : $"{{\"Softid\":\"{_softid}\",\"Card\":\"{Escape(card)}\",\"Mac\":\"{Escape(mac)}\"}}";
            var data = await PostAsync("login", json);
            if (data.TryGetValue("token", out var token) && token?.ToString().Length > 0)
            {
                Token = token.ToString();
                return new LoginResult { Ok = true, Token = Token };
            }
            var errcode = data.TryGetValue("errcode", out var e) ? e.ToString() : "-1009";
            return new LoginResult { Ok = false, Errcode = errcode };
        }

        public async Task HeartbeatAsync(string card)
        {
            RequireToken();
            var data = await PostAsync("heartbeat", TokenPayload(card));
            if (data.ContainsKey("errcode")) throw new AuthException(data["errcode"].ToString());
        }

        public async Task LogoutAsync(string card)
        {
            if (Token == null) return;
            await PostAsync("logout", TokenPayload(card));
            Token = null;
        }

        public async Task<string> ExpiryAsync(string card)
        {
            RequireToken();
            var data = await PostAsync("expiry", TokenPayload(card));
            if (data.ContainsKey("errcode")) throw new AuthException(data["errcode"].ToString());
            return data.TryGetValue("expires_at", out var v) ? v.ToString() : "";
        }

        public async Task<string> LatestVersionAsync()
        {
            var data = await PostAsync("version", $"{{\"Softid\":\"{_softid}\"}}");
            return data.TryGetValue("version", out var v) ? v.ToString() : "1.0.0";
        }

        private string TokenPayload(string card) =>
            $"{{\"Softid\":\"{_softid}\",\"Card\":\"{Escape(card)}\",\"Token\":\"{Escape(Token ?? "")}\"}}";

        private void RequireToken()
        {
            if (Token == null) throw new AuthException("-1002");
        }

        private static string Escape(string s) =>
            s.Replace("\\", "\\\\").Replace("\"", "\\\"");

        public void Dispose() => _http.Dispose();
    }

    // 极简 JSON 解析（仅本 SDK 所需的扁平对象结构；复杂场景请换 System.Text.Json）
    internal static class SimpleJson
    {
        public static Dictionary<string, object> Parse(string json)
        {
            var dict = new Dictionary<string, object>();
            var i = 0;
            SkipWs(json, ref i);
            Expect(json, ref i, '{');
            SkipWs(json, ref i);
            if (Peek(json, i) == '}') return dict;
            while (true)
            {
                SkipWs(json, ref i);
                var key = ParseString(json, ref i);
                SkipWs(json, ref i);
                Expect(json, ref i, ':');
                SkipWs(json, ref i);
                dict[key] = Peek(json, i) == '"' ? ParseString(json, ref i) : ParseLiteral(json, ref i);
                SkipWs(json, ref i);
                if (Peek(json, i) == ',') { i++; continue; }
                Expect(json, ref i, '}');
                break;
            }
            return dict;
        }

        private static char Peek(string s, int i) => s[i];
        private static void SkipWs(string s, ref int i) { while (i < s.Length && char.IsWhiteSpace(s[i])) i++; }
        private static void Expect(string s, ref int i, char c) { if (s[i] != c) throw new FormatException($"期望 {c} @ {i}"); i++; }

        private static string ParseString(string s, ref int i)
        {
            Expect(s, ref i, '"');
            var sb = new StringBuilder();
            while (s[i] != '"')
            {
                if (s[i] == '\\') { i++; sb.Append(s[i] == 'n' ? '\n' : s[i]); }
                else sb.Append(s[i]);
                i++;
            }
            i++;
            return sb.ToString();
        }

        private static object ParseLiteral(string s, ref int i)
        {
            var start = i;
            while (i < s.Length && s[i] != ',' && s[i] != '}') i++;
            var lit = s.Substring(start, i - start).Trim();
            return lit;
        }
    }
}
