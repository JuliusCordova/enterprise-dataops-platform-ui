package com.kyndryl.dataops.platform.modules.silverrefinement.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kyndryl.dataops.platform.modules.silverrefinement.service.SilverWorkflowService;

@RestController
@RequestMapping("/ui/api/silver/workflows")
public class SilverWorkflowApiController {

    private final SilverWorkflowService service;

    public SilverWorkflowApiController(SilverWorkflowService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> listWorkflows() {
        return ResponseEntity.ok(service.listWorkflows());
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createWorkflow(
        @RequestBody Object request
    ) {
        return ResponseEntity.ok(service.createWorkflow(request));
    }

    @GetMapping("/{workflowId}")
    public ResponseEntity<Map<String, Object>> getWorkflow(
        @PathVariable String workflowId
    ) {
        return ResponseEntity.ok(service.getWorkflow(workflowId));
    }

    @PostMapping("/{workflowId}/confirm-source")
    public ResponseEntity<Map<String, Object>> confirmSource(
        @PathVariable String workflowId,
        @RequestBody Object request
    ) {
        return ResponseEntity.ok(service.confirmSource(workflowId, request));
    }

    @GetMapping("/{workflowId}/business-rules")
    public ResponseEntity<Map<String, Object>> getBusinessRules(
        @PathVariable String workflowId
    ) {
        return ResponseEntity.ok(service.getBusinessRules(workflowId));
    }

    @PutMapping("/{workflowId}/business-rules/draft")
    public ResponseEntity<Map<String, Object>> saveBusinessRulesDraft(
        @PathVariable String workflowId,
        @RequestBody Object request
    ) {
        return ResponseEntity.ok(service.saveBusinessRulesDraft(workflowId, request));
    }
}
