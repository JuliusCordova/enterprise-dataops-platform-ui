package com.kyndryl.dataops.platform.modules.profiling.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kyndryl.dataops.platform.modules.profiling.dto.ProfilingRequest;
import com.kyndryl.dataops.platform.modules.profiling.service.ProfilingExecutionService;
import com.kyndryl.dataops.platform.modules.profiling.service.ProfilingMetadataService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/ui/api/profiling")
public class ProfilingApiController {

    private final ProfilingMetadataService metadataService;
    private final ProfilingExecutionService executionService;

    public ProfilingApiController(
        ProfilingMetadataService metadataService,
        ProfilingExecutionService executionService
    ) {
        this.metadataService = metadataService;
        this.executionService = executionService;
    }

    @GetMapping("/connections")
    public ResponseEntity<Map<String, Object>>
        getConnections() {

        return ResponseEntity.ok(
            metadataService.getConnections()
        );
    }

    @GetMapping(
        "/connections/{connectionId}/datasets"
    )
    public ResponseEntity<Map<String, Object>>
        getDatasets(
            @PathVariable
            String connectionId
        ) {

        return ResponseEntity.ok(
            metadataService.getDatasets(
                connectionId
            )
        );
    }

    @GetMapping(
        "/connections/{connectionId}/datasets/{datasetId}/tables"
    )
    public ResponseEntity<Map<String, Object>>
        getTables(
            @PathVariable
            String connectionId,

            @PathVariable
            String datasetId
        ) {

        return ResponseEntity.ok(
            metadataService.getTables(
                connectionId,
                datasetId
            )
        );
    }

    @PostMapping("/execute")
    public ResponseEntity<Map<String, Object>>
        execute(
            @Valid
            @RequestBody
            ProfilingRequest request
        ) {

        return ResponseEntity.ok(
            executionService.execute(
                request
            )
        );
    }
}
