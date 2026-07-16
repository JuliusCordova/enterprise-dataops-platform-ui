package com.kyndryl.dataops.platform.modules.profiling.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.NotBlank;

public record ProfilingRequest(

    @JsonProperty("connection_id")
    @NotBlank
    String connectionId,

    @JsonProperty("dataset_id")
    @NotBlank
    String datasetId,

    @JsonProperty("table_id")
    @NotBlank
    String tableId,

    @JsonProperty("selected_columns")
    List<String> selectedColumns

) {
    public ProfilingRequest {
        selectedColumns =
            selectedColumns == null
                ? List.of()
                : List.copyOf(selectedColumns);
    }
}
