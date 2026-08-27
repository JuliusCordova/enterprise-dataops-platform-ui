import json
import re
import time
import uuid
from datetime import datetime
from typing import Any

from fastapi import HTTPException
from google.cloud import bigquery


SUPPORTED_EXECUTION_RULES = {
    "NOT_NULL",
    "UNIQUE",
    "VALUE_RANGE",
    "ALLOWED_VALUES",
    "ROW_COUNT_MIN"
}


class DataQualityExecutionEngine:

    def __init__(
        self,
        client: bigquery.Client,
        repository
    ):
        self.client = client
        self.repository = repository

    @staticmethod
    def validate_identifier(
        value: str,
        field_name: str
    ) -> str:
        """
        Valida identificadores de proyecto, dataset, tabla o columna.

        No permite SQL libre ni caracteres especiales fuera de los
        admitidos para identificadores controlados.
        """
        if not value:
            raise HTTPException(
                status_code=400,
                detail=f"{field_name} es obligatorio"
            )

        if not re.fullmatch(
            r"[A-Za-z0-9_\-]+",
            value
        ):
            raise HTTPException(
                status_code=400,
                detail=f"Identificador inválido: {field_name}"
            )

        return value

    @staticmethod
    def parse_rule_parameters(
        value: Any
    ) -> dict:
        """
        Convierte los parámetros JSON almacenados en BigQuery
        en un diccionario Python.
        """
        if value is None:
            return {}

        if isinstance(value, dict):
            return value

        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return {}

        try:
            return dict(value)
        except (TypeError, ValueError):
            return {}

    @staticmethod
    def classify_status(
        failed_percentage: float,
        warning_threshold: float,
        critical_threshold: float
    ) -> str:
        """
        Clasifica el resultado según el porcentaje de incumplimiento.
        """
        if failed_percentage >= critical_threshold:
            return "CRITICO"

        if failed_percentage >= warning_threshold:
            return "OBSERVADO"

        return "CONFORME"

    def build_filter(
        self,
        configuration: dict,
        business_date: str | None
    ) -> tuple[str, list]:
        """
        Construye el filtro parametrizado por fecha de negocio.

        En esta versión no ejecuta table_filter libre para evitar
        SQL dinámico no validado.
        """
        filters = []
        parameters = []

        date_column = configuration.get(
            "date_column"
        )

        if business_date and date_column:
            date_column = self.validate_identifier(
                date_column,
                "date_column"
            )

            try:
                parsed_date = datetime.strptime(
                    business_date,
                    "%Y-%m-%d"
                ).date()
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "business_date debe tener formato "
                        "YYYY-MM-DD"
                    )
                )

            filters.append(
                f"DATE(`{date_column}`) = @business_date"
            )

            parameters.append(
                bigquery.ScalarQueryParameter(
                    "business_date",
                    "DATE",
                    parsed_date
                )
            )

        where_clause = (
            "WHERE " + " AND ".join(filters)
            if filters
            else ""
        )

        return where_clause, parameters

    def get_row_count(
        self,
        table_ref: str,
        where_clause: str,
        parameters: list
    ) -> int:
        """
        Obtiene el total de registros que serán evaluados.
        """
        query = f"""
        SELECT
          COUNT(*) AS row_count
        FROM `{table_ref}`
        {where_clause}
        """

        rows = list(
            self.client.query(
                query,
                job_config=bigquery.QueryJobConfig(
                    query_parameters=parameters
                )
            ).result()
        )

        if not rows:
            return 0

        return int(
            rows[0]["row_count"] or 0
        )

    def execute_rule(
        self,
        rule: dict,
        table_ref: str,
        where_clause: str,
        base_parameters: list,
        evaluated_rows: int
    ) -> dict:
        """
        Ejecuta una regla individual y devuelve sus métricas.
        """
        rule_type = rule.get("rule_type")
        column_name = rule.get("column_name")

        warning_threshold = float(
            rule.get("warning_threshold") or 0.0
        )

        critical_threshold = float(
            rule.get("critical_threshold") or 0.0
        )

        parameters = list(base_parameters)

        if rule_type not in SUPPORTED_EXECUTION_RULES:
            return {
                "failed_rows": 0,
                "failed_percentage": 0.0,
                "quality_score": 0.0,
                "status": "ERROR",
                "message": (
                    f"La regla {rule_type} todavía "
                    "no está soportada por el motor."
                )
            }

        rule_parameters = self.parse_rule_parameters(
            rule.get("rule_parameters")
        )

        if rule_type == "ROW_COUNT_MIN":
            min_rows = rule_parameters.get(
                "min_rows"
            )

            if min_rows is None:
                return {
                    "failed_rows": 0,
                    "failed_percentage": 0.0,
                    "quality_score": 0.0,
                    "status": "ERROR",
                    "message": (
                        "ROW_COUNT_MIN requiere "
                        "el parámetro min_rows."
                    )
                }

            try:
                min_rows = int(min_rows)
            except (TypeError, ValueError):
                return {
                    "failed_rows": 0,
                    "failed_percentage": 0.0,
                    "quality_score": 0.0,
                    "status": "ERROR",
                    "message": (
                        "min_rows debe ser un número entero."
                    )
                }

            if min_rows < 0:
                return {
                    "failed_rows": 0,
                    "failed_percentage": 0.0,
                    "quality_score": 0.0,
                    "status": "ERROR",
                    "message": (
                        "min_rows no puede ser negativo."
                    )
                }

            failed_rows = max(
                0,
                min_rows - evaluated_rows
            )

            failed_percentage = (
                round(
                    failed_rows * 100 / min_rows,
                    6
                )
                if min_rows > 0
                else 0.0
            )

            quality_score = round(
                max(
                    0.0,
                    100.0 - failed_percentage
                ),
                6
            )

            status = self.classify_status(
                failed_percentage=failed_percentage,
                warning_threshold=warning_threshold,
                critical_threshold=critical_threshold
            )

            return {
                "failed_rows": failed_rows,
                "failed_percentage": failed_percentage,
                "quality_score": quality_score,
                "status": status,
                "message": (
                    f"La regla {rule.get('rule_name')} esperaba "
                    f"como mínimo {min_rows} registros y encontró "
                    f"{evaluated_rows}."
                )
            }

        column_name = self.validate_identifier(
            column_name,
            "column_name"
        )

        if rule_type == "NOT_NULL":
            expression = (
                f"COUNTIF(`{column_name}` IS NULL)"
            )

        elif rule_type == "UNIQUE":
            expression = (
                f"COUNT(*) - "
                f"COUNT(DISTINCT `{column_name}`)"
            )

        elif rule_type == "VALUE_RANGE":
            range_conditions = []

            if "min_value" in rule_parameters:
                try:
                    min_value = float(
                        rule_parameters["min_value"]
                    )
                except (TypeError, ValueError):
                    return {
                        "failed_rows": 0,
                        "failed_percentage": 0.0,
                        "quality_score": 0.0,
                        "status": "ERROR",
                        "message": (
                            "min_value debe ser numérico."
                        )
                    }

                range_conditions.append(
                    f"`{column_name}` < @min_value"
                )

                parameters.append(
                    bigquery.ScalarQueryParameter(
                        "min_value",
                        "FLOAT64",
                        min_value
                    )
                )

            if "max_value" in rule_parameters:
                try:
                    max_value = float(
                        rule_parameters["max_value"]
                    )
                except (TypeError, ValueError):
                    return {
                        "failed_rows": 0,
                        "failed_percentage": 0.0,
                        "quality_score": 0.0,
                        "status": "ERROR",
                        "message": (
                            "max_value debe ser numérico."
                        )
                    }

                range_conditions.append(
                    f"`{column_name}` > @max_value"
                )

                parameters.append(
                    bigquery.ScalarQueryParameter(
                        "max_value",
                        "FLOAT64",
                        max_value
                    )
                )

            if not range_conditions:
                return {
                    "failed_rows": 0,
                    "failed_percentage": 0.0,
                    "quality_score": 0.0,
                    "status": "ERROR",
                    "message": (
                        "VALUE_RANGE no contiene "
                        "min_value ni max_value."
                    )
                }

            expression = (
                "COUNTIF("
                + " OR ".join(range_conditions)
                + ")"
            )

        elif rule_type == "ALLOWED_VALUES":
            allowed_values = rule_parameters.get(
                "allowed_values"
            )

            if not allowed_values:
                return {
                    "failed_rows": 0,
                    "failed_percentage": 0.0,
                    "quality_score": 0.0,
                    "status": "ERROR",
                    "message": (
                        "ALLOWED_VALUES requiere "
                        "una lista allowed_values."
                    )
                }

            if not isinstance(
                allowed_values,
                list
            ):
                return {
                    "failed_rows": 0,
                    "failed_percentage": 0.0,
                    "quality_score": 0.0,
                    "status": "ERROR",
                    "message": (
                        "allowed_values debe ser una lista."
                    )
                }

            parameters.append(
                bigquery.ArrayQueryParameter(
                    "allowed_values",
                    "STRING",
                    [
                        str(value)
                        for value in allowed_values
                    ]
                )
            )

            expression = (
                f"COUNTIF("
                f"`{column_name}` IS NULL "
                f"OR CAST(`{column_name}` AS STRING) "
                f"NOT IN UNNEST(@allowed_values)"
                f")"
            )

        else:
            return {
                "failed_rows": 0,
                "failed_percentage": 0.0,
                "quality_score": 0.0,
                "status": "ERROR",
                "message": (
                    f"No se pudo construir la regla "
                    f"{rule_type}."
                )
            }

        query = f"""
        SELECT
          {expression} AS failed_rows
        FROM `{table_ref}`
        {where_clause}
        """

        rows = list(
            self.client.query(
                query,
                job_config=bigquery.QueryJobConfig(
                    query_parameters=parameters
                )
            ).result()
        )

        failed_rows = int(
            rows[0]["failed_rows"] or 0
        )

        failed_percentage = (
            round(
                failed_rows * 100 / evaluated_rows,
                6
            )
            if evaluated_rows
            else 0.0
        )

        quality_score = round(
            max(
                0.0,
                100.0 - failed_percentage
            ),
            6
        )

        status = self.classify_status(
            failed_percentage=failed_percentage,
            warning_threshold=warning_threshold,
            critical_threshold=critical_threshold
        )

        return {
            "failed_rows": failed_rows,
            "failed_percentage": failed_percentage,
            "quality_score": quality_score,
            "status": status,
            "message": (
                f"La regla {rule.get('rule_name')} evaluó "
                f"{evaluated_rows} registros y encontró "
                f"{failed_rows} incumplimientos "
                f"({failed_percentage}%)."
            )
        }

    def get_rule_issue_samples(
        self,
        rule: dict,
        configuration: dict,
        table_ref: str,
        where_clause: str,
        base_parameters: list,
        limit: int = 20
    ) -> list[dict]:
        """
        Obtiene una muestra controlada de registros que incumplen
        una regla.

        No aplica para ROW_COUNT_MIN porque es una regla a nivel tabla.
        """
        rule_type = rule.get("rule_type")
        column_name = rule.get("column_name")

        if rule_type == "ROW_COUNT_MIN":
            return []

        if rule_type not in {
            "NOT_NULL",
            "UNIQUE",
            "VALUE_RANGE",
            "ALLOWED_VALUES"
        }:
            return []

        column_name = self.validate_identifier(
            column_name,
            "column_name"
        )

        parameters = list(
            base_parameters
        )

        if rule_type == "UNIQUE":
            query = f"""
            SELECT
              CAST(`{column_name}` AS STRING)
                AS invalid_value,
              COUNT(*) AS duplicate_count
            FROM `{table_ref}`
            {where_clause}
            GROUP BY `{column_name}`
            HAVING COUNT(*) > 1
            ORDER BY duplicate_count DESC
            LIMIT {int(limit)}
            """

            rows = self.client.query(
                query,
                job_config=bigquery.QueryJobConfig(
                    query_parameters=parameters
                )
            ).result()

            return [
                {
                    "business_key": (
                        str(row["invalid_value"])
                        if row["invalid_value"] is not None
                        else None
                    ),
                    "invalid_value": (
                        str(row["invalid_value"])
                        if row["invalid_value"] is not None
                        else None
                    ),
                    "source_payload": json.dumps(
                        {
                            "duplicate_count": int(
                                row["duplicate_count"]
                            )
                        },
                        ensure_ascii=False,
                        default=str
                    )
                }
                for row in rows
            ]

        issue_conditions = []

        if rule_type == "NOT_NULL":
            issue_conditions.append(
                f"`{column_name}` IS NULL"
            )

        elif rule_type == "VALUE_RANGE":
            rule_parameters = (
                self.parse_rule_parameters(
                    rule.get("rule_parameters")
                )
            )

            if "min_value" in rule_parameters:
                issue_conditions.append(
                    f"`{column_name}` < @sample_min_value"
                )

                parameters.append(
                    bigquery.ScalarQueryParameter(
                        "sample_min_value",
                        "FLOAT64",
                        float(
                            rule_parameters["min_value"]
                        )
                    )
                )

            if "max_value" in rule_parameters:
                issue_conditions.append(
                    f"`{column_name}` > @sample_max_value"
                )

                parameters.append(
                    bigquery.ScalarQueryParameter(
                        "sample_max_value",
                        "FLOAT64",
                        float(
                            rule_parameters["max_value"]
                        )
                    )
                )

        elif rule_type == "ALLOWED_VALUES":
            rule_parameters = (
                self.parse_rule_parameters(
                    rule.get("rule_parameters")
                )
            )

            allowed_values = rule_parameters.get(
                "allowed_values"
            ) or []

            if not allowed_values:
                return []

            parameters.append(
                bigquery.ArrayQueryParameter(
                    "sample_allowed_values",
                    "STRING",
                    [
                        str(value)
                        for value in allowed_values
                    ]
                )
            )

            issue_conditions.append(
                f"`{column_name}` IS NULL "
                f"OR CAST(`{column_name}` AS STRING) "
                f"NOT IN UNNEST(@sample_allowed_values)"
            )

        if not issue_conditions:
            return []

        issue_condition = (
            " OR ".join(issue_conditions)
        )

        business_keys = (
            configuration.get("business_key")
            or []
        )

        key_column = (
            business_keys[0]
            if business_keys
            else None
        )

        if key_column:
            key_column = self.validate_identifier(
                key_column,
                "business_key"
            )

            key_expression = (
                f"CAST(`{key_column}` AS STRING)"
            )
        else:
            key_expression = "NULL"

        filter_connector = (
            "AND"
            if where_clause
            else "WHERE"
        )

        query = f"""
        SELECT
          {key_expression} AS business_key,
          CAST(`{column_name}` AS STRING)
            AS invalid_value,
          TO_JSON_STRING(t) AS source_payload
        FROM `{table_ref}` AS t
        {where_clause}
        {filter_connector}
          ({issue_condition})
        LIMIT {int(limit)}
        """

        rows = self.client.query(
            query,
            job_config=bigquery.QueryJobConfig(
                query_parameters=parameters
            )
        ).result()

        return [
            {
                "business_key": (
                    str(row["business_key"])
                    if row["business_key"] is not None
                    else None
                ),
                "invalid_value": (
                    str(row["invalid_value"])
                    if row["invalid_value"] is not None
                    else None
                ),
                "source_payload": row[
                    "source_payload"
                ]
            }
            for row in rows
        ]

    def execute(
        self,
        request
    ) -> dict:
        """
        Ejecuta todas las reglas activas de una configuración,
        guarda resultados, muestras de incidencias y resumen general.
        """
        start_time = time.time()

        execution_id = (
            "DQEXEC_"
            f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_"
            f"{uuid.uuid4().hex[:8]}"
        )
        configuration = (
            self.repository.get_configuration(
                request.quality_config_id
            )
        )

        rules = self.repository.get_active_rules(
            request.quality_config_id
        )

        if not rules:
            raise HTTPException(
                status_code=400,
                detail=(
                    "La configuración no tiene reglas "
                    "activas para ejecutar"
                )
            )

        project_id = self.validate_identifier(
            configuration["project_id"],
            "project_id"
        )

        dataset_id = self.validate_identifier(
            configuration["dataset_id"],
            "dataset_id"
        )

        table_id = self.validate_identifier(
            configuration["table_id"],
            "table_id"
        )

        table_ref = (
            f"{project_id}.{dataset_id}.{table_id}"
        )

        self.client.get_table(
            table_ref
        )

        where_clause, base_parameters = (
            self.build_filter(
                configuration=configuration,
                business_date=request.business_date
            )
        )

        evaluated_rows = self.get_row_count(
            table_ref=table_ref,
            where_clause=where_clause,
            parameters=base_parameters
        )

        rule_results = []
        total_issue_samples = 0

        for rule in rules:
            try:
                result = self.execute_rule(
                    rule=rule,
                    table_ref=table_ref,
                    where_clause=where_clause,
                    base_parameters=base_parameters,
                    evaluated_rows=evaluated_rows
                )

            except Exception as error:
                result = {
                    "failed_rows": 0,
                    "failed_percentage": 0.0,
                    "quality_score": 0.0,
                    "status": "ERROR",
                    "message": str(error)
                }

            complete_result = {
                "execution_id": execution_id,
                "quality_config_id": (
                    request.quality_config_id
                ),
                "rule_id": rule["rule_id"],
                "rule_name": rule.get(
                    "rule_name"
                ),
                "rule_dimension": rule.get(
                    "rule_dimension"
                ),
                "rule_type": rule.get(
                    "rule_type"
                ),
                "column_name": rule.get(
                    "column_name"
                ),
                "evaluated_rows": evaluated_rows,
                "failed_rows": result[
                    "failed_rows"
                ],
                "failed_percentage": result[
                    "failed_percentage"
                ],
                "quality_score": result[
                    "quality_score"
                ],
                "observed_value": result[
                    "failed_percentage"
                ],
                "warning_threshold": float(
                    rule.get("warning_threshold")
                    or 0.0
                ),
                "critical_threshold": float(
                    rule.get("critical_threshold")
                    or 0.0
                ),
                "status": result[
                    "status"
                ],
                "message": result[
                    "message"
                ]
            }

            self.repository.save_rule_result(
                complete_result
            )

            rule_results.append(
                complete_result
            )

            if (
                result["failed_rows"] > 0
                and result["status"] in {
                    "OBSERVADO",
                    "CRITICO"
                }
            ):
                try:
                    issue_samples = (
                        self.get_rule_issue_samples(
                            rule=rule,
                            configuration=configuration,
                            table_ref=table_ref,
                            where_clause=where_clause,
                            base_parameters=base_parameters,
                            limit=20
                        )
                    )

                    for sample in issue_samples:
                        self.repository.save_issue_detail({
                            "execution_id": execution_id,
                            "quality_config_id": (
                                request.quality_config_id
                            ),
                            "rule_id": rule["rule_id"],
                            "business_key": sample.get(
                                "business_key"
                            ),
                            "column_name": rule.get(
                                "column_name"
                            ),
                            "invalid_value": sample.get(
                                "invalid_value"
                            ),
                            "issue_type": rule.get(
                                "rule_type"
                            ),
                            "issue_message": result.get(
                                "message"
                            ),
                            "severity": rule.get(
                                "severity_level"
                            ),
                            "source_payload": sample.get(
                                "source_payload"
                            )
                        })

                        total_issue_samples += 1

                except Exception as issue_error:
                    print(
                        "Error saving data quality issue samples. "
                        f"Execution: {execution_id}. "
                        f"Rule: {rule.get('rule_id')}. "
                        f"Error: {issue_error}"
                    )

        passed_rules = sum(
            1
            for result in rule_results
            if result["status"] == "CONFORME"
        )

        warning_rules = sum(
            1
            for result in rule_results
            if result["status"] == "OBSERVADO"
        )

        critical_rules = sum(
            1
            for result in rule_results
            if result["status"] == "CRITICO"
        )

        error_rules = sum(
            1
            for result in rule_results
            if result["status"] == "ERROR"
        )

        valid_scores = [
            result["quality_score"]
            for result in rule_results
            if result["status"] != "ERROR"
        ]

        overall_score = (
            round(
                sum(valid_scores) / len(valid_scores),
                6
            )
            if valid_scores
            else 0.0
        )

        if error_rules > 0:
            overall_status = "ERROR"

        elif critical_rules > 0:
            overall_status = "CRITICO"

        elif warning_rules > 0:
            overall_status = "OBSERVADO"

        else:
            overall_status = "CONFORME"

        duration_ms = int(
            (time.time() - start_time) * 1000
        )

        executive_summary = (
            f"Se evaluaron {len(rule_results)} reglas "
            f"sobre {evaluated_rows} registros. "
            f"El score general fue {overall_score}% "
            f"y el estado obtenido fue {overall_status}. "
            f"Se almacenaron {total_issue_samples} muestras "
            f"de incidencias."
        )

        if overall_status == "CONFORME":
            recommendation = (
                "No se requieren acciones correctivas inmediatas."
            )

        elif overall_status == "OBSERVADO":
            recommendation = (
                "Revisar las reglas observadas y los registros "
                "de muestra antes de publicar o consumir "
                "la información."
            )

        elif overall_status == "CRITICO":
            recommendation = (
                "Corregir las reglas críticas, revisar las "
                "incidencias registradas y reprocesar los "
                "datos afectados."
            )

        else:
            recommendation = (
                "Revisar los errores técnicos de ejecución "
                "antes de utilizar los resultados."
            )

        execution = {
            "execution_id": execution_id,
            "quality_config_id": (
                request.quality_config_id
            ),
            "requested_by": request.requested_by,
            "execution_mode": request.execution_mode,
            "business_date": request.business_date,
            "overall_score": overall_score,
            "overall_status": overall_status,
            "total_rules": len(rule_results),
            "passed_rules": passed_rules,
            "warning_rules": warning_rules,
            "critical_rules": critical_rules,
            "error_rules": error_rules,
            "profiled_row_count": evaluated_rows,
            "duration_ms": duration_ms,
            "executive_summary": executive_summary,
            "recommendation": recommendation,
            "error_message": None
        }

        self.repository.save_execution(
            execution
        )

        return {
            "execution": execution,
            "rule_results": rule_results,
            "issue_samples_saved": total_issue_samples
        }