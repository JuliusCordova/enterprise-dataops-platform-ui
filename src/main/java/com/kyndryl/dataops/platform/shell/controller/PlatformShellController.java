package com.kyndryl.dataops.platform.shell.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class PlatformShellController {

    @GetMapping("/")
    public String home(
        Model model
    ) {
        model.addAttribute(
            "pageTitle",
            "Enterprise DataOps"
        );

        model.addAttribute(
            "activeModule",
            "home"
        );

        return "index";
    }
}
