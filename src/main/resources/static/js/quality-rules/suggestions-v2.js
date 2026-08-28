(() => {
    "use strict";

    const ENDPOINTS = {
        connections: "/ui/api/profiling/connections",
        datasets: connectionId =>
            `/ui/api/profiling/metadata/${encodeURIComponent(connectionId)}/datasets`,
        tables: (connectionId, datasetId) =>
            `/ui/api/profiling/metadata/${encodeURIComponent(connectionId)}/${encodeURIComponent(datasetId)}/tables`,
        suggestions: "/ui/api/quality-rules/suggestions",
        draft: "/ui/api/quality-rules/draft",
        validate: draftId =>
            `/ui/api/quality-rules/draft/${encodeURIComponent(draftId)}/validate`,
        publish: draftId =>
            `/ui/api/quality-rules/draft/${encodeURIComponent(draftId)}/confirm`
    };

    let currentStep = 1;
    let suggestions = [];
    let selectedRuleIds = new Set();
    let editingRuleId = null;
    let draftId = null;
    let validated = false;
    let suggestionMetadata = {};

    const byId = id => document.getElementById(id);
    const elements = {
        connection: byId("q-connection"),
        dataset: byId("q-dataset"),
        table: byId("q-table"),
        refresh: byId("q-refresh"),
        summary: byId("q-summary"),
        dimension: byId("q-dimension"),
        confidence: byId("q-confidence"),
        selectAll: byId("q-select-all"),
        body: byId("q-body"),
        coverage: byId("q-coverage"),
        coverageBar: byId("q-coverage-bar"),
        selected: byId("q-selected"),
        schedule: byId("q-schedule"),
        owner: byId("q-owner"),
        validation: byId("q-validation"),
        status: byId("q-status"),
        message: byId("q-message"),
        back: byId("q-back"),
        next: byId("q-next"),
        save: byId("q-save"),
        validate: byId("q-validate"),
        publish: byId("q-publish"),
        copilotTitle: byId("q-copilot-title"),
        copilotMessage: byId("q-copilot-message"),
        dialog: byId("q-dialog"),
        dialogTitle: byId("q-dialog-title"),
        dialogName: byId("q-dialog-name"),
        dialogWarning: byId("q-dialog-warning"),
        dialogCritical: byId("q-dialog-critical"),
        dialogDescription: byId("q-dialog-description"),
        dialogSave: byId("q-dialog-save")
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
        invalidatePersistedState();

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
        invalidatePersistedState();
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

    function profileMode() {
        return document.querySelector('input[name="q-profile-mode"]:checked')?.value || "LATEST_PROFILE";
    }

    function executionMode() {
        return "ON_DEMAND";
    }

    function normalizeSuggestions(payload) {
        suggestionMetadata = payload?.metadata || payload?.summary || {};
        return extractArray(payload, ["suggestions", "rules", "items", "data"]).map((rule, index) => ({
            id: rule.rule_id || rule.id || `SERVER_RULE_${index}`,
            name: rule.rule_name || rule.name || `Regla_${index + 1}`,
            type: rule.rule_type || rule.type || "CUSTOM",
            column: rule.column_name || rule.column || "—",
            description: rule.rule_description || rule.description || "Sin descripción",
            dimension: String(rule.rule_dimension || rule.dimension || "UNSPECIFIED").toUpperCase(),
            confidence: String(rule.confidence || rule.confidence_level || "UNSPECIFIED").toUpperCase(),
            warning: numberOrNull(rule.warning_threshold),
            critical: numberOrNull(rule.critical_threshold)
        }));
    }

    async function generateSuggestions() {
        suggestions = [];
        selectedRuleIds = new Set();
        suggestionMetadata = {};
        renderTable();

        try {
            const payload = await apiRequest(ENDPOINTS.suggestions, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    connection_id: elements.connection.value,
                    dataset_id: elements.dataset.value,
                    table_id: elements.table.value,
                    profile_mode: profileMode()
                })
            });
            suggestions = normalizeSuggestions(payload);
            selectedRuleIds = new Set(
                suggestions
                    .filter(rule => rule.confidence === "HIGH")
                    .map(rule => rule.id)
            );
            if (suggestions.length === 0) {
                showMessage("El backend no devolvió sugerencias de reglas.", "warning");
            }
        } catch (error) {
            showMessage(
                `No se pudieron obtener sugerencias del backend: ${error.message}. No se generaron reglas locales.`,
                "error"
            );
        }
        renderTable();
    }

    function filteredSuggestions() {
        return suggestions.filter(rule =>
            (!elements.dimension.value || rule.dimension === elements.dimension.value)
            && (!elements.confidence.value || rule.confidence === elements.confidence.value)
        );
    }

    function renderTable() {
        const rules = filteredSuggestions();
        elements.body.innerHTML = rules.map(rule => `
            <tr>
                <td><input type="checkbox" data-select="${escapeHtml(rule.id)}" ${selectedRuleIds.has(rule.id) ? "checked" : ""}></td>
                <td><strong>${escapeHtml(rule.name)}</strong></td>
                <td>${escapeHtml(rule.type)}</td>
                <td>${escapeHtml(rule.column)}</td>
                <td>${escapeHtml(rule.description)}</td>
                <td><span class="dimension-chip">${escapeHtml(rule.dimension)}</span></td>
                <td><span class="confidence-chip confidence-${escapeHtml(rule.confidence.toLowerCase())}">${escapeHtml(rule.confidence)}</span></td>
                <td><button class="table-action-button" data-edit="${escapeHtml(rule.id)}">Editar</button></td>
            </tr>
        `).join("");

        elements.body.querySelectorAll("[data-select]").forEach(input => {
            input.addEventListener("change", () => {
                input.checked
                    ? selectedRuleIds.add(input.dataset.select)
                    : selectedRuleIds.delete(input.dataset.select);
                invalidatePersistedState();
                updateSummary();
            });
        });
        elements.body.querySelectorAll("[data-edit]").forEach(button => {
            button.addEventListener("click", () => openDialog(button.dataset.edit));
        });
        elements.selectAll.checked = rules.length > 0 && rules.every(rule => selectedRuleIds.has(rule.id));
        updateSummary();
    }

    function updateSummary() {
        elements.summary.textContent = `${suggestions.length} sugerencias del backend · ${selectedRuleIds.size} seleccionadas`;
    }

    function openDialog(ruleId) {
        const rule = suggestions.find(item => item.id === ruleId);
        if (!rule) {
            return;
        }
        editingRuleId = ruleId;
        elements.dialogTitle.textContent = rule.name;
        elements.dialogName.value = rule.name;
        elements.dialogWarning.value = rule.warning ?? "";
        elements.dialogCritical.value = rule.critical ?? "";
        elements.dialogDescription.value = rule.description;
        elements.dialog.showModal();
    }

    function saveDialog() {
        const rule = suggestions.find(item => item.id === editingRuleId);
        if (!rule) {
            return;
        }
        rule.name = elements.dialogName.value.trim() || rule.name;
        rule.warning = numberOrNull(elements.dialogWarning.value);
        rule.critical = numberOrNull(elements.dialogCritical.value);
        rule.description = elements.dialogDescription.value.trim() || rule.description;
        invalidatePersistedState();
        elements.dialog.close();
        renderTable();
    }

    function selectedRules() {
        return suggestions.filter(rule => selectedRuleIds.has(rule.id));
    }

    function renderSelectedRules() {
        const rules = selectedRules();
        elements.selected.innerHTML = rules.map(rule => `
            <article class="selected-rule-card">
                <header>
                    <div><h3>${escapeHtml(rule.name)}</h3><p>${escapeHtml(rule.column)} · ${escapeHtml(rule.dimension)}</p></div>
                    <button class="table-action-button" data-edit-selected="${escapeHtml(rule.id)}">Editar</button>
                </header>
                <div class="selected-rule-thresholds">
                    <div class="form-field"><label>Advertencia</label><input type="number" step="0.01" value="${rule.warning ?? ""}" data-warning="${escapeHtml(rule.id)}"></div>
                    <div class="form-field"><label>Crítico</label><input type="number" step="0.01" value="${rule.critical ?? ""}" data-critical="${escapeHtml(rule.id)}"></div>
                </div>
            </article>
        `).join("");

        elements.selected.querySelectorAll("[data-edit-selected]").forEach(button => {
            button.addEventListener("click", () => openDialog(button.dataset.editSelected));
        });
        elements.selected.querySelectorAll("[data-warning]").forEach(input => {
            input.addEventListener("change", () => {
                const rule = suggestions.find(item => item.id === input.dataset.warning);
                if (rule) {
                    rule.warning = numberOrNull(input.value);
                    invalidatePersistedState();
                }
            });
        });
        elements.selected.querySelectorAll("[data-critical]").forEach(input => {
            input.addEventListener("change", () => {
                const rule = suggestions.find(item => item.id === input.dataset.critical);
                if (rule) {
                    rule.critical = numberOrNull(input.value);
                    invalidatePersistedState();
                }
            });
        });

        const coverage = numberOrNull(
            suggestionMetadata.coverage_percentage
            ?? suggestionMetadata.coverage
            ?? suggestionMetadata.coverage_pct
        );
        elements.coverage.textContent = coverage === null ? "No informado" : `${coverage.toFixed(1)}%`;
        elements.coverageBar.style.width = coverage === null ? "0%" : `${Math.max(0, Math.min(100, coverage))}%`;
    }

    async function nextStep() {
        hideMessage();
        if (currentStep === 1) {
            if (!elements.connection.value || !elements.dataset.value || !elements.table.value) {
                showMessage("Selecciona conexión, dataset y tabla.", "warning");
                return;
            }
            await generateSuggestions();
            if (suggestions.length === 0) {
                return;
            }
            currentStep = 2;
            render();
            return;
        }
        if (currentStep === 2) {
            if (selectedRuleIds.size === 0) {
                showMessage("Selecciona al menos una regla.", "warning");
                return;
            }
            currentStep = 3;
            render();
        }
    }

    function buildPayload() {
        return {
            config_name: `Calidad de ${elements.dataset.value}.${elements.table.value}`,
            connection_id: elements.connection.value,
            dataset_id: elements.dataset.value,
            table_id: elements.table.value,
            owner_email: elements.owner.value.trim(),
            execution_mode: executionMode(),
            rules: selectedRules().map(rule => ({
                rule_name: rule.name,
                rule_type: rule.type,
                column_name: rule.column,
                rule_dimension: rule.dimension,
                description: rule.description,
                warning_threshold: rule.warning,
                critical_threshold: rule.critical,
                confidence: rule.confidence
            }))
        };
    }

    async function saveDraft() {
        invalidatePersistedState();
        try {
            const payload = await apiRequest(ENDPOINTS.draft, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(buildPayload())
            });
            const persistedDraftId = payload.draft_id || payload.data?.draft_id;
            if (!persistedDraftId) {
                throw new Error("El backend respondió sin draft_id");
            }
            draftId = persistedDraftId;
            elements.status.textContent = "GUARDADO";
            showMessage(`Borrador ${draftId} guardado en backend.`, "success");
            return true;
        } catch (error) {
            draftId = null;
            elements.status.textContent = "NO GUARDADO";
            showMessage(`No se pudo guardar el borrador: ${error.message}`, "error");
            return false;
        }
    }

    async function validateDraft() {
        if (!draftId) {
            const saved = await saveDraft();
            if (!saved) {
                return;
            }
        }

        try {
            const payload = await apiRequest(ENDPOINTS.validate(draftId), {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: "{}"
            });
            const isValid = payload.valid ?? payload.is_valid ?? payload.data?.valid ?? true;
            if (!isValid) {
                throw new Error(payload.message || "El backend reportó una configuración inválida");
            }
            validated = true;
            elements.validation.hidden = false;
            elements.validation.innerHTML = `
                <article class="validation-checklist-item">
                    <span class="validation-icon-success">✓</span>
                    <div><strong>Validación backend aprobada</strong><p>La configuración fue validada por el servicio.</p></div>
                </article>`;
            elements.publish.disabled = false;
            elements.status.textContent = "VALIDADO";
            showMessage("La configuración está lista para publicar.", "success");
        } catch (error) {
            validated = false;
            elements.publish.disabled = true;
            elements.status.textContent = "OBSERVADO";
            showMessage(`No se pudo validar: ${error.message}`, "error");
        }
    }

    async function publishDraft() {
        if (!validated || !draftId) {
            showMessage("Guarda y valida la configuración antes de publicar.", "warning");
            return;
        }

        try {
            const payload = await apiRequest(ENDPOINTS.publish(draftId), {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    confirmed_by: elements.owner.value.trim(),
                    active_flag: true
                })
            });
            const publishedId = payload.quality_config_id
                || payload.config_id
                || payload.data?.quality_config_id
                || payload.data?.config_id;
            if (!publishedId) {
                throw new Error("El backend respondió sin identificador de configuración publicada");
            }
            elements.status.textContent = "PUBLICADO";
            elements.publish.disabled = true;
            elements.publish.textContent = "Reglas publicadas";
            showMessage(`Configuración ${publishedId} publicada correctamente.`, "success");
        } catch (error) {
            elements.status.textContent = "NO PUBLICADO";
            showMessage(`No se pudieron publicar las reglas: ${error.message}`, "error");
        }
    }

    function invalidatePersistedState() {
        draftId = null;
        validated = false;
        elements.publish.disabled = true;
        if (elements.status) {
            elements.status.textContent = "BORRADOR";
        }
    }

    function disableUnsupportedScheduling() {
        document.querySelectorAll('input[name="q-exec-mode"]').forEach(input => {
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
    }

    function render() {
        [1, 2, 3].forEach(step => {
            byId(`q-step-${step}`).hidden = step !== currentStep;
        });
        document.querySelectorAll("[data-q-step]").forEach(node => {
            const step = Number(node.dataset.qStep);
            node.classList.toggle("active", step === currentStep);
            node.classList.toggle("completed", step < currentStep);
        });

        elements.back.disabled = currentStep === 1;
        elements.next.hidden = currentStep === 3;
        elements.save.hidden = currentStep !== 3;
        elements.validate.hidden = currentStep !== 3;
        elements.publish.hidden = currentStep !== 3;

        if (currentStep < 3) {
            elements.next.textContent = currentStep === 1
                ? "Generar sugerencias"
                : "Configurar seleccionadas";
        }
        if (currentStep === 2) {
            renderTable();
        }
        if (currentStep === 3) {
            renderSelectedRules();
        }

        const copy = {
            1: ["Selecciona el activo", "Las sugerencias serán solicitadas al backend."],
            2: ["Revisa recomendaciones", "Solo se muestran reglas devueltas por el servicio."],
            3: ["Configura y publica", "Guardar, validar y publicar requieren persistencia real."]
        }[currentStep];
        elements.copilotTitle.textContent = copy[0];
        elements.copilotMessage.textContent = copy[1];
    }

    elements.connection.addEventListener("change", loadDatasets);
    elements.dataset.addEventListener("change", loadTables);
    elements.table.addEventListener("change", invalidatePersistedState);
    elements.back.addEventListener("click", () => {
        if (currentStep > 1) {
            currentStep -= 1;
            render();
        }
    });
    elements.next.addEventListener("click", nextStep);
    elements.refresh.addEventListener("click", generateSuggestions);
    elements.dimension.addEventListener("change", renderTable);
    elements.confidence.addEventListener("change", renderTable);
    elements.selectAll.addEventListener("change", () => {
        filteredSuggestions().forEach(rule => {
            elements.selectAll.checked
                ? selectedRuleIds.add(rule.id)
                : selectedRuleIds.delete(rule.id);
        });
        invalidatePersistedState();
        renderTable();
    });
    elements.save.addEventListener("click", saveDraft);
    elements.validate.addEventListener("click", validateDraft);
    elements.publish.addEventListener("click", publishDraft);
    elements.dialogSave.addEventListener("click", saveDialog);

    disableUnsupportedScheduling();
    loadConnections().then(render);
})();
