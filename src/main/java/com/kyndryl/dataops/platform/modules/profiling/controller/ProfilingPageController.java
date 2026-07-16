package com.kyndryl.dataops.platform.modules.profiling.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class ProfilingPageController {

    @GetMapping("/profiling")
    public String profiling(
        Model model
    ) {
        model.addAttribute(
            "pageTitle",
            "Data Profiling"
        );

        model.addAttribute(
            "activeModule",
            "profiling"
        );

        return "profiling/index";
    }

    @GetMapping("/profiling/report")
    public String profilingReport(
        Model model
    ) {
        model.addAttribute(
            "pageTitle",
            "Profiling Report"
        );

        model.addAttribute(
            "activeModule",
            "profiling"
        );

        return "profiling/report";
    }
}
