package com.kyndryl.dataops.platform.modules.qualityrules.dto;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

public record QualityRuleDraftRequest(

    @JsonProperty("config_name")
    @NotBlank
    String configName,

    @JsonProperty("description")
    String description,

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
    @NotEmpty
    List<String> selectedColumns,

    @JsonProperty("rules")
    @NotEmpty
    List<Map<String, Object>> rules,

    @JsonProperty("created_by")
    @NotBlank
    String createdBy

) {
    public QualityRuleDraftRequest {
        selectedColumns =
            selectedColumns == null
                ? List.of()
                : List.copyOf(selectedColumns);

        rules =
            rules == null
                ? List.of()
                : List.copyOf(rules);
    }
}
