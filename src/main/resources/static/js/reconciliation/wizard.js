(() => {
    "use strict";

    const STORAGE_KEY = "dataOpsReconciliationDraftV2";

    const state = {
        currentStep: 1,
        connections: [],
        sourceColumns: [],
        targetColumns: [],
        commonColumns: [],
        recommendedCountColumns: [],
        recommendedSumColumns: [],
        draftId: null,
        validationResponse: null,
        publishedResponse: null,
        isSaving: false,
        isValidating: false,
        isPublishing: false
    };

    const elements = {
        processName: byId("process-name"),
        domainName: byId("domain-name"),
        description: byId("reconciliation-description"),

        sourceConnection: byId("source-connection"),
        sourceDataset: byId("source-dataset"),
        sourceTable: byId("source-table"),
        sourceFilter: byId("source-filter"),

        targetConnection: byId("target-connection"),
        targetDataset: byId("target-dataset"),
        targetTable: byId("target-table"),
        targetFilter: byId("target-filter"),

        sourceSummary: byId("source-selection-summary"),
        summarySource: byId("summary-source-path"),
        summaryTarget: byId("summary-target-path"),

        metadataLoading: byId("metadata-analysis-loading"),
        commonColumnCount: byId("common-column-count"),
        mappingRecommendation: byId("mapping-recommendation"),
        businessKey: byId("business-key-select"),
        dateColumn: byId("date-column-select"),
        commonColumnsGrid: byId("common-columns-grid"),

        countColumnsGrid: byId("count-columns-grid"),
        countMetricCount: byId("count-metric-count"),
        sumColumnsGrid: byId("sum-columns-grid"),
        sumMetricCount: byId("sum-metric-count"),

        rowTolerance: byId("row-tolerance"),
        countTolerance: byId("count-tolerance"),
        amountTolerance: byId("amount-tolerance"),
        selectedMetricsSummary: byId("selected-metrics-summary"),

        requestedBy: byId("wizard-requested-by"),
        review: byId("wizard-review-content"),

        publicationStatus: byId("wizard-publication-status"),
        validationSection: byId("wizard-validation-section"),
        validationStatus: byId("wizard-validation-status"),
        validationContent: byId("wizard-validation-content"),

        message: byId("wizard-message"),
        backButton: byId("wizard-back-button"),
        nextButton: byId("wizard-next-button"),
        saveButton: byId("wizard-save-button"),
        validateButton: byId("wizard-validate-button"),
        publishButton: byId("wizard-publish-button"),

        advisorTitle: byId("wizard-advisor-title"),
        advisorMessage: byId("wizard-advisor-message"),
        checklist: byId("wizard-checklist")
    };

    async function initialize() {
        validateElements();
        bindEvents();
        restoreLocalValues();
        await loadConnections();
        renderCurrentStep();
    }

    function byId(id) {
        return document.getElementById(id);
    }

    function validateElements() {
        const missing = Object.entries(elements)
            .filter(([, element]) => !element)
            .map(([name]) => name);

        if (missing.length > 0) {
            throw new Error("Faltan elementos requeridos: " + missing.join(", "));
        }
    }

    function bindEvents() {
        elements.sourceConnection.addEventListener(
            "change",
            () => handleConnectionChange("source")
        );

        elements.targetConnection.addEventListener(
            "change",
            () => handleConnectionChange("target")
        );

        elements.sourceDataset.addEventListener(
            "change",
            () => handleDatasetChange("source")
        );

        elements.targetDataset.addEventListener(
            "change",
            () => handleDatasetChange("target")
        );

        elements.sourceTable.addEventListener("change", handleSourceChange);
        elements.targetTable.addEventListener("change", handleSourceChange);

        elements.backButton.addEventListener("click", previousStep);
        elements.nextButton.addEventListener("click", nextStep);
        elements.saveButton.addEventListener("click", saveDraft);
        elements.validateButton.addEventListener("click", validateDraft);
        elements.publishButton.addEventListener("click", publishDraft);

        document.querySelectorAll("[data-step-target]").forEach(button => {
            button.addEventListener("click", () => {
                const target = Number(button.dataset.stepTarget);

                if (!button.disabled && target <= state.currentStep) {
                    state.currentStep = target;
                    renderCurrentStep();
                }
            });
        });

        [
            elements.processName,
            elements.domainName,
            elements.description,
            elements.sourceFilter,
            elements.targetFilter,
            elements.businessKey,
            elements.dateColumn,
            elements.rowTolerance,
            elements.countTolerance,
            elements.amountTolerance,
            elements.requestedBy
        ].forEach(element => {
            element.addEventListener("input", handleConfigurationChange);
            element.addEventListener("change", handleConfigurationChange);
        });
    }

    async function loadConnections() {
        setSelectLoading(elements.sourceConnection, "Cargando conexiones...");
        setSelectLoading(elements.targetConnection, "Cargando conexiones...");

        try {
            const payload = await apiRequest(
                "/ui/api/reconciliation/connections"
            );

            state.connections = extractArray(
                payload,
                ["connections", "items", "data"]
            );

            populateSelect(
                elements.sourceConnection,
                state.connections,
                "Selecciona una conexión",
                connectionValue,
                connectionLabel
            );

            populateSelect(
                elements.targetConnection,
                state.connections,
                "Selecciona una conexión",
                connectionValue,
                connectionLabel
            );

            elements.sourceConnection.disabled = state.connections.length === 0;
            elements.targetConnection.disabled = state.connections.length === 0;

        } catch (error) {
            showMessage(
                "No se pudieron cargar las conexiones: " + error.message,
                "error"
            );
        }
    }

    async function handleConnectionChange(side) {
        invalidateValidation();

        const connectionSelect =
            side === "source"
                ? elements.sourceConnection
                : elements.targetConnection;

        const datasetSelect =
            side === "source"
                ? elements.sourceDataset
                : elements.targetDataset;

        const tableSelect =
            side === "source"
                ? elements.sourceTable
                : elements.targetTable;

        resetSelect(tableSelect, "Selecciona un dataset");
        tableSelect.disabled = true;

        if (!connectionSelect.value) {
            resetSelect(datasetSelect, "Selecciona una conexión");
            datasetSelect.disabled = true;
            updateSourceSummary();
            return;
        }

        setSelectLoading(datasetSelect, "Cargando datasets...");

        try {
            const payload = await apiRequest(
                `/ui/api/reconciliation/metadata/${encodeURIComponent(
                    connectionSelect.value
                )}/datasets`
            );

            const datasets = extractArray(
                payload,
                ["datasets", "items", "data"]
            );

            populateSelect(
                datasetSelect,
                datasets,
                "Selecciona un dataset",
                datasetValue,
                datasetLabel
            );

            datasetSelect.disabled = datasets.length === 0;

        } catch (error) {
            resetSelect(datasetSelect, "No fue posible cargar datasets");
            datasetSelect.disabled = true;
            throw error;
        }

        updateSourceSummary();
        persistLocalState();
    }

    async function handleDatasetChange(side) {
        invalidateValidation();

        const connectionSelect =
            side === "source"
                ? elements.sourceConnection
                : elements.targetConnection;

        const datasetSelect =
            side === "source"
                ? elements.sourceDataset
                : elements.targetDataset;

        const tableSelect =
            side === "source"
                ? elements.sourceTable
                : elements.targetTable;

        if (!connectionSelect.value || !datasetSelect.value) {
            resetSelect(tableSelect, "Selecciona un dataset");
            tableSelect.disabled = true;
            updateSourceSummary();
            return;
        }

        setSelectLoading(tableSelect, "Cargando tablas...");

        try {
            const payload = await apiRequest(
                `/ui/api/reconciliation/metadata/${encodeURIComponent(
                    connectionSelect.value
                )}/${encodeURIComponent(
                    datasetSelect.value
                )}/tables`
            );

            const tables = extractArray(
                payload,
                ["tables", "items", "data"]
            );

            populateSelect(
                tableSelect,
                tables,
                "Selecciona una tabla",
                tableValue,
                tableLabel
            );

            tableSelect.disabled = tables.length === 0;

        } catch (error) {
            resetSelect(tableSelect, "No fue posible cargar tablas");
            tableSelect.disabled = true;
            throw error;
        }

        updateSourceSummary();
        persistLocalState();
    }

    function handleSourceChange() {
        invalidateValidation();
        updateSourceSummary();
        renderChecklist();
        persistLocalState();
    }

    function updateSourceSummary() {
        const complete = isSourceSelectionComplete();

        elements.sourceSummary.hidden = !complete;

        if (!complete) {
            return;
        }

        elements.summarySource.textContent =
            `${elements.sourceDataset.value}.${elements.sourceTable.value}`;

        elements.summaryTarget.textContent =
            `${elements.targetDataset.value}.${elements.targetTable.value}`;
    }

    async function analyzeMetadata() {
        elements.metadataLoading.hidden = false;

        try {
            const [sourcePayload, targetPayload] = await Promise.all([
                apiRequest(
                    `/ui/api/reconciliation/metadata/${encodeURIComponent(
                        elements.sourceConnection.value
                    )}/${encodeURIComponent(
                        elements.sourceDataset.value
                    )}/${encodeURIComponent(
                        elements.sourceTable.value
                    )}/columns`
                ),
                apiRequest(
                    `/ui/api/reconciliation/metadata/${encodeURIComponent(
                        elements.targetConnection.value
                    )}/${encodeURIComponent(
                        elements.targetDataset.value
                    )}/${encodeURIComponent(
                        elements.targetTable.value
                    )}/columns`
                )
            ]);

            state.sourceColumns = normalizeColumns(
                extractArray(sourcePayload, ["columns", "items", "data"])
            );

            state.targetColumns = normalizeColumns(
                extractArray(targetPayload, ["columns", "items", "data"])
            );

            state.commonColumns = findCommonColumns(
                state.sourceColumns,
                state.targetColumns
            );

            state.recommendedCountColumns = recommendCountColumns(
                state.commonColumns
            );

            state.recommendedSumColumns = recommendSumColumns(
                state.commonColumns
            );

            renderMetadataProposal();

        } finally {
            elements.metadataLoading.hidden = true;
        }
    }

    function normalizeColumns(columns) {
        return columns.map(column => {
            if (typeof column === "string") {
                return {
                    name: column,
                    type: "UNKNOWN"
                };
            }

            return {
                name:
                    column.column_name
                    || column.field_name
                    || column.name
                    || "",

                type: String(
                    column.data_type
                    || column.type
                    || "UNKNOWN"
                ).toUpperCase()
            };
        }).filter(column => column.name);
    }

    function findCommonColumns(sourceColumns, targetColumns) {
        const targetMap = new Map(
            targetColumns.map(column => [
                column.name.toLowerCase(),
                column
            ])
        );

        return sourceColumns
            .filter(column => targetMap.has(column.name.toLowerCase()))
            .map(column => {
                const targetColumn = targetMap.get(
                    column.name.toLowerCase()
                );

                return {
                    name: column.name,
                    sourceType: column.type,
                    targetType: targetColumn.type,
                    compatible: areTypesCompatible(
                        column.type,
                        targetColumn.type
                    )
                };
            });
    }

    function recommendCountColumns(columns) {
        return columns
            .filter(column =>
                column.compatible
                && (
                    isStringType(column.sourceType)
                    || /(^|_)id$/i.test(column.name)
                    || /code|codigo|status|type|category|channel|segment/i
                        .test(column.name)
                )
            )
            .slice(0, 8)
            .map(column => column.name);
    }

    function recommendSumColumns(columns) {
        return columns
            .filter(column =>
                column.compatible
                && isNumericType(column.sourceType)
                && !/(^|_)id$/i.test(column.name)
                && !/code|codigo|year|month|day/i.test(column.name)
            )
            .slice(0, 10)
            .map(column => column.name);
    }

    function renderMetadataProposal() {
        elements.commonColumnCount.textContent =
            `${state.commonColumns.length} columnas comunes`;

        renderCommonColumns();
        renderBusinessKeyOptions();
        renderDateOptions();
        renderCountColumns();
        renderSumColumns();

        const keyCandidate = suggestBusinessKey();
        const dateCandidate = suggestDateColumn();

        if (keyCandidate) {
            selectMultipleValues(elements.businessKey, [keyCandidate]);
        }

        if (dateCandidate) {
            elements.dateColumn.value = dateCandidate;
        }

        elements.mappingRecommendation.textContent =
            state.commonColumns.length === 0
                ? "No se encontraron columnas comunes. Revisa las tablas seleccionadas."
                : (
                    `Se identificaron ${state.commonColumns.length} columnas comunes, `
                    + `${state.recommendedCountColumns.length} candidatas para conteo y `
                    + `${state.recommendedSumColumns.length} candidatas para sumarización. `
                    + "Puedes modificar libremente la selección."
                );

        updateMetricCounters();
    }

    function renderCommonColumns() {
        elements.commonColumnsGrid.innerHTML = state.commonColumns
            .map(column => `
                <article class="common-column-card">
                    <strong>${escapeHtml(column.name)}</strong>
                    <span>
                        ${escapeHtml(column.sourceType)}
                        →
                        ${escapeHtml(column.targetType)}
                    </span>
                    <small class="${
                        column.compatible
                            ? "column-compatible"
                            : "column-incompatible"
                    }">
                        ${
                            column.compatible
                                ? "Compatible"
                                : "Revisar tipos"
                        }
                    </small>
                </article>
            `)
            .join("");
    }

    function renderBusinessKeyOptions() {
        elements.businessKey.innerHTML = state.commonColumns
            .filter(column => column.compatible)
            .map(column => `
                <option value="${escapeAttribute(column.name)}">
                    ${escapeHtml(column.name)}
                </option>
            `)
            .join("");
    }

    function renderDateOptions() {
        elements.dateColumn.innerHTML =
            '<option value="">Sin columna de fecha</option>';

        state.commonColumns
            .filter(column =>
                isDateType(column.sourceType)
                && isDateType(column.targetType)
            )
            .forEach(column => {
                const option = document.createElement("option");
                option.value = column.name;
                option.textContent = column.name;
                elements.dateColumn.appendChild(option);
            });
    }

    function renderCountColumns() {
        const candidates = state.commonColumns
            .filter(column =>
                column.compatible
                && (
                    isStringType(column.sourceType)
                    || /(^|_)id$/i.test(column.name)
                    || /code|codigo|status|type|category|channel|segment/i
                        .test(column.name)
                )
            );

        elements.countColumnsGrid.innerHTML = candidates
            .map(column => metricCardHtml(
                "count-column",
                column,
                state.recommendedCountColumns.includes(column.name),
                "COUNT"
            ))
            .join("");

        bindMetricCheckboxes();
    }

    function renderSumColumns() {
        const candidates = state.commonColumns
            .filter(column =>
                column.compatible
                && isNumericType(column.sourceType)
            );

        elements.sumColumnsGrid.innerHTML = candidates
            .map(column => metricCardHtml(
                "sum-column",
                column,
                state.recommendedSumColumns.includes(column.name),
                "SUM"
            ))
            .join("");

        bindMetricCheckboxes();
    }

    function metricCardHtml(name, column, checked, operation) {
        return `
            <label class="metric-choice-card">
                <input
                    type="checkbox"
                    name="${escapeAttribute(name)}"
                    value="${escapeAttribute(column.name)}"
                    ${checked ? "checked" : ""}>

                <div class="metric-choice-main">
                    <div>
                        <strong>${escapeHtml(column.name)}</strong>
                        <span>${escapeHtml(column.sourceType)}</span>
                    </div>

                    <span class="metric-operation-chip">
                        ${escapeHtml(operation)}
                    </span>
                </div>

                <small>
                    ${
                        checked
                            ? "Recomendada por Gemini"
                            : "Disponible para selección"
                    }
                </small>
            </label>
        `;
    }

    function bindMetricCheckboxes() {
        document
            .querySelectorAll(
                'input[name="count-column"], input[name="sum-column"]'
            )
            .forEach(input => {
                input.addEventListener("change", () => {
                    invalidateValidation();
                    updateMetricCounters();
                    renderSelectedMetricsSummary();
                    renderChecklist();
                    persistLocalState();
                });
            });
    }

    function updateMetricCounters() {
        elements.countMetricCount.textContent =
            `${getSelectedCountColumns().length} seleccionadas`;

        elements.sumMetricCount.textContent =
            `${getSelectedSumColumns().length} seleccionadas`;
    }

    function renderSelectedMetricsSummary() {
        const counts = getSelectedCountColumns();
        const sums = getSelectedSumColumns();

        elements.selectedMetricsSummary.innerHTML = `
            <div>
                <span>Conteo total</span>
                <strong>Siempre incluido</strong>
            </div>

            <div>
                <span>Conteos por columna</span>
                <strong>
                    ${escapeHtml(
                        counts.length > 0
                            ? counts.join(", ")
                            : "Ninguno"
                    )}
                </strong>
            </div>

            <div>
                <span>Sumarizaciones</span>
                <strong>
                    ${escapeHtml(
                        sums.length > 0
                            ? sums.join(", ")
                            : "Ninguna"
                    )}
                </strong>
            </div>

            <div>
                <span>Umbrales</span>
                <strong>
                    Filas: ${escapeHtml(elements.rowTolerance.value)}
                    · Conteos: ${escapeHtml(elements.countTolerance.value)}
                    · Sumas: ${escapeHtml(elements.amountTolerance.value)}
                </strong>
            </div>
        `;
    }

    function suggestBusinessKey() {
        const preferredPatterns = [
            /(^|_)id$/i,
            /_key$/i,
            /codigo$/i,
            /code$/i
        ];

        for (const pattern of preferredPatterns) {
            const candidate = state.commonColumns.find(
                column =>
                    column.compatible
                    && pattern.test(column.name)
            );

            if (candidate) {
                return candidate.name;
            }
        }

        return null;
    }

    function suggestDateColumn() {
        const preferredPatterns = [
            /full_date/i,
            /business_date/i,
            /fecha/i,
            /date/i,
            /timestamp/i
        ];

        const dateColumns = state.commonColumns.filter(
            column =>
                isDateType(column.sourceType)
                && isDateType(column.targetType)
        );

        for (const pattern of preferredPatterns) {
            const candidate = dateColumns.find(
                column => pattern.test(column.name)
            );

            if (candidate) {
                return candidate.name;
            }
        }

        return dateColumns[0]?.name || "";
    }

    async function nextStep() {
        hideMessage();

        const validation = validateStep(state.currentStep);

        if (!validation.valid) {
            showMessage(validation.message, "warning");
            return;
        }

        if (state.currentStep === 1) {
            elements.nextButton.disabled = true;
            elements.nextButton.textContent = "Analizando tablas...";

            try {
                await analyzeMetadata();
            } catch (error) {
                showMessage(
                    "No se pudo analizar la metadata: " + error.message,
                    "error"
                );
                return;
            } finally {
                elements.nextButton.disabled = false;
            }
        }

        if (state.currentStep === 2) {
            renderSelectedMetricsSummary();
        }

        if (state.currentStep === 3) {
            renderReview();
        }

        if (state.currentStep < 4) {
            state.currentStep += 1;
            renderCurrentStep();
        }
    }

    function previousStep() {
        hideMessage();

        if (state.currentStep > 1) {
            state.currentStep -= 1;
            renderCurrentStep();
        }
    }

    function validateStep(step) {
        if (step === 1) {
            if (!elements.processName.value.trim()) {
                return {
                    valid: false,
                    message: "El nombre del proceso es obligatorio."
                };
            }

            if (!elements.domainName.value.trim()) {
                return {
                    valid: false,
                    message: "El dominio es obligatorio."
                };
            }

            if (!isSourceSelectionComplete()) {
                return {
                    valid: false,
                    message:
                        "Selecciona conexión, dataset y tabla para origen y destino."
                };
            }
        }

        if (step === 2) {
            if (getSelectedBusinessKeys().length === 0) {
                return {
                    valid: false,
                    message: "Selecciona al menos una clave de negocio."
                };
            }

            if (
                getSelectedCountColumns().length === 0
                && getSelectedSumColumns().length === 0
            ) {
                return {
                    valid: false,
                    message:
                        "Selecciona al menos una métrica de conteo o sumarización."
                };
            }
        }

        if (step === 3) {
            if (Number(elements.rowTolerance.value) < 0) {
                return {
                    valid: false,
                    message:
                        "El umbral de filas no puede ser negativo."
                };
            }

            if (Number(elements.countTolerance.value) < 0) {
                return {
                    valid: false,
                    message:
                        "El umbral de conteo no puede ser negativo."
                };
            }

            if (Number(elements.amountTolerance.value) < 0) {
                return {
                    valid: false,
                    message:
                        "El umbral de sumarización no puede ser negativo."
                };
            }
        }

        return {
            valid: true,
            message: ""
        };
    }

    function isSourceSelectionComplete() {
        return Boolean(
            elements.sourceConnection.value
            && elements.sourceDataset.value
            && elements.sourceTable.value
            && elements.targetConnection.value
            && elements.targetDataset.value
            && elements.targetTable.value
        );
    }

    function renderReview() {
        const keys = getSelectedBusinessKeys();
        const counts = getSelectedCountColumns();
        const sums = getSelectedSumColumns();

        elements.review.innerHTML = `
            <div>
                <span>Proceso</span>
                <strong>${escapeHtml(elements.processName.value.trim())}</strong>
            </div>

            <div>
                <span>Dominio</span>
                <strong>${escapeHtml(elements.domainName.value.trim())}</strong>
            </div>

            <div>
                <span>Origen</span>
                <strong>
                    ${escapeHtml(
                        `${elements.sourceDataset.value}.${elements.sourceTable.value}`
                    )}
                </strong>
            </div>

            <div>
                <span>Destino</span>
                <strong>
                    ${escapeHtml(
                        `${elements.targetDataset.value}.${elements.targetTable.value}`
                    )}
                </strong>
            </div>

            <div>
                <span>Claves</span>
                <strong>${escapeHtml(keys.join(", "))}</strong>
            </div>

            <div>
                <span>Fecha</span>
                <strong>
                    ${escapeHtml(
                        elements.dateColumn.value || "Sin filtro automático"
                    )}
                </strong>
            </div>

            <div>
                <span>Métricas de conteo</span>
                <strong>
                    ${escapeHtml(counts.length ? counts.join(", ") : "Ninguna")}
                </strong>
            </div>

            <div>
                <span>Métricas de sumarización</span>
                <strong>
                    ${escapeHtml(sums.length ? sums.join(", ") : "Ninguna")}
                </strong>
            </div>

            <div>
                <span>Umbrales</span>
                <strong>
                    Filas: ${escapeHtml(elements.rowTolerance.value)}
                    · Conteos: ${escapeHtml(elements.countTolerance.value)}
                    · Sumas: ${escapeHtml(elements.amountTolerance.value)}
                </strong>
            </div>
        `;
    }

    async function saveDraft() {
        hideMessage();

        const validation = validatePublicationData();

        if (!validation.valid) {
            showMessage(validation.message, "warning");
            return;
        }

        state.isSaving = true;
        updateActionState();

        elements.saveButton.textContent =
            state.draftId ? "Actualizando..." : "Guardando...";

        try {
            const payload = buildDraftPayload();
            let response;

            if (state.draftId) {
                response = await apiRequest(
                    `/ui/api/reconciliation/draft/${encodeURIComponent(
                        state.draftId
                    )}`,
                    {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            process_name: payload.process_name,
                            domain_name: payload.domain_name,
                            description: payload.description,
                            business_key: payload.business_key,
                            date_column: payload.date_column,
                            count_columns: payload.count_columns,
                            sum_columns: payload.sum_columns,
                            row_tolerance: payload.row_tolerance,
                            count_tolerance: payload.count_tolerance,
                            amount_tolerance: payload.amount_tolerance
                        })
                    }
                );
            } else {
                response = await apiRequest(
                    "/ui/api/reconciliation/draft",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(payload)
                    }
                );
            }

            state.draftId = extractDraftId(response);

            if (!state.draftId) {
                throw new Error("El backend no devolvió draft_id.");
            }

            state.validationResponse = null;
            elements.publicationStatus.textContent = "GUARDADO";

            persistLocalState();

            showMessage(
                `Borrador ${state.draftId} guardado correctamente.`,
                "success"
            );

        } catch (error) {
            showMessage(
                "No se pudo guardar el borrador: " + error.message,
                "error"
            );

        } finally {
            state.isSaving = false;
            elements.saveButton.textContent = "Guardar borrador";
            renderChecklist();
            updateActionState();
        }
    }

    function buildDraftPayload() {
        return {
            process_name: elements.processName.value.trim(),
            domain_name: elements.domainName.value.trim(),
            description: elements.description.value.trim() || null,

            source_connection_id: elements.sourceConnection.value,
            source_dataset: elements.sourceDataset.value,
            source_table: elements.sourceTable.value,
            source_filter: elements.sourceFilter.value.trim() || null,

            target_connection_id: elements.targetConnection.value,
            target_dataset: elements.targetDataset.value,
            target_table: elements.targetTable.value,
            target_filter: elements.targetFilter.value.trim() || null,

            business_key: getSelectedBusinessKeys(),
            date_column: elements.dateColumn.value || null,

            count_columns: getSelectedCountColumns(),
            sum_columns: getSelectedSumColumns(),

            row_tolerance: Number(elements.rowTolerance.value || 0),
            count_tolerance: Number(elements.countTolerance.value || 0),
            amount_tolerance: Number(elements.amountTolerance.value || 0),

            requested_by: elements.requestedBy.value.trim(),
            session_id: getSessionId()
        };
    }

    async function validateDraft() {
        hideMessage();

        if (!state.draftId) {
            showMessage("Guarda primero el borrador.", "warning");
            return;
        }

        state.isValidating = true;
        elements.validateButton.textContent = "Validando...";
        updateActionState();

        try {
            const response = await apiRequest(
                `/ui/api/reconciliation/draft/${encodeURIComponent(
                    state.draftId
                )}/validate`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: "{}"
                }
            );

            state.validationResponse = response;
            persistLocalState();
            renderValidation(response);
            elements.validationSection.hidden = false;

            showMessage(
                isValidationSuccessful()
                    ? "La configuración está lista para publicarse."
                    : "La configuración presenta observaciones.",
                isValidationSuccessful() ? "success" : "warning"
            );

        } catch (error) {
            showMessage(
                "No se pudo validar el borrador: " + error.message,
                "error"
            );

        } finally {
            state.isValidating = false;
            elements.validateButton.textContent = "Validar configuración";
            renderChecklist();
            updateActionState();
        }
    }

    function renderValidation(response) {
        const valid = resolveValidationStatus(response) === "VALID";

        elements.validationStatus.textContent =
            valid ? "VALID" : "OBSERVED";

        elements.validationStatus.className =
            "neutral-chip "
            + (
                valid
                    ? "validation-status-valid"
                    : "validation-status-observed"
            );

        const message =
            response.validation_message
            || response.message
            || (
                valid
                    ? "Configuración válida."
                    : "Revisa las observaciones."
            );

        elements.validationContent.innerHTML = `
            <article class="validation-checklist-item">
                <span class="${
                    valid
                        ? "validation-icon-success"
                        : "validation-icon-error"
                }">
                    ${valid ? "✓" : "×"}
                </span>

                <div>
                    <strong>Validación del backend</strong>
                    <p>${escapeHtml(message)}</p>
                </div>
            </article>
        `;
    }

    async function publishDraft() {
        hideMessage();

        if (!state.draftId || !isValidationSuccessful()) {
            showMessage(
                "La configuración debe estar guardada y validada.",
                "warning"
            );
            return;
        }

        if (state.publishedResponse) {
            window.location.assign("/reconciliation");
            return;
        }

        state.isPublishing = true;
        elements.publishButton.textContent = "Publicando...";
        updateActionState();

        try {
            const response = await apiRequest(
                `/ui/api/reconciliation/draft/${encodeURIComponent(
                    state.draftId
                )}/confirm`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        confirmed_by: elements.requestedBy.value.trim(),
                        active_flag: true,
                        execute_after_confirm: false,
                        business_date: null
                    })
                }
            );

            state.publishedResponse = response;

            elements.publicationStatus.textContent = "PUBLICADO";
            elements.publicationStatus.className =
                "neutral-chip validation-status-valid";

            sessionStorage.removeItem(STORAGE_KEY);

            showMessage(
                "La reconciliación fue publicada y está disponible en el catálogo.",
                "success"
            );

            elements.publishButton.textContent = "Ir al catálogo";
            elements.publishButton.disabled = false;

        } catch (error) {
            showMessage(
                "No se pudo publicar la reconciliación: " + error.message,
                "error"
            );

        } finally {
            state.isPublishing = false;

            if (!state.publishedResponse) {
                elements.publishButton.textContent =
                    "Confirmar y publicar";
                updateActionState();
            }
        }
    }

    function validatePublicationData() {
        for (const step of [1, 2, 3]) {
            const validation = validateStep(step);

            if (!validation.valid) {
                return validation;
            }
        }

        if (!isValidEmail(elements.requestedBy.value.trim())) {
            return {
                valid: false,
                message: "El responsable debe ser un correo válido."
            };
        }

        return {
            valid: true,
            message: ""
        };
    }

    function renderCurrentStep() {
        for (let step = 1; step <= 4; step += 1) {
            byId(`wizard-step-${step}`).hidden =
                step !== state.currentStep;
        }

        document.querySelectorAll("[data-step-target]").forEach(button => {
            const step = Number(button.dataset.stepTarget);

            button.classList.toggle(
                "active",
                step === state.currentStep
            );

            button.classList.toggle(
                "completed",
                step < state.currentStep
            );

            button.disabled = step > state.currentStep;
        });

        elements.backButton.disabled = state.currentStep === 1;

        elements.nextButton.hidden = state.currentStep === 4;
        elements.saveButton.hidden = state.currentStep !== 4;
        elements.validateButton.hidden = state.currentStep !== 4;
        elements.publishButton.hidden = state.currentStep !== 4;

        const labels = {
            1: "Analizar tablas",
            2: "Definir umbrales",
            3: "Revisar y confirmar"
        };

        if (state.currentStep < 4) {
            elements.nextButton.textContent =
                labels[state.currentStep] || "Continuar";
        }

        if (state.currentStep === 3) {
            renderSelectedMetricsSummary();
        }

        if (state.currentStep === 4) {
            renderReview();

            if (state.validationResponse) {
                renderValidation(state.validationResponse);
                elements.validationSection.hidden = false;
            }
        }

        updateAdvisor();
        renderChecklist();
        updateActionState();
        persistLocalState();
    }

    function updateAdvisor() {
        const content = {
            1: {
                title: "Define el proceso",
                message:
                    "Completa el nombre, dominio y las tablas de origen y destino."
            },
            2: {
                title: "Selecciona las métricas",
                message:
                    "Gemini recomienda opciones, pero tú decides cuáles incluir."
            },
            3: {
                title: "Define los umbrales",
                message:
                    "Configura diferencias aceptadas para filas, conteos y sumarizaciones."
            },
            4: {
                title: "Publica con control humano",
                message:
                    "Guarda el borrador, valida el contrato y publica la reconciliación."
            }
        }[state.currentStep];

        elements.advisorTitle.textContent = content.title;
        elements.advisorMessage.textContent = content.message;
    }

    function renderChecklist() {
        const checklist = [
            {
                label: "Nombre del proceso",
                valid: Boolean(elements.processName.value.trim()),
                detail: elements.processName.value.trim() || "Obligatorio"
            },
            {
                label: "Dominio",
                valid: Boolean(elements.domainName.value.trim()),
                detail: elements.domainName.value.trim() || "Obligatorio"
            },
            {
                label: "Origen y destino",
                valid: isSourceSelectionComplete(),
                detail:
                    isSourceSelectionComplete()
                        ? "Tablas seleccionadas"
                        : "Pendiente"
            },
            {
                label: "Metadata compatible",
                valid: state.commonColumns.length > 0,
                detail: `${state.commonColumns.length} columnas comunes`
            },
            {
                label: "Métricas de conteo",
                valid: getSelectedCountColumns().length > 0,
                detail: `${getSelectedCountColumns().length} seleccionadas`
            },
            {
                label: "Métricas de sumarización",
                valid: getSelectedSumColumns().length > 0,
                detail: `${getSelectedSumColumns().length} seleccionadas`
            },
            {
                label: "Borrador",
                valid: Boolean(state.draftId),
                detail: state.draftId || "Pendiente"
            },
            {
                label: "Validación",
                valid: isValidationSuccessful(),
                detail:
                    isValidationSuccessful()
                        ? "Válida"
                        : "Pendiente"
            }
        ];

        elements.checklist.innerHTML = checklist
            .map(item => `
                <div class="design-checklist-item">
                    <span class="${
                        item.valid
                            ? "checklist-success"
                            : "checklist-pending"
                    }">
                        ${item.valid ? "✓" : "○"}
                    </span>

                    <div>
                        <strong>${escapeHtml(item.label)}</strong>
                        <small>${escapeHtml(item.detail)}</small>
                    </div>
                </div>
            `)
            .join("");
    }

    function updateActionState() {
        elements.saveButton.disabled = state.isSaving;

        elements.validateButton.disabled =
            state.isValidating
            || !state.draftId;

        elements.publishButton.disabled =
            state.isPublishing
            || (
                !state.publishedResponse
                && !isValidationSuccessful()
            );
    }

    function handleConfigurationChange() {
        invalidateValidation();
        renderSelectedMetricsSummary();
        renderChecklist();
        persistLocalState();
    }

    function invalidateValidation() {
        state.validationResponse = null;
        elements.validationSection.hidden = true;
    }

    function getSelectedBusinessKeys() {
        return Array.from(
            elements.businessKey.selectedOptions
        ).map(option => option.value);
    }

    function getSelectedCountColumns() {
        return Array.from(
            elements.countColumnsGrid.querySelectorAll(
                'input[name="count-column"]:checked'
            )
        ).map(input => input.value);
    }

    function getSelectedSumColumns() {
        return Array.from(
            elements.sumColumnsGrid.querySelectorAll(
                'input[name="sum-column"]:checked'
            )
        ).map(input => input.value);
    }

    function resolveValidationStatus(response) {
        const status = String(
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

    function isValidationSuccessful() {
        return Boolean(
            state.validationResponse
            && resolveValidationStatus(
                state.validationResponse
            ) === "VALID"
        );
    }

    function extractDraftId(response) {
        return (
            response?.draft_id
            || response?.draft?.draft_id
            || response?.configuration?.draft_id
            || response?.data?.draft_id
            || state.draftId
            || null
        );
    }

    function persistLocalState() {
        sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                currentStep: state.currentStep,
                draftId: state.draftId,
                validationResponse: state.validationResponse,

                values: {
                    processName: elements.processName.value,
                    domainName: elements.domainName.value,
                    description: elements.description.value,
                    sourceConnection: elements.sourceConnection.value,
                    sourceDataset: elements.sourceDataset.value,
                    sourceTable: elements.sourceTable.value,
                    sourceFilter: elements.sourceFilter.value,
                    targetConnection: elements.targetConnection.value,
                    targetDataset: elements.targetDataset.value,
                    targetTable: elements.targetTable.value,
                    targetFilter: elements.targetFilter.value,
                    rowTolerance: elements.rowTolerance.value,
                    countTolerance: elements.countTolerance.value,
                    amountTolerance: elements.amountTolerance.value,
                    requestedBy: elements.requestedBy.value
                }
            })
        );
    }

    function restoreLocalValues() {
        const raw = sessionStorage.getItem(STORAGE_KEY);

        if (!raw) {
            return;
        }

        try {
            const saved = JSON.parse(raw);
            state.draftId = saved.draftId || null;
            state.validationResponse =
                saved.validationResponse || null;

            const values = saved.values || {};

            elements.processName.value =
                values.processName
                || elements.processName.value
                || "Cuadratura dinámica";

            elements.domainName.value =
                values.domainName || "";

            elements.description.value =
                values.description || "";

            elements.sourceFilter.value =
                values.sourceFilter || "";

            elements.targetFilter.value =
                values.targetFilter || "";

            elements.rowTolerance.value =
                values.rowTolerance ?? 0;

            elements.countTolerance.value =
                values.countTolerance ?? 0;

            elements.amountTolerance.value =
                values.amountTolerance ?? 0;

            elements.requestedBy.value =
                values.requestedBy
                || "julio.cordova@gmail.com";

        } catch {
            sessionStorage.removeItem(STORAGE_KEY);
        }
    }

    function populateSelect(
        select,
        values,
        placeholder,
        valueResolver,
        labelResolver
    ) {
        select.innerHTML = "";

        const placeholderOption =
            document.createElement("option");

        placeholderOption.value = "";
        placeholderOption.textContent = placeholder;

        select.appendChild(placeholderOption);

        const seen = new Set();

        values.forEach(item => {
            const value = valueResolver(item);

            if (!value || seen.has(value)) {
                return;
            }

            seen.add(value);

            const option = document.createElement("option");
            option.value = value;
            option.textContent = labelResolver(item) || value;
            select.appendChild(option);
        });
    }

    function setSelectLoading(select, text) {
        resetSelect(select, text);
        select.disabled = true;
    }

    function resetSelect(select, text) {
        select.innerHTML =
            `<option value="">${escapeHtml(text)}</option>`;
    }

    function connectionValue(item) {
        return typeof item === "string"
            ? item
            : (
                item.connection_id
                || item.id
                || item.name
                || ""
            );
    }

    function connectionLabel(item) {
        return typeof item === "string"
            ? item
            : (
                item.display_name
                || item.connection_name
                || item.name
                || item.connection_id
                || ""
            );
    }

    function datasetValue(item) {
        return typeof item === "string"
            ? item
            : (
                item.dataset_id
                || item.dataset_name
                || item.name
                || ""
            );
    }

    function datasetLabel(item) {
        return typeof item === "string"
            ? item
            : (
                item.display_name
                || item.dataset_name
                || item.dataset_id
                || item.name
                || ""
            );
    }

    function tableValue(item) {
        return typeof item === "string"
            ? item
            : (
                item.table_id
                || item.table_name
                || item.name
                || ""
            );
    }

    function tableLabel(item) {
        return typeof item === "string"
            ? item
            : (
                item.display_name
                || item.table_name
                || item.table_id
                || item.name
                || ""
            );
    }

    function extractArray(payload, keys) {
        if (Array.isArray(payload)) {
            return payload;
        }

        for (const key of keys) {
            if (Array.isArray(payload?.[key])) {
                return payload[key];
            }
        }

        return [];
    }

    function selectMultipleValues(select, values) {
        const selectedValues = new Set(values);

        Array.from(select.options).forEach(option => {
            option.selected = selectedValues.has(option.value);
        });
    }

    function areTypesCompatible(sourceType, targetType) {
        if (sourceType === targetType) {
            return true;
        }

        return isNumericType(sourceType) && isNumericType(targetType);
    }

    function isNumericType(type) {
        return [
            "INT64",
            "INTEGER",
            "FLOAT64",
            "FLOAT",
            "NUMERIC",
            "BIGNUMERIC",
            "DECIMAL"
        ].some(value => String(type).includes(value));
    }

    function isStringType(type) {
        return [
            "STRING",
            "VARCHAR",
            "CHAR"
        ].some(value => String(type).includes(value));
    }

    function isDateType(type) {
        return [
            "DATE",
            "DATETIME",
            "TIMESTAMP"
        ].some(value => String(type).includes(value));
    }

    function isValidEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    function getSessionId() {
        const key = "dataOpsReconciliationWizardSession";

        let value = sessionStorage.getItem(key);

        if (!value) {
            value =
                window.crypto?.randomUUID
                    ? window.crypto.randomUUID()
                    : `SESSION_${Date.now()}`;

            sessionStorage.setItem(key, value);
        }

        return value;
    }

    async function apiRequest(url, options = {}) {
        const response = await fetch(
            url,
            {
                ...options,
                headers: {
                    Accept: "application/json",
                    ...(options.headers || {})
                }
            }
        );

        const contentType =
            response.headers.get("content-type") || "";

        const payload =
            contentType.includes("application/json")
                ? await response.json()
                : {
                    message: await response.text()
                };

        if (!response.ok) {
            throw new Error(
                typeof payload.detail === "string"
                    ? payload.detail
                    : payload.message
                    || `Error HTTP ${response.status}`
            );
        }

        return payload;
    }

    function showMessage(text, type) {
        elements.message.hidden = false;
        elements.message.textContent = text;
        elements.message.className =
            `message wizard-message message-${type}`;
    }

    function hideMessage() {
        elements.message.hidden = true;
        elements.message.textContent = "";
        elements.message.className =
            "message wizard-message";
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
        console.error(error);
        showMessage(
            "No fue posible iniciar el wizard: " + error.message,
            "error"
        );
    });
})();
