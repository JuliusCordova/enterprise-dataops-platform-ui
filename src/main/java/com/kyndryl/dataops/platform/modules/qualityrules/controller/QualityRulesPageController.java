package com.kyndryl.dataops.platform.modules.qualityrules.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class QualityRulesPageController {

    @GetMapping("/quality-rules")
    public String qualityRules(
        Model model
    ) {
        model.addAttribute(
            "pageTitle",
            "Quality Rules"
        );

        model.addAttribute(
            "activeModule",
            "quality-rules"
        );

        return "quality-rules/index";
    }
}
