package com.kyndryl.dataops.platform.modules.qualityexecution.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kyndryl.dataops.platform.modules.qualityexecution.dto.QualityExecutionRequest;
import com.kyndryl.dataops.platform.modules.qualityexecution.service.QualityExecutionService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/ui/api/quality-execution")
public class QualityExecutionApiController {

    private final QualityExecutionService service;

    public QualityExecutionApiController(
        QualityExecutionService service
    ) {
        this.service = service;
    }

    @GetMapping("/configs")
    public ResponseEntity<Map<String, Object>>
        getConfigurations(
            @RequestParam(
                defaultValue = "true"
            )
            boolean activeOnly
        ) {

        return ResponseEntity.ok(
            service.getConfigurations(
                activeOnly
            )
        );
    }

    @PostMapping("/execute")
    public ResponseEntity<Map<String, Object>>
        execute(
            @Valid
            @RequestBody
            QualityExecutionRequest request
        ) {

        return ResponseEntity.ok(
            service.execute(request)
        );
    }

    @GetMapping("/result/{executionId}")
    public ResponseEntity<Map<String, Object>>
        getResult(
            @PathVariable
            String executionId
        ) {

        return ResponseEntity.ok(
            service.getResult(executionId)
        );
    }

    @GetMapping("/latest/{qualityConfigId}")
    public ResponseEntity<Map<String, Object>>
        getLatest(
            @PathVariable
            String qualityConfigId
        ) {

        return ResponseEntity.ok(
            service.getLatest(
                qualityConfigId
            )
        );
    }

    @GetMapping("/issues/{executionId}")
    public ResponseEntity<Map<String, Object>>
        getIssues(
            @PathVariable
            String executionId
        ) {

        return ResponseEntity.ok(
            service.getIssues(executionId)
        );
    }
}
