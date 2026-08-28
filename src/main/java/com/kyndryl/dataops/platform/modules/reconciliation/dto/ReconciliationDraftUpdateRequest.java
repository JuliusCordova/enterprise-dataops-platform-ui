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

    @JsonProperty("count_columns")
    List<String> countColumns,

    @JsonProperty("sum_columns")
    List<String> sumColumns,

    @JsonProperty("row_tolerance")
    Long rowTolerance,

    @JsonProperty("count_tolerance")
    Long countTolerance,

    @JsonProperty("amount_tolerance")
    Double amountTolerance

) {
    public ReconciliationDraftUpdateRequest {
        businessKey = businessKey == null ? List.of() : List.copyOf(businessKey);
        countColumns = countColumns == null ? List.of() : List.copyOf(countColumns);
        sumColumns = sumColumns == null ? List.of() : List.copyOf(sumColumns);

        rowTolerance = rowTolerance == null ? 0L : Math.max(0L, rowTolerance);
        countTolerance = countTolerance == null ? 0L : Math.max(0L, countTolerance);
        amountTolerance = amountTolerance == null ? 0.0 : Math.max(0.0, amountTolerance);
    }
}
