package com.kyndryl.dataops.platform.modules.reconciliation.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.NotBlank;

public record ReconciliationDraftCreateRequest(

    @JsonProperty("process_name")
    @NotBlank
    String processName,

    @JsonProperty("domain_name")
    String domainName,

    @JsonProperty("description")
    String description,

    @JsonProperty("source_connection_id")
    @NotBlank
    String sourceConnectionId,

    @JsonProperty("source_dataset")
    @NotBlank
    String sourceDataset,

    @JsonProperty("source_table")
    @NotBlank
    String sourceTable,

    @JsonProperty("source_filter")
    String sourceFilter,

    @JsonProperty("target_connection_id")
    @NotBlank
    String targetConnectionId,

    @JsonProperty("target_dataset")
    @NotBlank
    String targetDataset,

    @JsonProperty("target_table")
    @NotBlank
    String targetTable,

    @JsonProperty("target_filter")
    String targetFilter,

    @JsonProperty("business_key")
    List<String> businessKey,

    @JsonProperty("date_column")
    String dateColumn,

    @JsonProperty("sum_columns")
    List<String> sumColumns,

    @JsonProperty("row_tolerance")
    Long rowTolerance,

    @JsonProperty("amount_tolerance")
    Double amountTolerance,

    @JsonProperty("requested_by")
    String requestedBy,

    @JsonProperty("session_id")
    String sessionId

) {
    public ReconciliationDraftCreateRequest {
        domainName =
            normalizeOptional(domainName);

        description =
            normalizeOptional(description);

        sourceFilter =
            normalizeOptional(sourceFilter);

        targetFilter =
            normalizeOptional(targetFilter);

        dateColumn =
            normalizeOptional(dateColumn);

        businessKey =
            businessKey == null
                ? List.of()
                : List.copyOf(businessKey);

        sumColumns =
            sumColumns == null
                ? List.of()
                : List.copyOf(sumColumns);

        rowTolerance =
            rowTolerance == null
                ? 0L
                : rowTolerance;

        amountTolerance =
            amountTolerance == null
                ? 0.0
                : amountTolerance;

        requestedBy =
            requestedBy == null
            || requestedBy.isBlank()
                ? "system"
                : requestedBy.trim();

        sessionId =
            normalizeOptional(sessionId);
    }

    private static String normalizeOptional(
        String value
    ) {
        return value == null
            || value.isBlank()
                ? null
                : value.trim();
    }
}
