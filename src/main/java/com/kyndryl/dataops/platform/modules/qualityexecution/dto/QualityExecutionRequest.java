package com.kyndryl.dataops.platform.modules.qualityexecution.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.NotBlank;

public record QualityExecutionRequest(

    @JsonProperty("quality_config_id")
    @NotBlank
    String qualityConfigId,

    @JsonProperty("business_date")
    String businessDate,

    @JsonProperty("requested_by")
    String requestedBy,

    @JsonProperty("execution_mode")
    String executionMode

) {
    public QualityExecutionRequest {
        requestedBy =
            requestedBy == null
            || requestedBy.isBlank()
                ? "system"
                : requestedBy.trim();

        executionMode =
            executionMode == null
            || executionMode.isBlank()
                ? "ON_DEMAND"
                : executionMode.trim().toUpperCase();

        businessDate =
            businessDate == null
            || businessDate.isBlank()
                ? null
                : businessDate.trim();
    }
}
