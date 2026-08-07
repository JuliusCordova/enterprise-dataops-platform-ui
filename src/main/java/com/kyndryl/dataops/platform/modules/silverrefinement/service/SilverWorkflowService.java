package com.kyndryl.dataops.platform.modules.silverrefinement.service;

import java.util.Map;

import org.springframework.stereotype.Service;

import com.kyndryl.dataops.platform.integration.silver.SilverWorkflowClient;

@Service
public class SilverWorkflowService {

    private final SilverWorkflowClient client;

    public SilverWorkflowService(SilverWorkflowClient client) {
        this.client = client;
    }

    public Map<String, Object> listWorkflows() {
        return client.listWorkflows();
    }

    public Map<String, Object> createWorkflow(Object request) {
        return client.createWorkflow(request);
    }

    public Map<String, Object> getWorkflow(String workflowId) {
        return client.getWorkflow(workflowId);
    }

    public Map<String, Object> confirmSource(String workflowId, Object request) {
        return client.confirmSource(workflowId, request);
    }

    public Map<String, Object> getBusinessRules(String workflowId) {
        return client.getBusinessRules(workflowId);
    }

    public Map<String, Object> generateMappingRecommendations(
        String workflowId,
        Object request
    ) {
        return client.generateMappingRecommendations(workflowId, request);
    }

    public Map<String, Object> saveBusinessRulesDraft(String workflowId, Object request) {
        return client.saveBusinessRulesDraft(workflowId, request);
    }

    public Map<String, Object> generateBusinessRules(String workflowId, Object request) {
        return client.generateBusinessRules(workflowId, request);
    }

    public Map<String, Object> confirmBusinessRules(String workflowId, Object request) {
        return client.confirmBusinessRules(workflowId, request);
    }

    public Map<String, Object> saveSpecification(String workflowId, Object request) {
        return client.saveSpecification(workflowId, request);
    }

    public Map<String, Object> reviewQuality(String workflowId, Object request) {
        return client.reviewQuality(workflowId, request);
    }

    public Object listDestinationDatasets(String projectId) {
        return client.listDestinationDatasets(projectId);
    }

    public Object createDestinationDataset(String projectId, Object request) {
        return client.createDestinationDataset(projectId, request);
    }

    public Object listDestinationTables(String projectId, String datasetId) {
        return client.listDestinationTables(projectId, datasetId);
    }

    public Object getDestinationTable(String projectId, String datasetId, String tableId) {
        return client.getDestinationTable(projectId, datasetId, tableId);
    }
}
