package com.kyndryl.dataops.platform.modules.reconciliation.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class ReconciliationPageController {

    @GetMapping("/reconciliation")
    public String reconciliation(
        Model model
    ) {
        model.addAttribute(
            "pageTitle",
            "Data Reconciliation"
        );

        model.addAttribute(
            "activeModule",
            "reconciliation"
        );

        return "reconciliation/index";
    }

    @GetMapping("/reconciliation/new")
    public String newReconciliation(
        Model model
    ) {
        model.addAttribute(
            "pageTitle",
            "Nueva cuadratura"
        );

        model.addAttribute(
            "activeModule",
            "reconciliation"
        );

        return "reconciliation/new";
    }

    @GetMapping("/reconciliation/result")
    public String reconciliationResult(
        Model model
    ) {
        model.addAttribute(
            "pageTitle",
            "Reconciliation Result"
        );

        model.addAttribute(
            "activeModule",
            "reconciliation"
        );

        return "reconciliation/result";
    }
}
