package com.kyndryl.dataops.platform.modules.silverrefinement.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@Controller
public class SilverRefinementPageController {

    @GetMapping("/silver-refinement")
    public String silverRefinement(Model model) {
        model.addAttribute("pageTitle", "Silver Refinement");
        model.addAttribute("activeModule", "silver-refinement");
        return "silver-refinement/index";
    }

    @GetMapping("/silver-refinement/{workflowId}")
    public String silverWorkflow(
        @PathVariable String workflowId,
        Model model
    ) {
        model.addAttribute("pageTitle", "Silver Workflow");
        model.addAttribute("activeModule", "silver-refinement");
        model.addAttribute("workflowId", workflowId);
        return "silver-refinement/workflow";
    }
}
