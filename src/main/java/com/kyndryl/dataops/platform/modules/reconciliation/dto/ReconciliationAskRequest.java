package com.kyndryl.dataops.platform.modules.reconciliation.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.NotBlank;

public record ReconciliationAskRequest(

    @JsonProperty("question")
    @NotBlank
    String question,

    @JsonProperty("user_email")
    String userEmail,

    @JsonProperty("session_id")
    String sessionId

) {
    public ReconciliationAskRequest {
        userEmail =
            userEmail == null
            || userEmail.isBlank()
                ? "system"
                : userEmail.trim();

        sessionId =
            sessionId == null
            || sessionId.isBlank()
                ? null
                : sessionId.trim();
    }
}
