(() => {
    "use strict";

    const loading = document.getElementById("silver-loading");
    const empty = document.getElementById("silver-empty");
    const tableWrap = document.getElementById("silver-table-wrap");
    const tbody = document.getElementById("silver-workflows");
    const message = document.getElementById("silver-message");

    function showMessage(text) {
        message.textContent = text;
        message.hidden = false;
    }

    function sourceLabel(source) {
        if (!source || typeof source !== "object") return "—";
        return [source.project_id, source.dataset_id, source.table_id]
            .filter(Boolean).join(".") || "—";
    }

    function render(workflows) {
        loading.hidden = true;
        empty.hidden = true;
        if (!Array.isArray(workflows) || workflows.length === 0) {
            empty.hidden = false;
            return;
        }

        tbody.innerHTML = workflows.map((workflow) => `
            <tr data-workflow-id="${workflow.workflow_id}">
                <td><a href="/silver-refinement/${encodeURIComponent(workflow.workflow_id)}"><strong>${workflow.workflow_id ?? "—"}</strong></a></td>
                <td>${sourceLabel(workflow.source)}</td>
                <td>${workflow.status ?? "—"}</td>
                <td>${workflow.version ?? "—"}</td>
                <td>${workflow.active_step ?? "—"}</td>
                <td>${workflow.updated_at ?? "—"}</td>
            </tr>
        `).join("");
        tableWrap.hidden = false;
    }

    async function loadWorkflows() {
        try {
            const response = await fetch("/ui/api/silver/workflows", {
                headers: { "Accept": "application/json" }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const payload = await response.json();
            render(payload.workflows ?? []);
        } catch (error) {
            loading.hidden = true;
            empty.hidden = true;
            showMessage(`No se pudo cargar Silver Refinement: ${error.message}`);
        }
    }

    loadWorkflows();
})();
