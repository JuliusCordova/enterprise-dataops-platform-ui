package com.kyndryl.dataops.platform.modules.qualityrules.service;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.kyndryl.dataops.platform.modules.qualityrules.dto.QualityRuleConfirmRequest;
import com.kyndryl.dataops.platform.modules.qualityrules.dto.QualityRuleDraftRequest;
import com.kyndryl.dataops.platform.modules.qualityrules.dto.QualityRuleDraftUpdateRequest;
import com.kyndryl.dataops.platform.shared.client.DataOpsApiClient;

@Service
public class QualityRulesService {

    private static final Logger log =
        LoggerFactory.getLogger(
            QualityRulesService.class
        );

    private final DataOpsApiClient client;

    public QualityRulesService(
        DataOpsApiClient client
    ) {
        this.client = client;
    }

    public Map<String, Object> getRuleTypes() {
        log.info(
            "Consultando catálogo de reglas de calidad"
        );

        return client.get(
            "/data-quality/rule-types"
        );
    }

    public Map<String, Object> createDraft(
        QualityRuleDraftRequest request
    ) {
        log.info(
            "Creando borrador. connectionId={}, datasetId={}, tableId={}, rules={}",
            request.connectionId(),
            request.datasetId(),
            request.tableId(),
            request.rules().size()
        );

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
        QualityRuleDraftUpdateRequest request
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

    public Map<String, Object> confirmDraft(
        String draftId,
        QualityRuleConfirmRequest request
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
