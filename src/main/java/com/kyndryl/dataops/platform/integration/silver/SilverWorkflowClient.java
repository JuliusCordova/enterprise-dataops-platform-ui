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
        return client.post(path(workflowId, "/confirm-source"), request);
    }

    public Map<String, Object> getBusinessRules(String workflowId) {
        return client.get(path(workflowId, "/business-rules"));
    }

    public Map<String, Object> generateMappingRecommendations(
        String workflowId,
        Object request
    ) {
        return client.post(path(workflowId, "/mapping-recommendations"), request);
    }

    public Map<String, Object> saveBusinessRulesDraft(String workflowId, Object request) {
        return client.put(path(workflowId, "/business-rules/draft"), request);
    }

    public Map<String, Object> generateBusinessRules(String workflowId, Object request) {
        return client.post(path(workflowId, "/business-rules/generate"), request);
    }

    public Map<String, Object> confirmBusinessRules(String workflowId, Object request) {
        return client.post(path(workflowId, "/business-rules/confirm"), request);
    }

    public Map<String, Object> saveSpecification(String workflowId, Object request) {
        return client.post(path(workflowId, "/specification"), request);
    }

    public Map<String, Object> reviewQuality(String workflowId, Object request) {
        return client.post(path(workflowId, "/quality-review"), request);
    }

    public Object listDestinationDatasets(String projectId) {
        return client.getObject(catalogProjectPath(projectId) + "/datasets");
    }

    public Object createDestinationDataset(String projectId, Object request) {
        return client.postObject(catalogProjectPath(projectId) + "/datasets", request);
    }

    public Object listDestinationTables(String projectId, String datasetId) {
        return client.getObject(
            catalogProjectPath(projectId)
                + "/datasets/"
                + validateIdentifier(datasetId, "datasetId")
                + "/tables"
        );
    }

    public Object getDestinationTable(String projectId, String datasetId, String tableId) {
        return client.getObject(
            catalogProjectPath(projectId)
                + "/datasets/"
                + validateIdentifier(datasetId, "datasetId")
                + "/tables/"
                + validateIdentifier(tableId, "tableId")
        );
    }

    private String path(String workflowId, String suffix) {
        return "/silver-workflows/" + validateIdentifier(workflowId, "workflowId") + suffix;
    }

    private String catalogProjectPath(String projectId) {
        return "/silver-workflows/catalog/projects/" + validateIdentifier(projectId, "projectId");
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
