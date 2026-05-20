package com.authsystem.model.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "apps")
public class App {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "softid", unique = true, length = 18)
    private String softid;

    @Column(name = "app_name", nullable = false, unique = true, length = 100)
    private String appName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 20)
    private String version = "1.0.0";

    @Column(name = "version_name", length = 100)
    private String versionName;

    @Column(length = 100)
    private String developer;

    @Column(name = "is_free")
    private Integer isFree = 1;

    @Column(name = "icon_url", length = 255)
    private String iconUrl;

    @Column(name = "download_url", length = 255)
    private String downloadUrl;

    @Column(name = "usage_guide", columnDefinition = "TEXT")
    private String usageGuide;

    @Column(name = "purchase_url", length = 255)
    private String purchaseUrl;

    @Column(name = "announcement", columnDefinition = "TEXT")
    private String announcement;

    @Column(name = "force_update")
    private Integer forceUpdate = 0;

    @Column(length = 20)
    private String status = "enabled";

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public String getSoftid() { return softid; }
    public void setSoftid(String softid) { this.softid = softid; }

    public String getAppName() { return appName; }
    public void setAppName(String appName) { this.appName = appName; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public String getVersionName() { return versionName; }
    public void setVersionName(String versionName) { this.versionName = versionName; }

    public String getDeveloper() { return developer; }
    public void setDeveloper(String developer) { this.developer = developer; }

    public Integer getIsFree() { return isFree; }
    public void setIsFree(Integer isFree) { this.isFree = isFree; }

    public String getIconUrl() { return iconUrl; }
    public void setIconUrl(String iconUrl) { this.iconUrl = iconUrl; }

    public String getDownloadUrl() { return downloadUrl; }
    public void setDownloadUrl(String downloadUrl) { this.downloadUrl = downloadUrl; }

    public String getUsageGuide() { return usageGuide; }
    public void setUsageGuide(String usageGuide) { this.usageGuide = usageGuide; }

    public String getPurchaseUrl() { return purchaseUrl; }
    public void setPurchaseUrl(String purchaseUrl) { this.purchaseUrl = purchaseUrl; }

    public String getAnnouncement() { return announcement; }
    public void setAnnouncement(String announcement) { this.announcement = announcement; }

    public Integer getForceUpdate() { return forceUpdate; }
    public void setForceUpdate(Integer forceUpdate) { this.forceUpdate = forceUpdate; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
