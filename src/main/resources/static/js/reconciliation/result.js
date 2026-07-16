(() => {
    "use strict";

    const STORAGE_KEY =
        "dataOpsReconciliationExecution";

    const state = {
        context: null,
        executionId: null,
        configuration: null,
        result: null,
        metrics: [],
        differences: []
    };

    const loadingSection =
        document.getElementById(
            "reconciliation-result-loading"
        );

    const contentSection =
        document.getElementById(
            "reconciliation-result-content"
        );

    const errorSection =
        document.getElementById(
            "reconciliation-result-error"
        );

    const errorMessage =
        document.getElementById(
            "reconciliation-result-error-message"
        );

    async function initialize() {
        const rawContext =
            sessionStorage.getItem(
                STORAGE_KEY
            );

        if (!rawContext) {
            showError(
                "No se encontró una ejecución de reconciliación en esta sesión."
            );

            return;
        }

        try {
            state.context =
                JSON.parse(rawContext);

            state.executionId =
                state.context.executionId;

            state.configuration =
                state.context.configuration
                || {};

            if (!state.executionId) {
                throw new Error(
                    "No se encontró execution_id."
                );
            }

            state.result =
                await apiRequest(
                    `/ui/api/reconciliation/result/${encodeURIComponent(
                        state.executionId
                    )}`
                );

            state.metrics =
                extractMetrics(
                    state.result
                );

            state.differences =
                extractDifferences(
                    state.result
                );

            renderResult();

            loadingSection.hidden = true;
            contentSection.hidden = false;

        } catch (error) {
            showError(
                error.message
            );
        }
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
                        "Accept":
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

    function renderResult() {
        const summary =
            buildSummary();

        renderHeader(summary);
        renderMetrics(summary);
        renderMetricTable();
        renderDifferences();
        renderAiExplanation(summary);
        renderExecutionDetails(summary);
        bindActions();
    }

    function buildSummary() {
        const execution =
            resolveExecutionObject(
                state.result
            );

        const sourceRows =
            numberValue(
                execution.source_row_count
                ?? execution.source_count
                ?? state.result.source_row_count
                ?? 0
            );

        const targetRows =
            numberValue(
                execution.target_row_count
                ?? execution.target_count
                ?? state.result.target_row_count
                ?? 0
            );

        const rowDifference =
            numberValue(
                execution.row_count_difference
                ?? execution.row_difference
                ?? sourceRows - targetRows
            );

        const overallStatus =
            normalizeStatus(
                execution.overall_status
                ?? execution.status
                ?? state.result.overall_status
                ?? state.result.status
                ?? calculateStatusFromMetrics()
            );

        const processName =
            state.configuration.process_name
            || execution.process_name
            || state.configuration.reconciliation_id
            || "Cuadratura de datos";

        const durationMs =
            numberValue(
                execution.duration_ms
                ?? state.result.duration_ms
                ?? 0
            );

        const businessDate =
            execution.business_date
            || state.context.request?.business_date
            || "—";

        return {
            execution,
            sourceRows,
            targetRows,
            rowDifference,
            overallStatus,
            processName,
            durationMs,
            businessDate
        };
    }

    function resolveExecutionObject(
        payload
    ) {
        return (
            payload.execution
            || payload.summary
            || payload.result
            || payload.data
            || payload
        );
    }

    function extractMetrics(
        payload
    ) {
        const candidates = [
            payload.metric_results,
            payload.metrics,
            payload.results,
            payload.execution?.metric_results,
            payload.result?.metric_results,
            payload.data?.metric_results
        ];

        for (const candidate of candidates) {
            if (Array.isArray(candidate)) {
                return candidate;
            }
        }

        return [];
    }

    function extractDifferences(
        payload
    ) {
        const candidates = [
            payload.differences,
            payload.difference_details,
            payload.difference_samples,
            payload.execution?.differences,
            payload.result?.differences,
            payload.data?.differences
        ];

        for (const candidate of candidates) {
            if (Array.isArray(candidate)) {
                return candidate;
            }
        }

        return [];
    }

    function calculateStatusFromMetrics() {
        if (
            state.metrics.some(
                metric =>
                    normalizeStatus(
                        metric.status
                    ) === "CRITICO"
            )
        ) {
            return "CRITICO";
        }

        if (
            state.metrics.some(
                metric =>
                    normalizeStatus(
                        metric.status
                    ) === "OBSERVADO"
            )
        ) {
            return "OBSERVADO";
        }

        return "CONFORME";
    }

    function renderHeader(summary) {
        setText(
            "reconciliation-overall-status",
            summary.overallStatus
        );

        const statusChip =
            document.getElementById(
                "reconciliation-status-chip"
            );

        statusChip.textContent =
            summary.overallStatus;

        statusChip.className =
            "status-chip status-"
            + summary.overallStatus
                .toLowerCase();

        setText(
            "reconciliation-process-name",
            summary.processName
        );

        setText(
            "reconciliation-executive-summary",
            buildExecutiveSummary(
                summary
            )
        );

        setText(
            "reconciliation-result-source",
            buildPath(
                state.configuration,
                "source"
            )
        );

        setText(
            "reconciliation-result-target",
            buildPath(
                state.configuration,
                "target"
            )
        );

        setText(
            "reconciliation-result-date",
            summary.businessDate
        );
    }

    function renderMetrics(summary) {
        setText(
            "metric-source-rows",
            formatNumber(
                summary.sourceRows
            )
        );

        setText(
            "metric-target-rows",
            formatNumber(
                summary.targetRows
            )
        );

        setText(
            "metric-row-difference",
            formatNumber(
                summary.rowDifference
            )
        );

        setText(
            "metric-result-count",
            state.metrics.length
        );

        setText(
            "metric-duration",
            formatDuration(
                summary.durationMs
            )
        );

        setText(
            "reconciliation-metric-count",
            `${state.metrics.length} métricas`
        );
    }

    function renderMetricTable() {
        const body =
            document.getElementById(
                "reconciliation-metric-body"
            );

        body.innerHTML = "";

        if (
            state.metrics.length === 0
        ) {
            body.innerHTML = `
                <tr>
                    <td colspan="7">
                        No se encontraron métricas detalladas.
                    </td>
                </tr>
            `;

            return;
        }

        state.metrics.forEach(metric => {
            const normalized =
                normalizeMetric(metric);

            const row =
                document.createElement(
                    "tr"
                );

            row.innerHTML = `
                <td>
                    <span class="table-status table-status-${escapeHtml(
                        normalized.status
                            .toLowerCase()
                    )}">
                        ${escapeHtml(
                            normalized.status
                        )}
                    </span>
                </td>

                <td>
                    <strong>
                        ${escapeHtml(
                            normalized.metricName
                        )}
                    </strong>

                    <br>

                    <small>
                        ${escapeHtml(
                            normalized.metricType
                        )}
                    </small>
                </td>

                <td>
                    ${formatValue(
                        normalized.sourceValue
                    )}
                </td>

                <td>
                    ${formatValue(
                        normalized.targetValue
                    )}
                </td>

                <td>
                    ${formatValue(
                        normalized.difference
                    )}
                </td>

                <td>
                    ${formatPercentage(
                        normalized.percentageDifference
                    )}
                </td>

                <td>
                    ${formatValue(
                        normalized.tolerance
                    )}
                </td>
            `;

            body.appendChild(row);
        });
    }

    function normalizeMetric(metric) {
        return {
            metricName:
                metric.metric_name
                || metric.name
                || "Métrica",

            metricType:
                metric.metric_type
                || metric.type
                || "COMPARISON",

            sourceValue:
                metric.source_value
                ?? 0,

            targetValue:
                metric.target_value
                ?? 0,

            difference:
                metric.difference_value
                ?? metric.absolute_difference
                ?? 0,

            percentageDifference:
                metric.percentage_difference
                ?? 0,

            tolerance:
                metric.tolerance_value
                ?? 0,

            status:
                normalizeStatus(
                    metric.status
                )
        };
    }

    function renderDifferences() {
        const container =
            document.getElementById(
                "reconciliation-difference-content"
            );

        setText(
            "reconciliation-difference-count",
            `${state.differences.length} diferencias`
        );

        if (
            state.differences.length === 0
        ) {
            container.innerHTML = `
                <div class="rules-list-empty">

                    <strong>
                        No se encontraron diferencias
                    </strong>

                    <p>
                        Las claves evaluadas se encuentran alineadas
                        entre origen y destino.
                    </p>

                </div>
            `;

            return;
        }

        container.innerHTML =
            state.differences
                .map(
                    difference => `
                        <article class="issue-card">

                            <div>

                                <span class="panel-eyebrow">
                                    ${escapeHtml(
                                        difference.difference_type
                                        || "DIFERENCIA"
                                    )}
                                </span>

                                <h3>
                                    ${escapeHtml(
                                        difference.business_key
                                        || "Registro observado"
                                    )}
                                </h3>

                                <p>
                                    ${escapeHtml(
                                        buildDifferenceMessage(
                                            difference
                                        )
                                    )}
                                </p>

                            </div>

                            <span class="table-status table-status-${escapeHtml(
                                normalizeStatus(
                                    difference.severity
                                ).toLowerCase()
                            )}">
                                ${escapeHtml(
                                    normalizeStatus(
                                        difference.severity
                                    )
                                )}
                            </span>

                        </article>
                    `
                )
                .join("");
    }

    function buildDifferenceMessage(
        difference
    ) {
        if (
            difference.source_present === true
            && difference.target_present === false
        ) {
            return (
                "El registro existe en el origen, "
                + "pero no fue encontrado en el destino."
            );
        }

        if (
            difference.source_present === false
            && difference.target_present === true
        ) {
            return (
                "El registro existe en el destino, "
                + "pero no fue encontrado en el origen."
            );
        }

        return (
            difference.message
            || difference.detail
            || "Se identificó una diferencia entre origen y destino."
        );
    }

    function renderAiExplanation(summary) {
        setText(
            "reconciliation-ai-summary",
            buildAiSummary(
                summary
            )
        );

        setText(
            "reconciliation-ai-recommendation",
            buildRecommendation(
                summary
            )
        );
    }

    function buildExecutiveSummary(
        summary
    ) {
        if (
            summary.overallStatus === "CONFORME"
        ) {
            return (
                `La cuadratura terminó conforme. `
                + `Se compararon ${formatNumber(
                    summary.sourceRows
                )} registros de origen contra `
                + `${formatNumber(
                    summary.targetRows
                )} registros de destino.`
            );
        }

        if (
            summary.overallStatus === "OBSERVADO"
        ) {
            return (
                `La cuadratura presenta observaciones. `
                + `La diferencia de filas es ${formatNumber(
                    summary.rowDifference
                )} y existen métricas que requieren revisión.`
            );
        }

        return (
            "La cuadratura presenta diferencias críticas. "
            + "Se recomienda revisar las métricas y registros "
            + "antes de continuar con el consumo del destino."
        );
    }

    function buildAiSummary(summary) {
        const observedMetrics =
            state.metrics.filter(
                metric =>
                    normalizeStatus(
                        metric.status
                    ) !== "CONFORME"
            ).length;

        return (
            `La ejecución comparó ${formatNumber(
                summary.sourceRows
            )} filas de origen con ${formatNumber(
                summary.targetRows
            )} filas de destino. `
            + `Se evaluaron ${state.metrics.length} métricas y `
            + `${observedMetrics} presentaron observaciones. `
            + `Se identificaron ${state.differences.length} diferencias detalladas.`
        );
    }

    function buildRecommendation(summary) {
        if (
            summary.overallStatus === "CONFORME"
        ) {
            return (
                "La información está alineada. Mantén esta "
                + "cuadratura como control recurrente del proceso."
            );
        }

        if (
            summary.overallStatus === "OBSERVADO"
        ) {
            return (
                "Revisa las métricas fuera de tolerancia y "
                + "confirma si las diferencias corresponden a "
                + "latencia de carga o reglas de transformación."
            );
        }

        return (
            "Detén la publicación del destino para procesos críticos "
            + "y revisa los registros faltantes, duplicados o fuera "
            + "de tolerancia."
        );
    }

    function renderExecutionDetails(summary) {
        const execution =
            summary.execution;

        setText(
            "detail-execution-id",
            state.executionId
        );

        setText(
            "detail-reconciliation-id",
            state.configuration.reconciliation_id
            || execution.reconciliation_id
            || "—"
        );

        setText(
            "detail-requested-by",
            execution.requested_by
            || state.context.request?.requested_by
            || "—"
        );

        setText(
            "detail-execution-date",
            formatDateTime(
                execution.execution_ts
                || execution.created_at
                || state.context.executionResponse
                    ?.execution_ts
            )
        );
    }

    function bindActions() {
        document.getElementById(
            "print-reconciliation-result"
        ).addEventListener(
            "click",
            () => window.print()
        );

        document.getElementById(
            "execute-reconciliation-again"
        ).addEventListener(
            "click",
            () => {
                window.location.assign(
                    "/reconciliation"
                );
            }
        );
    }

    function buildPath(
        configuration,
        prefix
    ) {
        const parts = [
            configuration[
                `${prefix}_project`
            ],
            configuration[
                `${prefix}_dataset`
            ],
            configuration[
                `${prefix}_table`
            ]
        ].filter(Boolean);

        return parts.length > 0
            ? parts.join(".")
            : "—";
    }

    function normalizeStatus(status) {
        const normalized =
            String(
                status || "CONFORME"
            ).toUpperCase();

        if (
            [
                "CONFORME",
                "SUCCESS",
                "PASSED",
                "VALID",
                "OK"
            ].includes(normalized)
        ) {
            return "CONFORME";
        }

        if (
            [
                "OBSERVADO",
                "WARNING",
                "WARN"
            ].includes(normalized)
        ) {
            return "OBSERVADO";
        }

        if (
            [
                "CRITICO",
                "CRITICAL",
                "FAILED",
                "ERROR"
            ].includes(normalized)
        ) {
            return "CRITICO";
        }

        return normalized;
    }

    function formatValue(value) {
        const number =
            Number(value);

        if (Number.isFinite(number)) {
            return new Intl.NumberFormat(
                "es-PE",
                {
                    maximumFractionDigits: 2
                }
            ).format(number);
        }

        return String(
            value ?? "—"
        );
    }

    function formatNumber(value) {
        return new Intl.NumberFormat(
            "es-PE"
        ).format(
            numberValue(value)
        );
    }

    function formatPercentage(value) {
        return (
            numberValue(value)
                .toFixed(2)
            + "%"
        );
    }

    function formatDuration(
        milliseconds
    ) {
        const value =
            numberValue(milliseconds);

        if (value < 1000) {
            return `${value} ms`;
        }

        return (
            (value / 1000)
                .toFixed(2)
            + " s"
        );
    }

    function formatDateTime(value) {
        if (!value) {
            return "—";
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return String(value);
        }

        return new Intl.DateTimeFormat(
            "es-PE",
            {
                dateStyle: "medium",
                timeStyle: "short"
            }
        ).format(date);
    }

    function numberValue(value) {
        const parsed =
            Number(value);

        return Number.isFinite(parsed)
            ? parsed
            : 0;
    }

    function setText(id, value) {
        const element =
            document.getElementById(id);

        if (element) {
            element.textContent =
                value;
        }
    }

    function showError(message) {
        loadingSection.hidden = true;
        contentSection.hidden = true;
        errorSection.hidden = false;
        errorMessage.textContent =
            message;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    initialize();
})();
