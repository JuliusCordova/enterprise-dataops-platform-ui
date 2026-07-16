(() => {
    "use strict";

    const STORAGE_KEY =
        "dataOpsReconciliationDraft";

    const state = {
        currentStep: 1,
        connections: [],

        sourceColumns: [],
        targetColumns: [],
        commonColumns: [],

        draftId: null,
        validationResponse: null,
        publishedResponse: null,

        isSaving: false,
        isValidating: false,
        isPublishing: false
    };

    const elements = {
        sourceConnection:
            document.getElementById("source-connection"),

        sourceDataset:
            document.getElementById("source-dataset"),

        sourceTable:
            document.getElementById("source-table"),

        targetConnection:
            document.getElementById("target-connection"),

        targetDataset:
            document.getElementById("target-dataset"),

        targetTable:
            document.getElementById("target-table"),

        sourceSummary:
            document.getElementById("source-selection-summary"),

        summarySource:
            document.getElementById("summary-source-path"),

        summaryTarget:
            document.getElementById("summary-target-path"),

        metadataLoading:
            document.getElementById("metadata-analysis-loading"),

        commonColumnCount:
            document.getElementById("common-column-count"),

        mappingRecommendation:
            document.getElementById("mapping-recommendation"),

        businessKey:
            document.getElementById("business-key-select"),

        dateColumn:
            document.getElementById("date-column-select"),

        commonColumnsGrid:
            document.getElementById("common-columns-grid"),

        sumColumnsGrid:
            document.getElementById("sum-columns-grid"),

        rowTolerance:
            document.getElementById("row-tolerance"),

        amountTolerance:
            document.getElementById("amount-tolerance"),

        sourceFilter:
            document.getElementById("source-filter"),

        targetFilter:
            document.getElementById("target-filter"),

        processName:
            document.getElementById("process-name"),

        domainName:
            document.getElementById("domain-name"),

        description:
            document.getElementById("reconciliation-description"),

        requestedBy:
            document.getElementById("wizard-requested-by"),

        review:
            document.getElementById("wizard-review-content"),

        publicationStatus:
            document.getElementById("wizard-publication-status"),

        validationSection:
            document.getElementById("wizard-validation-section"),

        validationStatus:
            document.getElementById("wizard-validation-status"),

        validationContent:
            document.getElementById("wizard-validation-content"),

        message:
            document.getElementById("wizard-message"),

        backButton:
            document.getElementById("wizard-back-button"),

        nextButton:
            document.getElementById("wizard-next-button"),

        saveButton:
            document.getElementById("wizard-save-button"),

        validateButton:
            document.getElementById("wizard-validate-button"),

        publishButton:
            document.getElementById("wizard-publish-button"),

        advisorTitle:
            document.getElementById("wizard-advisor-title"),

        advisorMessage:
            document.getElementById("wizard-advisor-message"),

        checklist:
            document.getElementById("wizard-checklist")
    };

    async function initialize() {
        validateElements();
        bindEvents();
        await loadConnections();
        restoreLocalDraft();
        renderCurrentStep();
    }

    function validateElements() {
        const missing =
            Object.entries(elements)
                .filter(([, element]) => !element)
                .map(([name]) => name);

        if (missing.length > 0) {
            throw new Error(
                "Faltan elementos requeridos: "
                + missing.join(", ")
            );
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

        elements.sourceTable.addEventListener(
            "change",
            handleSourceSelectionChange
        );

        elements.targetTable.addEventListener(
            "change",
            handleSourceSelectionChange
        );

        elements.backButton.addEventListener(
            "click",
            previousStep
        );

        elements.nextButton.addEventListener(
            "click",
            nextStep
        );

        elements.saveButton.addEventListener(
            "click",
            saveDraft
        );

        elements.validateButton.addEventListener(
            "click",
            validateDraft
        );

        elements.publishButton.addEventListener(
            "click",
            publishDraft
        );

        document
            .querySelectorAll("[data-step-target]")
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => {
                        const target =
                            Number(
                                button.dataset.stepTarget
                            );

                        if (
                            !button.disabled
                            && target <= state.currentStep
                        ) {
                            state.currentStep = target;
                            renderCurrentStep();
                        }
                    }
                );
            });

        [
            elements.rowTolerance,
            elements.amountTolerance,
            elements.sourceFilter,
            elements.targetFilter,
            elements.processName,
            elements.domainName,
            elements.description,
            elements.requestedBy,
            elements.businessKey,
            elements.dateColumn
        ].forEach(element => {
            element.addEventListener(
                "change",
                handleConfigurationChange
            );

            element.addEventListener(
                "input",
                handleConfigurationChange
            );
        });
    }

    async function loadConnections() {
        setSelectLoading(
            elements.sourceConnection,
            "Cargando conexiones..."
        );

        setSelectLoading(
            elements.targetConnection,
            "Cargando conexiones..."
        );

        try {
            const payload =
                await apiRequest(
                    "/ui/api/reconciliation/connections"
                );

            state.connections =
                extractArray(
                    payload,
                    [
                        "connections",
                        "items",
                        "data"
                    ]
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

            elements.sourceConnection.disabled =
                state.connections.length === 0;

            elements.targetConnection.disabled =
                state.connections.length === 0;

        } catch (error) {
            showMessage(
                "No se pudieron cargar las conexiones: "
                    + error.message,
                "error"
            );
        }
    }

    async function handleConnectionChange(
        side
    ) {
        invalidateDraft();

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

        resetSelect(
            tableSelect,
            "Selecciona un dataset"
        );

        tableSelect.disabled = true;

        if (!connectionSelect.value) {
            resetSelect(
                datasetSelect,
                "Selecciona una conexión"
            );

            datasetSelect.disabled = true;
            updateSourceSummary();
            return;
        }

        setSelectLoading(
            datasetSelect,
            "Cargando datasets..."
        );

        try {
            const payload =
                await apiRequest(
                    `/ui/api/reconciliation/metadata/${encodeURIComponent(
                        connectionSelect.value
                    )}/datasets`
                );

            const datasets =
                extractArray(
                    payload,
                    [
                        "datasets",
                        "items",
                        "data"
                    ]
                );

            populateSelect(
                datasetSelect,
                datasets,
                "Selecciona un dataset",
                datasetValue,
                datasetLabel
            );

            datasetSelect.disabled =
                datasets.length === 0;

        } catch (error) {
            showMessage(
                "No se pudieron cargar los datasets: "
                    + error.message,
                "error"
            );
        }

        updateSourceSummary();
    }

    async function handleDatasetChange(
        side
    ) {
        invalidateDraft();

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

        if (
            !connectionSelect.value
            || !datasetSelect.value
        ) {
            resetSelect(
                tableSelect,
                "Selecciona un dataset"
            );

            tableSelect.disabled = true;
            updateSourceSummary();
            return;
        }

        setSelectLoading(
            tableSelect,
            "Cargando tablas..."
        );

        try {
            const payload =
                await apiRequest(
                    `/ui/api/reconciliation/metadata/${encodeURIComponent(
                        connectionSelect.value
                    )}/${encodeURIComponent(
                        datasetSelect.value
                    )}/tables`
                );

            const tables =
                extractArray(
                    payload,
                    [
                        "tables",
                        "items",
                        "data"
                    ]
                );

            populateSelect(
                tableSelect,
                tables,
                "Selecciona una tabla",
                tableValue,
                tableLabel
            );

            tableSelect.disabled =
                tables.length === 0;

        } catch (error) {
            showMessage(
                "No se pudieron cargar las tablas: "
                    + error.message,
                "error"
            );
        }

        updateSourceSummary();
    }

    function handleSourceSelectionChange() {
        invalidateDraft();
        updateSourceSummary();
        renderChecklist();
    }

    function updateSourceSummary() {
        const complete =
            isSourceSelectionComplete();

        elements.sourceSummary.hidden =
            !complete;

        if (!complete) {
            return;
        }

        elements.summarySource.textContent =
            `${elements.sourceDataset.value}.${elements.sourceTable.value}`;

        elements.summaryTarget.textContent =
            `${elements.targetDataset.value}.${elements.targetTable.value}`;
    }

    async function analyzeMetadata() {
        elements.metadataLoading.hidden =
            false;

        try {
            const [
                sourcePayload,
                targetPayload
            ] = await Promise.all([
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

            state.sourceColumns =
                normalizeColumns(
                    extractArray(
                        sourcePayload,
                        [
                            "columns",
                            "items",
                            "data"
                        ]
                    )
                );

            state.targetColumns =
                normalizeColumns(
                    extractArray(
                        targetPayload,
                        [
                            "columns",
                            "items",
                            "data"
                        ]
                    )
                );

            state.commonColumns =
                findCommonColumns(
                    state.sourceColumns,
                    state.targetColumns
                );

            renderMetadataProposal();

        } finally {
            elements.metadataLoading.hidden =
                true;
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

                type:
                    String(
                        column.data_type
                        || column.type
                        || "UNKNOWN"
                    ).toUpperCase()
            };
        }).filter(column => column.name);
    }

    function findCommonColumns(
        sourceColumns,
        targetColumns
    ) {
        const targetMap =
            new Map(
                targetColumns.map(
                    column => [
                        column.name.toLowerCase(),
                        column
                    ]
                )
            );

        return sourceColumns
            .filter(column =>
                targetMap.has(
                    column.name.toLowerCase()
                )
            )
            .map(column => {
                const targetColumn =
                    targetMap.get(
                        column.name.toLowerCase()
                    );

                return {
                    name: column.name,
                    sourceType: column.type,
                    targetType: targetColumn.type,
                    compatible:
                        areTypesCompatible(
                            column.type,
                            targetColumn.type
                        )
                };
            });
    }

    function areTypesCompatible(
        sourceType,
        targetType
    ) {
        if (sourceType === targetType) {
            return true;
        }

        return (
            isNumericType(sourceType)
            && isNumericType(targetType)
        );
    }

    function renderMetadataProposal() {
        elements.commonColumnCount.textContent =
            `${state.commonColumns.length} columnas comunes`;

        renderCommonColumns();
        renderBusinessKeyOptions();
        renderDateOptions();
        renderSumColumns();

        const keyCandidate =
            suggestBusinessKey();

        const dateCandidate =
            suggestDateColumn();

        if (keyCandidate) {
            selectMultipleValues(
                elements.businessKey,
                [keyCandidate]
            );
        }

        if (dateCandidate) {
            elements.dateColumn.value =
                dateCandidate;
        }

        elements.mappingRecommendation.textContent =
            state.commonColumns.length === 0
                ? "No existen columnas comunes. Revisa las tablas seleccionadas."
                : (
                    `Se identificaron ${state.commonColumns.length} columnas comunes. `
                    + (
                        keyCandidate
                            ? `${keyCandidate} fue propuesta como clave. `
                            : "Selecciona manualmente una clave. "
                    )
                    + (
                        dateCandidate
                            ? `${dateCandidate} fue propuesta como fecha.`
                            : "No se encontró una fecha candidata."
                    )
                );
    }

    function renderCommonColumns() {
        elements.commonColumnsGrid.innerHTML =
            state.commonColumns
                .map(column => `
                    <article class="common-column-card">

                        <strong>
                            ${escapeHtml(column.name)}
                        </strong>

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
        elements.businessKey.innerHTML =
            state.commonColumns
                .filter(column => column.compatible)
                .map(column => `
                    <option value="${escapeAttribute(
                        column.name
                    )}">
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
                const option =
                    document.createElement("option");

                option.value = column.name;
                option.textContent = column.name;

                elements.dateColumn.appendChild(
                    option
                );
            });
    }

    function renderSumColumns() {
        elements.sumColumnsGrid.innerHTML =
            state.commonColumns
                .filter(column =>
                    isNumericType(column.sourceType)
                    && isNumericType(column.targetType)
                )
                .map(column => `
                    <label class="wizard-checkbox-card">

                        <input
                            type="checkbox"
                            name="sum-column"
                            value="${escapeAttribute(
                                column.name
                            )}"
                            checked>

                        <div>

                            <strong>
                                ${escapeHtml(column.name)}
                            </strong>

                            <span>
                                ${escapeHtml(column.sourceType)}
                            </span>

                        </div>

                    </label>
                `)
                .join("");

        elements.sumColumnsGrid
            .querySelectorAll("input")
            .forEach(input => {
                input.addEventListener(
                    "change",
                    handleConfigurationChange
                );
            });
    }

    function suggestBusinessKey() {
        const preferredPatterns = [
            /(^|_)id$/i,
            /_key$/i,
            /codigo$/i,
            /code$/i
        ];

        for (const pattern of preferredPatterns) {
            const candidate =
                state.commonColumns.find(
                    column =>
                        column.compatible
                        && pattern.test(
                            column.name
                        )
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

        const dateColumns =
            state.commonColumns.filter(
                column =>
                    isDateType(column.sourceType)
                    && isDateType(column.targetType)
            );

        for (const pattern of preferredPatterns) {
            const candidate =
                dateColumns.find(
                    column =>
                        pattern.test(column.name)
                );

            if (candidate) {
                return candidate.name;
            }
        }

        return dateColumns[0]?.name || "";
    }

    async function nextStep() {
        hideMessage();

        const validation =
            validateStep(
                state.currentStep
            );

        if (!validation.valid) {
            showMessage(
                validation.message,
                "warning"
            );
            return;
        }

        if (state.currentStep === 1) {
            try {
                await analyzeMetadata();
            } catch (error) {
                showMessage(
                    "No se pudo analizar la metadata: "
                        + error.message,
                    "error"
                );
                return;
            }
        }

        if (state.currentStep === 3) {
            renderReview();
            applyDefaultPublicationValues();
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
        if (
            step === 1
            && !isSourceSelectionComplete()
        ) {
            return {
                valid: false,
                message:
                    "Selecciona conexión, dataset y tabla para origen y destino."
            };
        }

        if (
            step === 2
            && getSelectedBusinessKeys().length === 0
        ) {
            return {
                valid: false,
                message:
                    "Selecciona al menos una clave de negocio."
            };
        }

        if (
            step === 3
            && Number(elements.rowTolerance.value) < 0
        ) {
            return {
                valid: false,
                message:
                    "La tolerancia de filas no puede ser negativa."
            };
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

    function applyDefaultPublicationValues() {
        if (!elements.processName.value.trim()) {
            elements.processName.value =
                `Cuadratura ${humanize(
                    elements.sourceTable.value
                )} vs ${humanize(
                    elements.targetTable.value
                )}`;
        }

        if (!elements.description.value.trim()) {
            elements.description.value =
                `Comparación entre ${elements.sourceDataset.value}.${elements.sourceTable.value} y ${elements.targetDataset.value}.${elements.targetTable.value}.`;
        }
    }

    function renderReview() {
        const keys =
            getSelectedBusinessKeys();

        const sums =
            getSelectedSumColumns();

        elements.review.innerHTML = `
            <div>
                <span>Origen</span>
                <strong>${escapeHtml(
                    `${elements.sourceDataset.value}.${elements.sourceTable.value}`
                )}</strong>
            </div>

            <div>
                <span>Destino</span>
                <strong>${escapeHtml(
                    `${elements.targetDataset.value}.${elements.targetTable.value}`
                )}</strong>
            </div>

            <div>
                <span>Claves</span>
                <strong>${escapeHtml(
                    keys.join(", ")
                )}</strong>
            </div>

            <div>
                <span>Fecha</span>
                <strong>${escapeHtml(
                    elements.dateColumn.value
                    || "Sin filtro de fecha"
                )}</strong>
            </div>

            <div>
                <span>Métricas</span>
                <strong>${escapeHtml(
                    sums.length > 0
                        ? sums.join(", ")
                        : "Solo conteo de filas"
                )}</strong>
            </div>

            <div>
                <span>Tolerancias</span>
                <strong>
                    Filas:
                    ${escapeHtml(
                        elements.rowTolerance.value
                    )}
                    · Montos:
                    ${escapeHtml(
                        elements.amountTolerance.value
                    )}
                </strong>
            </div>
        `;
    }

    async function saveDraft() {
        hideMessage();

        const validation =
            validatePublicationData();

        if (!validation.valid) {
            showMessage(
                validation.message,
                "warning"
            );
            return;
        }

        state.isSaving = true;
        updateActionState();

        elements.saveButton.textContent =
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
                        `/ui/api/reconciliation/draft/${encodeURIComponent(
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
                                    process_name:
                                        payload.process_name,

                                    domain_name:
                                        payload.domain_name,

                                    description:
                                        payload.description,

                                    business_key:
                                        payload.business_key,

                                    date_column:
                                        payload.date_column,

                                    sum_columns:
                                        payload.sum_columns,

                                    row_tolerance:
                                        payload.row_tolerance,

                                    amount_tolerance:
                                        payload.amount_tolerance
                                })
                        }
                    );

            } else {
                response =
                    await apiRequest(
                        "/ui/api/reconciliation/draft",
                        {
                            method: "POST",
                            headers: {
                                "Content-Type":
                                    "application/json"
                            },
                            body:
                                JSON.stringify(payload)
                        }
                    );
            }

            state.draftId =
                extractDraftId(response);

            if (!state.draftId) {
                throw new Error(
                    "El backend no devolvió draft_id."
                );
            }

            state.validationResponse = null;

            persistLocalDraft();

            elements.publicationStatus.textContent =
                "GUARDADO";

            showMessage(
                `Borrador ${state.draftId} guardado correctamente.`,
                "success"
            );

        } catch (error) {
            showMessage(
                "No se pudo guardar el borrador: "
                    + error.message,
                "error"
            );

        } finally {
            state.isSaving = false;
            elements.saveButton.textContent =
                "Guardar borrador";

            renderChecklist();
            updateActionState();
        }
    }

    function buildDraftPayload() {
        const dateColumn =
            elements.dateColumn.value
            || null;

        return {
            process_name:
                elements.processName.value.trim(),

            domain_name:
                elements.domainName.value.trim()
                || null,

            description:
                elements.description.value.trim()
                || null,

            source_connection_id:
                elements.sourceConnection.value,

            source_dataset:
                elements.sourceDataset.value,

            source_table:
                elements.sourceTable.value,

            source_filter:
                buildFilter(
                    elements.sourceFilter.value,
                    dateColumn
                ),

            target_connection_id:
                elements.targetConnection.value,

            target_dataset:
                elements.targetDataset.value,

            target_table:
                elements.targetTable.value,

            target_filter:
                buildFilter(
                    elements.targetFilter.value,
                    dateColumn
                ),

            business_key:
                getSelectedBusinessKeys(),

            date_column:
                dateColumn,

            sum_columns:
                getSelectedSumColumns(),

            row_tolerance:
                Number(
                    elements.rowTolerance.value
                    || 0
                ),

            amount_tolerance:
                Number(
                    elements.amountTolerance.value
                    || 0
                ),

            requested_by:
                elements.requestedBy.value.trim(),

            session_id:
                getSessionId()
        };
    }

    function buildFilter(
        customFilter,
        dateColumn
    ) {
        const trimmed =
            String(customFilter || "").trim();

        if (!dateColumn) {
            return trimmed || null;
        }

        const dateFilter =
            `${dateColumn} = @business_date`;

        return trimmed
            ? `(${trimmed}) AND ${dateFilter}`
            : dateFilter;
    }

    async function validateDraft() {
        hideMessage();

        if (!state.draftId) {
            showMessage(
                "Guarda primero el borrador.",
                "warning"
            );
            return;
        }

        state.isValidating = true;
        elements.validateButton.textContent =
            "Validando...";
        updateActionState();

        try {
            const response =
                await apiRequest(
                    `/ui/api/reconciliation/draft/${encodeURIComponent(
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

            persistLocalDraft();
            renderValidation(response);

            elements.validationSection.hidden =
                false;

            showMessage(
                isValidationSuccessful()
                    ? "La configuración está lista para publicarse."
                    : "La configuración presenta observaciones.",
                isValidationSuccessful()
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
            elements.validateButton.textContent =
                "Validar configuración";
            renderChecklist();
            updateActionState();
        }
    }

    function renderValidation(response) {
        const valid =
            resolveValidationStatus(response)
            === "VALID";

        elements.validationStatus.textContent =
            valid
                ? "VALID"
                : "OBSERVED";

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
                    <strong>
                        Validación del backend
                    </strong>

                    <p>
                        ${escapeHtml(message)}
                    </p>
                </div>

            </article>
        `;
    }

    async function publishDraft() {
        hideMessage();

        if (
            !state.draftId
            || !isValidationSuccessful()
        ) {
            showMessage(
                "La configuración debe estar guardada y validada.",
                "warning"
            );
            return;
        }

        state.isPublishing = true;
        elements.publishButton.textContent =
            "Publicando...";
        updateActionState();

        try {
            const response =
                await apiRequest(
                    `/ui/api/reconciliation/draft/${encodeURIComponent(
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
                                    elements.requestedBy.value.trim(),

                                active_flag:
                                    true,

                                execute_after_confirm:
                                    false,

                                business_date:
                                    null
                            })
                    }
                );

            state.publishedResponse =
                response;

            elements.publicationStatus.textContent =
                "PUBLICADO";

            elements.publicationStatus.className =
                "neutral-chip validation-status-valid";

            sessionStorage.removeItem(
                STORAGE_KEY
            );

            showMessage(
                "La cuadratura fue publicada y ya está disponible en el catálogo.",
                "success"
            );

            elements.publishButton.textContent =
                "Ir al catálogo";

            elements.publishButton.disabled =
                false;

            elements.publishButton.onclick =
                () => {
                    window.location.assign(
                        "/reconciliation"
                    );
                };

        } catch (error) {
            showMessage(
                "No se pudo publicar la cuadratura: "
                    + error.message,
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
        if (!elements.processName.value.trim()) {
            return {
                valid: false,
                message:
                    "El nombre del proceso es obligatorio."
            };
        }

        if (!isValidEmail(
            elements.requestedBy.value.trim()
        )) {
            return {
                valid: false,
                message:
                    "El responsable debe ser un correo válido."
            };
        }

        return {
            valid: true,
            message: ""
        };
    }

    function renderCurrentStep() {
        for (let step = 1; step <= 4; step += 1) {
            const panel =
                document.getElementById(
                    `wizard-step-${step}`
                );

            panel.hidden =
                step !== state.currentStep;
        }

        document
            .querySelectorAll("[data-step-target]")
            .forEach(button => {
                const step =
                    Number(
                        button.dataset.stepTarget
                    );

                button.classList.toggle(
                    "active",
                    step === state.currentStep
                );

                button.classList.toggle(
                    "completed",
                    step < state.currentStep
                );

                button.disabled =
                    step > state.currentStep;
            });

        elements.backButton.disabled =
            state.currentStep === 1;

        elements.nextButton.hidden =
            state.currentStep === 4;

        elements.saveButton.hidden =
            state.currentStep !== 4;

        elements.validateButton.hidden =
            state.currentStep !== 4;

        elements.publishButton.hidden =
            state.currentStep !== 4;

        if (state.currentStep === 4) {
            renderReview();
        }

        updateAdvisor();
        renderChecklist();
        updateActionState();
        persistLocalDraft();
    }

    function updateAdvisor() {
        const content = {
            1: {
                title:
                    "Selecciona las fuentes",
                message:
                    "Elige las tablas de origen y destino. El sistema consultará su metadata sin ejecutar SQL libre."
            },
            2: {
                title:
                    "Confirma el mapeo",
                message:
                    "Revisa las columnas comunes, selecciona las claves y confirma la columna de fecha."
            },
            3: {
                title:
                    "Define los controles",
                message:
                    "Selecciona las métricas numéricas y establece tolerancias proporcionales al proceso."
            },
            4: {
                title:
                    "Publica con control humano",
                message:
                    "Guarda el borrador, valida el contrato con el backend y confirma la publicación."
            }
        }[state.currentStep];

        elements.advisorTitle.textContent =
            content.title;

        elements.advisorMessage.textContent =
            content.message;
    }

    function renderChecklist() {
        const checklist = [
            {
                label:
                    "Origen y destino",
                valid:
                    isSourceSelectionComplete(),
                detail:
                    isSourceSelectionComplete()
                        ? "Fuentes seleccionadas"
                        : "Pendiente"
            },
            {
                label:
                    "Metadata compatible",
                valid:
                    state.commonColumns.length > 0,
                detail:
                    `${state.commonColumns.length} columnas comunes`
            },
            {
                label:
                    "Clave de negocio",
                valid:
                    getSelectedBusinessKeys().length > 0,
                detail:
                    getSelectedBusinessKeys().join(", ")
                    || "Pendiente"
            },
            {
                label:
                    "Métricas",
                valid:
                    state.currentStep < 3
                    || getSelectedSumColumns().length > 0
                    || true,
                detail:
                    `${getSelectedSumColumns().length} métricas`
            },
            {
                label:
                    "Borrador",
                valid:
                    Boolean(state.draftId),
                detail:
                    state.draftId || "Pendiente"
            },
            {
                label:
                    "Validación",
                valid:
                    isValidationSuccessful(),
                detail:
                    isValidationSuccessful()
                        ? "Válida"
                        : "Pendiente"
            }
        ];

        elements.checklist.innerHTML =
            checklist.map(item => `
                <div class="design-checklist-item">

                    <span class="${
                        item.valid
                            ? "checklist-success"
                            : "checklist-pending"
                    }">
                        ${item.valid ? "✓" : "○"}
                    </span>

                    <div>
                        <strong>
                            ${escapeHtml(item.label)}
                        </strong>

                        <small>
                            ${escapeHtml(item.detail)}
                        </small>
                    </div>

                </div>
            `).join("");
    }

    function updateActionState() {
        elements.saveButton.disabled =
            state.isSaving;

        elements.validateButton.disabled =
            state.isValidating
            || !state.draftId;

        elements.publishButton.disabled =
            state.isPublishing
            || !isValidationSuccessful();
    }

    function handleConfigurationChange() {
        invalidateDraft();
        renderChecklist();
        persistLocalDraft();
    }

    function invalidateDraft() {
        state.validationResponse = null;
        elements.validationSection.hidden =
            true;
    }

    function getSelectedBusinessKeys() {
        return Array.from(
            elements.businessKey.selectedOptions
        ).map(option => option.value);
    }

    function getSelectedSumColumns() {
        return Array.from(
            elements.sumColumnsGrid.querySelectorAll(
                'input[name="sum-column"]:checked'
            )
        ).map(input => input.value);
    }

    function resolveValidationStatus(response) {
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

    function persistLocalDraft() {
        sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                currentStep:
                    state.currentStep,

                draftId:
                    state.draftId,

                validationResponse:
                    state.validationResponse,

                values: {
                    sourceConnection:
                        elements.sourceConnection.value,

                    sourceDataset:
                        elements.sourceDataset.value,

                    sourceTable:
                        elements.sourceTable.value,

                    targetConnection:
                        elements.targetConnection.value,

                    targetDataset:
                        elements.targetDataset.value,

                    targetTable:
                        elements.targetTable.value,

                    processName:
                        elements.processName.value,

                    domainName:
                        elements.domainName.value,

                    description:
                        elements.description.value,

                    requestedBy:
                        elements.requestedBy.value,

                    rowTolerance:
                        elements.rowTolerance.value,

                    amountTolerance:
                        elements.amountTolerance.value,

                    sourceFilter:
                        elements.sourceFilter.value,

                    targetFilter:
                        elements.targetFilter.value
                }
            })
        );
    }

    function restoreLocalDraft() {
        const raw =
            sessionStorage.getItem(
                STORAGE_KEY
            );

        if (!raw) {
            return;
        }

        try {
            const saved =
                JSON.parse(raw);

            state.draftId =
                saved.draftId || null;

            state.validationResponse =
                saved.validationResponse
                || null;

            const values =
                saved.values || {};

            elements.processName.value =
                values.processName || "";

            elements.domainName.value =
                values.domainName || "";

            elements.description.value =
                values.description || "";

            elements.requestedBy.value =
                values.requestedBy
                || "julio.cordova@gmail.com";

            elements.rowTolerance.value =
                values.rowTolerance ?? 0;

            elements.amountTolerance.value =
                values.amountTolerance ?? 0;

            elements.sourceFilter.value =
                values.sourceFilter || "";

            elements.targetFilter.value =
                values.targetFilter || "";

        } catch {
            sessionStorage.removeItem(
                STORAGE_KEY
            );
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
        placeholderOption.textContent =
            placeholder;

        select.appendChild(
            placeholderOption
        );

        const seen =
            new Set();

        values.forEach(item => {
            const value =
                valueResolver(item);

            if (!value || seen.has(value)) {
                return;
            }

            seen.add(value);

            const option =
                document.createElement("option");

            option.value = value;
            option.textContent =
                labelResolver(item)
                || value;

            select.appendChild(option);
        });
    }

    function setSelectLoading(
        select,
        text
    ) {
        resetSelect(select, text);
        select.disabled = true;
    }

    function resetSelect(
        select,
        text
    ) {
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

    function selectMultipleValues(
        select,
        values
    ) {
        const selectedValues =
            new Set(values);

        Array.from(select.options)
            .forEach(option => {
                option.selected =
                    selectedValues.has(
                        option.value
                    );
            });
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
        ].some(value =>
            String(type).includes(value)
        );
    }

    function isDateType(type) {
        return [
            "DATE",
            "DATETIME",
            "TIMESTAMP"
        ].some(value =>
            String(type).includes(value)
        );
    }

    function isValidEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(value);
    }

    function getSessionId() {
        const key =
            "dataOpsReconciliationWizardSession";

        let value =
            sessionStorage.getItem(key);

        if (!value) {
            value =
                window.crypto?.randomUUID
                    ? window.crypto.randomUUID()
                    : `SESSION_${Date.now()}`;

            sessionStorage.setItem(
                key,
                value
            );
        }

        return value;
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

    function humanize(value) {
        return String(value || "")
            .replaceAll("_", " ")
            .replace(
                /\b\w/g,
                character =>
                    character.toUpperCase()
            );
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
        showMessage(
            "No fue posible iniciar el wizard: "
                + error.message,
            "error"
        );
    });
})();
