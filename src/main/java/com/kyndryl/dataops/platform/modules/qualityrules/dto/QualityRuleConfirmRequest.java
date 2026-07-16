package com.kyndryl.dataops.platform.modules.qualityrules.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.NotBlank;

public record QualityRuleConfirmRequest(

    @JsonProperty("confirmed_by")
    @NotBlank
    String confirmedBy

) {
}
