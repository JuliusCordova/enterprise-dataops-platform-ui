(() => {
    "use strict";

    const STORAGE_KEY =
        "dataOpsProfilingContext";

    const loadingSection =
        document.getElementById("report-loading");

    const contentSection =
        document.getElementById("report-content");

    const errorSection =
        document.getElementById("report-error");

    const errorMessage =
        document.getElementById(
            "report-error-message"
        );

    function initialize() {
        const rawContext =
            sessionStorage.getItem(STORAGE_KEY);

        if (!rawContext) {
            showError(
                "No existe un resultado de perfilado disponible."
            );
            return;
        }

        try {
            const context =
                JSON.parse(rawContext);

            const report =
                buildProfilingReport(context);

            renderReport(report);

            window.setTimeout(() => {
                loadingSection.hidden = true;
                contentSection.hidden = false;
            }, 450);

        } catch (error) {
            showError(error.message);
        }
    }

    function buildProfilingReport(context) {
        const payload =
            context.result || {};

        const columns =
            resolveColumnProfiles(payload);

        const rowCount =
            numberValue(
                payload.row_count
                ?? payload.total_rows
                ?? firstColumnValue(
                    columns,
                    "row_count"
                )
                ?? 0
            );

        const interpretedColumns =
            columns.map(column =>
                interpretColumn(
                    column,
                    rowCount
                )
            );

        const completeness =
            calculateCompleteness(
                interpretedColumns
            );

        const possibleKeys =
            interpretedColumns.filter(
                column =>
                    column.possibleKey
            );

        const warnings =
            interpretedColumns.filter(
                column =>
                    column.status !== "CONFORME"
            );

        const score =
            calculateScore(
                completeness,
                warnings,
                interpretedColumns
            );

        const status =
            resolveOverallStatus(score);

        const recommendations =
            buildRecommendations(
                interpretedColumns
            );

        const findings =
            buildFindings(
                interpretedColumns
            );

        return {
            connectionId:
                context.connectionId || "—",

            datasetId:
                context.datasetId || "—",

            tableId:
                context.tableId || "—",

            projectId:
                payload.project_id || "—",

            executedAt:
                context.executedAt,

            rowCount,

            columnCount:
                interpretedColumns.length,

            completeness,

            possibleKeyCount:
                possibleKeys.length,

            warningCount:
                warnings.length,

            score,

            status,

            columns:
                interpretedColumns,

            recommendations,

            findings
        };
    }

    function resolveColumnProfiles(payload) {
        const candidates = [
            payload.column_profiles,
            payload.columns,
            payload.profiles,
            payload.data?.column_profiles,
            payload.result?.column_profiles
        ];

        for (const candidate of candidates) {
            if (Array.isArray(candidate)) {
                return candidate;
            }
        }

        return [];
    }

    function interpretColumn(
        column,
        tableRowCount
    ) {
        const name =
            column.column_name
            ?? column.name
            ?? column.field_name
            ?? "unknown";

        const type =
            String(
                column.data_type
                ?? column.type
                ?? "UNKNOWN"
            ).toUpperCase();

        const rowCount =
            numberValue(
                column.row_count
                ?? tableRowCount
                ?? 0
            );

        const nullCount =
            numberValue(
                column.null_count
                ?? 0
            );

        const nullPercentage =
            normalizePercentage(
                column.null_percentage,
                rowCount > 0
                    ? (nullCount / rowCount) * 100
                    : 0
            );

        const distinctCount =
            numberValue(
                column.distinct_count
                ?? 0
            );

        const distinctPercentage =
            normalizePercentage(
                column.distinct_percentage,
                rowCount > 0
                    ? (distinctCount / rowCount) * 100
                    : 0
            );

        const possibleKey =
            rowCount > 0
            && nullPercentage === 0
            && distinctPercentage >= 99.5;

        let status = "CONFORME";
        let observation =
            "Sin observaciones relevantes.";

        if (nullPercentage >= 20) {
            status = "CRITICO";
            observation =
                "Alta proporción de valores nulos.";

        } else if (nullPercentage >= 5) {
            status = "OBSERVADO";
            observation =
                "La completitud requiere revisión.";

        } else if (
            distinctPercentage >= 99.5
            && !possibleKey
        ) {
            status = "OBSERVADO";
            observation =
                "Alta cardinalidad.";
        }

        const suggestedRules =
            suggestRules({
                type,
                possibleKey,
                nullPercentage,
                distinctCount,
                distinctPercentage
            });

        return {
            name,
            type,
            rowCount,
            nullCount,
            nullPercentage,
            distinctCount,
            distinctPercentage,
            minValue:
                column.min_value ?? null,
            maxValue:
                column.max_value ?? null,
            averageValue:
                column.average_value ?? null,
            standardDeviation:
                column.standard_deviation ?? null,
            possibleKey,
            status,
            observation,
            suggestedRules
        };
    }

    function suggestRules(column) {
        const rules = [];

        if (
            column.nullPercentage === 0
            || column.possibleKey
        ) {
            rules.push("NOT_NULL");
        }

        if (column.possibleKey) {
            rules.push("UNIQUE");
        }

        if (
            isNumeric(column.type)
        ) {
            rules.push("VALUE_RANGE");
        }

        if (
            isString(column.type)
            && column.distinctCount > 0
            && column.distinctCount <= 20
        ) {
            rules.push("ALLOWED_VALUES");
        }

        return [...new Set(rules)];
    }

    function calculateCompleteness(columns) {
        if (columns.length === 0) {
            return 0;
        }

        const averageNull =
            columns.reduce(
                (total, column) =>
                    total
                    + column.nullPercentage,
                0
            ) / columns.length;

        return round(
            Math.max(
                0,
                100 - averageNull
            ),
            1
        );
    }

    function calculateScore(
        completeness,
        warnings,
        columns
    ) {
        if (columns.length === 0) {
            return 0;
        }

        const criticalCount =
            warnings.filter(
                item =>
                    item.status === "CRITICO"
            ).length;

        const observedCount =
            warnings.filter(
                item =>
                    item.status === "OBSERVADO"
            ).length;

        const penalty =
            criticalCount * 8
            + observedCount * 2;

        return Math.round(
            Math.max(
                0,
                Math.min(
                    100,
                    completeness - penalty
                )
            )
        );
    }

    function resolveOverallStatus(score) {
        if (score >= 90) {
            return "CONFORME";
        }

        if (score >= 70) {
            return "OBSERVADO";
        }

        return "CRITICO";
    }

    function buildRecommendations(columns) {
        const recommendations = [];

        const possibleKey =
            columns.find(
                column =>
                    column.possibleKey
            );

        if (possibleKey) {
            recommendations.push({
                title:
                    `${possibleKey.name} parece una clave de negocio`,
                detail:
                    "Presenta alta unicidad y no contiene valores nulos.",
                rule:
                    "NOT_NULL + UNIQUE",
                priority:
                    "ALTA"
            });
        }

        const nullableColumn =
            columns
                .filter(
                    column =>
                        column.nullPercentage >= 5
                )
                .sort(
                    (a, b) =>
                        b.nullPercentage
                        - a.nullPercentage
                )[0];

        if (nullableColumn) {
            recommendations.push({
                title:
                    `Revisar completitud de ${nullableColumn.name}`,
                detail:
                    `${formatPercentage(
                        nullableColumn.nullPercentage
                    )} de valores nulos.`,
                rule:
                    "NOT_NULL",
                priority:
                    nullableColumn.nullPercentage >= 20
                        ? "CRITICA"
                        : "MEDIA"
            });
        }

        const lowCardinality =
            columns.find(
                column =>
                    isString(column.type)
                    && column.distinctCount > 0
                    && column.distinctCount <= 20
            );

        if (lowCardinality) {
            recommendations.push({
                title:
                    `Controlar el dominio de ${lowCardinality.name}`,
                detail:
                    `Solo se identificaron ${formatNumber(
                        lowCardinality.distinctCount
                    )} valores distintos.`,
                rule:
                    "ALLOWED_VALUES",
                priority:
                    "MEDIA"
            });
        }

        const numericColumn =
            columns.find(
                column =>
                    isNumeric(column.type)
            );

        if (numericColumn) {
            recommendations.push({
                title:
                    `Validar el rango de ${numericColumn.name}`,
                detail:
                    "La columna numérica puede protegerse con límites esperados.",
                rule:
                    "VALUE_RANGE",
                priority:
                    "MEDIA"
            });
        }

        if (recommendations.length === 0) {
            recommendations.push({
                title:
                    "Mantener monitoreo preventivo",
                detail:
                    "No se detectaron desviaciones relevantes en el perfilado inicial.",
                rule:
                    "ROW_COUNT_MIN",
                priority:
                    "BAJA"
            });
        }

        return recommendations.slice(0, 5);
    }

    function buildFindings(columns) {
        const findings = [];

        const critical =
            columns.filter(
                column =>
                    column.status === "CRITICO"
            );

        const observed =
            columns.filter(
                column =>
                    column.status === "OBSERVADO"
            );

        const keys =
            columns.filter(
                column =>
                    column.possibleKey
            );

        const lowCardinality =
            columns.filter(
                column =>
                    isString(column.type)
                    && column.distinctCount > 0
                    && column.distinctCount <= 20
            );

        findings.push({
            label: "Críticas",
            value: critical.length,
            description:
                "Columnas con riesgo alto de completitud.",
            status:
                critical.length > 0
                    ? "critical"
                    : "success"
        });

        findings.push({
            label: "Observadas",
            value: observed.length,
            description:
                "Columnas que requieren revisión.",
            status:
                observed.length > 0
                    ? "warning"
                    : "success"
        });

        findings.push({
            label: "Claves candidatas",
            value: keys.length,
            description:
                "Columnas con alta unicidad.",
            status: "neutral"
        });

        findings.push({
            label: "Dominios reducidos",
            value: lowCardinality.length,
            description:
                "Columnas aptas para valores permitidos.",
            status: "neutral"
        });

        return findings;
    }

    function renderReport(report) {
        setText(
            "overall-score",
            report.score
        );

        setText(
            "overall-status",
            report.status
        );

        const statusChip =
            document.getElementById(
                "overall-status"
            );

        statusChip.className =
            "status-chip status-"
            + report.status.toLowerCase();

        setText(
            "table-title",
            `${report.datasetId}.${report.tableId}`
        );

        setText(
            "source-connection",
            report.connectionId
        );

        setText(
            "source-dataset",
            report.datasetId
        );

        setText(
            "source-table",
            report.tableId
        );

        setText(
            "metric-rows",
            formatNumber(report.rowCount)
        );

        setText(
            "metric-columns",
            formatNumber(report.columnCount)
        );

        setText(
            "metric-completeness",
            formatPercentage(
                report.completeness
            )
        );

        setText(
            "metric-keys",
            report.possibleKeyCount
        );

        setText(
            "metric-warnings",
            report.warningCount
        );

        setText(
            "profiled-column-count",
            `${report.columnCount} columnas`
        );

        const executiveSummary =
            createExecutiveSummary(report);

        setText(
            "executive-summary",
            executiveSummary
        );

        setText(
            "gemini-summary",
            createGeminiSummary(report)
        );

        renderColumns(report.columns);

        renderRecommendations(
            report.recommendations
        );

        renderFindings(
            report.findings
        );

        configureActions(report);
    }

    function createExecutiveSummary(report) {
        if (report.status === "CONFORME") {
            return (
                `La tabla presenta una preparación alta para analítica, `
                + `con ${formatPercentage(
                    report.completeness
                )} de completitud y `
                + `${report.warningCount} observaciones.`
            );
        }

        if (report.status === "OBSERVADO") {
            return (
                `La tabla puede utilizarse con precaución. `
                + `Se identificaron ${report.warningCount} columnas `
                + `que requieren validación antes de su publicación.`
            );
        }

        return (
            `La tabla presenta riesgos relevantes de calidad. `
            + `Se recomienda atender los hallazgos críticos `
            + `antes de utilizarla en procesos analíticos.`
        );
    }

    function createGeminiSummary(report) {
        const keyText =
            report.possibleKeyCount > 0
                ? `Se identificaron ${report.possibleKeyCount} posibles claves de negocio. `
                : "No se identificó una clave de negocio concluyente. ";

        return (
            `Se analizaron ${report.columnCount} columnas y `
            + `${formatNumber(
                report.rowCount
            )} registros. `
            + keyText
            + `El score inicial de preparación es ${report.score}/100. `
            + `Las recomendaciones se construyeron utilizando `
            + `únicamente las métricas reales del perfilado.`
        );
    }

    function renderColumns(columns) {
        const body =
            document.getElementById(
                "column-profile-body"
            );

        body.innerHTML = "";

        columns.forEach(column => {
            const row =
                document.createElement("tr");

            const ruleText =
                column.suggestedRules.length > 0
                    ? column.suggestedRules.join(", ")
                    : "Monitoreo";

            row.innerHTML = `
                <td>
                    <div class="column-name">
                        ${escapeHtml(column.name)}
                        ${
                            column.possibleKey
                                ? '<span class="key-badge">KEY</span>'
                                : ""
                        }
                    </div>
                </td>

                <td>
                    <span class="data-type">
                        ${escapeHtml(column.type)}
                    </span>
                </td>

                <td>
                    ${formatPercentage(
                        column.nullPercentage
                    )}
                </td>

                <td>
                    ${formatNumber(
                        column.distinctCount
                    )}
                </td>

                <td>
                    <span class="table-status table-status-${column.status.toLowerCase()}">
                        ${column.status}
                    </span>
                </td>

                <td>
                    ${escapeHtml(ruleText)}
                </td>
            `;

            body.appendChild(row);
        });
    }

    function renderRecommendations(
        recommendations
    ) {
        const container =
            document.getElementById(
                "recommendation-list"
            );

        container.innerHTML = "";

        recommendations.forEach(
            recommendation => {
                const card =
                    document.createElement("article");

                card.className =
                    "recommendation-card";

                card.innerHTML = `
                    <div class="recommendation-topline">
                        <strong>
                            ${escapeHtml(
                                recommendation.title
                            )}
                        </strong>

                        <span>
                            ${escapeHtml(
                                recommendation.priority
                            )}
                        </span>
                    </div>

                    <p>
                        ${escapeHtml(
                            recommendation.detail
                        )}
                    </p>

                    <small>
                        Regla sugerida:
                        ${escapeHtml(
                            recommendation.rule
                        )}
                    </small>
                `;

                container.appendChild(card);
            }
        );
    }

    function renderFindings(findings) {
        const container =
            document.getElementById(
                "findings-grid"
            );

        container.innerHTML = "";

        findings.forEach(finding => {
            const card =
                document.createElement("article");

            card.className =
                `finding-card finding-${finding.status}`;

            card.innerHTML = `
                <span>
                    ${escapeHtml(finding.label)}
                </span>

                <strong>
                    ${escapeHtml(finding.value)}
                </strong>

                <p>
                    ${escapeHtml(
                        finding.description
                    )}
                </p>
            `;

            container.appendChild(card);
        });
    }

    function configureActions(report) {
        const continueButton =
            document.getElementById(
                "continue-rules-button"
            );

        const reportButton =
            document.getElementById(
                "download-report-button"
            );

        continueButton.addEventListener(
            "click",
            () => {
                sessionStorage.setItem(
                    "dataOpsRuleRecommendations",
                    JSON.stringify({
                        source: {
                            connectionId:
                                report.connectionId,
                            datasetId:
                                report.datasetId,
                            tableId:
                                report.tableId
                        },
                        recommendations:
                            report.recommendations,
                        columns:
                            report.columns
                    })
                );

                window.location.assign(
                    "/quality-rules"
                );
            }
        );

        reportButton.addEventListener(
            "click",
            () => {
                window.print();
            }
        );
    }

    function firstColumnValue(
        columns,
        property
    ) {
        if (
            !Array.isArray(columns)
            || columns.length === 0
        ) {
            return null;
        }

        return columns[0]?.[property];
    }

    function normalizePercentage(
        explicitValue,
        fallbackValue
    ) {
        if (
            explicitValue === null
            || explicitValue === undefined
        ) {
            return round(
                numberValue(fallbackValue),
                2
            );
        }

        let value =
            numberValue(explicitValue);

        if (value > 0 && value <= 1) {
            value *= 100;
        }

        return round(value, 2);
    }

    function numberValue(value) {
        const parsed = Number(value);

        return Number.isFinite(parsed)
            ? parsed
            : 0;
    }

    function isNumeric(type) {
        return [
            "INTEGER",
            "INT64",
            "FLOAT",
            "FLOAT64",
            "NUMERIC",
            "BIGNUMERIC",
            "DECIMAL"
        ].some(
            numericType =>
                type.includes(numericType)
        );
    }

    function isString(type) {
        return (
            type.includes("STRING")
            || type.includes("VARCHAR")
            || type.includes("TEXT")
        );
    }

    function round(value, decimals) {
        const factor =
            Math.pow(10, decimals);

        return Math.round(
            value * factor
        ) / factor;
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
            round(
                numberValue(value),
                1
            ) + "%"
        );
    }

    function setText(id, value) {
        const element =
            document.getElementById(id);

        if (element) {
            element.textContent = value;
        }
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function showError(message) {
        loadingSection.hidden = true;
        contentSection.hidden = true;
        errorSection.hidden = false;
        errorMessage.textContent = message;
    }

    initialize();
})();
