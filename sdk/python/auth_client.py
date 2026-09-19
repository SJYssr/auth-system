"""卡密授权系统 Python 客户端 SDK（仅标准库，零依赖）。

用法：
    from auth_client import AuthClient

    client = AuthClient(base_url="http://your-server:3000", softid="1460MREWAFMB3XQFEP")
    result = client.login(card="Ab3xK9mPq2Rt5W", mac=get_mac())
    if not result.ok:
        print("登录失败:", result.errcode, result.message)
        raise SystemExit(1)

    print("会话 token:", result.token)

    # 登录成功后可启动后台心跳线程（每 10 分钟续期会话）
    client.start_heartbeat(card="Ab3xK9mPq2Rt5W", mac=get_mac())

接口契约见仓库 docs/openapi.json。
"""
from __future__ import annotations

import json
import threading
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Optional

# 错误码 → 可读信息（与后台「错误码对照表」保持一致）
ERROR_MESSAGES = {
    "-1001": "参数缺失或格式错误",
    "-1002": "认证失败（Token 无效或已过期，请重新登录）",
    "-1004": "卡密不存在",
    "-1005": "卡密已过期",
    "-1006": "卡密已禁用",
    "-1007": "应用不存在或已下架",
    "-1008": "版本不匹配，需强制更新",
    "-1009": "服务器内部错误",
    "-1010": "机器码不匹配",
    "-1011": "卡密已在其他设备登录",
    "-1012": "管理员激活配额已满",
}


class AuthError(Exception):
    """卡密 API 业务错误。errcode 含义见 ERROR_MESSAGES。"""

    def __init__(self, errcode: str, message: str = ""):
        self.errcode = errcode
        self.message = message or ERROR_MESSAGES.get(errcode, "未知错误")
        super().__init__(f"[{self.errcode}] {self.message}")


@dataclass
class LoginResult:
    ok: bool
    token: Optional[str] = None
    errcode: Optional[str] = None
    message: str = ""


class AuthClient:
    """卡密授权系统客户端。

    Args:
        base_url: 服务端地址，如 http://your-server:3000
        softid: 18 位软件标识（后台创建应用时生成）
        timeout: 请求超时秒数
    """

    HEARTBEAT_INTERVAL = 10 * 60  # 会话 24h 有效，每 10 分钟续期足够

    def __init__(self, base_url: str, softid: str, timeout: float = 10.0):
        if not softid or len(softid) != 18 or not softid.isalnum():
            raise ValueError("softid 必须为 18 位字母数字")
        self.base_url = base_url.rstrip("/")
        self.softid = softid
        self.timeout = timeout
        self.token: Optional[str] = None
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._heartbeat_stop = threading.Event()

    # ===== 内部请求 =====
    def _post(self, path: str, payload: dict) -> dict:
        req = urllib.request.Request(
            self.base_url + path,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                raise AuthError("-1009", "请求过于频繁，请稍后再试") from e
            raise

    def _get(self, path: str) -> dict:
        try:
            with urllib.request.urlopen(self.base_url + path, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                raise AuthError("-1009", "请求过于频繁，请稍后再试") from e
            raise

    # ===== 公开信息接口 =====
    def announcement(self) -> str:
        """获取应用公告（text/plain）。"""
        req = urllib.request.Request(
            self.base_url + "/announcement",
            data=json.dumps({"Softid": self.softid}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return resp.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            raise AuthError(e.code == 429 and "-1009" or "-1009") from e

    def latest_version(self) -> str:
        """获取最新版本号。"""
        return self._post("/version", {"Softid": self.softid}).get("version", "1.0.0")

    def download_url(self) -> str:
        return self._post("/download", {"Softid": self.softid}).get("url", "")

    def usage_url(self) -> str:
        return self._post("/usage", {"Softid": self.softid}).get("url", "")

    def purchase_url(self) -> str:
        return self._post("/purchase", {"Softid": self.softid}).get("url", "")

    # ===== 会话接口 =====
    def login(self, card: str, mac: str, version: str = "") -> LoginResult:
        """卡密登录。成功后 token 保存在 self.token。"""
        payload: dict[str, Any] = {"Softid": self.softid, "Card": card, "Mac": mac}
        if version:
            payload["Version"] = version
        data = self._post("/login", payload)
        if "token" in data and data["token"]:
            self.token = data["token"]
            return LoginResult(ok=True, token=self.token)
        errcode = str(data.get("errcode", "-1009"))
        return LoginResult(ok=False, errcode=errcode, message=ERROR_MESSAGES.get(errcode, "未知错误"))

    def logout(self, card: str) -> None:
        """登出并释放会话。"""
        if not self.token:
            return
        self._post("/logout", {"Softid": self.softid, "Card": card, "Token": self.token})
        self.token = None
        self.stop_heartbeat()

    def heartbeat(self, card: str) -> None:
        """心跳保活；会话失效抛出 AuthError(-1002)，到期抛出 AuthError(-1005)。"""
        if not self.token:
            raise AuthError("-1002")
        data = self._post("/heartbeat", {"Softid": self.softid, "Card": card, "Token": self.token})
        if "errcode" in data:
            raise AuthError(str(data["errcode"]))

    def expiry(self, card: str) -> str:
        """获取卡密到期时间（YYYY-MM-DD HH:mm:ss）。"""
        data = self._post("/expiry", {"Softid": self.softid, "Card": card, "Token": self.token})
        if "errcode" in data:
            raise AuthError(str(data["errcode"]))
        return data.get("expires_at", "")

    # ===== 心跳线程 =====
    def start_heartbeat(self, card: str, on_expired=None) -> None:
        """启动后台心跳线程。会话失效/卡到期时回调 on_expired(errcode)（未提供则静默停止）。"""
        def _loop():
            while not self._heartbeat_stop.wait(self.HEARTBEAT_INTERVAL):
                try:
                    self.heartbeat(card)
                except AuthError as e:
                    if on_expired:
                        on_expired(e)
                    return

        self.stop_heartbeat()
        self._heartbeat_stop.clear()
        self._heartbeat_thread = threading.Thread(target=_loop, daemon=True)
        self._heartbeat_thread.start()

    def stop_heartbeat(self) -> None:
        self._heartbeat_stop.set()
        self._heartbeat_thread = None
