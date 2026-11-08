# 客户端 SDK

终端软件接入卡密授权系统的多语言客户端库。接口契约见 [docs/openapi.json](../docs/openapi.json)（服务端同步托管在 `/openapi.json`）。

## 集成标准流程

```
1. 客户端启动 → POST /login（Softid + Card + Mac）
2. 登录成功拿到 16 位 token（会话 24h 有效）
3. 运行期间定时 POST /heartbeat（建议每 10 分钟）保活会话
4. 收到 -1002 → 会话失效，重新 /login；收到 -1005 → 卡密到期，引导续费
5. 退出时 POST /logout 释放会话（换设备登录前必须先登出，否则 -1011）
```

## 可用 SDK

| 语言 | 路径 | 依赖 | 说明 |
|---|---|---|---|
| Python | [sdk/python/auth_client.py](python/auth_client.py) | 无（标准库） | 含后台心跳线程、错误码映射 |
| C# | [sdk/csharp/AuthClient.cs](csharp/AuthClient.cs) | 无（.NET Standard 2.0+） | 单文件，放入项目即可用 |
| Java | [sdk/java/AuthClient.java](java/AuthClient.java) | 无（JDK 11+） | 单文件，含极简 JSON 解析 |

## Python 示例

```python
from auth_client import AuthClient, AuthError

client = AuthClient(base_url="http://your-server:3000", softid="1460MREWAFMB3XQFEP")
result = client.login(card="Ab3xK9mPq2Rt5W", mac=get_mac())
if not result.ok:
    print("登录失败:", result.errcode, result.message)
    raise SystemExit(1)

def on_expired(err):
    print("会话失效/卡密到期:", err)
    # 引导用户续费或重新登录

client.start_heartbeat(card="Ab3xK9mPq2Rt5W", on_expired=on_expired)
print("剩余有效期:", client.expiry(card="Ab3xK9mPq2Rt5W"))
```

## 机器码（Mac）生成建议

机器码是设备唯一标识，取值需满足：同设备稳定、不同设备不同、用户难以自行修改。常见做法：

- **Windows**：主板序列号 / `MachineGuid`（注册表 `HKLM\SOFTWARE\Microsoft\Cryptography`）
- **Linux/macOS**：`/etc/machine-id` 或 `IOPlatformUUID`

## Webhook 接收端验签

后台配置的 webhook 每次推送都会携带 `X-Webhook-Signature: sha256=<hex>`，验签方式：

```python
import hmac, hashlib
expected = "sha256=" + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
assert hmac.compare_digest(expected, received_signature)
```

事件类型：`card.activated`（首激）、`card.disabled`、`card.enabled`、`card.deleted`，payload 为 `{event, timestamp, data}`。


## Node.js 离线验签

在线登录的 `license` 字段形如 `{ license: { ... }, signature: "..." }`；服务端 `CARD_OFFLINE_HOURS=0` 时返回 `null`。启用后最长24小时，且不超过卡密到期时间。公钥由发行商从已认证的管理接口 `/api/admin/license-public-key` 获取后，随客户端发布并固定信任；不要使用待验证响应提供的公钥。

```js
const { verifyOfflineLicense } = require('./node/offline_license');
const valid = verifyOfflineLicense(loginResult.license, embeddedPublicKeyBase64, {
  app_id: yourNumericAppId,
  device_id: yourLocalDeviceId
});
if (!valid) throw new Error('需要联网重新验证授权');
```

该模块无第三方依赖，验证签名、应用、设备、签发及到期时间。公钥为 Base64 DER SPKI；私钥只保存在服务端。离线状态无法立即接收封禁，客户端系统时钟回拨防护仍需接入方制定可信时间策略。Python/C#/Java/Go SDK 当前尚未集成此离线模块。
