package com.authsystem.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse {
    private boolean success;
    private Object data;
    private String message;
    private Map<String, Object> pagination;

    public ApiResponse(boolean success, Object data, String message) {
        this.success = success;
        this.data = data;
        this.message = message;
    }

    public ApiResponse(boolean success, Object data, String message, Map<String, Object> pagination) {
        this.success = success;
        this.data = data;
        this.message = message;
        this.pagination = pagination;
    }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public Object getData() { return data; }
    public void setData(Object data) { this.data = data; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public Map<String, Object> getPagination() { return pagination; }
    public void setPagination(Map<String, Object> pagination) { this.pagination = pagination; }
}
