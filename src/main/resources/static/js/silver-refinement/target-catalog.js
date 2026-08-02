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

  async function api(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : { message: await response.text() };
    if (!response.ok) {
      const detail = typeof payload.detail === "string"
        ? payload.detail
        : payload.message || `HTTP ${response.status}`;
      throw new Error(detail);
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

  function createDatasetPanel() {
    const panel = document.createElement("div");
    panel.className = "silver-inline-create";
    panel.hidden = true;
    panel.innerHTML = `
      <label><span>Nuevo dataset</span><input class="new-dataset-name" type="text" placeholder="seguros_silver" autocomplete="off"></label>
      <label><span>Ubicación</span><select class="new-dataset-location"><option value="US">US</option><option value="EU">EU</option><option value="southamerica-west1">southamerica-west1</option></select></label>
      <label><span>Descripción</span><input class="new-dataset-description" type="text" placeholder="Capa Silver del dominio"></label>
      <button type="button" class="enterprise-button enterprise-button-primary">Crear dataset</button>
    `;
    return panel;
  }

  function createTablePanel() {
    const panel = document.createElement("div");
    panel.className = "silver-inline-create";
    panel.hidden = true;
    panel.innerHTML = `
      <label><span>Nueva tabla</span><input type="text" placeholder="movimientos_siniestro" autocomplete="off"></label>
      <button type="button" class="enterprise-button enterprise-button-secondary">Usar nombre</button>
    `;
    return panel;
  }

  function sanitizeIdentifier(value) {
    return value.trim().replace(/[^A-Za-z0-9_]/g, "_").replace(/^_+|_+$/g, "");
  }

  function projectId(projectInput) {
    const value = projectInput.value.trim();
    if (!value) throw new Error("Define el proyecto destino.");
    return value;
  }

  function catalogBase(projectInput) {
    return `/ui/api/silver/workflows/catalog/projects/${encodeURIComponent(projectId(projectInput))}`;
  }

  async function initialize() {
    const datasetInput = $("sw-target-dataset");
    const tableInput = $("sw-target-table");
    const projectInput = $("sw-target-project");
    if (!datasetInput || !tableInput || !projectInput) return;

    const initialDataset = datasetInput.value;
    const initialTable = tableInput.value;
    const datasetSelect = replaceInputWithSelect(datasetInput, "Selecciona un dataset destino");
    const tableSelect = replaceInputWithSelect(tableInput, "Selecciona una tabla destino");
    const datasetPanel = createDatasetPanel();
    const tablePanel = createTablePanel();
    datasetSelect.closest("label")?.after(datasetPanel);
    tableSelect.closest("label")?.after(tablePanel);

    async function loadTargetDatasets(preferredDataset = "") {
      datasetPanel.hidden = true;
      datasetSelect.innerHTML = '<option value="">Cargando datasets...</option>';
      datasetSelect.disabled = true;
      tableSelect.innerHTML = '<option value="">Selecciona un dataset destino</option>';
      tableSelect.disabled = true;
      try {
        const payload = await api(`${catalogBase(projectInput)}/datasets`);
        datasetSelect.innerHTML = '<option value="">Selecciona un dataset destino</option>';
        values(payload, ["datasets", "items", "data"]).forEach(item => {
          const value = itemValue(item, ["dataset_id", "datasetId", "name"]);
          const location = itemValue(item, ["location"]);
          const tableCount = itemValue(item, ["table_count", "tableCount"]);
          const suffix = [location, tableCount ? `${tableCount} tablas` : ""].filter(Boolean).join(" · ");
          appendOption(datasetSelect, value, suffix ? `${value} — ${suffix}` : value);
        });
        appendOption(datasetSelect, NEW_DATASET, "+ Crear nuevo dataset");
        datasetSelect.disabled = false;
        const selected = preferredDataset || initialDataset;
        if (selected) {
          appendOption(datasetSelect, selected, `${selected} (seleccionado)`, true);
          datasetSelect.value = selected;
          await loadTargetTables();
        }
      } catch (error) {
        datasetSelect.innerHTML = '<option value="">No disponible</option>';
        message(`No se pudieron cargar los datasets destino: ${error.message}`, "error");
      }
    }

    async function loadTargetTables(preferredTable = "") {
      datasetPanel.hidden = datasetSelect.value !== NEW_DATASET;
      tablePanel.hidden = true;
      tableSelect.innerHTML = '<option value="">Selecciona una tabla destino</option>';
      tableSelect.disabled = true;
      const datasetId = datasetSelect.value;
      if (!datasetId || datasetId === NEW_DATASET) return;
      try {
        const payload = await api(`${catalogBase(projectInput)}/datasets/${encodeURIComponent(datasetId)}/tables`);
        values(payload, ["tables", "items", "data"]).forEach(item => {
          const value = itemValue(item, ["table_id", "tableId", "name"]);
          const type = itemValue(item, ["table_type", "tableType"]);
          appendOption(tableSelect, value, type ? `${value} — ${type}` : value);
        });
        appendOption(tableSelect, NEW_TABLE, "+ Crear nueva tabla");
        tableSelect.disabled = false;
        const selected = preferredTable || initialTable;
        if (selected) {
          appendOption(tableSelect, selected, `${selected} (seleccionada)`, true);
          tableSelect.value = selected;
        }
      } catch (error) {
        message(`No se pudieron cargar las tablas destino: ${error.message}`, "error");
      }
    }

    datasetPanel.querySelector("button").addEventListener("click", async () => {
      const button = datasetPanel.querySelector("button");
      const name = sanitizeIdentifier(datasetPanel.querySelector(".new-dataset-name").value);
      const location = datasetPanel.querySelector(".new-dataset-location").value;
      const description = datasetPanel.querySelector(".new-dataset-description").value.trim();
      if (!name) {
        message("Ingresa un nombre válido para el dataset.", "error");
        return;
      }
      button.disabled = true;
      try {
        await api(`${catalogBase(projectInput)}/datasets`, {
          method: "POST",
          body: JSON.stringify({
            dataset_id: name,
            location,
            description: description || null,
            confirm_creation: true
          })
        });
        message(`Dataset ${name} creado correctamente en ${location}.`, "success");
        await loadTargetDatasets(name);
      } catch (error) {
        message(`No se pudo crear el dataset: ${error.message}`, "error");
      } finally {
        button.disabled = false;
      }
    });

    tablePanel.querySelector("button").addEventListener("click", () => {
      const input = tablePanel.querySelector("input");
      const value = sanitizeIdentifier(input.value);
      if (!value) {
        message("Ingresa un nombre válido para la tabla.", "error");
        return;
      }
      appendOption(tableSelect, value, `${value} (nueva)`, true);
      tableSelect.value = value;
      tablePanel.hidden = true;
      message("La tabla quedó definida como nueva. Se creará mediante el DDL aprobado.", "success");
    });

    datasetSelect.addEventListener("change", loadTargetTables);
    tableSelect.addEventListener("change", () => {
      tablePanel.hidden = tableSelect.value !== NEW_TABLE;
    });
    projectInput.addEventListener("change", () => loadTargetDatasets());

    await loadTargetDatasets();
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
