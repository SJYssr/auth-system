package com.authsystem.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
public class SpaController {

    @RequestMapping(value = {"/login", "/register", "/admin", "/admin/**", "/products", "/about", "/app/**"})
    public String forward() {
        return "forward:/index.html";
    }
}
