(() => {
    "use strict";

    const STORAGE_KEY =
        "dataOpsProfilingContext";

    const connectionSelect =
        document.getElementById("connection");

    const datasetSelect =
        document.getElementById("dataset");

    const tableSelect =
        document.getElementById("table");

    const profileButton =
        document.getElementById("profile-button");

    const profilingForm =
        document.getElementById("profiling-form");

    const message =
        document.getElementById("profiling-message");

    function initialize() {
        validateRequiredElements();
        bindEvents();
        resetInitialState();
        loadConnections();
    }

    function validateRequiredElements() {
        const requiredElements = [
            connectionSelect,
            datasetSelect,
            tableSelect,
            profileButton,
            profilingForm,
            message
        ];

        const missingElement =
            requiredElements.some(
                element => !element
            );

        if (missingElement) {
            throw new Error(
                "No fue posible inicializar el módulo de profiling. "
                + "Faltan elementos requeridos en la página."
            );
        }
    }

    function bindEvents() {
        connectionSelect.addEventListener(
            "change",
            handleConnectionChange
        );

        datasetSelect.addEventListener(
            "change",
            handleDatasetChange
        );

        tableSelect.addEventListener(
            "change",
            updateProfileButton
        );

        profilingForm.addEventListener(
            "submit",
            handleProfilingSubmit
        );
    }

    function resetInitialState() {
        connectionSelect.disabled = true;
        datasetSelect.disabled = true;
        tableSelect.disabled = true;
        profileButton.disabled = true;

        populateSelect(
            datasetSelect,
            [],
            "Selecciona una conexión",
            resolveDatasetValue,
            resolveDatasetLabel
        );

        populateSelect(
            tableSelect,
            [],
            "Selecciona un dataset",
            resolveTableValue,
            resolveTableLabel
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
            const text =
                await response.text();

            payload = {
                message:
                    text || "Respuesta no válida"
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

        if (
            Array.isArray(payload?.detail)
        ) {
            return payload.detail
                .map(item =>
                    item.msg
                    || item.message
                    || JSON.stringify(item)
                )
                .join(". ");
        }

        return `Error HTTP ${status}`;
    }

    async function loadConnections() {
        hideMessage();

        setSelectLoading(
            connectionSelect,
            "Cargando conexiones..."
        );

        try {
            const payload = await apiRequest(
                "/ui/api/profiling/connections"
            );

            const connections =
                extractArray(
                    payload,
                    [
                        "connections",
                        "items",
                        "data"
                    ]
                );

            populateSelect(
                connectionSelect,
                connections,
                "Selecciona una conexión",
                resolveConnectionValue,
                resolveConnectionLabel
            );

            connectionSelect.disabled = false;

            if (connections.length === 0) {
                connectionSelect.disabled = true;

                showMessage(
                    "No se encontraron conexiones disponibles.",
                    "warning"
                );
            }

        } catch (error) {
            populateSelect(
                connectionSelect,
                [],
                "No fue posible cargar conexiones",
                resolveConnectionValue,
                resolveConnectionLabel
            );

            connectionSelect.disabled = true;

            showMessage(
                "No se pudieron cargar las conexiones: "
                    + error.message,
                "error"
            );
        }

        updateProfileButton();
    }

    async function handleConnectionChange() {
        hideMessage();

        resetDatasetAndTable();
        updateProfileButton();

        if (!connectionSelect.value) {
            return;
        }

        setSelectLoading(
            datasetSelect,
            "Cargando datasets..."
        );

        try {
            const connectionId =
                encodeURIComponent(
                    connectionSelect.value
                );

            const payload = await apiRequest(
                `/ui/api/profiling/connections/${connectionId}/datasets`
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
                resolveDatasetValue,
                resolveDatasetLabel
            );

            datasetSelect.disabled =
                datasets.length === 0;

            if (datasets.length === 0) {
                showMessage(
                    "La conexión seleccionada no tiene datasets disponibles.",
                    "warning"
                );
            }

        } catch (error) {
            populateSelect(
                datasetSelect,
                [],
                "No fue posible cargar datasets",
                resolveDatasetValue,
                resolveDatasetLabel
            );

            datasetSelect.disabled = true;

            showMessage(
                "No se pudieron cargar los datasets: "
                    + error.message,
                "error"
            );
        }

        updateProfileButton();
    }

    async function handleDatasetChange() {
        hideMessage();

        resetTable();
        updateProfileButton();

        if (
            !connectionSelect.value
            || !datasetSelect.value
        ) {
            return;
        }

        setSelectLoading(
            tableSelect,
            "Cargando tablas..."
        );

        try {
            const connectionId =
                encodeURIComponent(
                    connectionSelect.value
                );

            const datasetId =
                encodeURIComponent(
                    datasetSelect.value
                );

            const payload = await apiRequest(
                `/ui/api/profiling/connections/${connectionId}/datasets/${datasetId}/tables`
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
                resolveTableValue,
                resolveTableLabel
            );

            tableSelect.disabled =
                tables.length === 0;

            if (tables.length === 0) {
                showMessage(
                    "El dataset seleccionado no tiene tablas disponibles.",
                    "warning"
                );
            }

        } catch (error) {
            populateSelect(
                tableSelect,
                [],
                "No fue posible cargar tablas",
                resolveTableValue,
                resolveTableLabel
            );

            tableSelect.disabled = true;

            showMessage(
                "No se pudieron cargar las tablas: "
                    + error.message,
                "error"
            );
        }

        updateProfileButton();
    }

    async function handleProfilingSubmit(
        event
    ) {
        event.preventDefault();

        hideMessage();

        if (!isSelectionComplete()) {
            showMessage(
                "Selecciona conexión, dataset y tabla antes de continuar.",
                "warning"
            );
            return;
        }

        setProfilingState(true);

        try {
            const request = {
                connection_id:
                    connectionSelect.value,

                dataset_id:
                    datasetSelect.value,

                table_id:
                    tableSelect.value,

                selected_columns: []
            };

            const payload = await apiRequest(
                "/ui/api/profiling/execute",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify(request)
                }
            );

            const profilingContext = {
                connectionId:
                    connectionSelect.value,

                datasetId:
                    datasetSelect.value,

                tableId:
                    tableSelect.value,

                executedAt:
                    new Date().toISOString(),

                result: payload
            };

            sessionStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(
                    profilingContext
                )
            );

            window.location.assign(
                "/profiling/report"
            );

        } catch (error) {
            showMessage(
                "No se pudo ejecutar el perfilado: "
                    + error.message,
                "error"
            );

            setProfilingState(false);
        }
    }

    function setProfilingState(
        isProfiling
    ) {
        connectionSelect.disabled =
            isProfiling;

        datasetSelect.disabled =
            isProfiling
            || !connectionSelect.value;

        tableSelect.disabled =
            isProfiling
            || !datasetSelect.value;

        profileButton.disabled =
            isProfiling
            || !isSelectionComplete();

        profileButton.textContent =
            isProfiling
                ? "Analizando tabla..."
                : "Analizar tabla";
    }

    function isSelectionComplete() {
        return Boolean(
            connectionSelect.value
            && datasetSelect.value
            && tableSelect.value
        );
    }

    function updateProfileButton() {
        profileButton.disabled =
            !isSelectionComplete();
    }

    function resetDatasetAndTable() {
        populateSelect(
            datasetSelect,
            [],
            "Selecciona una conexión",
            resolveDatasetValue,
            resolveDatasetLabel
        );

        datasetSelect.disabled = true;

        resetTable();
    }

    function resetTable() {
        populateSelect(
            tableSelect,
            [],
            "Selecciona un dataset",
            resolveTableValue,
            resolveTableLabel
        );

        tableSelect.disabled = true;
    }

    function setSelectLoading(
        select,
        label
    ) {
        populateSelect(
            select,
            [],
            label,
            item => item,
            item => item
        );

        select.disabled = true;
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

        const uniqueValues =
            uniqueItems(
                values,
                valueResolver
            );

        uniqueValues.forEach(item => {
            const value =
                valueResolver(item);

            const label =
                labelResolver(item);

            if (!value) {
                return;
            }

            const option =
                document.createElement(
                    "option"
                );

            option.value = value;
            option.textContent =
                label || value;

            select.appendChild(option);
        });
    }

    function extractArray(
        payload,
        possibleKeys
    ) {
        if (Array.isArray(payload)) {
            return payload;
        }

        for (const key of possibleKeys) {
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

    function uniqueItems(
        values,
        valueResolver
    ) {
        const seen = new Set();

        return values.filter(item => {
            const value =
                String(
                    valueResolver(item) || ""
                ).trim();

            if (
                !value
                || seen.has(value)
            ) {
                return false;
            }

            seen.add(value);

            return true;
        });
    }

    function resolveConnectionValue(
        item
    ) {
        if (typeof item === "string") {
            return item;
        }

        return item.connection_id
            || item.id
            || item.name
            || "";
    }

    function resolveConnectionLabel(
        item
    ) {
        if (typeof item === "string") {
            return item;
        }

        return item.display_name
            || item.connection_name
            || item.name
            || item.connection_id
            || "";
    }

    function resolveDatasetValue(
        item
    ) {
        if (typeof item === "string") {
            return item;
        }

        return item.dataset_id
            || item.dataset_name
            || item.id
            || item.name
            || "";
    }

    function resolveDatasetLabel(
        item
    ) {
        if (typeof item === "string") {
            return item;
        }

        return item.display_name
            || item.dataset_name
            || item.dataset_id
            || item.name
            || "";
    }

    function resolveTableValue(
        item
    ) {
        if (typeof item === "string") {
            return item;
        }

        return item.table_id
            || item.table_name
            || item.id
            || item.name
            || "";
    }

    function resolveTableLabel(
        item
    ) {
        if (typeof item === "string") {
            return item;
        }

        return item.display_name
            || item.table_name
            || item.table_id
            || item.name
            || "";
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

    try {
        initialize();

    } catch (error) {
        console.error(
            "Profiling module initialization failed",
            error
        );

        if (message) {
            showMessage(
                error.message,
                "error"
            );
        }
    }
})();
