package com.kyndryl.dataops.platform.modules.reconciliation.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.NotBlank;

public record ReconciliationDraftCreateRequest(

    @JsonProperty("process_name")
    @NotBlank(message = "El nombre del proceso es obligatorio")
    String processName,

    @JsonProperty("domain_name")
    @NotBlank(message = "El dominio es obligatorio")
    String domainName,

    @JsonProperty("description")
    String description,

    @JsonProperty("source_connection_id")
    @NotBlank(message = "La conexión de origen es obligatoria")
    String sourceConnectionId,

    @JsonProperty("source_dataset")
    @NotBlank(message = "El dataset de origen es obligatorio")
    String sourceDataset,

    @JsonProperty("source_table")
    @NotBlank(message = "La tabla de origen es obligatoria")
    String sourceTable,

    @JsonProperty("source_filter")
    String sourceFilter,

    @JsonProperty("target_connection_id")
    @NotBlank(message = "La conexión de destino es obligatoria")
    String targetConnectionId,

    @JsonProperty("target_dataset")
    @NotBlank(message = "El dataset de destino es obligatorio")
    String targetDataset,

    @JsonProperty("target_table")
    @NotBlank(message = "La tabla de destino es obligatoria")
    String targetTable,

    @JsonProperty("target_filter")
    String targetFilter,

    @JsonProperty("business_key")
    List<String> businessKey,

    @JsonProperty("date_column")
    String dateColumn,

    @JsonProperty("count_columns")
    List<String> countColumns,

    @JsonProperty("sum_columns")
    List<String> sumColumns,

    @JsonProperty("row_tolerance")
    Long rowTolerance,

    @JsonProperty("count_tolerance")
    Long countTolerance,

    @JsonProperty("amount_tolerance")
    Double amountTolerance,

    @JsonProperty("requested_by")
    String requestedBy,

    @JsonProperty("session_id")
    String sessionId

) {
    public ReconciliationDraftCreateRequest {
        processName = normalizeRequired(processName);
        domainName = normalizeRequired(domainName);
        description = normalizeOptional(description);

        sourceConnectionId = normalizeRequired(sourceConnectionId);
        sourceDataset = normalizeRequired(sourceDataset);
        sourceTable = normalizeRequired(sourceTable);
        sourceFilter = normalizeOptional(sourceFilter);

        targetConnectionId = normalizeRequired(targetConnectionId);
        targetDataset = normalizeRequired(targetDataset);
        targetTable = normalizeRequired(targetTable);
        targetFilter = normalizeOptional(targetFilter);

        dateColumn = normalizeOptional(dateColumn);

        businessKey = copyOrEmpty(businessKey);
        countColumns = copyOrEmpty(countColumns);
        sumColumns = copyOrEmpty(sumColumns);

        rowTolerance = rowTolerance == null ? 0L : Math.max(0L, rowTolerance);
        countTolerance = countTolerance == null ? 0L : Math.max(0L, countTolerance);
        amountTolerance = amountTolerance == null ? 0.0 : Math.max(0.0, amountTolerance);

        requestedBy =
            requestedBy == null || requestedBy.isBlank()
                ? "system"
                : requestedBy.trim();

        sessionId = normalizeOptional(sessionId);
    }

    private static List<String> copyOrEmpty(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private static String normalizeRequired(String value) {
        return value == null ? null : value.trim();
    }

    private static String normalizeOptional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
