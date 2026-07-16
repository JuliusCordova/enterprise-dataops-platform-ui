package com.kyndryl.dataops.platform.modules.reconciliation.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ReconciliationDraftUpdateRequest(

    @JsonProperty("process_name")
    String processName,

    @JsonProperty("domain_name")
    String domainName,

    @JsonProperty("description")
    String description,

    @JsonProperty("business_key")
    List<String> businessKey,

    @JsonProperty("date_column")
    String dateColumn,

    @JsonProperty("sum_columns")
    List<String> sumColumns,

    @JsonProperty("row_tolerance")
    Long rowTolerance,

    @JsonProperty("amount_tolerance")
    Double amountTolerance

) {
    public ReconciliationDraftUpdateRequest {
        businessKey =
            businessKey == null
                ? List.of()
                : List.copyOf(businessKey);

        sumColumns =
            sumColumns == null
                ? List.of()
                : List.copyOf(sumColumns);
    }
}
