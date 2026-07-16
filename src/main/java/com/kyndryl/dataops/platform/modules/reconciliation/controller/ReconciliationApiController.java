package com.kyndryl.dataops.platform.modules.reconciliation.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kyndryl.dataops.platform.modules.reconciliation.dto.ReconciliationAskRequest;
import com.kyndryl.dataops.platform.modules.reconciliation.dto.ReconciliationConfirmRequest;
import com.kyndryl.dataops.platform.modules.reconciliation.dto.ReconciliationDraftCreateRequest;
import com.kyndryl.dataops.platform.modules.reconciliation.dto.ReconciliationDraftUpdateRequest;
import com.kyndryl.dataops.platform.modules.reconciliation.dto.ReconciliationExecuteRequest;
import com.kyndryl.dataops.platform.modules.reconciliation.service.ReconciliationService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/ui/api/reconciliation")
public class ReconciliationApiController {

    private final ReconciliationService service;

    public ReconciliationApiController(
        ReconciliationService service
    ) {
        this.service = service;
    }

    @GetMapping("/configs")
    public ResponseEntity<Map<String, Object>>
        getConfigurations() {

        return ResponseEntity.ok(
            service.getConfigurations()
        );
    }

    @PostMapping("/execute")
    public ResponseEntity<Map<String, Object>>
        execute(
            @Valid
            @RequestBody
            ReconciliationExecuteRequest request
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

    @GetMapping("/latest/{reconciliationId}")
    public ResponseEntity<Map<String, Object>>
        getLatest(
            @PathVariable
            String reconciliationId
        ) {

        return ResponseEntity.ok(
            service.getLatest(
                reconciliationId
            )
        );
    }

    @PostMapping("/ask")
    public ResponseEntity<Map<String, Object>>
        ask(
            @Valid
            @RequestBody
            ReconciliationAskRequest request
        ) {

        return ResponseEntity.ok(
            service.ask(request)
        );
    }

    @GetMapping("/connections")
    public ResponseEntity<Map<String, Object>>
        getConnections() {

        return ResponseEntity.ok(
            service.getConnections()
        );
    }

    @GetMapping(
        "/metadata/{connectionId}/datasets"
    )
    public ResponseEntity<Map<String, Object>>
        getDatasets(
            @PathVariable
            String connectionId
        ) {

        return ResponseEntity.ok(
            service.getDatasets(
                connectionId
            )
        );
    }

    @GetMapping(
        "/metadata/{connectionId}/{datasetId}/tables"
    )
    public ResponseEntity<Map<String, Object>>
        getTables(
            @PathVariable
            String connectionId,

            @PathVariable
            String datasetId
        ) {

        return ResponseEntity.ok(
            service.getTables(
                connectionId,
                datasetId
            )
        );
    }

    @GetMapping(
        "/metadata/{connectionId}/{datasetId}/{tableId}/columns"
    )
    public ResponseEntity<Map<String, Object>>
        getColumns(
            @PathVariable
            String connectionId,

            @PathVariable
            String datasetId,

            @PathVariable
            String tableId
        ) {

        return ResponseEntity.ok(
            service.getColumns(
                connectionId,
                datasetId,
                tableId
            )
        );
    }

    @PostMapping("/draft")
    public ResponseEntity<Map<String, Object>>
        createDraft(
            @Valid
            @RequestBody
            ReconciliationDraftCreateRequest request
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

            @RequestBody
            ReconciliationDraftUpdateRequest request
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
            service.validateDraft(
                draftId
            )
        );
    }

    @PostMapping("/draft/{draftId}/confirm")
    public ResponseEntity<Map<String, Object>>
        confirmDraft(
            @PathVariable
            String draftId,

            @Valid
            @RequestBody
            ReconciliationConfirmRequest request
        ) {

        return ResponseEntity.ok(
            service.confirmDraft(
                draftId,
                request
            )
        );
    }
}
