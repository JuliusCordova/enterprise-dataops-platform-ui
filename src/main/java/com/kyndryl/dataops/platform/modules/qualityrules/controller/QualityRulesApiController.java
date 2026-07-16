package com.kyndryl.dataops.platform.modules.qualityrules.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kyndryl.dataops.platform.modules.qualityrules.dto.QualityRuleConfirmRequest;
import com.kyndryl.dataops.platform.modules.qualityrules.dto.QualityRuleDraftRequest;
import com.kyndryl.dataops.platform.modules.qualityrules.dto.QualityRuleDraftUpdateRequest;
import com.kyndryl.dataops.platform.modules.qualityrules.service.QualityRulesService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/ui/api/quality-rules")
public class QualityRulesApiController {

    private final QualityRulesService service;

    public QualityRulesApiController(
        QualityRulesService service
    ) {
        this.service = service;
    }

    @GetMapping("/rule-types")
    public ResponseEntity<Map<String, Object>>
        getRuleTypes() {

        return ResponseEntity.ok(
            service.getRuleTypes()
        );
    }

    @PostMapping("/draft")
    public ResponseEntity<Map<String, Object>>
        createDraft(
            @Valid
            @RequestBody
            QualityRuleDraftRequest request
        ) {

        return ResponseEntity.ok(
            service.createDraft(request)
        );
    }

    @GetMapping("/draft/{draftId}")
    public ResponseEntity<Map<String, Object>>
        getDraft(
            @PathVariable
            String draftId
        ) {

        return ResponseEntity.ok(
            service.getDraft(draftId)
        );
    }

    @PutMapping("/draft/{draftId}")
    public ResponseEntity<Map<String, Object>>
        updateDraft(
            @PathVariable
            String draftId,

            @Valid
            @RequestBody
            QualityRuleDraftUpdateRequest request
        ) {

        return ResponseEntity.ok(
            service.updateDraft(
                draftId,
                request
            )
        );
    }

    @PostMapping("/draft/{draftId}/validate")
    public ResponseEntity<Map<String, Object>>
        validateDraft(
            @PathVariable
            String draftId
        ) {

        return ResponseEntity.ok(
            service.validateDraft(draftId)
        );
    }

    @PostMapping("/draft/{draftId}/confirm")
    public ResponseEntity<Map<String, Object>>
        confirmDraft(
            @PathVariable
            String draftId,

            @Valid
            @RequestBody
            QualityRuleConfirmRequest request
        ) {

        return ResponseEntity.ok(
            service.confirmDraft(
                draftId,
                request
            )
        );
    }
}
