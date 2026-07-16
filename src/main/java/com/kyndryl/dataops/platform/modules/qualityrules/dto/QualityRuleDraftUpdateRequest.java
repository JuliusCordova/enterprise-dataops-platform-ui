package com.kyndryl.dataops.platform.modules.qualityrules.dto;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.NotEmpty;

public record QualityRuleDraftUpdateRequest(

    @JsonProperty("config_name")
    String configName,

    @JsonProperty("description")
    String description,

    @JsonProperty("selected_columns")
    @NotEmpty
    List<String> selectedColumns,

    @JsonProperty("rules")
    @NotEmpty
    List<Map<String, Object>> rules

) {
    public QualityRuleDraftUpdateRequest {
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
