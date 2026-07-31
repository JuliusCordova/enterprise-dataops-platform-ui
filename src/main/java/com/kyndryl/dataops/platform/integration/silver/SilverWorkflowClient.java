package com.kyndryl.dataops.platform.integration.silver;

import java.util.Map;

import org.springframework.stereotype.Component;

@Component
public class SilverWorkflowClient {

    private final SilverBackendClient client;

    public SilverWorkflowClient(SilverBackendClient client) {
        this.client = client;
    }

    public Map<String, Object> listWorkflows() {
        return client.get("/silver-workflows");
    }

    public Map<String, Object> createWorkflow(Object request) {
        return client.post("/silver-workflows", request);
    }

    public Map<String, Object> getWorkflow(String workflowId) {
        return client.get("/silver-workflows/" + validateIdentifier(workflowId, "workflowId"));
    }

    public Map<String, Object> confirmSource(String workflowId, Object request) {
        return client.post(
            "/silver-workflows/" + validateIdentifier(workflowId, "workflowId") + "/confirm-source",
            request
        );
    }

    public Map<String, Object> getBusinessRules(String workflowId) {
        return client.get(
            "/silver-workflows/" + validateIdentifier(workflowId, "workflowId") + "/business-rules"
        );
    }

    public Map<String, Object> saveBusinessRulesDraft(String workflowId, Object request) {
        return client.put(
            "/silver-workflows/" + validateIdentifier(workflowId, "workflowId") + "/business-rules/draft",
            request
        );
    }

    private String validateIdentifier(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " no puede estar vacío");
        }
        String normalized = value.trim();
        if (!normalized.matches("[A-Za-z0-9_\\-]+")) {
            throw new IllegalArgumentException(fieldName + " contiene caracteres no permitidos");
        }
        return normalized;
    }
}
