(() => {
    "use strict";

    const EXECUTION_STORAGE_KEY =
        "dataOpsQualityExecutionResult";

    const state = {
        configurations: [],
        filteredConfigurations: [],
        selectedConfiguration: null,
        isExecuting: false
    };

    const configCount =
        document.getElementById("config-count");

    const configSearch =
        document.getElementById("config-search");

    const domainFilter =
        document.getElementById("domain-filter");

    const configLoading =
        document.getElementById("config-loading");

    const configList =
        document.getElementById("config-list");

    const configEmpty =
        document.getElementById("config-empty");

    const assistantMessage =
        document.getElementById(
            "execution-assistant-message"
        );

    const selectedSummary =
        document.getElementById(
            "selected-config-summary"
        );

    const selectedName =
        document.getElementById(
            "selected-config-name"
        );

    const selectedTable =
        document.getElementById(
            "selected-config-table"
        );

    const selectedDomain =
        document.getElementById(
            "selected-config-domain"
        );

    const businessDate =
        document.getElementById(
            "business-date"
        );

    const executionMode =
        document.getElementById(
            "execution-mode"
        );

    const requestedBy =
        document.getElementById(
            "execution-requested-by"
        );

    const executeButton =
        document.getElementById(
            "execute-quality-button"
        );

    const message =
        document.getElementById(
            "execution-message"
        );

    async function initialize() {
        bindEvents();
        await loadConfigurations();
    }

    function bindEvents() {
        configSearch.addEventListener(
            "input",
            applyFilters
        );

        domainFilter.addEventListener(
            "change",
            applyFilters
        );

        executeButton.addEventListener(
            "click",
            executeQualityAssessment
        );

        requestedBy.addEventListener(
            "input",
            updateExecuteButton
        );
    }

    async function apiRequest(
        url,
        options = {}
    ) {
        const response = await fetch(
            url,
            {
                ...options,
                headers: {
                    "Accept": "application/json",
                    ...(options.headers || {})
                }
            }
        );

        const contentType =
            response.headers.get(
                "content-type"
            ) || "";

        let payload = {};

        if (
            contentType.includes(
                "application/json"
            )
        ) {
            payload = await response.json();

        } else {
            payload = {
                message:
                    await response.text()
            };
        }

        if (!response.ok) {
            throw new Error(
                resolveErrorMessage(
                    payload,
                    response.status
                )
            );
        }

        return payload;
    }

    function resolveErrorMessage(
        payload,
        status
    ) {
        if (
            typeof payload?.detail === "string"
        ) {
            return payload.detail;
        }

        if (
            typeof payload?.message === "string"
        ) {
            return payload.message;
        }

        return `Error HTTP ${status}`;
    }

    async function loadConfigurations() {
        configLoading.hidden = false;
        configEmpty.hidden = true;
        configList.innerHTML = "";

        try {
            const payload = await apiRequest(
                "/ui/api/quality-execution/configs?activeOnly=true"
            );

            state.configurations =
                extractConfigurations(payload);

            state.filteredConfigurations =
                [...state.configurations];

            populateDomainFilter();
            renderConfigurations();

        } catch (error) {
            showMessage(
                "No se pudieron cargar las configuraciones: "
                    + error.message,
                "error"
            );

        } finally {
            configLoading.hidden = true;
        }
    }

    function extractConfigurations(
        payload
    ) {
        const candidates = [
            payload.configurations,
            payload.configs,
            payload.items,
            payload.data
        ];

        for (const candidate of candidates) {
            if (Array.isArray(candidate)) {
                return candidate;
            }
        }

        return Array.isArray(payload)
            ? payload
            : [];
    }

    function populateDomainFilter() {
        const domains = [
            ...new Set(
                state.configurations
                    .map(
                        item =>
                            item.domain_name
                            || ""
                    )
                    .filter(Boolean)
            )
        ].sort();

        domainFilter.innerHTML =
            '<option value="">Todos los dominios</option>';

        domains.forEach(domain => {
            const option =
                document.createElement("option");

            option.value = domain;
            option.textContent = domain;

            domainFilter.appendChild(option);
        });
    }

    function applyFilters() {
        const searchText =
            configSearch.value
                .trim()
                .toLowerCase();

        const selectedDomain =
            domainFilter.value;

        state.filteredConfigurations =
            state.configurations.filter(
                configuration => {
                    const searchableText = [
                        configuration.quality_config_id,
                        configuration.config_name,
                        configuration.domain_name,
                        configuration.dataset_id,
                        configuration.table_id,
                        configuration.description
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();

                    const matchesSearch =
                        !searchText
                        || searchableText.includes(
                            searchText
                        );

                    const matchesDomain =
                        !selectedDomain
                        || configuration.domain_name
                            === selectedDomain;

                    return (
                        matchesSearch
                        && matchesDomain
                    );
                }
            );

        renderConfigurations();
    }

    function renderConfigurations() {
        configList.innerHTML = "";

        configCount.textContent =
            `${state.filteredConfigurations.length} configuraciones`;

        configEmpty.hidden =
            state.filteredConfigurations.length > 0;

        state.filteredConfigurations
            .forEach(configuration => {
                configList.appendChild(
                    createConfigurationCard(
                        configuration
                    )
                );
            });
    }

    function createConfigurationCard(
        configuration
    ) {
        const article =
            document.createElement("article");

        const selected =
            state.selectedConfiguration
            ?.quality_config_id
            === configuration.quality_config_id;

        article.className =
            "execution-config-card"
            + (
                selected
                    ? " execution-config-card-selected"
                    : ""
            );

        const selectedColumns =
            Array.isArray(
                configuration.selected_columns
            )
                ? configuration.selected_columns
                : [];

        article.innerHTML = `
            <div class="execution-config-card-header">

                <div>

                    <span class="module-status">
                        ${escapeHtml(
                            configuration.domain_name
                            || "Sin dominio"
                        )}
                    </span>

                    <h3>
                        ${escapeHtml(
                            configuration.config_name
                            || configuration.quality_config_id
                        )}
                    </h3>

                    <p>
                        ${escapeHtml(
                            configuration.description
                            || "Configuración activa de calidad de datos."
                        )}
                    </p>

                </div>

                <span class="table-status table-status-conforme">
                    ACTIVA
                </span>

            </div>

            <div class="execution-config-metadata">

                <div>
                    <span>Tabla</span>
                    <strong>
                        ${escapeHtml(
                            `${configuration.dataset_id}.${configuration.table_id}`
                        )}
                    </strong>
                </div>

                <div>
                    <span>Columnas</span>
                    <strong>
                        ${selectedColumns.length}
                    </strong>
                </div>

                <div>
                    <span>Modo</span>
                    <strong>
                        ${escapeHtml(
                            configuration.configuration_mode
                            || "MANUAL"
                        )}
                    </strong>
                </div>

            </div>

            <button
                class="outline-button select-config-button"
                type="button">
                ${
                    selected
                        ? "Seleccionada"
                        : "Seleccionar"
                }
            </button>
        `;

        article
            .querySelector(
                ".select-config-button"
            )
            .addEventListener(
                "click",
                () => {
                    selectConfiguration(
                        configuration
                    );
                }
            );

        return article;
    }

    function selectConfiguration(
        configuration
    ) {
        state.selectedConfiguration =
            configuration;

        selectedSummary.hidden = false;

        selectedName.textContent =
            configuration.config_name
            || configuration.quality_config_id;

        selectedTable.textContent =
            `${configuration.dataset_id}.${configuration.table_id}`;

        selectedDomain.textContent =
            configuration.domain_name
            || "Sin dominio";

        assistantMessage.textContent =
            "La configuración está lista. Puedes ejecutar una evaluación completa o indicar una fecha de negocio.";

        renderConfigurations();
        updateExecuteButton();
        hideMessage();
    }

    function updateExecuteButton() {
        executeButton.disabled =
            state.isExecuting
            || !state.selectedConfiguration
            || !isValidEmail(
                requestedBy.value.trim()
            );
    }

    async function executeQualityAssessment() {
        hideMessage();

        if (!state.selectedConfiguration) {
            showMessage(
                "Selecciona una configuración.",
                "warning"
            );
            return;
        }

        state.isExecuting = true;
        executeButton.textContent =
            "Ejecutando reglas...";

        updateExecuteButton();

        try {
            const request = {
                quality_config_id:
                    state.selectedConfiguration
                        .quality_config_id,

                business_date:
                    businessDate.value
                    || null,

                requested_by:
                    requestedBy.value.trim(),

                execution_mode:
                    executionMode.value
            };

            const executionResponse =
                await apiRequest(
                    "/ui/api/quality-execution/execute",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body:
                            JSON.stringify(
                                request
                            )
                    }
                );

            const executionId =
                extractExecutionId(
                    executionResponse
                );

            if (!executionId) {
                throw new Error(
                    "El backend no devolvió execution_id."
                );
            }

            sessionStorage.setItem(
                EXECUTION_STORAGE_KEY,
                JSON.stringify({
                    executionId,
                    configuration:
                        state.selectedConfiguration,
                    request,
                    executionResponse
                })
            );

            window.location.assign(
                "/quality-execution/result"
            );

        } catch (error) {
            showMessage(
                "No se pudo ejecutar la evaluación: "
                    + error.message,
                "error"
            );

        } finally {
            state.isExecuting = false;

            executeButton.textContent =
                "Ejecutar evaluación";

            updateExecuteButton();
        }
    }

    function extractExecutionId(
        response
    ) {
        return (
            response?.execution_id
            || response?.execution
                ?.execution_id
            || response?.result
                ?.execution_id
            || response?.data
                ?.execution_id
            || null
        );
    }

    function isValidEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(value);
    }

    function showMessage(
        text,
        type = "info"
    ) {
        message.hidden = false;
        message.textContent = text;
        message.className =
            `message message-${type}`;
    }

    function hideMessage() {
        message.hidden = true;
        message.textContent = "";
        message.className = "message";
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    initialize().catch(error => {
        showMessage(
            "No fue posible inicializar Quality Execution: "
                + error.message,
            "error"
        );
    });
})();
