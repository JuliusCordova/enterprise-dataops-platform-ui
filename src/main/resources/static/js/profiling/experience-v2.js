(() => {
    "use strict";

    const ENDPOINTS = {
        connections: "/ui/api/profiling/connections",
        datasets: connectionId =>
            `/ui/api/profiling/metadata/${encodeURIComponent(connectionId)}/datasets`,
        tables: (connectionId, datasetId) =>
            `/ui/api/profiling/metadata/${encodeURIComponent(connectionId)}/${encodeURIComponent(datasetId)}/tables`,
        profile: "/ui/api/profiling/profile"
    };

    let currentStep = 1;
    let profile = null;

    const byId = id => document.getElementById(id);
    const elements = {
        connection: byId("p-connection"),
        dataset: byId("p-dataset"),
        table: byId("p-table"),
        schedule: byId("p-schedule"),
        status: byId("p-status"),
        progress: byId("p-progress"),
        kpis: byId("p-kpis"),
        rows: byId("p-rows"),
        columns: byId("p-cols"),
        completeness: byId("p-completeness"),
        key: byId("p-key"),
        tableWrap: byId("p-table-wrap"),
        columnBody: byId("p-columns"),
        summary: byId("p-summary"),
        coverage: byId("p-coverage"),
        coverageBar: byId("p-coverage-bar"),
        recommendations: byId("p-recommendations"),
        message: byId("p-message"),
        back: byId("p-back"),
        next: byId("p-next"),
        saveTask: byId("p-save-task"),
        quality: byId("p-quality"),
        copilotTitle: byId("p-copilot-title"),
        copilotMessage: byId("p-copilot-message")
    };

    const escapeHtml = value => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const numberOrNull = value => {
        if (value === null || value === undefined || value === "") {
            return null;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    };

    const extractArray = (payload, keys) => {
        if (Array.isArray(payload)) {
            return payload;
        }
        for (const key of keys) {
            if (Array.isArray(payload?.[key])) {
                return payload[key];
            }
        }
        return [];
    };

    const firstValue = (item, keys) => {
        if (typeof item === "string") {
            return item;
        }
        return keys.map(key => item?.[key]).find(value => value !== undefined && value !== null && value !== "") || "";
    };

    async function apiRequest(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: {
                Accept: "application/json",
                ...(options.headers || {})
            }
        });

        const contentType = response.headers.get("content-type") || "";
        const payload = contentType.includes("application/json")
            ? await response.json()
            : {message: await response.text()};

        if (!response.ok) {
            const detail = typeof payload.detail === "string"
                ? payload.detail
                : payload.message || `HTTP ${response.status}`;
            throw new Error(detail);
        }
        return payload;
    }

    function populateSelect(select, items, placeholder, valueResolver, labelResolver) {
        select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>`;
        const seen = new Set();
        items.forEach(item => {
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

    function resetSelect(select, placeholder) {
        select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>`;
    }

    function showMessage(text, type) {
        elements.message.hidden = false;
        elements.message.textContent = text;
        elements.message.className = `message dq-message message-${type}`;
    }

    function hideMessage() {
        elements.message.hidden = true;
    }

    async function loadConnections() {
        try {
            const payload = await apiRequest(ENDPOINTS.connections);
            const items = extractArray(payload, ["connections", "items", "data"]);
            populateSelect(
                elements.connection,
                items,
                "Selecciona una conexión",
                item => firstValue(item, ["connection_id", "id", "name"]),
                item => firstValue(item, ["display_name", "connection_name", "name", "connection_id"])
            );
            elements.connection.disabled = items.length === 0;
        } catch (error) {
            showMessage(`No se pudieron cargar las conexiones: ${error.message}`, "error");
        }
    }

    async function loadDatasets() {
        resetSelect(elements.table, "Selecciona un dataset");
        elements.table.disabled = true;

        if (!elements.connection.value) {
            resetSelect(elements.dataset, "Selecciona una conexión");
            elements.dataset.disabled = true;
            return;
        }

        try {
            const payload = await apiRequest(ENDPOINTS.datasets(elements.connection.value));
            const items = extractArray(payload, ["datasets", "items", "data"]);
            populateSelect(
                elements.dataset,
                items,
                "Selecciona un dataset",
                item => firstValue(item, ["dataset_id", "dataset_name", "name"]),
                item => firstValue(item, ["display_name", "dataset_name", "dataset_id", "name"])
            );
            elements.dataset.disabled = items.length === 0;
        } catch (error) {
            showMessage(`No se pudieron cargar los datasets: ${error.message}`, "error");
        }
    }

    async function loadTables() {
        if (!elements.connection.value || !elements.dataset.value) {
            return;
        }

        try {
            const payload = await apiRequest(
                ENDPOINTS.tables(elements.connection.value, elements.dataset.value)
            );
            const items = extractArray(payload, ["tables", "items", "data"]);
            populateSelect(
                elements.table,
                items,
                "Selecciona una tabla",
                item => firstValue(item, ["table_id", "table_name", "name"]),
                item => firstValue(item, ["display_name", "table_name", "table_id", "name"])
            );
            elements.table.disabled = items.length === 0;
        } catch (error) {
            showMessage(`No se pudieron cargar las tablas: ${error.message}`, "error");
        }
    }

    function normalizeProfile(payload) {
        const columns = extractArray(payload, ["columns", "profiles", "column_profiles", "data"])
            .map(column => ({
                name: column.column_name || column.name || column.field_name || "columna",
                type: column.data_type || column.type || "UNKNOWN",
                nullPercentage: numberOrNull(column.null_percentage ?? column.null_pct),
                distinctPercentage: numberOrNull(column.distinct_percentage ?? column.distinct_pct),
                semanticRole: column.semantic_role || column.role || column.business_role || "No informado"
            }));

        const recommendations = extractArray(payload, ["recommendations", "suggestions", "findings"])
            .map(item => ({
                title: item.title || item.name || item.recommendation || "Recomendación",
                reason: item.reason || item.description || item.message || "Sin detalle",
                confidence: String(item.confidence || item.confidence_level || "UNSPECIFIED").toUpperCase()
            }));

        return {
            rowCount: numberOrNull(payload.row_count ?? payload.rows ?? payload.total_rows),
            columnCount: numberOrNull(payload.column_count ?? payload.columns_count) ?? columns.length,
            completeness: numberOrNull(
                payload.completeness_percentage
                ?? payload.completeness
                ?? payload.average_completeness
            ),
            candidateKey: payload.candidate_key || payload.primary_key_candidate || payload.detected_key || null,
            coverage: numberOrNull(
                payload.coverage_percentage
                ?? payload.coverage
                ?? payload.profile_coverage
            ),
            summary: payload.summary || payload.executive_summary || payload.description || null,
            columns,
            recommendations
        };
    }

    function formatNumber(value) {
        return value === null ? "No informado" : new Intl.NumberFormat("es-PE").format(value);
    }

    function formatPercentage(value) {
        return value === null ? "No informado" : `${value.toFixed(1)}%`;
    }

    function renderProfile() {
        elements.rows.textContent = formatNumber(profile.rowCount);
        elements.columns.textContent = formatNumber(profile.columnCount);
        elements.completeness.textContent = formatPercentage(profile.completeness);
        elements.key.textContent = profile.candidateKey || "No informado";
        elements.kpis.hidden = false;
        elements.tableWrap.hidden = false;

        elements.columnBody.innerHTML = profile.columns.map(column => `
            <tr>
                <td><strong>${escapeHtml(column.name)}</strong></td>
                <td>${escapeHtml(column.type)}</td>
                <td>${formatPercentage(column.nullPercentage)}</td>
                <td>${formatPercentage(column.distinctPercentage)}</td>
                <td>${escapeHtml(column.semanticRole)}</td>
            </tr>
        `).join("");

        elements.summary.textContent = profile.summary
            || "El backend no devolvió un resumen ejecutivo para este profiling.";

        elements.coverage.textContent = formatPercentage(profile.coverage);
        elements.coverageBar.style.width = profile.coverage === null
            ? "0%"
            : `${Math.max(0, Math.min(100, profile.coverage))}%`;

        elements.recommendations.innerHTML = profile.recommendations.length > 0
            ? profile.recommendations.map(recommendation => `
                <article class="recommendation-item">
                    <div>
                        <strong>${escapeHtml(recommendation.title)}</strong>
                        <p>${escapeHtml(recommendation.reason)}</p>
                    </div>
                    <span class="confidence-chip confidence-${escapeHtml(recommendation.confidence.toLowerCase())}">${escapeHtml(recommendation.confidence)}</span>
                </article>
            `).join("")
            : '<article class="recommendation-item"><div><strong>Sin recomendaciones</strong><p>El backend no devolvió recomendaciones para este análisis.</p></div></article>';
    }

    async function runProfiling() {
        elements.status.textContent = "EJECUTANDO";
        elements.progress.hidden = false;
        try {
            const payload = await apiRequest(ENDPOINTS.profile, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    connection_id: elements.connection.value,
                    dataset_id: elements.dataset.value,
                    table_id: elements.table.value,
                    selected_columns: []
                })
            });
            profile = normalizeProfile(payload);
            renderProfile();
            elements.status.textContent = "COMPLETADO";
        } catch (error) {
            profile = null;
            elements.status.textContent = "ERROR";
            showMessage(`El profiling no pudo ejecutarse: ${error.message}`, "error");
        } finally {
            elements.progress.hidden = true;
        }
    }

    async function nextStep() {
        hideMessage();
        if (currentStep === 1) {
            if (!elements.connection.value || !elements.dataset.value || !elements.table.value) {
                showMessage("Selecciona conexión, dataset y tabla.", "warning");
                return;
            }
            currentStep = 2;
            render();
            await runProfiling();
            return;
        }
        if (currentStep === 2) {
            if (!profile) {
                showMessage("El profiling debe completar correctamente antes de mostrar el informe.", "warning");
                return;
            }
            currentStep = 3;
            render();
        }
    }

    function disableUnsupportedScheduling() {
        document.querySelectorAll('input[name="p-mode"]').forEach(input => {
            if (input.value === "SCHEDULED") {
                input.disabled = true;
                input.checked = false;
                input.title = "Programación no disponible: contrato backend no certificado";
            }
            if (input.value === "ON_DEMAND") {
                input.checked = true;
            }
        });
        if (elements.schedule) {
            elements.schedule.hidden = true;
        }
        if (elements.saveTask) {
            elements.saveTask.hidden = true;
            elements.saveTask.disabled = true;
        }
    }

    function render() {
        [1, 2, 3].forEach(step => {
            byId(`p-step-${step}`).hidden = step !== currentStep;
        });
        document.querySelectorAll("[data-step]").forEach(node => {
            const step = Number(node.dataset.step);
            node.classList.toggle("active", step === currentStep);
            node.classList.toggle("completed", step < currentStep);
        });

        elements.back.disabled = currentStep === 1;
        elements.next.hidden = currentStep === 3;
        elements.quality.hidden = currentStep !== 3;
        if (currentStep < 3) {
            elements.next.textContent = currentStep === 1 ? "Analizar tabla" : "Ver informe";
        }

        const copy = {
            1: ["Selecciona una tabla", "La ejecución disponible es a demanda."],
            2: ["Analizando el activo", "Las métricas son calculadas exclusivamente por el backend."],
            3: ["Comprende los hallazgos", "La interfaz presenta únicamente resultados devueltos por el servicio."]
        }[currentStep];
        elements.copilotTitle.textContent = copy[0];
        elements.copilotMessage.textContent = copy[1];
    }

    elements.connection.addEventListener("change", loadDatasets);
    elements.dataset.addEventListener("change", loadTables);
    elements.back.addEventListener("click", () => {
        if (currentStep > 1) {
            currentStep -= 1;
            render();
        }
    });
    elements.next.addEventListener("click", nextStep);

    disableUnsupportedScheduling();
    loadConnections().then(render);
})();
