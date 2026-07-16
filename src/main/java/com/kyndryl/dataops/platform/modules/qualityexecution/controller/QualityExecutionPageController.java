package com.kyndryl.dataops.platform.modules.qualityexecution.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class QualityExecutionPageController {

    @GetMapping("/quality-execution")
    public String qualityExecution(
        Model model
    ) {
        model.addAttribute(
            "pageTitle",
            "Quality Execution"
        );

        model.addAttribute(
            "activeModule",
            "quality-execution"
        );

        return "quality-execution/index";
    }

    @GetMapping("/quality-execution/result")
    public String qualityExecutionResult(
        Model model
    ) {
        model.addAttribute(
            "pageTitle",
            "Quality Assessment"
        );

        model.addAttribute(
            "activeModule",
            "quality-execution"
        );

        return "quality-execution/result";
    }
}
