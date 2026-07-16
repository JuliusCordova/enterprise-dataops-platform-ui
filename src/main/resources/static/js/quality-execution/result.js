(() => {
    "use strict";

    const STORAGE_KEY =
        "dataOpsQualityExecutionResult";

    const state = {
        executionContext: null,
        executionId: null,
        configuration: null,
        result: null,
        issues: null
    };

    const loading =
        document.getElementById(
            "quality-result-loading"
        );

    const content =
        document.getElementById(
            "quality-result-content"
        );

    const errorSection =
        document.getElementById(
            "quality-result-error"
        );

    const errorMessage =
        document.getElementById(
            "quality-result-error-message"
        );

    async function initialize() {
        const rawContext =
            sessionStorage.getItem(
                STORAGE_KEY
            );

        if (!rawContext) {
            showError(
                "No existe una ejecución disponible en esta sesión."
            );
            return;
        }

        try {
            state.executionContext =
                JSON.parse(rawContext);

            state.executionId =
                state.executionContext
                    .executionId;

            state.configuration =
                state.executionContext
                    .configuration
                || {};

            if (!state.executionId) {
                throw new Error(
                    "No se encontró execution_id."
                );
            }

            const [
                resultResponse,
                issuesResponse
            ] = await Promise.all([
                apiRequest(
                    `/ui/api/quality-execution/result/${encodeURIComponent(
                        state.executionId
                    )}`
                ),

                apiRequest(
                    `/ui/api/quality-execution/issues/${encodeURIComponent(
                        state.executionId
                    )}`
                ).catch(() => ({
                    total: 0,
                    issues: []
                }))
            ]);

            state.result =
                resultResponse;

            state.issues =
                issuesResponse;

            render();

            loading.hidden = true;
            content.hidden = false;

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
        const response = await fetch(
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

    function render() {
        const ruleResults =
            extractRuleResults(
                state.result
            );

        const summary =
            calculateSummary(
                ruleResults
            );

        renderHeader(
            summary
        );

        renderMetrics(
            summary
        );

        renderRuleResults(
            ruleResults
        );

        renderIssues();

        renderExplanation(
            summary
        );

        bindActions();
    }

    function extractRuleResults(
        payload
    ) {
        const candidates = [
            payload.rule_results,
            payload.results,
            payload.rules,
            payload.execution_results,
            payload.data?.rule_results,
            payload.result?.rule_results
        ];

        for (const candidate of candidates) {
            if (Array.isArray(candidate)) {
                return candidate;
            }
        }

        if (
            Array.isArray(
                state.executionContext
                    ?.executionResponse
                    ?.rule_results
            )
        ) {
            return state.executionContext
                .executionResponse
                .rule_results;
        }

        return [];
    }

    function calculateSummary(
        ruleResults
    ) {
        const normalized =
            ruleResults.map(
                normalizeRuleResult
            );

        const total =
            normalized.length;

        const conforme =
            normalized.filter(
                item =>
                    item.status === "CONFORME"
            ).length;

        const observed =
            normalized.filter(
                item =>
                    item.status === "OBSERVADO"
            ).length;

        const critical =
            normalized.filter(
                item =>
                    item.status === "CRITICO"
                    || item.status === "ERROR"
            ).length;

        const qualityScore =
            total > 0
                ? round(
                    normalized.reduce(
                        (sum, item) =>
                            sum
                            + item.qualityScore,
                        0
                    ) / total,
                    1
                )
                : 0;

        let overallStatus =
            "CONFORME";

        if (critical > 0) {
            overallStatus =
                "CRITICO";

        } else if (observed > 0) {
            overallStatus =
                "OBSERVADO";
        }

        return {
            normalized,
            total,
            conforme,
            observed,
            critical,
            qualityScore,
            overallStatus
        };
    }

    function normalizeRuleResult(
        item
    ) {
        return {
            ruleName:
                item.rule_name
                || item.name
                || "Regla de calidad",

            ruleType:
                item.rule_type
                || "—",

            columnName:
                item.column_name
                || "Tabla",

            evaluatedRows:
                numberValue(
                    item.evaluated_rows
                ),

            failedRows:
                numberValue(
                    item.failed_rows
                ),

            failedPercentage:
                numberValue(
                    item.failed_percentage
                ),

            qualityScore:
                numberValue(
                    item.quality_score
                ),

            status:
                normalizeStatus(
                    item.status
                ),

            message:
                item.message
                || "Sin detalle."
        };
    }

    function renderHeader(
        summary
    ) {
        setText(
            "quality-score",
            summary.qualityScore
        );

        const status =
            document.getElementById(
                "quality-status"
            );

        status.textContent =
            summary.overallStatus;

        status.className =
            "status-chip status-"
            + summary.overallStatus
                .toLowerCase();

        const configName =
            state.configuration
                .config_name
            || state.configuration
                .quality_config_id
            || "Configuración de calidad";

        setText(
            "quality-config-name",
            configName
        );

        setText(
            "quality-dataset",
            state.configuration
                .dataset_id
            || "—"
        );

        setText(
            "quality-table",
            state.configuration
                .table_id
            || "—"
        );

        setText(
            "quality-execution-id",
            state.executionId
        );

        setText(
            "quality-executive-summary",
            buildExecutiveSummary(
                summary
            )
        );
    }

    function renderMetrics(
        summary
    ) {
        setText(
            "metric-total-rules",
            summary.total
        );

        setText(
            "metric-conforme",
            summary.conforme
        );

        setText(
            "metric-observed",
            summary.observed
        );

        setText(
            "metric-critical",
            summary.critical
        );

        const issueCount =
            resolveIssueCount();

        setText(
            "metric-issues",
            issueCount
        );

        setText(
            "result-rule-count",
            `${summary.total} reglas`
        );
    }

    function renderRuleResults(
        ruleResults
    ) {
        const body =
            document.getElementById(
                "quality-rule-result-body"
            );

        body.innerHTML = "";

        const normalized =
            ruleResults.map(
                normalizeRuleResult
            );

        if (
            normalized.length === 0
        ) {
            body.innerHTML = `
                <tr>
                    <td colspan="7">
                        No se encontraron resultados por regla.
                    </td>
                </tr>
            `;
            return;
        }

        normalized.forEach(item => {
            const row =
                document.createElement(
                    "tr"
                );

            row.innerHTML = `
                <td>
                    <span class="table-status table-status-${escapeHtml(
                        item.status.toLowerCase()
                    )}">
                        ${escapeHtml(
                            item.status
                        )}
                    </span>
                </td>

                <td>
                    <strong>
                        ${escapeHtml(
                            item.ruleName
                        )}
                    </strong>

                    <br>

                    <small>
                        ${escapeHtml(
                            item.ruleType
                        )}
                    </small>
                </td>

                <td>
                    ${escapeHtml(
                        item.columnName
                    )}
                </td>

                <td>
                    ${formatNumber(
                        item.evaluatedRows
                    )}
                </td>

                <td>
                    ${formatNumber(
                        item.failedRows
                    )}
                </td>

                <td>
                    ${item.qualityScore}%
                </td>

                <td>
                    ${escapeHtml(
                        item.message
                    )}
                </td>
            `;

            body.appendChild(row);
        });
    }

    function renderIssues() {
        const container =
            document.getElementById(
                "issues-content"
            );

        const issues =
            extractIssues(
                state.issues
            );

        const count =
            resolveIssueCount();

        setText(
            "issue-count",
            `${count} incidencias`
        );

        if (
            issues.length === 0
        ) {
            container.innerHTML = `
                <div class="rules-list-empty">

                    <strong>
                        No se encontraron incidencias
                    </strong>

                    <p>
                        Todas las reglas evaluadas se encuentran conformes.
                    </p>

                </div>
            `;
            return;
        }

        container.innerHTML =
            issues.map(issue => `
                <article class="issue-card">

                    <div>

                        <span class="panel-eyebrow">
                            ${escapeHtml(
                                issue.difference_type
                                || issue.rule_type
                                || "INCIDENCIA"
                            )}
                        </span>

                        <h3>
                            ${escapeHtml(
                                issue.column_name
                                || issue.business_key
                                || "Registro observado"
                            )}
                        </h3>

                        <p>
                            ${escapeHtml(
                                issue.message
                                || issue.detail
                                || issue.source_payload
                                || "Requiere revisión."
                            )}
                        </p>

                    </div>

                    <span class="table-status table-status-observado">
                        ${escapeHtml(
                            issue.severity
                            || "OBSERVADO"
                        )}
                    </span>

                </article>
            `).join("");
    }

    function extractIssues(
        payload
    ) {
        if (Array.isArray(payload)) {
            return payload;
        }

        const candidates = [
            payload?.issues,
            payload?.items,
            payload?.data,
            payload?.samples
        ];

        for (const candidate of candidates) {
            if (Array.isArray(candidate)) {
                return candidate;
            }
        }

        return [];
    }

    function resolveIssueCount() {
        const explicit =
            state.issues?.total
            ?? state.issues
                ?.issue_samples_saved;

        if (
            explicit !== undefined
            && explicit !== null
        ) {
            return numberValue(
                explicit
            );
        }

        return extractIssues(
            state.issues
        ).length;
    }

    function renderExplanation(
        summary
    ) {
        setText(
            "quality-ai-summary",
            buildAiSummary(
                summary
            )
        );

        setText(
            "quality-ai-recommendation",
            buildRecommendation(
                summary
            )
        );
    }

    function buildExecutiveSummary(
        summary
    ) {
        if (
            summary.overallStatus
            === "CONFORME"
        ) {
            return (
                `La evaluación finalizó con ${summary.qualityScore}% `
                + `de calidad. Las ${summary.total} reglas se ejecutaron `
                + `sin desviaciones críticas.`
            );
        }

        if (
            summary.overallStatus
            === "OBSERVADO"
        ) {
            return (
                `La evaluación terminó con ${summary.qualityScore}% `
                + `de calidad y ${summary.observed} reglas observadas.`
            );
        }

        return (
            `La evaluación identificó ${summary.critical} reglas críticas. `
            + `Se recomienda revisar las incidencias antes de consumir la tabla.`
        );
    }

    function buildAiSummary(
        summary
    ) {
        return (
            `Se ejecutaron ${summary.total} reglas. `
            + `${summary.conforme} resultaron conformes, `
            + `${summary.observed} observadas y `
            + `${summary.critical} críticas. `
            + `El score global calculado es ${summary.qualityScore}%.`
        );
    }

    function buildRecommendation(
        summary
    ) {
        if (
            summary.overallStatus
            === "CONFORME"
        ) {
            return (
                "La tabla puede continuar hacia sus procesos analíticos. "
                + "Mantén la ejecución periódica para detectar desviaciones."
            );
        }

        if (
            summary.overallStatus
            === "OBSERVADO"
        ) {
            return (
                "Revisa las reglas observadas y corrige los registros "
                + "antes de publicar nuevos datos."
            );
        }

        return (
            "Detén el consumo de la tabla en procesos críticos y prioriza "
            + "la remediación de las reglas con estado crítico."
        );
    }

    function bindActions() {
        document.getElementById(
            "print-quality-result"
        ).addEventListener(
            "click",
            () => window.print()
        );

        document.getElementById(
            "execute-again-button"
        ).addEventListener(
            "click",
            () => {
                window.location.assign(
                    "/quality-execution"
                );
            }
        );
    }

    function normalizeStatus(
        status
    ) {
        const normalized =
            String(
                status || "CONFORME"
            ).toUpperCase();

        if (
            [
                "CONFORME",
                "SUCCESS",
                "PASSED",
                "VALID"
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

    function setText(
        id,
        value
    ) {
        const element =
            document.getElementById(id);

        if (element) {
            element.textContent =
                value;
        }
    }

    function showError(
        text
    ) {
        loading.hidden = true;
        content.hidden = true;
        errorSection.hidden = false;
        errorMessage.textContent =
            text;
    }

    function numberValue(
        value
    ) {
        const parsed =
            Number(value);

        return Number.isFinite(parsed)
            ? parsed
            : 0;
    }

    function round(
        value,
        decimals
    ) {
        const factor =
            Math.pow(
                10,
                decimals
            );

        return Math.round(
            value * factor
        ) / factor;
    }

    function formatNumber(
        value
    ) {
        return new Intl.NumberFormat(
            "es-PE"
        ).format(
            numberValue(value)
        );
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

    initialize();
})();
