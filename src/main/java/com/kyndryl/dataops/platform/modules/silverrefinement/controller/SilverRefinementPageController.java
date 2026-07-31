package com.kyndryl.dataops.platform.modules.silverrefinement.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SilverRefinementPageController {

    @GetMapping("/silver-refinement")
    public String silverRefinement(Model model) {
        model.addAttribute("pageTitle", "Silver Refinement");
        model.addAttribute("activeModule", "silver-refinement");
        return "silver-refinement/index";
    }
}
