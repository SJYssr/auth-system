package com.authsystem.model.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "cards")
public class Card {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "app_id", nullable = false)
    private Integer appId;

    @Column(name = "card", nullable = false, unique = true, length = 128)
    private String card;

    @Column(name = "card_type", length = 50)
    private String cardType = "天卡";

    @Column(precision = 10, scale = 2)
    private BigDecimal price = BigDecimal.ZERO;

    @Column
    private Integer points = 0;

    @Column(name = "card_remark", columnDefinition = "TEXT")
    private String cardRemark;

    @Column(length = 20)
    private String status = "enabled";

    @Column(name = "is_activated")
    private Integer isActivated = 0;

    @Column(name = "activated_at")
    private LocalDateTime activatedAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Column(name = "mac", length = 255)
    private String mac;

    @Column(name = "login_count")
    private Integer loginCount = 0;

    @Column(name = "activation_ip", length = 45)
    private String activationIp;

    @Column(name = "last_login_time")
    private LocalDateTime lastLoginTime;

    @Column(name = "last_login_ip", length = 45)
    private String lastLoginIp;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "app_id", insertable = false, updatable = false)
    private App app;

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public Integer getAppId() { return appId; }
    public void setAppId(Integer appId) { this.appId = appId; }

    public String getCard() { return card; }
    public void setCard(String card) { this.card = card; }

    public String getCardType() { return cardType; }
    public void setCardType(String cardType) { this.cardType = cardType; }

    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }

    public Integer getPoints() { return points; }
    public void setPoints(Integer points) { this.points = points; }

    public String getCardRemark() { return cardRemark; }
    public void setCardRemark(String cardRemark) { this.cardRemark = cardRemark; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Integer getIsActivated() { return isActivated; }
    public void setIsActivated(Integer isActivated) { this.isActivated = isActivated; }

    public LocalDateTime getActivatedAt() { return activatedAt; }
    public void setActivatedAt(LocalDateTime activatedAt) { this.activatedAt = activatedAt; }

    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }

    public String getMac() { return mac; }
    public void setMac(String mac) { this.mac = mac; }

    public Integer getLoginCount() { return loginCount; }
    public void setLoginCount(Integer loginCount) { this.loginCount = loginCount; }

    public String getActivationIp() { return activationIp; }
    public void setActivationIp(String activationIp) { this.activationIp = activationIp; }

    public LocalDateTime getLastLoginTime() { return lastLoginTime; }
    public void setLastLoginTime(LocalDateTime lastLoginTime) { this.lastLoginTime = lastLoginTime; }

    public String getLastLoginIp() { return lastLoginIp; }
    public void setLastLoginIp(String lastLoginIp) { this.lastLoginIp = lastLoginIp; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public App getApp() { return app; }
}
