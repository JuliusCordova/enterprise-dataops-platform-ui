package com.kyndryl.dataops.platform.modules.reconciliation.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.NotBlank;

public record ReconciliationExecuteRequest(

    @JsonProperty("reconciliation_id")
    @NotBlank
    String reconciliationId,

    @JsonProperty("business_date")
    @NotBlank
    String businessDate,

    @JsonProperty("requested_by")
    String requestedBy

) {
    public ReconciliationExecuteRequest {
        requestedBy =
            requestedBy == null
            || requestedBy.isBlank()
                ? "system"
                : requestedBy.trim();

        businessDate =
            businessDate == null
                ? null
                : businessDate.trim();
    }
}
