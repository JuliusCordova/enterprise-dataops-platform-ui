package com.kyndryl.dataops.platform.modules.silverrefinement.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kyndryl.dataops.platform.integration.silver.SilverArtifactClient;
import com.kyndryl.dataops.platform.integration.silver.SilverExecutionClient;

@RestController
@RequestMapping("/ui/api/silver")
public class SilverOperationsApiController {

    private final SilverArtifactClient artifacts;
    private final SilverExecutionClient executions;

    public SilverOperationsApiController(
        SilverArtifactClient artifacts,
        SilverExecutionClient executions
    ) {
        this.artifacts = artifacts;
        this.executions = executions;
    }

    @GetMapping("/specs/{specId}/artifacts")
    public ResponseEntity<Map<String, Object>> listArtifacts(@PathVariable String specId) {
        return ResponseEntity.ok(artifacts.listArtifacts(specId));
    }

    @GetMapping(
        "/specs/{specId}/artifacts/current/{artifactType}/content"
    )
    public ResponseEntity<Map<String, Object>> getArtifactContent(
        @PathVariable String specId,
        @PathVariable String artifactType
    ) {
        return ResponseEntity.ok(
            artifacts.getArtifactContent(specId, artifactType)
        );
    }

    @PostMapping("/specs/{specId}/artifacts/generate")
    public ResponseEntity<Map<String, Object>> generateArtifacts(
        @PathVariable String specId,
        @RequestBody Object request
    ) {
        return ResponseEntity.ok(artifacts.generateArtifacts(specId, request));
    }

    @PostMapping("/specs/{specId}/artifacts/ddl")
    public ResponseEntity<Map<String, Object>> generateDdl(
        @PathVariable String specId,
        @RequestBody Object request
    ) {
        return ResponseEntity.ok(artifacts.generateDdl(specId, request));
    }

    @PostMapping("/executions")
    public ResponseEntity<Map<String, Object>> createExecution(@RequestBody Object request) {
        return ResponseEntity.ok(executions.create(request));
    }

    @GetMapping("/executions/{executionId}")
    public ResponseEntity<Map<String, Object>> getExecution(@PathVariable String executionId) {
        return ResponseEntity.ok(executions.get(executionId));
    }

    @PostMapping("/executions/{executionId}/validate-package")
    public ResponseEntity<Map<String, Object>> validatePackage(@PathVariable String executionId) {
        return ResponseEntity.ok(executions.validatePackage(executionId));
    }

    @PostMapping("/executions/{executionId}/submit")
    public ResponseEntity<Map<String, Object>> submit(@PathVariable String executionId) {
        return ResponseEntity.ok(executions.submit(executionId));
    }

    @PostMapping("/executions/{executionId}/sync-status")
    public ResponseEntity<Map<String, Object>> syncStatus(@PathVariable String executionId) {
        return ResponseEntity.ok(executions.syncStatus(executionId));
    }

    @GetMapping("/executions/{executionId}/logs")
    public ResponseEntity<Map<String, Object>> logs(@PathVariable String executionId) {
        return ResponseEntity.ok(executions.logs(executionId));
    }

    @PostMapping("/executions/{executionId}/metrics/sync")
    public ResponseEntity<Map<String, Object>> syncMetrics(@PathVariable String executionId) {
        return ResponseEntity.ok(executions.syncMetrics(executionId));
    }
}
