(() => {
    "use strict";

    const STORAGE_KEY =
        "dataOpsReconciliationExecution";

    const state = {
        configurations: [],
        filteredConfigurations: [],
        selectedConfiguration: null,
        isExecuting: false,
        isAsking: false
    };

    const count =
        document.getElementById(
            "reconciliation-count"
        );

    const search =
        document.getElementById(
            "reconciliation-search"
        );

    const domainFilter =
        document.getElementById(
            "reconciliation-domain-filter"
        );

    const loading =
        document.getElementById(
            "reconciliation-loading"
        );

    const list =
        document.getElementById(
            "reconciliation-list"
        );

    const empty =
        document.getElementById(
            "reconciliation-empty"
        );

    const selectedSummary =
        document.getElementById(
            "selected-reconciliation-summary"
        );

    const selectedName =
        document.getElementById(
            "selected-reconciliation-name"
        );

    const selectedSource =
        document.getElementById(
            "selected-reconciliation-source"
        );

    const selectedTarget =
        document.getElementById(
            "selected-reconciliation-target"
        );

    const assistantMessage =
        document.getElementById(
            "reconciliation-assistant-message"
        );

    const businessDate =
        document.getElementById(
            "reconciliation-business-date"
        );

    const requestedBy =
        document.getElementById(
            "reconciliation-requested-by"
        );

    const executeButton =
        document.getElementById(
            "execute-reconciliation-button"
        );

    const message =
        document.getElementById(
            "reconciliation-message"
        );

    const question =
        document.getElementById(
            "reconciliation-question"
        );

    const askButton =
        document.getElementById(
            "ask-reconciliation-button"
        );

    const agentResponse =
        document.getElementById(
            "reconciliation-agent-response"
        );

    async function initialize() {
        bindEvents();
        setDefaultBusinessDate();
        await loadConfigurations();
    }

    function bindEvents() {
        search.addEventListener(
            "input",
            applyFilters
        );

        domainFilter.addEventListener(
            "change",
            applyFilters
        );

        businessDate.addEventListener(
            "change",
            updateExecuteButton
        );

        requestedBy.addEventListener(
            "input",
            updateExecuteButton
        );

        executeButton.addEventListener(
            "click",
            executeReconciliation
        );

        askButton.addEventListener(
            "click",
            askAgent
        );
    }

    function setDefaultBusinessDate() {
        const today =
            new Date();

        businessDate.value =
            today.toISOString()
                .slice(0, 10);
    }

    async function loadConfigurations() {
        loading.hidden = false;
        empty.hidden = true;

        try {
            const payload =
                await apiRequest(
                    "/ui/api/reconciliation/configs"
                );

            state.configurations =
                extractConfigurations(
                    payload
                );

            state.filteredConfigurations =
                [...state.configurations];

            populateDomainFilter();
            renderConfigurations();

        } catch (error) {
            showMessage(
                "No se pudieron cargar las cuadraturas: "
                    + error.message,
                "error"
            );

        } finally {
            loading.hidden = true;
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
                        configuration =>
                            configuration.domain_name
                            || ""
                    )
                    .filter(Boolean)
            )
        ].sort();

        domainFilter.innerHTML =
            '<option value="">Todos los dominios</option>';

        domains.forEach(domain => {
            const option =
                document.createElement(
                    "option"
                );

            option.value = domain;
            option.textContent = domain;

            domainFilter.appendChild(
                option
            );
        });
    }

    function applyFilters() {
        const searchValue =
            search.value
                .trim()
                .toLowerCase();

        const domainValue =
            domainFilter.value;

        state.filteredConfigurations =
            state.configurations.filter(
                configuration => {
                    const searchableText = [
                        configuration.reconciliation_id,
                        configuration.process_name,
                        configuration.domain_name,
                        configuration.source_dataset,
                        configuration.source_table,
                        configuration.target_dataset,
                        configuration.target_table
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();

                    const matchesSearch =
                        !searchValue
                        || searchableText.includes(
                            searchValue
                        );

                    const matchesDomain =
                        !domainValue
                        || configuration.domain_name
                            === domainValue;

                    return (
                        matchesSearch
                        && matchesDomain
                    );
                }
            );

        renderConfigurations();
    }

    function renderConfigurations() {
        list.innerHTML = "";

        count.textContent =
            `${state.filteredConfigurations.length} configuraciones`;

        empty.hidden =
            state.filteredConfigurations.length > 0;

        state.filteredConfigurations
            .forEach(configuration => {
                list.appendChild(
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
            document.createElement(
                "article"
            );

        const selected =
            state.selectedConfiguration
                ?.reconciliation_id
            === configuration.reconciliation_id;

        article.className =
            "reconciliation-card"
            + (
                selected
                    ? " reconciliation-card-selected"
                    : ""
            );

        const source =
            buildSourcePath(
                configuration,
                "source"
            );

        const target =
            buildSourcePath(
                configuration,
                "target"
            );

        article.innerHTML = `
            <div class="reconciliation-card-top">

                <div>

                    <span class="module-status">
                        ${escapeHtml(
                            configuration.domain_name
                            || "Sin dominio"
                        )}
                    </span>

                    <h3>
                        ${escapeHtml(
                            configuration.process_name
                            || configuration.reconciliation_id
                        )}
                    </h3>

                    <p>
                        ${escapeHtml(
                            configuration.description
                            || "Configuración activa de reconciliación."
                        )}
                    </p>

                </div>

                <span class="table-status table-status-conforme">
                    ACTIVA
                </span>

            </div>

            <div class="reconciliation-flow">

                <div>

                    <span>Origen</span>

                    <strong>
                        ${escapeHtml(source)}
                    </strong>

                </div>

                <span class="reconciliation-arrow">
                    →
                </span>

                <div>

                    <span>Destino</span>

                    <strong>
                        ${escapeHtml(target)}
                    </strong>

                </div>

            </div>

            <button
                type="button"
                class="enterprise-button enterprise-button-secondary select-reconciliation-button">

                ${
                    selected
                        ? "Seleccionada"
                        : "Seleccionar"
                }

            </button>
        `;

        article
            .querySelector(
                ".select-reconciliation-button"
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
            configuration.process_name
            || configuration.reconciliation_id;

        selectedSource.textContent =
            buildSourcePath(
                configuration,
                "source"
            );

        selectedTarget.textContent =
            buildSourcePath(
                configuration,
                "target"
            );

        assistantMessage.textContent =
            "La cuadratura está lista. Selecciona la fecha de negocio y ejecuta la validación.";

        renderConfigurations();
        updateExecuteButton();
        hideMessage();
    }

    function updateExecuteButton() {
        executeButton.disabled =
            state.isExecuting
            || !state.selectedConfiguration
            || !businessDate.value
            || !isValidEmail(
                requestedBy.value.trim()
            );
    }

    async function executeReconciliation() {
        hideMessage();

        if (!state.selectedConfiguration) {
            showMessage(
                "Selecciona una cuadratura.",
                "warning"
            );
            return;
        }

        state.isExecuting = true;
        executeButton.textContent =
            "Ejecutando cuadratura...";

        updateExecuteButton();

        try {
            const request = {
                reconciliation_id:
                    state.selectedConfiguration
                        .reconciliation_id,

                business_date:
                    businessDate.value,

                requested_by:
                    requestedBy.value.trim()
            };

            const response =
                await apiRequest(
                    "/ui/api/reconciliation/execute",
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
                    response
                );

            if (!executionId) {
                throw new Error(
                    "El backend no devolvió execution_id."
                );
            }

            sessionStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    executionId,
                    configuration:
                        state.selectedConfiguration,
                    request,
                    executionResponse:
                        response
                })
            );

            window.location.assign(
                "/reconciliation/result"
            );

        } catch (error) {
            showMessage(
                "No se pudo ejecutar la cuadratura: "
                    + error.message,
                "error"
            );

        } finally {
            state.isExecuting = false;
            executeButton.textContent =
                "Ejecutar cuadratura";

            updateExecuteButton();
        }
    }

    async function askAgent() {
        const questionValue =
            question.value.trim();

        if (!questionValue) {
            return;
        }

        state.isAsking = true;
        askButton.disabled = true;
        askButton.textContent =
            "Consultando...";

        agentResponse.hidden = false;
        agentResponse.textContent =
            "Analizando la solicitud…";

        try {
            const response =
                await apiRequest(
                    "/ui/api/reconciliation/ask",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body:
                            JSON.stringify({
                                question:
                                    questionValue,

                                user_email:
                                    requestedBy.value
                                        .trim(),

                                session_id:
                                    getOrCreateSessionId()
                            })
                    }
                );

            agentResponse.textContent =
                response.answer
                || response.message
                || response.executive_summary
                || JSON.stringify(
                    response,
                    null,
                    2
                );

        } catch (error) {
            agentResponse.textContent =
                "No fue posible consultar al agente: "
                + error.message;

        } finally {
            state.isAsking = false;
            askButton.disabled = false;
            askButton.textContent =
                "Consultar agente";
        }
    }

    function buildSourcePath(
        configuration,
        prefix
    ) {
        const project =
            configuration[
                `${prefix}_project`
            ];

        const dataset =
            configuration[
                `${prefix}_dataset`
            ];

        const table =
            configuration[
                `${prefix}_table`
            ];

        return [
            project,
            dataset,
            table
        ]
            .filter(Boolean)
            .join(".");
    }

    function extractExecutionId(
        response
    ) {
        return (
            response.execution_id
            || response.execution
                ?.execution_id
            || response.result
                ?.execution_id
            || response.data
                ?.execution_id
            || null
        );
    }

    function getOrCreateSessionId() {
        const key =
            "dataOpsReconciliationSessionId";

        let sessionId =
            sessionStorage.getItem(key);

        if (!sessionId) {
            sessionId =
                window.crypto?.randomUUID
                    ? window.crypto.randomUUID()
                    : (
                        "SESSION_"
                        + Date.now()
                    );

            sessionStorage.setItem(
                key,
                sessionId
            );
        }

        return sessionId;
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

    function isValidEmail(
        value
    ) {
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

    function escapeHtml(
        value
    ) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    initialize().catch(error => {
        showMessage(
            "No fue posible inicializar Data Reconciliation: "
                + error.message,
            "error"
        );
    });
})();
