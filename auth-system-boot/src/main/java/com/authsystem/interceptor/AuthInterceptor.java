package com.authsystem.interceptor;

import com.authsystem.model.entity.Admin;
import com.authsystem.repository.AdminRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Optional;

@Component
public class AuthInterceptor implements HandlerInterceptor {

    @Autowired
    private AdminRepository adminRepository;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String token = request.getParameter("token");
        if (token == null || token.isEmpty()) {
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                token = authHeader.substring(7);
            }
        }

        if (token == null || token.isEmpty()) {
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"success\":false,\"data\":null,\"message\":\"未提供认证令牌\"}");
            return false;
        }

        Optional<Admin> adminOpt = adminRepository.findByToken(token);
        if (adminOpt.isEmpty()) {
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"success\":false,\"data\":null,\"message\":\"无效的认证令牌\"}");
            return false;
        }

        Admin admin = adminOpt.get();
        if (!"enabled".equals(admin.getStatus())) {
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"success\":false,\"data\":null,\"message\":\"账户已被禁用\"}");
            return false;
        }

        if (admin.getIsSuperuser() != 1) {
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"success\":false,\"data\":null,\"message\":\"需要超级用户权限\"}");
            return false;
        }

        request.setAttribute("currentUser", admin);
        return true;
    }
}
