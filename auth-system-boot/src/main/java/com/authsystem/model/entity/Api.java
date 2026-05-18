package com.authsystem.model.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "apis")
public class Api {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "api_name", nullable = false, length = 100)
    private String apiName;

    @Column(name = "api_path", nullable = false, length = 500)
    private String apiPath;

    @Column(name = "api_method", length = 10)
    private String apiMethod = "POST";

    @Column(name = "param_count")
    private Integer paramCount = 0;

    @Column(name = "params_config", columnDefinition = "TEXT")
    private String paramsConfig;

    @Column(name = "return_desc", columnDefinition = "TEXT")
    private String returnDesc;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public String getApiName() { return apiName; }
    public void setApiName(String apiName) { this.apiName = apiName; }
    public String getApiPath() { return apiPath; }
    public void setApiPath(String apiPath) { this.apiPath = apiPath; }
    public String getApiMethod() { return apiMethod; }
    public void setApiMethod(String apiMethod) { this.apiMethod = apiMethod; }
    public Integer getParamCount() { return paramCount; }
    public void setParamCount(Integer paramCount) { this.paramCount = paramCount; }
    public String getParamsConfig() { return paramsConfig; }
    public void setParamsConfig(String paramsConfig) { this.paramsConfig = paramsConfig; }
    public String getReturnDesc() { return returnDesc; }
    public void setReturnDesc(String returnDesc) { this.returnDesc = returnDesc; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
