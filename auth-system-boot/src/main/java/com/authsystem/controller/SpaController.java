package com.authsystem.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaController {

    @GetMapping({"/login", "/register", "/admin", "/admin/**", "/useradmin", "/useradmin/**", "/products", "/about", "/app/**"})
    public String forward() {
        return "forward:/index.html";
    }
}
