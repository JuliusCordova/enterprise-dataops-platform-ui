package com.kyndryl.dataops.platform.integration.reconciliation;

import java.util.Map;

import org.springframework.stereotype.Component;

import com.kyndryl.dataops.platform.shared.client.DataOpsApiClient;

/**
 * Adapter del BFF para el bounded context de reconciliación.
 *
 * <p>Expone únicamente operaciones certificadas en el OpenAPI productivo.
 * Las capacidades futuras de versionado, estado, archivado e historial no se
 * simulan hasta que existan contratos backend reales.</p>
 */
@Component
public class ReconciliationConfigurationClient {

    private final DataOpsApiClient client;

    public ReconciliationConfigurationClient(
        DataOpsApiClient client
    ) {
        this.client = client;
    }

    public Map<String, Object> listConfigurations() {
        return client.get(
            "/reconciliation/configs"
        );
    }

    public Map<String, Object> createDraft(
        Object request
    ) {
        return client.post(
            "/reconciliation/configure/draft",
            request
        );
    }

    public Map<String, Object> getDraft(
        String draftId
    ) {
        return client.get(
            "/reconciliation/configure/draft/"
                + validateIdentifier(
                    draftId,
                    "draftId"
                )
        );
    }

    public Map<String, Object> updateDraft(
        String draftId,
        Object request
    ) {
        return client.put(
            "/reconciliation/configure/draft/"
                + validateIdentifier(
                    draftId,
                    "draftId"
                ),
            request
        );
    }

    public Map<String, Object> validateDraft(
        String draftId
    ) {
        return client.post(
            "/reconciliation/configure/validate/"
                + validateIdentifier(
                    draftId,
                    "draftId"
                ),
            Map.of()
        );
    }

    public Map<String, Object> publishDraft(
        String draftId,
        Object request
    ) {
        return client.post(
            "/reconciliation/configure/confirm/"
                + validateIdentifier(
                    draftId,
                    "draftId"
                ),
            request
        );
    }

    public Map<String, Object> execute(
        Object request
    ) {
        return client.post(
            "/reconciliation/execute",
            request
        );
    }

    public Map<String, Object> getResult(
        String executionId
    ) {
        return client.get(
            "/reconciliation/result/"
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
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(
                fieldName + " no puede estar vacío"
            );
        }

        String normalized = value.trim();

        if (!normalized.matches("[A-Za-z0-9_\\-]+")) {
            throw new IllegalArgumentException(
                fieldName
                    + " contiene caracteres no permitidos"
            );
        }

        return normalized;
    }
}
