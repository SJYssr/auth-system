/**
 * 卡密认证系统 — 客户端 API
 * 版本: 1.3.0
 * 自动生成 — 请勿手动编辑
 */

'use strict';

class AuthSystemClient {
  /**
   * @param {string} baseURL - API 基地址
   * @param {object} [opts] - { timeout: number }
   */
  constructor(baseURL, opts = {}) {
    this.baseURL = baseURL.replace(/\/$/, "");
    this.timeout = opts.timeout || 10000;
  }

  async _post(path, body) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeout);
    try {
      const resp = await fetch(this.baseURL + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      return await resp.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 获取公告
   * @param {Softid} Softid - 
   * @returns {Promise<object>} 响应 JSON
   */
  async Announcement(Softid) {
    return this._post("/announcement", { "Softid": Softid });
  }

  /**
   * 获取最新版本号
   * @param {Softid} Softid - 
   * @returns {Promise<object>} 响应 JSON
   */
  async Version(Softid) {
    return this._post("/version", { "Softid": Softid });
  }

  /**
   * 卡密登录
   * @param {Softid} Softid - 
   * @param {Card} Card - 
   * @param {Mac} Mac - 
   * @param {Version} Version [可选] - 
   * @returns {Promise<object>} 响应 JSON
   */
  async Login(Softid, Card, Mac, Version) {
    return this._post("/login", { "Softid": Softid, "Card": Card, "Mac": Mac, "Version": Version });
  }

  /**
   * 卡密登出
   * @param {Softid} Softid - 
   * @param {Card} Card - 
   * @param {Token} Token - 
   * @returns {Promise<object>} 响应 JSON
   */
  async Logout(Softid, Card, Token) {
    return this._post("/logout", { "Softid": Softid, "Card": Card, "Token": Token });
  }

  /**
   * 心跳保活
   * @param {Softid} Softid - 
   * @param {Card} Card - 
   * @param {Token} Token - 
   * @returns {Promise<object>} 响应 JSON
   */
  async Heartbeat(Softid, Card, Token) {
    return this._post("/heartbeat", { "Softid": Softid, "Card": Card, "Token": Token });
  }

  /**
   * 获取到期时间
   * @param {Softid} Softid - 
   * @param {Card} Card - 
   * @param {Token} Token - 
   * @returns {Promise<object>} 响应 JSON
   */
  async Expiry(Softid, Card, Token) {
    return this._post("/expiry", { "Softid": Softid, "Card": Card, "Token": Token });
  }

  /**
   * 获取下载地址
   * @param {Softid} Softid - 
   * @returns {Promise<object>} 响应 JSON
   */
  async Download(Softid) {
    return this._post("/download", { "Softid": Softid });
  }

  /**
   * 获取使用说明
   * @param {Softid} Softid - 
   * @returns {Promise<object>} 响应 JSON
   */
  async Usage(Softid) {
    return this._post("/usage", { "Softid": Softid });
  }

  /**
   * 获取购买地址
   * @param {Softid} Softid - 
   * @returns {Promise<object>} 响应 JSON
   */
  async Purchase(Softid) {
    return this._post("/purchase", { "Softid": Softid });
  }

}

module.exports = { AuthSystemClient };