"""
# 卡密认证系统 — 客户端 API
# 版本: 1.3.0
# 自动生成 — 请勿手动编辑
"""

import requests
from typing import Optional, Dict, Any


class AuthSystemClient:
    """客户端卡密认证 SDK 集成契约。所有接口均为 POST，请求体使用大写首字母字段名（Softid, Card, Mac, Version, Token），响应为 JSON。"""

    def __init__(self, base_url: str, timeout: int = 10):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

    def _post(self, path: str, data: Dict[str, Any]) -> Dict[str, Any]:
        url = self.base_url + path
        resp = self.session.post(url, json=data, timeout=self.timeout)
        return resp.json()

    def Announcement(self, Softid):
        """获取公告"""
        Softid: Softid (必填)
        return self._post("/announcement", {"Softid": Softid})

    def Version(self, Softid):
        """获取最新版本号"""
        Softid: Softid (必填)
        return self._post("/version", {"Softid": Softid})

    def Login(self, Softid, Card, Mac, Version=None):
        """卡密登录"""
        Softid: Softid (必填)
        Card: Card (必填)
        Mac: Mac (必填)
        Version: Version
        return self._post("/login", {"Softid": Softid, "Card": Card, "Mac": Mac, "Version": Version})

    def Logout(self, Softid, Card, Token):
        """卡密登出"""
        Softid: Softid (必填)
        Card: Card (必填)
        Token: Token (必填)
        return self._post("/logout", {"Softid": Softid, "Card": Card, "Token": Token})

    def Heartbeat(self, Softid, Card, Token):
        """心跳保活"""
        Softid: Softid (必填)
        Card: Card (必填)
        Token: Token (必填)
        return self._post("/heartbeat", {"Softid": Softid, "Card": Card, "Token": Token})

    def Expiry(self, Softid, Card, Token):
        """获取到期时间"""
        Softid: Softid (必填)
        Card: Card (必填)
        Token: Token (必填)
        return self._post("/expiry", {"Softid": Softid, "Card": Card, "Token": Token})

    def Download(self, Softid):
        """获取下载地址"""
        Softid: Softid (必填)
        return self._post("/download", {"Softid": Softid})

    def Usage(self, Softid):
        """获取使用说明"""
        Softid: Softid (必填)
        return self._post("/usage", {"Softid": Softid})

    def Purchase(self, Softid):
        """获取购买地址"""
        Softid: Softid (必填)
        return self._post("/purchase", {"Softid": Softid})

