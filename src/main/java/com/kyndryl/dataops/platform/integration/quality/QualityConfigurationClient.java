package com.kyndryl.dataops.platform.integration.quality;

import java.util.Map;

import org.springframework.stereotype.Component;

import com.kyndryl.dataops.platform.shared.client.DataOpsApiClient;

/**
 * Adapter del BFF para el bounded context de calidad de datos.
 *
 * <p>Esta primera versión encapsula únicamente contratos certificados en el
 * OpenAPI productivo de jarvis-reconciliation-agent. Las operaciones CRUD de
 * lifecycle que todavía no existen en el backend no se simulan localmente.</p>
 */
@Component
public class QualityConfigurationClient {

    private final DataOpsApiClient client;

    public QualityConfigurationClient(
        DataOpsApiClient client
    ) {
        this.client = client;
    }

    public Map<String, Object> listConfigurations() {
        return client.get(
            "/data-quality/configs"
        );
    }

    public Map<String, Object> getConfiguration(
        String configurationId
    ) {
        return client.get(
            "/data-quality/config/"
                + validateIdentifier(
                    configurationId,
                    "configurationId"
                )
        );
    }

    public Map<String, Object> listRuleTypes() {
        return client.get(
            "/data-quality/rule-types"
        );
    }

    public Map<String, Object> createDraft(
        Object request
    ) {
        return client.post(
            "/data-quality/configure/draft",
            request
        );
    }

    public Map<String, Object> getDraft(
        String draftId
    ) {
        return client.get(
            "/data-quality/configure/draft/"
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
            "/data-quality/configure/draft/"
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
            "/data-quality/configure/validate/"
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
            "/data-quality/configure/confirm/"
                + validateIdentifier(
                    draftId,
                    "draftId"
                ),
            request
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
