package com.kyndryl.dataops.platform.modules.qualityrules.service;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.kyndryl.dataops.platform.integration.quality.QualityConfigurationClient;
import com.kyndryl.dataops.platform.modules.qualityrules.dto.QualityRuleConfirmRequest;
import com.kyndryl.dataops.platform.modules.qualityrules.dto.QualityRuleDraftRequest;
import com.kyndryl.dataops.platform.modules.qualityrules.dto.QualityRuleDraftUpdateRequest;

@Service
public class QualityRulesService {

    private static final Logger log =
        LoggerFactory.getLogger(
            QualityRulesService.class
        );

    private final QualityConfigurationClient configurationClient;

    public QualityRulesService(
        QualityConfigurationClient configurationClient
    ) {
        this.configurationClient = configurationClient;
    }

    public Map<String, Object> getRuleTypes() {
        log.info(
            "Consultando catálogo de reglas de calidad"
        );

        return configurationClient.listRuleTypes();
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

        return configurationClient.createDraft(request);
    }

    public Map<String, Object> getDraft(
        String draftId
    ) {
        return configurationClient.getDraft(draftId);
    }

    public Map<String, Object> updateDraft(
        String draftId,
        QualityRuleDraftUpdateRequest request
    ) {
        return configurationClient.updateDraft(
            draftId,
            request
        );
    }

    public Map<String, Object> validateDraft(
        String draftId
    ) {
        return configurationClient.validateDraft(draftId);
    }

    public Map<String, Object> confirmDraft(
        String draftId,
        QualityRuleConfirmRequest request
    ) {
        return configurationClient.publishDraft(
            draftId,
            request
        );
    }
}
