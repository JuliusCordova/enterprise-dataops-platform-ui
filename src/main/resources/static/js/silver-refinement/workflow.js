(() => {
  "use strict";

  const workflowId = document.getElementById("workflow-id").value;
  const mappingBody = document.getElementById("mapping-body");
  const message = document.getElementById("silver-detail-message");
  const artifactOutput = document.getElementById("artifact-output");
  const executionOutput = document.getElementById("execution-output");
  let workflow = null;
  let executionId = null;

  function showMessage(text) {
    message.textContent = text;
    message.hidden = false;
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      ...options
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(payload.detail || payload.message || `HTTP ${response.status}`);
    return payload;
  }

  function addColumn(column = {}) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input class="m-name" value="${column.name || ""}" placeholder="customer_id"></td>
      <td><input class="m-type" value="${column.data_type || "STRING"}"></td>
      <td><input class="m-source" value="${column.source_column || column.name || ""}"></td>
      <td><input class="m-transform" value="${column.transformation || ""}" placeholder="TRIM(customer_id)"></td>
      <td><input class="m-nullable" type="checkbox" ${column.nullable === false ? "" : "checked"}></td>
      <td><button class="enterprise-button enterprise-button-secondary m-remove" type="button">×</button></td>`;
    row.querySelector(".m-remove").addEventListener("click", () => row.remove());
    mappingBody.appendChild(row);
  }

  function columns() {
    return [...mappingBody.querySelectorAll("tr")].map(row => ({
      name: row.querySelector(".m-name").value.trim(),
      data_type: row.querySelector(".m-type").value.trim(),
      nullable: row.querySelector(".m-nullable").checked,
      source_column: row.querySelector(".m-source").value.trim() || null,
      transformation: row.querySelector(".m-transform").value.trim() || null
    })).filter(column => column.name && column.data_type);
  }

  function baseRequest(includeSource) {
    const payload = {
      mapping_version: Number(document.getElementById("mapping-version").value),
      target_project: document.getElementById("target-project").value.trim(),
      target_dataset: document.getElementById("target-dataset").value.trim(),
      target_table: document.getElementById("target-table").value.trim(),
      columns: columns(),
      generated_by: document.getElementById("generated-by").value.trim(),
      metadata: { workflow_id: workflowId, mapping_persistence: "generation_request_only" }
    };
    if (includeSource) {
      payload.source_project = workflow.source.project_id;
      payload.source_dataset = workflow.source.dataset_id;
      payload.source_table = workflow.source.table_id;
      payload.specification = { workflow_id: workflowId, business_rules: workflow.business_rules || {} };
      payload.quality_rules = workflow.quality_rules || [];
    }
    return payload;
  }

  async function loadWorkflow() {
    workflow = await api(`/ui/api/silver/workflows/${encodeURIComponent(workflowId)}`);
    document.getElementById("wf-title").textContent = workflow.workflow_id;
    document.getElementById("wf-status").textContent = `${workflow.status} · v${workflow.version}`;
    document.getElementById("wf-source").textContent = workflow.source?.fully_qualified_name || "Fuente no disponible";
    document.getElementById("spec-id").value = workflow.spec_id || "";
    document.getElementById("target-table").value = `${workflow.source?.table_id || "table"}_silver`;
    const sourceColumns = workflow.schema_context?.columns || [];
    sourceColumns.forEach(column => addColumn({
      name: column.name,
      data_type: column.data_type,
      nullable: column.nullable,
      source_column: column.name,
      transformation: null
    }));
    if (!sourceColumns.length) addColumn();
  }

  async function generateDdl() {
    const specId = document.getElementById("spec-id").value.trim();
    if (!specId) throw new Error("El workflow aún no tiene spec_id. Completa o genera la especificación backend.");
    artifactOutput.textContent = JSON.stringify(await api(`/ui/api/silver/specs/${encodeURIComponent(specId)}/artifacts/ddl`, { method: "POST", body: JSON.stringify(baseRequest(false)) }), null, 2);
  }

  async function generatePackage() {
    const specId = document.getElementById("spec-id").value.trim();
    if (!specId) throw new Error("El workflow aún no tiene spec_id. Completa o genera la especificación backend.");
    artifactOutput.textContent = JSON.stringify(await api(`/ui/api/silver/specs/${encodeURIComponent(specId)}/artifacts/generate`, { method: "POST", body: JSON.stringify(baseRequest(true)) }), null, 2);
  }

  async function createExecution() {
    const specId = document.getElementById("spec-id").value.trim();
    const result = await api("/ui/api/silver/executions", { method: "POST", body: JSON.stringify({ spec_id: specId, requested_by: document.getElementById("generated-by").value.trim() }) });
    executionId = result.execution_id;
    executionOutput.textContent = JSON.stringify(result, null, 2);
    document.getElementById("validate-package").disabled = !executionId;
    document.getElementById("submit-execution").disabled = !executionId;
    document.getElementById("sync-status").disabled = !executionId;
  }

  async function executionAction(action) {
    if (!executionId) throw new Error("Primero crea una ejecución.");
    executionOutput.textContent = JSON.stringify(await api(`/ui/api/silver/executions/${encodeURIComponent(executionId)}/${action}`, { method: "POST", body: "{}" }), null, 2);
  }

  document.getElementById("add-column").addEventListener("click", () => addColumn());
  document.getElementById("generate-ddl").addEventListener("click", () => generateDdl().catch(e => showMessage(e.message)));
  document.getElementById("generate-package").addEventListener("click", () => generatePackage().catch(e => showMessage(e.message)));
  document.getElementById("create-execution").addEventListener("click", () => createExecution().catch(e => showMessage(e.message)));
  document.getElementById("validate-package").addEventListener("click", () => executionAction("validate-package").catch(e => showMessage(e.message)));
  document.getElementById("submit-execution").addEventListener("click", () => executionAction("submit").catch(e => showMessage(e.message)));
  document.getElementById("sync-status").addEventListener("click", () => executionAction("sync-status").catch(e => showMessage(e.message)));

  loadWorkflow().catch(error => showMessage(`No se pudo cargar el workflow: ${error.message}`));
})();
