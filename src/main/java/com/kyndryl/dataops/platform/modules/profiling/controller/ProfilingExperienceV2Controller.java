package com.kyndryl.dataops.platform.modules.profiling.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class ProfilingExperienceV2Controller {
    @GetMapping("/profiling-v2")
    public String profilingV2(Model model) {
        model.addAttribute("pageTitle", "Data Profiling");
        model.addAttribute("activeModule", "profiling");
        return "profiling/index-v2";
    }
}
