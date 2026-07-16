package com.kyndryl.dataops.platform.modules.reconciliation.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record ReconciliationConfirmRequest(

    @JsonProperty("confirmed_by")
    @NotBlank
    @Email
    String confirmedBy,

    @JsonProperty("active_flag")
    Boolean activeFlag,

    @JsonProperty("execute_after_confirm")
    Boolean executeAfterConfirm,

    @JsonProperty("business_date")
    String businessDate

) {
    public ReconciliationConfirmRequest {
        activeFlag =
            activeFlag == null
                ? Boolean.TRUE
                : activeFlag;

        executeAfterConfirm =
            executeAfterConfirm == null
                ? Boolean.FALSE
                : executeAfterConfirm;

        businessDate =
            businessDate == null
            || businessDate.isBlank()
                ? null
                : businessDate.trim();
    }
}
