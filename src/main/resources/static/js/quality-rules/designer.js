(() => {
    "use strict";

    const RECOMMENDATIONS_STORAGE_KEY =
        "dataOpsRuleRecommendations";

    const DRAFT_STORAGE_KEY =
        "dataOpsQualityRulesDraft";

    const PUBLISHED_STORAGE_KEY =
        "dataOpsPublishedQualityConfig";

    const DEFAULT_RULE_TYPES = [
        {
            rule_type: "NOT_NULL",
            display_name: "Campo obligatorio",
            dimension: "COMPLETENESS"
        },
        {
            rule_type: "UNIQUE",
            display_name: "Valores únicos",
            dimension: "UNIQUENESS"
        },
        {
            rule_type: "VALUE_RANGE",
            display_name: "Rango permitido",
            dimension: "VALIDITY"
        },
        {
            rule_type: "ALLOWED_VALUES",
            display_name: "Valores permitidos",
            dimension: "VALIDITY"
        },
        {
            rule_type: "ROW_COUNT_MIN",
            display_name: "Volumen mínimo",
            dimension: "COMPLETENESS"
        }
    ];

    const state = {
        source: null,
        profilingColumns: [],
        profilingRecommendations: [],
        ruleTypes: [],
        rules: [],

        draftId: null,
        draftResponse: null,
        validationResponse: null,
        publishedResponse: null,

        isSaving: false,
        isValidating: false,
        isConfirming: false,
        isPublished: false
    };

    const elements = {
        emptyState:
            document.getElementById(
                "rules-empty-state"
            ),

        content:
            document.getElementById(
                "rules-content"
            ),

        sourceTitle:
            document.getElementById(
                "rules-source-title"
            ),

        sourceConnection:
            document.getElementById(
                "rules-connection"
            ),

        sourceDataset:
            document.getElementById(
                "rules-dataset"
            ),

        sourceTable:
            document.getElementById(
                "rules-table"
            ),

        selectedRuleCount:
            document.getElementById(
                "selected-rule-count"
            ),

        applyAllButton:
            document.getElementById(
                "apply-all-button"
            ),

        addRuleButton:
            document.getElementById(
                "add-rule-button"
            ),

        rulesList:
            document.getElementById(
                "rules-list"
            ),

        aiSummary:
            document.getElementById(
                "rules-ai-summary"
            ),

        designChecklist:
            document.getElementById(
                "design-checklist"
            ),

        configName:
            document.getElementById(
                "config-name"
            ),

        configDescription:
            document.getElementById(
                "config-description"
            ),

        createdBy:
            document.getElementById(
                "created-by"
            ),

        message:
            document.getElementById(
                "rules-message"
            ),

        saveDraftButton:
            document.getElementById(
                "save-draft-button"
            ),

        validateButton:
            document.getElementById(
                "validate-rules-button"
            ),

        validationResult:
            document.getElementById(
                "validation-result"
            ),

        validationStatus:
            document.getElementById(
                "validation-status"
            ),

        validationChecklist:
            document.getElementById(
                "validation-checklist"
            ),

        confirmButton:
            document.getElementById(
                "confirm-rules-button"
            )
    };

    async function initialize() {
        validateRequiredElements();
        bindPageEvents();

        await loadRuleTypes();

        const restored =
            await restoreSavedDraft();

        if (!restored) {
            const profilingContext =
                readStorage(
                    RECOMMENDATIONS_STORAGE_KEY
                );

            if (!profilingContext) {
                showEmptyState();
                return;
            }

            initializeFromProfiling(
                profilingContext
            );
        }

        renderCompleteScreen();
    }

    function validateRequiredElements() {
        const requiredElements =
            Object.entries(elements);

        const missing =
            requiredElements.filter(
                ([, element]) => !element
            );

        if (missing.length > 0) {
            const missingNames =
                missing.map(
                    ([name]) => name
                );

            throw new Error(
                "Faltan elementos requeridos: "
                + missingNames.join(", ")
            );
        }
    }

    function bindPageEvents() {
        elements.applyAllButton
            .addEventListener(
                "click",
                applyAllRecommendations
            );

        elements.addRuleButton
            .addEventListener(
                "click",
                addManualRule
            );

        elements.saveDraftButton
            .addEventListener(
                "click",
                saveDraft
            );

        elements.validateButton
            .addEventListener(
                "click",
                validateDraft
            );

        elements.confirmButton
            .addEventListener(
                "click",
                confirmOrExecute
            );

        elements.configName
            .addEventListener(
                "input",
                handleConfigurationChange
            );

        elements.configDescription
            .addEventListener(
                "input",
                handleConfigurationChange
            );

        elements.createdBy
            .addEventListener(
                "input",
                handleConfigurationChange
            );
    }

    async function loadRuleTypes() {
        try {
            const payload =
                await apiRequest(
                    "/ui/api/quality-rules/rule-types"
                );

            const items =
                extractArray(
                    payload,
                    [
                        "rule_types",
                        "rules",
                        "items",
                        "data"
                    ]
                );

            state.ruleTypes =
                normalizeRuleTypes(items);

            if (
                state.ruleTypes.length === 0
            ) {
                state.ruleTypes =
                    DEFAULT_RULE_TYPES;
            }

        } catch (error) {
            console.warn(
                "Se utilizará catálogo local.",
                error
            );

            state.ruleTypes =
                DEFAULT_RULE_TYPES;
        }
    }

    async function restoreSavedDraft() {
        const localDraft =
            readStorage(
                DRAFT_STORAGE_KEY
            );

        if (
            !localDraft
            || !localDraft.draftId
        ) {
            return false;
        }

        state.draftId =
            localDraft.draftId;

        state.source =
            localDraft.source || null;

        state.rules =
            Array.isArray(
                localDraft.rules
            )
                ? localDraft.rules
                : [];

        state.profilingColumns =
            Array.isArray(
                localDraft.profilingColumns
            )
                ? localDraft.profilingColumns
                : [];

        state.draftResponse =
            localDraft.draftResponse
            || null;

        state.validationResponse =
            localDraft.validationResponse
            || null;

        state.publishedResponse =
            localDraft.publishedResponse
            || null;

        state.isPublished =
            localDraft.isPublished === true;

        restoreFormValues(
            localDraft.form
        );

        /*
         * Consultamos nuevamente el backend para
         * comprobar que el borrador todavía existe.
         */
        try {
            const backendDraft =
                await apiRequest(
                    `/ui/api/quality-rules/draft/${encodeURIComponent(
                        state.draftId
                    )}`
                );

            state.draftResponse =
                backendDraft;

            mergeBackendDraft(
                backendDraft
            );

            showMessage(
                `Borrador ${state.draftId} recuperado. Puedes editarlo, validarlo o publicarlo.`,
                "success"
            );

        } catch (error) {
            /*
             * Si falla la consulta, conservamos la copia
             * local para no perder el trabajo del usuario.
             */
            console.warn(
                "No fue posible recuperar el borrador del backend.",
                error
            );

            showMessage(
                "Se recuperó la copia local del borrador. El backend no pudo ser consultado.",
                "warning"
            );
        }

        return Boolean(
            state.source
            && state.rules.length > 0
        );
    }

    function initializeFromProfiling(
        profilingContext
    ) {
        state.source =
            profilingContext.source
            || {};

        state.profilingColumns =
            Array.isArray(
                profilingContext.columns
            )
                ? profilingContext.columns
                : [];

        state.profilingRecommendations =
            Array.isArray(
                profilingContext.recommendations
            )
                ? profilingContext.recommendations
                : [];

        state.rules =
            buildSuggestedRules(
                state.profilingColumns
            );

        setDefaultFormValues();
    }

    function mergeBackendDraft(
        backendResponse
    ) {
        const draft =
            backendResponse.draft
            || backendResponse.configuration
            || backendResponse.data
            || backendResponse;

        state.source = {
            connectionId:
                draft.connection_id
                || state.source?.connectionId,

            datasetId:
                draft.dataset_id
                || state.source?.datasetId,

            tableId:
                draft.table_id
                || state.source?.tableId
        };

        if (
            draft.config_name
            && !elements.configName.value
        ) {
            elements.configName.value =
                draft.config_name;
        }

        if (
            draft.description
            && !elements.configDescription.value
        ) {
            elements.configDescription.value =
                draft.description;
        }

        if (
            draft.created_by
            && !elements.createdBy.value
        ) {
            elements.createdBy.value =
                draft.created_by;
        }

        const backendRules =
            draft.rules
            || draft.quality_rules;

        if (
            Array.isArray(backendRules)
            && backendRules.length > 0
        ) {
            state.rules =
                backendRules.map(
                    mapBackendRule
                );
        }

        const draftStatus =
            String(
                draft.status
                || draft.draft_status
                || draft.validation_status
                || ""
            ).toUpperCase();

        if (
            [
                "PUBLISHED",
                "CONFIRMED",
                "ACTIVE"
            ].includes(draftStatus)
        ) {
            state.isPublished = true;
        }
    }

    function mapBackendRule(
        backendRule
    ) {
        const ruleType =
            String(
                backendRule.rule_type
                || backendRule.type
                || "NOT_NULL"
            ).toUpperCase();

        const columnName =
            backendRule.column_name
            || "";

        return {
            localId:
                backendRule.rule_id
                || createLocalId(),

            selected:
                backendRule.active_flag
                !== false,

            suggested:
                false,

            ruleType,

            ruleName:
                backendRule.rule_name
                || buildRuleName(
                    ruleType,
                    columnName
                ),

            dimension:
                backendRule.rule_dimension
                || resolveDimension(
                    ruleType
                ),

            columnName,

            dataType:
                findProfileColumn(
                    columnName
                )?.type
                || "",

            warningThreshold:
                numberValue(
                    backendRule.warning_threshold
                    ?? defaultWarningThreshold(
                        ruleType
                    )
                ),

            criticalThreshold:
                numberValue(
                    backendRule.critical_threshold
                    ?? defaultCriticalThreshold(
                        ruleType
                    )
                ),

            parameters:
                normalizeBackendParameters(
                    ruleType,
                    backendRule.parameters
                    || {}
                )
        };
    }

    function normalizeBackendParameters(
        ruleType,
        parameters
    ) {
        if (
            ruleType === "ALLOWED_VALUES"
        ) {
            const values =
                parameters.allowed_values;

            return {
                allowed_values:
                    Array.isArray(values)
                        ? values.join(", ")
                        : String(
                            values || ""
                        )
            };
        }

        if (
            ruleType === "VALUE_RANGE"
        ) {
            return {
                min_value:
                    parameters.min_value
                    ?? "",

                max_value:
                    parameters.max_value
                    ?? ""
            };
        }

        if (
            ruleType === "ROW_COUNT_MIN"
        ) {
            return {
                minimum_row_count:
                    parameters.minimum_row_count
                    ?? 1
            };
        }

        return {};
    }

    function renderCompleteScreen() {
        elements.emptyState.hidden =
            true;

        elements.content.hidden =
            false;

        renderSource();
        renderRules();
        renderAdvisor();
        renderDesignChecklist();
        restoreValidationView();
        updateActionState();
    }

    function showEmptyState() {
        elements.emptyState.hidden =
            false;

        elements.content.hidden =
            true;
    }

    function renderSource() {
        const connection =
            state.source?.connectionId
            || "—";

        const dataset =
            state.source?.datasetId
            || "—";

        const table =
            state.source?.tableId
            || "—";

        elements.sourceConnection
            .textContent = connection;

        elements.sourceDataset
            .textContent = dataset;

        elements.sourceTable
            .textContent = table;

        elements.sourceTitle
            .textContent =
            `${dataset}.${table}`;
    }

    function setDefaultFormValues() {
        const table =
            state.source?.tableId
            || "tabla";

        elements.configName.value =
            `Calidad de ${humanize(table)}`;

        elements.configDescription.value =
            `Configuración de calidad generada a partir del perfilado de ${state.source?.datasetId}.${table}.`;

        if (
            !elements.createdBy.value
        ) {
            elements.createdBy.value =
                "julio.cordova@gmail.com";
        }
    }

    function restoreFormValues(
        form
    ) {
        if (!form) {
            return;
        }

        elements.configName.value =
            form.configName || "";

        elements.configDescription.value =
            form.configDescription || "";

        elements.createdBy.value =
            form.createdBy
            || "julio.cordova@gmail.com";
    }

    function buildSuggestedRules(
        columns
    ) {
        const results = [];

        columns.forEach(column => {
            const suggested =
                Array.isArray(
                    column.suggestedRules
                )
                    ? column.suggestedRules
                    : [];

            suggested.forEach(ruleType => {
                results.push(
                    createRuleModel({
                        ruleType,
                        columnName:
                            column.name,

                        dataType:
                            column.type,

                        suggested: true,

                        selected: true,

                        column
                    })
                );
            });
        });

        return removeDuplicateRules(
            results
        );
    }

    function createRuleModel({
        ruleType,
        columnName = "",
        dataType = "",
        suggested = false,
        selected = true,
        column = null
    }) {
        const normalizedRuleType =
            String(
                ruleType || "NOT_NULL"
            ).toUpperCase();

        return {
            localId:
                createLocalId(),

            selected,

            suggested,

            ruleType:
                normalizedRuleType,

            ruleName:
                buildRuleName(
                    normalizedRuleType,
                    columnName
                ),

            dimension:
                resolveDimension(
                    normalizedRuleType
                ),

            columnName:
                normalizedRuleType
                === "ROW_COUNT_MIN"
                    ? ""
                    : columnName,

            dataType,

            warningThreshold:
                defaultWarningThreshold(
                    normalizedRuleType
                ),

            criticalThreshold:
                defaultCriticalThreshold(
                    normalizedRuleType
                ),

            parameters:
                buildDefaultParameters(
                    normalizedRuleType,
                    column
                )
        };
    }

    function applyAllRecommendations() {
        if (
            state.rules.length === 0
        ) {
            state.rules =
                buildSuggestedRules(
                    state.profilingColumns
                );
        }

        state.rules.forEach(rule => {
            rule.selected = true;
        });

        rulesChanged();

        showMessage(
            "Se activaron todas las reglas recomendadas.",
            "success"
        );
    }

    function addManualRule() {
        const firstColumn =
            state.profilingColumns[0];

        state.rules.push(
            createRuleModel({
                ruleType:
                    "NOT_NULL",

                columnName:
                    firstColumn?.name
                    || "",

                dataType:
                    firstColumn?.type
                    || "",

                suggested:
                    false,

                selected:
                    true
            })
        );

        rulesChanged();
    }

    function rulesChanged() {
        /*
         * Si se modifica el borrador, deja de estar
         * validado hasta ejecutar una nueva validación.
         */
        state.validationResponse = null;
        state.isPublished = false;

        elements.validationResult.hidden =
            true;

        persistDraftState();

        renderRules();
        renderAdvisor();
        renderDesignChecklist();
        updateActionState();
    }

    function handleConfigurationChange() {
        state.validationResponse = null;

        if (!state.isPublished) {
            elements.validationResult.hidden =
                true;
        }

        persistDraftState();
        renderDesignChecklist();
        updateActionState();
    }

    function renderRules() {
        elements.rulesList.innerHTML =
            "";

        if (
            state.rules.length === 0
        ) {
            elements.rulesList.innerHTML = `
                <div class="rules-list-empty">

                    <strong>
                        No existen reglas configuradas
                    </strong>

                    <p>
                        Agrega una regla manual o aplica las recomendaciones del perfilado.
                    </p>

                </div>
            `;

            updateSelectedRuleCount();
            return;
        }

        state.rules.forEach(
            (rule, index) => {
                elements.rulesList
                    .appendChild(
                        createRuleCard(
                            rule,
                            index
                        )
                    );
            }
        );

        updateSelectedRuleCount();
    }

    function createRuleCard(
        rule,
        index
    ) {
        const article =
            document.createElement(
                "article"
            );

        article.className =
            "quality-rule-card";

        article.innerHTML = `
            <div class="quality-rule-card-header">

                <label class="rule-selection-control">

                    <input
                        type="checkbox"
                        class="rule-selected-input"
                        ${rule.selected
                            ? "checked"
                            : ""}>

                    <span></span>

                </label>

                <div class="rule-card-title">

                    <div class="rule-title-line">

                        <strong>
                            ${escapeHtml(
                                rule.ruleName
                            )}
                        </strong>

                        <span class="${
                            rule.suggested
                                ? "suggested-rule-chip"
                                : "manual-rule-chip"
                        }">
                            ${
                                rule.suggested
                                    ? "SUGERIDA"
                                    : "GUARDADA"
                            }
                        </span>

                    </div>

                    <small>
                        ${escapeHtml(
                            rule.dimension
                        )}
                    </small>

                </div>

                <button
                    type="button"
                    class="remove-rule-button"
                    aria-label="Eliminar regla">
                    ×
                </button>

            </div>

            <div class="quality-rule-form-grid">

                <div class="form-field">

                    <label>
                        Tipo
                    </label>

                    <select
                        class="rule-type-input">

                        ${buildRuleTypeOptions(
                            rule.ruleType
                        )}

                    </select>

                </div>

                <div class="form-field">

                    <label>
                        Columna
                    </label>

                    <select
                        class="rule-column-input"
                        ${
                            rule.ruleType
                            === "ROW_COUNT_MIN"
                                ? "disabled"
                                : ""
                        }>

                        ${buildColumnOptions(
                            rule.columnName,
                            rule.ruleType
                        )}

                    </select>

                </div>

                <div class="form-field">

                    <label>
                        Nombre
                    </label>

                    <input
                        type="text"
                        class="rule-name-input"
                        value="${escapeAttribute(
                            rule.ruleName
                        )}">

                </div>

                <div class="form-field">

                    <label>
                        Dimensión
                    </label>

                    <input
                        type="text"
                        value="${escapeAttribute(
                            rule.dimension
                        )}"
                        readonly>

                </div>

                <div class="form-field">

                    <label>
                        Advertencia
                    </label>

                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        class="warning-threshold-input"
                        value="${escapeAttribute(
                            rule.warningThreshold
                        )}">

                </div>

                <div class="form-field">

                    <label>
                        Crítico
                    </label>

                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        class="critical-threshold-input"
                        value="${escapeAttribute(
                            rule.criticalThreshold
                        )}">

                </div>

            </div>

            <div class="rule-parameters-container">

                ${renderParameterFields(
                    rule
                )}

            </div>
        `;

        bindRuleEvents(
            article,
            index
        );

        return article;
    }

    function bindRuleEvents(
        article,
        index
    ) {
        article
            .querySelector(
                ".rule-selected-input"
            )
            .addEventListener(
                "change",
                event => {
                    state.rules[index]
                        .selected =
                        event.target.checked;

                    rulesChanged();
                }
            );

        article
            .querySelector(
                ".rule-type-input"
            )
            .addEventListener(
                "change",
                event => {
                    const rule =
                        state.rules[index];

                    rule.ruleType =
                        event.target.value;

                    rule.dimension =
                        resolveDimension(
                            rule.ruleType
                        );

                    if (
                        rule.ruleType
                        === "ROW_COUNT_MIN"
                    ) {
                        rule.columnName = "";

                    } else if (
                        !rule.columnName
                    ) {
                        rule.columnName =
                            state.profilingColumns[0]
                                ?.name
                            || "";
                    }

                    rule.ruleName =
                        buildRuleName(
                            rule.ruleType,
                            rule.columnName
                        );

                    rule.warningThreshold =
                        defaultWarningThreshold(
                            rule.ruleType
                        );

                    rule.criticalThreshold =
                        defaultCriticalThreshold(
                            rule.ruleType
                        );

                    rule.parameters =
                        buildDefaultParameters(
                            rule.ruleType,
                            findProfileColumn(
                                rule.columnName
                            )
                        );

                    rulesChanged();
                }
            );

        article
            .querySelector(
                ".rule-column-input"
            )
            .addEventListener(
                "change",
                event => {
                    const rule =
                        state.rules[index];

                    rule.columnName =
                        event.target.value;

                    rule.ruleName =
                        buildRuleName(
                            rule.ruleType,
                            rule.columnName
                        );

                    rulesChanged();
                }
            );

        article
            .querySelector(
                ".rule-name-input"
            )
            .addEventListener(
                "input",
                event => {
                    state.rules[index]
                        .ruleName =
                        event.target.value;

                    handleConfigurationChange();
                }
            );

        article
            .querySelector(
                ".warning-threshold-input"
            )
            .addEventListener(
                "input",
                event => {
                    state.rules[index]
                        .warningThreshold =
                        numberValue(
                            event.target.value
                        );

                    handleConfigurationChange();
                }
            );

        article
            .querySelector(
                ".critical-threshold-input"
            )
            .addEventListener(
                "input",
                event => {
                    state.rules[index]
                        .criticalThreshold =
                        numberValue(
                            event.target.value
                        );

                    handleConfigurationChange();
                }
            );

        article
            .querySelector(
                ".remove-rule-button"
            )
            .addEventListener(
                "click",
                () => {
                    state.rules.splice(
                        index,
                        1
                    );

                    rulesChanged();
                }
            );

        article
            .querySelectorAll(
                "[data-parameter]"
            )
            .forEach(input => {
                input.addEventListener(
                    "input",
                    event => {
                        const parameter =
                            event.target.dataset
                                .parameter;

                        state.rules[index]
                            .parameters[
                                parameter
                            ] =
                            event.target.value;

                        handleConfigurationChange();
                    }
                );
            });
    }

    function renderParameterFields(
        rule
    ) {
        if (
            rule.ruleType
            === "VALUE_RANGE"
        ) {
            return `
                <div class="rule-parameters-grid">

                    <div class="form-field">

                        <label>
                            Mínimo
                        </label>

                        <input
                            type="number"
                            step="any"
                            data-parameter="min_value"
                            value="${escapeAttribute(
                                rule.parameters
                                    .min_value
                                ?? ""
                            )}">

                    </div>

                    <div class="form-field">

                        <label>
                            Máximo
                        </label>

                        <input
                            type="number"
                            step="any"
                            data-parameter="max_value"
                            value="${escapeAttribute(
                                rule.parameters
                                    .max_value
                                ?? ""
                            )}">

                    </div>

                </div>
            `;
        }

        if (
            rule.ruleType
            === "ALLOWED_VALUES"
        ) {
            return `
                <div class="form-field">

                    <label>
                        Valores permitidos
                    </label>

                    <input
                        type="text"
                        data-parameter="allowed_values"
                        value="${escapeAttribute(
                            rule.parameters
                                .allowed_values
                            ?? ""
                        )}"
                        placeholder="ACTIVO, INACTIVO">

                </div>
            `;
        }

        if (
            rule.ruleType
            === "ROW_COUNT_MIN"
        ) {
            return `
                <div class="form-field">

                    <label>
                        Registros mínimos
                    </label>

                    <input
                        type="number"
                        min="1"
                        data-parameter="minimum_row_count"
                        value="${escapeAttribute(
                            rule.parameters
                                .minimum_row_count
                            ?? 1
                        )}">

                </div>
            `;
        }

        return `
            <div class="rule-no-parameters">
                Esta regla no requiere parámetros adicionales.
            </div>
        `;
    }

    function renderAdvisor() {
        const selected =
            getSelectedRules();

        const columns =
            getSelectedColumns();

        elements.aiSummary.textContent =
            selected.length === 0
                ? "Selecciona al menos una regla para construir la configuración."
                : (
                    `La configuración contiene ${selected.length} reglas activas `
                    + `y cubre ${columns.length} columnas. `
                    + (
                        state.draftId
                            ? `El borrador ${state.draftId} está guardado.`
                            : "Guarda el borrador para continuar."
                    )
                );
    }

    function renderDesignChecklist() {
        const checklist =
            buildLocalChecklist();

        elements.designChecklist
            .innerHTML =
            checklist.map(item => `
                <div class="design-checklist-item">

                    <span class="${
                        item.valid
                            ? "checklist-success"
                            : "checklist-pending"
                    }">
                        ${item.valid
                            ? "✓"
                            : "○"}
                    </span>

                    <div>

                        <strong>
                            ${escapeHtml(
                                item.label
                            )}
                        </strong>

                        <small>
                            ${escapeHtml(
                                item.detail
                            )}
                        </small>

                    </div>

                </div>
            `).join("");
    }

    function buildLocalChecklist() {
        const selected =
            getSelectedRules();

        return [
            {
                label:
                    "Fuente seleccionada",

                detail:
                    `${state.source?.datasetId}.${state.source?.tableId}`,

                valid:
                    Boolean(
                        state.source?.connectionId
                        && state.source?.datasetId
                        && state.source?.tableId
                    )
            },
            {
                label:
                    "Nombre de configuración",

                detail:
                    elements.configName.value
                        .trim()
                    || "Pendiente",

                valid:
                    Boolean(
                        elements.configName
                            .value
                            .trim()
                    )
            },
            {
                label:
                    "Reglas configuradas",

                detail:
                    `${selected.length} activas`,

                valid:
                    selected.length > 0
            },
            {
                label:
                    "Borrador guardado",

                detail:
                    state.draftId
                    || "Pendiente",

                valid:
                    Boolean(
                        state.draftId
                    )
            },
            {
                label:
                    "Validación del backend",

                detail:
                    state.validationResponse
                        ? resolveValidationStatus(
                            state.validationResponse
                        )
                        : "Pendiente",

                valid:
                    isBackendValidationSuccessful()
            },
            {
                label:
                    "Publicación",

                detail:
                    state.isPublished
                        ? "Configuración publicada"
                        : "Pendiente",

                valid:
                    state.isPublished
            }
        ];
    }

    async function saveDraft() {
        hideMessage();

        const validation =
            validateConfigurationLocally();

        if (!validation.valid) {
            showMessage(
                validation.errors.join(
                    " "
                ),
                "error"
            );
            return;
        }

        state.isSaving = true;
        updateActionState();

        elements.saveDraftButton
            .textContent =
            state.draftId
                ? "Actualizando..."
                : "Guardando...";

        try {
            const payload =
                buildDraftPayload();

            let response;

            if (state.draftId) {
                response =
                    await apiRequest(
                        `/ui/api/quality-rules/draft/${encodeURIComponent(
                            state.draftId
                        )}`,
                        {
                            method: "PUT",
                            headers: {
                                "Content-Type":
                                    "application/json"
                            },
                            body:
                                JSON.stringify({
                                    config_name:
                                        payload.config_name,

                                    description:
                                        payload.description,

                                    selected_columns:
                                        payload.selected_columns,

                                    rules:
                                        payload.rules
                                })
                        }
                    );

            } else {
                response =
                    await apiRequest(
                        "/ui/api/quality-rules/draft",
                        {
                            method: "POST",
                            headers: {
                                "Content-Type":
                                    "application/json"
                            },
                            body:
                                JSON.stringify(
                                    payload
                                )
                        }
                    );
            }

            const draftId =
                extractDraftId(
                    response
                );

            if (!draftId) {
                throw new Error(
                    "El backend no devolvió draft_id."
                );
            }

            state.draftId = draftId;
            state.draftResponse = response;
            state.validationResponse = null;
            state.isPublished = false;

            persistDraftState();

            showMessage(
                `Reglas guardadas en el borrador ${draftId}. Puedes validarlas y publicarlas.`,
                "success"
            );

        } catch (error) {
            showMessage(
                "No se pudieron guardar las reglas: "
                + error.message,
                "error"
            );

        } finally {
            state.isSaving = false;

            elements.saveDraftButton
                .textContent =
                "Guardar borrador";

            renderAdvisor();
            renderDesignChecklist();
            updateActionState();
        }
    }

    async function validateDraft() {
        hideMessage();

        if (!state.draftId) {
            showMessage(
                "Primero debes guardar el borrador.",
                "warning"
            );
            return;
        }

        state.isValidating = true;

        elements.validateButton
            .textContent =
            "Validando...";

        updateActionState();

        try {
            const response =
                await apiRequest(
                    `/ui/api/quality-rules/draft/${encodeURIComponent(
                        state.draftId
                    )}/validate`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body: "{}"
                    }
                );

            state.validationResponse =
                response;

            state.isPublished = false;

            persistDraftState();

            renderBackendValidation(
                response
            );

            elements.validationResult
                .hidden = false;

            showMessage(
                isBackendValidationSuccessful()
                    ? "El borrador está validado y listo para publicarse."
                    : "El borrador presenta observaciones.",
                isBackendValidationSuccessful()
                    ? "success"
                    : "warning"
            );

        } catch (error) {
            showMessage(
                "No se pudo validar el borrador: "
                + error.message,
                "error"
            );

        } finally {
            state.isValidating = false;

            elements.validateButton
                .textContent =
                "Validar configuración";

            renderDesignChecklist();
            updateActionState();
        }
    }

    async function confirmOrExecute() {
        if (state.isPublished) {
            window.location.assign(
                "/quality-execution"
            );
            return;
        }

        await publishDraft();
    }

    async function publishDraft() {
        hideMessage();

        if (
            !state.draftId
            || !isBackendValidationSuccessful()
        ) {
            showMessage(
                "El borrador debe estar guardado y validado antes de publicarse.",
                "warning"
            );
            return;
        }

        state.isConfirming = true;

        elements.confirmButton
            .textContent =
            "Publicando...";

        updateActionState();

        try {
            const response =
                await apiRequest(
                    `/ui/api/quality-rules/draft/${encodeURIComponent(
                        state.draftId
                    )}/confirm`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body:
                            JSON.stringify({
                                confirmed_by:
                                    elements.createdBy
                                        .value
                                        .trim()
                            })
                    }
                );

            state.isPublished = true;
            state.publishedResponse = response;

            sessionStorage.setItem(
                PUBLISHED_STORAGE_KEY,
                JSON.stringify(
                    response
                )
            );

            persistDraftState();

            elements.validationStatus
                .textContent =
                "PUBLISHED";

            elements.validationStatus
                .className =
                "neutral-chip validation-status-valid";

            showMessage(
                "Las reglas fueron publicadas correctamente y ya están disponibles para ejecución.",
                "success"
            );

        } catch (error) {
            showMessage(
                "No se pudieron publicar las reglas: "
                + error.message,
                "error"
            );

        } finally {
            state.isConfirming = false;

            renderDesignChecklist();
            updateActionState();
        }
    }

    function updateActionState() {
        const validation =
            validateConfigurationLocally();

        elements.saveDraftButton.disabled =
            state.isSaving
            || state.isPublished
            || !validation.valid;

        elements.validateButton.disabled =
            state.isValidating
            || state.isPublished
            || !state.draftId;

        if (state.isPublished) {
            elements.confirmButton.disabled =
                false;

            elements.confirmButton
                .textContent =
                "Ir a ejecutar reglas";

            return;
        }

        elements.confirmButton.disabled =
            state.isConfirming
            || !isBackendValidationSuccessful();

        elements.confirmButton
            .textContent =
            "Confirmar y publicar";
    }

    function restoreValidationView() {
        if (state.isPublished) {
            elements.validationResult.hidden =
                false;

            elements.validationStatus
                .textContent =
                "PUBLISHED";

            elements.validationStatus
                .className =
                "neutral-chip validation-status-valid";

            elements.validationChecklist
                .innerHTML = `
                    <article class="validation-checklist-item">

                        <span class="validation-icon-success">
                            ✓
                        </span>

                        <div>

                            <strong>
                                Configuración publicada
                            </strong>

                            <p>
                                Las reglas están disponibles para ejecutarse sin repetir el profiling.
                            </p>

                        </div>

                    </article>
                `;

            return;
        }

        if (state.validationResponse) {
            renderBackendValidation(
                state.validationResponse
            );

            elements.validationResult.hidden =
                false;
        }
    }

    function renderBackendValidation(
        response
    ) {
        const status =
            resolveValidationStatus(
                response
            );

        elements.validationStatus
            .textContent = status;

        elements.validationStatus
            .className =
            "neutral-chip validation-status-"
            + status.toLowerCase();

        const message =
            response.validation_message
            || response.message
            || (
                status === "VALID"
                    ? "Configuración validada correctamente."
                    : "La configuración presenta observaciones."
            );

        elements.validationChecklist
            .innerHTML = `
                <article class="validation-checklist-item">

                    <span class="${
                        status === "VALID"
                            ? "validation-icon-success"
                            : "validation-icon-error"
                    }">
                        ${
                            status === "VALID"
                                ? "✓"
                                : "×"
                        }
                    </span>

                    <div>

                        <strong>
                            Validación del backend
                        </strong>

                        <p>
                            ${escapeHtml(
                                message
                            )}
                        </p>

                    </div>

                </article>
            `;
    }

    function validateConfigurationLocally() {
        const errors = [];
        const selected =
            getSelectedRules();

        if (
            !elements.configName
                .value
                .trim()
        ) {
            errors.push(
                "El nombre es obligatorio."
            );
        }

        if (
            !isValidEmail(
                elements.createdBy
                    .value
                    .trim()
            )
        ) {
            errors.push(
                "El responsable debe ser un correo válido."
            );
        }

        if (
            selected.length === 0
        ) {
            errors.push(
                "Selecciona al menos una regla."
            );
        }

        selected.forEach(rule => {
            if (
                rule.ruleType
                !== "ROW_COUNT_MIN"
                && !rule.columnName
            ) {
                errors.push(
                    `La regla ${rule.ruleName} requiere columna.`
                );
            }

            if (
                numberValue(
                    rule.criticalThreshold
                )
                < numberValue(
                    rule.warningThreshold
                )
            ) {
                errors.push(
                    `Revisa los umbrales de ${rule.ruleName}.`
                );
            }
        });

        return {
            valid:
                errors.length === 0,
            errors
        };
    }

    function buildDraftPayload() {
        return {
            config_name:
                elements.configName
                    .value
                    .trim(),

            description:
                elements.configDescription
                    .value
                    .trim(),

            connection_id:
                state.source.connectionId,

            dataset_id:
                state.source.datasetId,

            table_id:
                state.source.tableId,

            selected_columns:
                getSelectedColumns(),

            rules:
                getSelectedRules()
                    .map(
                        serializeRule
                    ),

            created_by:
                elements.createdBy
                    .value
                    .trim()
        };
    }

    function serializeRule(rule) {
        return {
            rule_name:
                rule.ruleName,

            rule_dimension:
                rule.dimension,

            rule_type:
                rule.ruleType,

            column_name:
                rule.ruleType
                === "ROW_COUNT_MIN"
                    ? null
                    : rule.columnName,

            parameters:
                normalizeParametersForBackend(
                    rule
                ),

            warning_threshold:
                numberValue(
                    rule.warningThreshold
                ),

            critical_threshold:
                numberValue(
                    rule.criticalThreshold
                ),

            active_flag: true
        };
    }

    function normalizeParametersForBackend(
        rule
    ) {
        if (
            rule.ruleType
            === "ALLOWED_VALUES"
        ) {
            return {
                allowed_values:
                    String(
                        rule.parameters
                            .allowed_values
                        || ""
                    )
                        .split(",")
                        .map(
                            item =>
                                item.trim()
                        )
                        .filter(Boolean)
            };
        }

        if (
            rule.ruleType
            === "VALUE_RANGE"
        ) {
            return {
                min_value:
                    optionalNumber(
                        rule.parameters
                            .min_value
                    ),

                max_value:
                    optionalNumber(
                        rule.parameters
                            .max_value
                    )
            };
        }

        if (
            rule.ruleType
            === "ROW_COUNT_MIN"
        ) {
            return {
                minimum_row_count:
                    numberValue(
                        rule.parameters
                            .minimum_row_count
                    )
            };
        }

        return {};
    }

    function persistDraftState() {
        sessionStorage.setItem(
            DRAFT_STORAGE_KEY,
            JSON.stringify({
                draftId:
                    state.draftId,

                source:
                    state.source,

                profilingColumns:
                    state.profilingColumns,

                rules:
                    state.rules,

                draftResponse:
                    state.draftResponse,

                validationResponse:
                    state.validationResponse,

                publishedResponse:
                    state.publishedResponse,

                isPublished:
                    state.isPublished,

                form: {
                    configName:
                        elements.configName
                            .value,

                    configDescription:
                        elements.configDescription
                            .value,

                    createdBy:
                        elements.createdBy
                            .value
                }
            })
        );
    }

    function extractDraftId(response) {
        return (
            response.draft_id
            || response.draft?.draft_id
            || response.configuration
                ?.draft_id
            || response.data?.draft_id
            || state.draftId
            || null
        );
    }

    function resolveValidationStatus(
        response
    ) {
        const status =
            String(
                response?.validation_status
                || response?.status
                || response?.draft_status
                || ""
            ).toUpperCase();

        if (
            response?.valid === true
            || [
                "VALID",
                "VALIDATED",
                "SUCCESS",
                "CONFORME",
                "READY_FOR_CONFIRMATION"
            ].includes(status)
        ) {
            return "VALID";
        }

        return "OBSERVED";
    }

    function isBackendValidationSuccessful() {
        return Boolean(
            state.validationResponse
            && resolveValidationStatus(
                state.validationResponse
            ) === "VALID"
        );
    }

    function getSelectedRules() {
        return state.rules.filter(
            rule => rule.selected
        );
    }

    function getSelectedColumns() {
        return unique(
            getSelectedRules()
                .map(
                    rule =>
                        rule.columnName
                )
                .filter(Boolean)
        );
    }

    function updateSelectedRuleCount() {
        const count =
            getSelectedRules().length;

        elements.selectedRuleCount
            .textContent =
            `${count} ${
                count === 1
                    ? "regla"
                    : "reglas"
            }`;
    }

    function buildRuleTypeOptions(
        selected
    ) {
        return state.ruleTypes.map(
            rule => `
                <option
                    value="${escapeAttribute(
                        rule.rule_type
                    )}"
                    ${
                        rule.rule_type
                        === selected
                            ? "selected"
                            : ""
                    }>

                    ${escapeHtml(
                        rule.display_name
                    )}

                </option>
            `
        ).join("");
    }

    function buildColumnOptions(
        selected,
        ruleType
    ) {
        if (
            ruleType === "ROW_COUNT_MIN"
        ) {
            return `
                <option value="">
                    Regla a nivel de tabla
                </option>
            `;
        }

        return state.profilingColumns
            .map(column => `
                <option
                    value="${escapeAttribute(
                        column.name
                    )}"
                    ${
                        column.name
                        === selected
                            ? "selected"
                            : ""
                    }>

                    ${escapeHtml(
                        column.name
                    )}

                </option>
            `)
            .join("");
    }

    function normalizeRuleTypes(items) {
        return items.map(item => {
            if (
                typeof item === "string"
            ) {
                return {
                    rule_type:
                        item.toUpperCase(),

                    display_name:
                        humanize(item),

                    dimension:
                        resolveDimension(item)
                };
            }

            const code =
                item.rule_type
                || item.code
                || item.name
                || "";

            return {
                rule_type:
                    String(code)
                        .toUpperCase(),

                display_name:
                    item.display_name
                    || item.label
                    || humanize(code),

                dimension:
                    item.dimension
                    || resolveDimension(code)
            };
        }).filter(
            item => item.rule_type
        );
    }

    function buildRuleName(
        ruleType,
        column
    ) {
        const readableColumn =
            column
                ? humanize(column)
                : "Tabla";

        const labels = {
            NOT_NULL:
                `${readableColumn} obligatorio`,

            UNIQUE:
                `${readableColumn} único`,

            VALUE_RANGE:
                `Rango válido de ${readableColumn}`,

            ALLOWED_VALUES:
                `Valores permitidos de ${readableColumn}`,

            ROW_COUNT_MIN:
                "Volumen mínimo de registros"
        };

        return labels[ruleType]
            || `${humanize(ruleType)} ${readableColumn}`;
    }

    function resolveDimension(
        ruleType
    ) {
        const dimensions = {
            NOT_NULL:
                "COMPLETENESS",

            UNIQUE:
                "UNIQUENESS",

            VALUE_RANGE:
                "VALIDITY",

            ALLOWED_VALUES:
                "VALIDITY",

            ROW_COUNT_MIN:
                "COMPLETENESS"
        };

        return dimensions[
            String(ruleType)
                .toUpperCase()
        ] || "VALIDITY";
    }

    function defaultWarningThreshold(
        ruleType
    ) {
        return {
            NOT_NULL: 0.1,
            UNIQUE: 0.1,
            VALUE_RANGE: 0.5,
            ALLOWED_VALUES: 0.5,
            ROW_COUNT_MIN: 0
        }[ruleType] ?? 0.5;
    }

    function defaultCriticalThreshold(
        ruleType
    ) {
        return {
            NOT_NULL: 1,
            UNIQUE: 1,
            VALUE_RANGE: 2,
            ALLOWED_VALUES: 2,
            ROW_COUNT_MIN: 0
        }[ruleType] ?? 2;
    }

    function buildDefaultParameters(
        ruleType,
        column
    ) {
        if (
            ruleType === "VALUE_RANGE"
        ) {
            return {
                min_value:
                    column?.minValue
                    ?? "",

                max_value:
                    column?.maxValue
                    ?? ""
            };
        }

        if (
            ruleType === "ALLOWED_VALUES"
        ) {
            return {
                allowed_values: ""
            };
        }

        if (
            ruleType === "ROW_COUNT_MIN"
        ) {
            return {
                minimum_row_count:
                    Math.max(
                        1,
                        Math.floor(
                            numberValue(
                                state.profilingColumns[0]
                                    ?.rowCount
                            ) * 0.9
                        )
                    )
            };
        }

        return {};
    }

    function removeDuplicateRules(rules) {
        const seen = new Set();

        return rules.filter(rule => {
            const key =
                `${rule.ruleType}:${rule.columnName}`;

            if (seen.has(key)) {
                return false;
            }

            seen.add(key);
            return true;
        });
    }

    function findProfileColumn(name) {
        return state.profilingColumns
            .find(
                column =>
                    column.name === name
            );
    }

    async function apiRequest(
        url,
        options = {}
    ) {
        const response =
            await fetch(
                url,
                {
                    ...options,
                    headers: {
                        Accept:
                            "application/json",

                        ...(options.headers || {})
                    }
                }
            );

        const contentType =
            response.headers.get(
                "content-type"
            ) || "";

        const payload =
            contentType.includes(
                "application/json"
            )
                ? await response.json()
                : {
                    message:
                        await response.text()
                };

        if (!response.ok) {
            throw new Error(
                typeof payload.detail
                    === "string"
                    ? payload.detail
                    : payload.message
                    || `Error HTTP ${response.status}`
            );
        }

        return payload;
    }

    function extractArray(
        payload,
        keys
    ) {
        if (Array.isArray(payload)) {
            return payload;
        }

        for (const key of keys) {
            if (
                Array.isArray(
                    payload?.[key]
                )
            ) {
                return payload[key];
            }
        }

        return [];
    }

    function readStorage(key) {
        const raw =
            sessionStorage.getItem(key);

        if (!raw) {
            return null;
        }

        try {
            return JSON.parse(raw);

        } catch {
            return null;
        }
    }

    function createLocalId() {
        return window.crypto?.randomUUID
            ? window.crypto.randomUUID()
            : (
                "RULE_"
                + Date.now()
                + "_"
                + Math.random()
                    .toString(16)
                    .slice(2)
            );
    }

    function unique(values) {
        return [...new Set(values)];
    }

    function humanize(value) {
        return String(value || "")
            .replaceAll("_", " ")
            .replace(
                /\b\w/g,
                character =>
                    character.toUpperCase()
            );
    }

    function isValidEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(value);
    }

    function numberValue(value) {
        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : 0;
    }

    function optionalNumber(value) {
        if (
            value === ""
            || value === null
            || value === undefined
        ) {
            return null;
        }

        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : null;
    }

    function showMessage(
        text,
        type = "info"
    ) {
        elements.message.hidden =
            false;

        elements.message.textContent =
            text;

        elements.message.className =
            `message message-${type}`;
    }

    function hideMessage() {
        elements.message.hidden =
            true;

        elements.message.textContent =
            "";

        elements.message.className =
            "message";
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function escapeAttribute(value) {
        return escapeHtml(value);
    }

    initialize().catch(error => {
        console.error(
            "Quality Rules initialization failed.",
            error
        );

        showMessage(
            "No se pudo inicializar Quality Rules: "
                + error.message,
            "error"
        );
    });
})();
