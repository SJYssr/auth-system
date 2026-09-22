// 卡密认证系统 — 客户端 API
// 版本: 1.3.0
// 自动生成 — 请勿手动编辑

package authsystem

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type AuthSystemClient struct {
	BaseURL string
	Timeout time.Duration
	client  *http.Client
}

func NewAuthSystemClient(baseURL string) *AuthSystemClient {
	return &AuthSystemClient{
		BaseURL: baseURL,
		Timeout: 10 * time.Second,
		client:  &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *AuthSystemClient) post(path string, body map[string]interface{}) (map[string]interface{}, error) {
	jsonBody, _ := json.Marshal(body)
	url := c.BaseURL + path
	req, err := http.NewRequest("POST", url, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}
	return result, nil
}

// 获取公告
func (c *AuthSystemClient) Announcement(Softid string) (map[string]interface{}, error) {
	return c.post("/announcement", map[string]interface{}{"Softid": Softid})
}

// 获取最新版本号
func (c *AuthSystemClient) Version(Softid string) (map[string]interface{}, error) {
	return c.post("/version", map[string]interface{}{"Softid": Softid})
}

// 卡密登录
func (c *AuthSystemClient) Login(Softid string, Card string, Mac string, Version string) (map[string]interface{}, error) {
	return c.post("/login", map[string]interface{}{"Softid": Softid, "Card": Card, "Mac": Mac, "Version": Version})
}

// 卡密登出
func (c *AuthSystemClient) Logout(Softid string, Card string, Token string) (map[string]interface{}, error) {
	return c.post("/logout", map[string]interface{}{"Softid": Softid, "Card": Card, "Token": Token})
}

// 心跳保活
func (c *AuthSystemClient) Heartbeat(Softid string, Card string, Token string) (map[string]interface{}, error) {
	return c.post("/heartbeat", map[string]interface{}{"Softid": Softid, "Card": Card, "Token": Token})
}

// 获取到期时间
func (c *AuthSystemClient) Expiry(Softid string, Card string, Token string) (map[string]interface{}, error) {
	return c.post("/expiry", map[string]interface{}{"Softid": Softid, "Card": Card, "Token": Token})
}

// 获取下载地址
func (c *AuthSystemClient) Download(Softid string) (map[string]interface{}, error) {
	return c.post("/download", map[string]interface{}{"Softid": Softid})
}

// 获取使用说明
func (c *AuthSystemClient) Usage(Softid string) (map[string]interface{}, error) {
	return c.post("/usage", map[string]interface{}{"Softid": Softid})
}

// 获取购买地址
func (c *AuthSystemClient) Purchase(Softid string) (map[string]interface{}, error) {
	return c.post("/purchase", map[string]interface{}{"Softid": Softid})
}
