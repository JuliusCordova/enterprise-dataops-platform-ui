package com.kyndryl.dataops.platform.modules.profiling.service;

import java.util.Map;

import org.springframework.stereotype.Service;

import com.kyndryl.dataops.platform.shared.client.DataOpsApiClient;

@Service
public class ProfilingMetadataService {

    private final DataOpsApiClient client;

    public ProfilingMetadataService(
        DataOpsApiClient client
    ) {
        this.client = client;
    }

    public Map<String, Object> getConnections() {
        return client.get(
            "/connections"
        );
    }

    public Map<String, Object> getDatasets(
        String connectionId
    ) {
        String safeConnectionId = validateIdentifier(
            connectionId,
            "connectionId"
        );

        return client.get(
            "/metadata/"
                + safeConnectionId
                + "/datasets"
        );
    }

    public Map<String, Object> getTables(
        String connectionId,
        String datasetId
    ) {
        String safeConnectionId = validateIdentifier(
            connectionId,
            "connectionId"
        );

        String safeDatasetId = validateIdentifier(
            datasetId,
            "datasetId"
        );

        return client.get(
            "/metadata/"
                + safeConnectionId
                + "/"
                + safeDatasetId
                + "/tables"
        );
    }

    public Map<String, Object> getColumns(
        String connectionId,
        String datasetId,
        String tableId
    ) {
        String safeConnectionId = validateIdentifier(
            connectionId,
            "connectionId"
        );

        String safeDatasetId = validateIdentifier(
            datasetId,
            "datasetId"
        );

        String safeTableId = validateIdentifier(
            tableId,
            "tableId"
        );

        return client.get(
            "/metadata/"
                + safeConnectionId
                + "/"
                + safeDatasetId
                + "/"
                + safeTableId
                + "/columns"
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

        String normalized = value.trim();

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
