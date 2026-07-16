package com.kyndryl.dataops.platform.modules.profiling.service;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.kyndryl.dataops.platform.modules.profiling.dto.ProfilingRequest;
import com.kyndryl.dataops.platform.shared.client.DataOpsApiClient;

@Service
public class ProfilingExecutionService {

    private static final Logger log =
        LoggerFactory.getLogger(
            ProfilingExecutionService.class
        );

    private final DataOpsApiClient client;

    public ProfilingExecutionService(
        DataOpsApiClient client
    ) {
        this.client = client;
    }

    public Map<String, Object> execute(
        ProfilingRequest request
    ) {
        log.info(
            "Executing profiling. connectionId={}, datasetId={}, tableId={}",
            request.connectionId(),
            request.datasetId(),
            request.tableId()
        );

        return client.post(
            "/data-quality/profile",
            request
        );
    }
}
