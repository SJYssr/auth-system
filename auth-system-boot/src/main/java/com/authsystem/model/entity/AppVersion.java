package com.authsystem.model.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "app_versions")
public class AppVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "app_id", nullable = false)
    private Integer appId;

    @Column(name = "version", nullable = false, length = 20)
    private String version;

    @Column(name = "version_name", length = 100)
    private String versionName;

    @Column(length = 20)
    private String status = "enabled";

    @Column(name = "force_update")
    private Integer forceUpdate = 0;

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

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public String getVersionName() { return versionName; }
    public void setVersionName(String versionName) { this.versionName = versionName; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Integer getForceUpdate() { return forceUpdate; }
    public void setForceUpdate(Integer forceUpdate) { this.forceUpdate = forceUpdate; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public App getApp() { return app; }
}
