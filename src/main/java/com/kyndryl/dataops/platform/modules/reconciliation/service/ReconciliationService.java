package com.kyndryl.dataops.platform.modules.reconciliation.service;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.kyndryl.dataops.platform.integration.reconciliation.ReconciliationConfigurationClient;
import com.kyndryl.dataops.platform.modules.reconciliation.dto.ReconciliationAskRequest;
import com.kyndryl.dataops.platform.modules.reconciliation.dto.ReconciliationConfirmRequest;
import com.kyndryl.dataops.platform.modules.reconciliation.dto.ReconciliationDraftCreateRequest;
import com.kyndryl.dataops.platform.modules.reconciliation.dto.ReconciliationDraftUpdateRequest;
import com.kyndryl.dataops.platform.modules.reconciliation.dto.ReconciliationExecuteRequest;
import com.kyndryl.dataops.platform.shared.client.DataOpsApiClient;

@Service
public class ReconciliationService {

    private static final Logger log =
        LoggerFactory.getLogger(
            ReconciliationService.class
        );

    private final ReconciliationConfigurationClient configurationClient;
    private final DataOpsApiClient client;

    public ReconciliationService(
        ReconciliationConfigurationClient configurationClient,
        DataOpsApiClient client
    ) {
        this.configurationClient = configurationClient;
        this.client = client;
    }

    public Map<String, Object> getConfigurations() {
        log.info(
            "Consultando configuraciones de reconciliación"
        );

        return configurationClient.listConfigurations();
    }

    public Map<String, Object> execute(
        ReconciliationExecuteRequest request
    ) {
        log.info(
            "Ejecutando reconciliación. reconciliationId={}, businessDate={}",
            request.reconciliationId(),
            request.businessDate()
        );

        return configurationClient.execute(request);
    }

    public Map<String, Object> getResult(
        String executionId
    ) {
        return configurationClient.getResult(executionId);
    }

    public Map<String, Object> getLatest(
        String reconciliationId
    ) {
        return client.get(
            "/reconciliation/latest/"
                + validateIdentifier(
                    reconciliationId,
                    "reconciliationId"
                )
        );
    }

    public Map<String, Object> ask(
        ReconciliationAskRequest request
    ) {
        return client.post(
            "/reconciliation/ask",
            request
        );
    }

    public Map<String, Object> getConnections() {
        return client.get(
            "/connections"
        );
    }

    public Map<String, Object> getDatasets(
        String connectionId
    ) {
        return client.get(
            "/metadata/"
                + validateIdentifier(
                    connectionId,
                    "connectionId"
                )
                + "/datasets"
        );
    }

    public Map<String, Object> getTables(
        String connectionId,
        String datasetId
    ) {
        return client.get(
            "/metadata/"
                + validateIdentifier(
                    connectionId,
                    "connectionId"
                )
                + "/"
                + validateIdentifier(
                    datasetId,
                    "datasetId"
                )
                + "/tables"
        );
    }

    public Map<String, Object> getColumns(
        String connectionId,
        String datasetId,
        String tableId
    ) {
        return client.get(
            "/metadata/"
                + validateIdentifier(
                    connectionId,
                    "connectionId"
                )
                + "/"
                + validateIdentifier(
                    datasetId,
                    "datasetId"
                )
                + "/"
                + validateIdentifier(
                    tableId,
                    "tableId"
                )
                + "/columns"
        );
    }

    public Map<String, Object> createDraft(
        ReconciliationDraftCreateRequest request
    ) {
        log.info(
            "Creando borrador de reconciliación. processName={}, source={}.{}, target={}.{}",
            request.processName(),
            request.sourceDataset(),
            request.sourceTable(),
            request.targetDataset(),
            request.targetTable()
        );

        return configurationClient.createDraft(request);
    }

    public Map<String, Object> getDraft(
        String draftId
    ) {
        return configurationClient.getDraft(draftId);
    }

    public Map<String, Object> updateDraft(
        String draftId,
        ReconciliationDraftUpdateRequest request
    ) {
        return configurationClient.updateDraft(
            draftId,
            request
        );
    }

    public Map<String, Object> validateDraft(
        String draftId
    ) {
        return configurationClient.validateDraft(draftId);
    }

    public Map<String, Object> confirmDraft(
        String draftId,
        ReconciliationConfirmRequest request
    ) {
        return configurationClient.publishDraft(
            draftId,
            request
        );
    }

    private String validateIdentifier(
        String value,
        String fieldName
    ) {
        if (
            value == null
            || value.isBlank()
        ) {
            throw new IllegalArgumentException(
                fieldName + " no puede estar vacío"
            );
        }

        String normalized =
            value.trim();

        if (!normalized.matches(
            "[A-Za-z0-9_\\-]+"
        )) {
            throw new IllegalArgumentException(
                fieldName
                    + " contiene caracteres no permitidos"
            );
        }

        return normalized;
    }
}
