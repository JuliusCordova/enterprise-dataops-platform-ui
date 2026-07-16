package com.kyndryl.dataops.platform.modules.qualityexecution.service;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.kyndryl.dataops.platform.modules.qualityexecution.dto.QualityExecutionRequest;
import com.kyndryl.dataops.platform.shared.client.DataOpsApiClient;

@Service
public class QualityExecutionService {

    private static final Logger log =
        LoggerFactory.getLogger(
            QualityExecutionService.class
        );

    private final DataOpsApiClient client;

    public QualityExecutionService(
        DataOpsApiClient client
    ) {
        this.client = client;
    }

    public Map<String, Object> getConfigurations(
        boolean activeOnly
    ) {
        return client.get(
            "/data-quality/configs?active_only="
                + activeOnly
        );
    }

    public Map<String, Object> execute(
        QualityExecutionRequest request
    ) {
        log.info(
            "Ejecutando calidad. qualityConfigId={}, businessDate={}, mode={}",
            request.qualityConfigId(),
            request.businessDate(),
            request.executionMode()
        );

        return client.post(
            "/data-quality/execute",
            request
        );
    }

    public Map<String, Object> getResult(
        String executionId
    ) {
        return client.get(
            "/data-quality/result/"
                + validateIdentifier(
                    executionId,
                    "executionId"
                )
        );
    }

    public Map<String, Object> getLatest(
        String qualityConfigId
    ) {
        return client.get(
            "/data-quality/latest/"
                + validateIdentifier(
                    qualityConfigId,
                    "qualityConfigId"
                )
        );
    }

    public Map<String, Object> getIssues(
        String executionId
    ) {
        return client.get(
            "/data-quality/issues/"
                + validateIdentifier(
                    executionId,
                    "executionId"
                )
        );
    }

    private String validateIdentifier(
        String value,
        String fieldName
    ) {
        if (
            value == null
            || value.isBlank()
        ) {
            throw new IllegalArgumentException(
                fieldName + " no puede estar vacío"
            );
        }

        String normalized =
            value.trim();

        if (!normalized.matches(
            "[A-Za-z0-9_\\-]+"
        )) {
            throw new IllegalArgumentException(
                fieldName
                    + " contiene caracteres no permitidos"
            );
        }

        return normalized;
    }
}
