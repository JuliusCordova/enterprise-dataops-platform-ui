(() => {
  "use strict";

  const NEW_DATASET = "__new_dataset__";
  const NEW_TABLE = "__new_table__";
  const $ = id => document.getElementById(id);

  function message(text, type = "warning") {
    const box = $("silver-wizard-message");
    if (!box) return;
    box.hidden = false;
    box.textContent = text;
    box.className = `message dq-message message-${type}`;
  }

  async function getJson(url) {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.detail || payload.message || `HTTP ${response.status}`);
    }
    return payload;
  }

  function values(payload, keys) {
    if (Array.isArray(payload)) return payload;
    for (const key of keys) {
      if (Array.isArray(payload?.[key])) return payload[key];
    }
    return [];
  }

  function itemValue(item, keys) {
    if (typeof item === "string") return item;
    for (const key of keys) {
      const value = item?.[key];
      if (value !== undefined && value !== null && value !== "") return String(value);
    }
    return "";
  }

  function replaceInputWithSelect(input, placeholder) {
    const select = document.createElement("select");
    select.id = input.id;
    select.className = input.className;
    select.name = input.name;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    input.replaceWith(select);
    return select;
  }

  function appendOption(select, value, label = value, selected = false) {
    if (!value || [...select.options].some(option => option.value === value)) return;
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = selected;
    select.appendChild(option);
  }

  function createNewValuePanel(labelText, placeholder) {
    const panel = document.createElement("div");
    panel.className = "silver-inline-create";
    panel.hidden = true;
    panel.innerHTML = `
      <label>
        <span>${labelText}</span>
        <input type="text" placeholder="${placeholder}" autocomplete="off">
      </label>
      <button type="button" class="enterprise-button enterprise-button-secondary">Usar nombre</button>
    `;
    return panel;
  }

  function sanitizeIdentifier(value) {
    return value.trim().replace(/[^A-Za-z0-9_]/g, "_").replace(/^_+|_+$/g, "");
  }

  async function initialize() {
    const datasetInput = $("sw-target-dataset");
    const tableInput = $("sw-target-table");
    const projectInput = $("sw-target-project");
    const connectionSelect = $("sw-connection");
    if (!datasetInput || !tableInput || !projectInput || !connectionSelect) return;

    const initialDataset = datasetInput.value;
    const initialTable = tableInput.value;
    const datasetSelect = replaceInputWithSelect(datasetInput, "Selecciona un dataset destino");
    const tableSelect = replaceInputWithSelect(tableInput, "Selecciona una tabla destino");
    const datasetPanel = createNewValuePanel("Nuevo dataset", "seguros_silver");
    const tablePanel = createNewValuePanel("Nueva tabla", "movimientos_siniestro");
    datasetSelect.closest("label")?.after(datasetPanel);
    tableSelect.closest("label")?.after(tablePanel);

    async function loadTargetDatasets() {
      datasetSelect.innerHTML = '<option value="">Cargando datasets...</option>';
      tableSelect.innerHTML = '<option value="">Selecciona un dataset destino</option>';
      tableSelect.disabled = true;
      const connectionId = connectionSelect.value;
      if (!connectionId) {
        datasetSelect.innerHTML = '<option value="">Selecciona primero la conexión fuente</option>';
        datasetSelect.disabled = true;
        return;
      }
      try {
        const payload = await getJson(`/ui/api/profiling/metadata/${encodeURIComponent(connectionId)}/datasets`);
        datasetSelect.innerHTML = '<option value="">Selecciona un dataset destino</option>';
        values(payload, ["datasets", "items", "data"]).forEach(item => {
          const value = itemValue(item, ["dataset_id", "dataset_name", "name"]);
          appendOption(datasetSelect, value, itemValue(item, ["display_name", "dataset_name", "dataset_id", "name"]) || value);
        });
        appendOption(datasetSelect, NEW_DATASET, "+ Crear nuevo dataset");
        datasetSelect.disabled = false;
        if (initialDataset) appendOption(datasetSelect, initialDataset, initialDataset, true);
      } catch (error) {
        datasetSelect.innerHTML = '<option value="">No disponible</option>';
        datasetSelect.disabled = true;
        message(`No se pudieron cargar los datasets destino: ${error.message}`, "error");
      }
    }

    async function loadTargetTables() {
      datasetPanel.hidden = datasetSelect.value !== NEW_DATASET;
      tablePanel.hidden = true;
      tableSelect.innerHTML = '<option value="">Selecciona una tabla destino</option>';
      tableSelect.disabled = true;
      const connectionId = connectionSelect.value;
      const datasetId = datasetSelect.value;
      if (!connectionId || !datasetId || datasetId === NEW_DATASET) return;
      try {
        const payload = await getJson(`/ui/api/profiling/metadata/${encodeURIComponent(connectionId)}/${encodeURIComponent(datasetId)}/tables`);
        values(payload, ["tables", "items", "data"]).forEach(item => {
          const value = itemValue(item, ["table_id", "table_name", "name"]);
          appendOption(tableSelect, value, itemValue(item, ["display_name", "table_name", "table_id", "name"]) || value);
        });
        appendOption(tableSelect, NEW_TABLE, "+ Crear nueva tabla");
        tableSelect.disabled = false;
        if (initialTable) appendOption(tableSelect, initialTable, initialTable, true);
      } catch (error) {
        message(`No se pudieron cargar las tablas destino: ${error.message}`, "error");
      }
    }

    function activateCreatedValue(panel, select) {
      const input = panel.querySelector("input");
      const button = panel.querySelector("button");
      button.addEventListener("click", () => {
        const value = sanitizeIdentifier(input.value);
        if (!value) {
          message("Ingresa un nombre válido.", "error");
          return;
        }
        appendOption(select, value, `${value} (nuevo)`, true);
        panel.hidden = true;
        select.dispatchEvent(new Event("change"));
      });
    }

    datasetSelect.addEventListener("change", loadTargetTables);
    tableSelect.addEventListener("change", () => {
      tablePanel.hidden = tableSelect.value !== NEW_TABLE;
    });
    connectionSelect.addEventListener("change", loadTargetDatasets);
    projectInput.addEventListener("change", loadTargetDatasets);
    activateCreatedValue(datasetPanel, datasetSelect);
    activateCreatedValue(tablePanel, tableSelect);

    await loadTargetDatasets();
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
