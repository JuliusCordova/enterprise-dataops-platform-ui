package com.kyndryl.dataops.platform.integration.silver;

import java.util.Map;

import org.springframework.stereotype.Component;

@Component
public class SilverExecutionClient {

    private final SilverBackendClient client;

    public SilverExecutionClient(SilverBackendClient client) {
        this.client = client;
    }

    public Map<String, Object> create(Object request) {
        return client.post("/executions", request);
    }

    public Map<String, Object> get(String executionId) {
        return client.get("/executions/" + validate(executionId));
    }

    public Map<String, Object> validatePackage(String executionId) {
        return client.post("/executions/" + validate(executionId) + "/validate-package", Map.of());
    }

    public Map<String, Object> submit(String executionId) {
        return client.post("/executions/" + validate(executionId) + "/submit", Map.of());
    }

    public Map<String, Object> syncStatus(String executionId) {
        return client.post("/executions/" + validate(executionId) + "/sync-status", Map.of());
    }

    public Map<String, Object> logs(String executionId) {
        return client.get("/agentops/executions/" + validate(executionId) + "/logs");
    }

    public Map<String, Object> syncMetrics(String executionId) {
        return client.post("/agentops/executions/" + validate(executionId) + "/metrics/sync", Map.of());
    }

    private String validate(String value) {
        if (value == null || !value.trim().matches("[A-Za-z0-9_\\-]+")) {
            throw new IllegalArgumentException("executionId inválido");
        }
        return value.trim();
    }
}
