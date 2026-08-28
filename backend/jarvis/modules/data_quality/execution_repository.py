from fastapi import HTTPException
from google.cloud import bigquery


class DataQualityExecutionRepository:

    def __init__(
        self,
        client: bigquery.Client,
        project_id: str,
        dataset_id: str
    ):
        self.client = client
        self.project_id = project_id
        self.dataset_id = dataset_id

    def get_configuration(
        self,
        quality_config_id: str
    ) -> dict:
        query = f"""
        SELECT *
        FROM `{self.project_id}.{self.dataset_id}.data_quality_config`
        WHERE quality_config_id = @quality_config_id
          AND active_flag = TRUE
          AND validation_status = 'VALIDATED'
        LIMIT 1
        """

        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter(
                    "quality_config_id",
                    "STRING",
                    quality_config_id
                )
            ]
        )

        rows = list(
            self.client.query(
                query,
                job_config=job_config
            ).result()
        )

        if not rows:
            raise HTTPException(
                status_code=404,
                detail=(
                    "No existe una configuración activa y validada "
                    f"con ID {quality_config_id}"
                )
            )

        return dict(rows[0].items())

    def get_active_rules(
        self,
        quality_config_id: str
    ) -> list[dict]:
        query = f"""
        SELECT
          rule_id,
          quality_config_id,
          rule_name,
          rule_dimension,
          rule_type,
          column_name,
          comparison_column,
          rule_parameters,
          warning_threshold,
          critical_threshold,
          severity_level,
          active_flag
        FROM `{self.project_id}.{self.dataset_id}.data_quality_rule`
        WHERE quality_config_id = @quality_config_id
          AND active_flag = TRUE
        ORDER BY created_at, rule_id
        """

        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter(
                    "quality_config_id",
                    "STRING",
                    quality_config_id
                )
            ]
        )

        rows = self.client.query(
            query,
            job_config=job_config
        ).result()

        return [
            dict(row.items())
            for row in rows
        ]

    def save_execution(
        self,
        execution: dict
    ) -> None:
        query = f"""
        INSERT INTO
        `{self.project_id}.{self.dataset_id}.data_quality_execution`
        (
          execution_id,
          quality_config_id,
          requested_by,
          execution_mode,
          execution_ts,
          business_date,

          overall_score,
          overall_status,

          total_rules,
          passed_rules,
          warning_rules,
          critical_rules,
          error_rules,

          profiled_row_count,
          duration_ms,

          executive_summary,
          recommendation,
          error_message,
          created_at
        )
        VALUES
        (
          @execution_id,
          @quality_config_id,
          @requested_by,
          @execution_mode,
          CURRENT_TIMESTAMP(),
          @business_date,

          @overall_score,
          @overall_status,

          @total_rules,
          @passed_rules,
          @warning_rules,
          @critical_rules,
          @error_rules,

          @profiled_row_count,
          @duration_ms,

          @executive_summary,
          @recommendation,
          @error_message,
          CURRENT_TIMESTAMP()
        )
        """

        parameters = [
            bigquery.ScalarQueryParameter(
                "execution_id",
                "STRING",
                execution["execution_id"]
            ),
            bigquery.ScalarQueryParameter(
                "quality_config_id",
                "STRING",
                execution["quality_config_id"]
            ),
            bigquery.ScalarQueryParameter(
                "requested_by",
                "STRING",
                execution.get("requested_by")
            ),
            bigquery.ScalarQueryParameter(
                "execution_mode",
                "STRING",
                execution.get("execution_mode")
            ),
            bigquery.ScalarQueryParameter(
                "business_date",
                "DATE",
                execution.get("business_date")
            ),
            bigquery.ScalarQueryParameter(
                "overall_score",
                "FLOAT64",
                execution.get("overall_score")
            ),
            bigquery.ScalarQueryParameter(
                "overall_status",
                "STRING",
                execution.get("overall_status")
            ),
            bigquery.ScalarQueryParameter(
                "total_rules",
                "INT64",
                execution.get("total_rules", 0)
            ),
            bigquery.ScalarQueryParameter(
                "passed_rules",
                "INT64",
                execution.get("passed_rules", 0)
            ),
            bigquery.ScalarQueryParameter(
                "warning_rules",
                "INT64",
                execution.get("warning_rules", 0)
            ),
            bigquery.ScalarQueryParameter(
                "critical_rules",
                "INT64",
                execution.get("critical_rules", 0)
            ),
            bigquery.ScalarQueryParameter(
                "error_rules",
                "INT64",
                execution.get("error_rules", 0)
            ),
            bigquery.ScalarQueryParameter(
                "profiled_row_count",
                "INT64",
                execution.get("profiled_row_count", 0)
            ),
            bigquery.ScalarQueryParameter(
                "duration_ms",
                "INT64",
                execution.get("duration_ms", 0)
            ),
            bigquery.ScalarQueryParameter(
                "executive_summary",
                "STRING",
                execution.get("executive_summary")
            ),
            bigquery.ScalarQueryParameter(
                "recommendation",
                "STRING",
                execution.get("recommendation")
            ),
            bigquery.ScalarQueryParameter(
                "error_message",
                "STRING",
                execution.get("error_message")
            )
        ]

        self.client.query(
            query,
            job_config=bigquery.QueryJobConfig(
                query_parameters=parameters
            )
        ).result()

    def save_rule_result(
        self,
        result: dict
    ) -> None:
        query = f"""
        INSERT INTO
        `{self.project_id}.{self.dataset_id}.data_quality_rule_result`
        (
          execution_id,
          quality_config_id,
          rule_id,

          rule_name,
          rule_dimension,
          rule_type,
          column_name,

          evaluated_rows,
          failed_rows,
          failed_percentage,
          quality_score,

          observed_value,
          warning_threshold,
          critical_threshold,

          status,
          message,
          created_at
        )
        VALUES
        (
          @execution_id,
          @quality_config_id,
          @rule_id,

          @rule_name,
          @rule_dimension,
          @rule_type,
          @column_name,

          @evaluated_rows,
          @failed_rows,
          @failed_percentage,
          @quality_score,

          @observed_value,
          @warning_threshold,
          @critical_threshold,

          @status,
          @message,
          CURRENT_TIMESTAMP()
        )
        """

        parameters = [
            bigquery.ScalarQueryParameter(
                "execution_id",
                "STRING",
                result["execution_id"]
            ),
            bigquery.ScalarQueryParameter(
                "quality_config_id",
                "STRING",
                result["quality_config_id"]
            ),
            bigquery.ScalarQueryParameter(
                "rule_id",
                "STRING",
                result["rule_id"]
            ),
            bigquery.ScalarQueryParameter(
                "rule_name",
                "STRING",
                result.get("rule_name")
            ),
            bigquery.ScalarQueryParameter(
                "rule_dimension",
                "STRING",
                result.get("rule_dimension")
            ),
            bigquery.ScalarQueryParameter(
                "rule_type",
                "STRING",
                result.get("rule_type")
            ),
            bigquery.ScalarQueryParameter(
                "column_name",
                "STRING",
                result.get("column_name")
            ),
            bigquery.ScalarQueryParameter(
                "evaluated_rows",
                "INT64",
                result.get("evaluated_rows", 0)
            ),
            bigquery.ScalarQueryParameter(
                "failed_rows",
                "INT64",
                result.get("failed_rows", 0)
            ),
            bigquery.ScalarQueryParameter(
                "failed_percentage",
                "FLOAT64",
                result.get("failed_percentage", 0.0)
            ),
            bigquery.ScalarQueryParameter(
                "quality_score",
                "FLOAT64",
                result.get("quality_score", 0.0)
            ),
            bigquery.ScalarQueryParameter(
                "observed_value",
                "FLOAT64",
                result.get("observed_value", 0.0)
            ),
            bigquery.ScalarQueryParameter(
                "warning_threshold",
                "FLOAT64",
                result.get("warning_threshold", 0.0)
            ),
            bigquery.ScalarQueryParameter(
                "critical_threshold",
                "FLOAT64",
                result.get("critical_threshold", 0.0)
            ),
            bigquery.ScalarQueryParameter(
                "status",
                "STRING",
                result.get("status")
            ),
            bigquery.ScalarQueryParameter(
                "message",
                "STRING",
                result.get("message")
            )
        ]

        self.client.query(
            query,
            job_config=bigquery.QueryJobConfig(
                query_parameters=parameters
            )
        ).result()

    def save_issue_detail(
        self,
        issue: dict
    ) -> None:
        query = f"""
        INSERT INTO
        `{self.project_id}.{self.dataset_id}.data_quality_issue_detail`
        (
          execution_id,
          quality_config_id,
          rule_id,

          business_key,
          column_name,
          invalid_value,

          issue_type,
          issue_message,
          severity,
          source_payload,

          created_at
        )
        VALUES
        (
          @execution_id,
          @quality_config_id,
          @rule_id,

          @business_key,
          @column_name,
          @invalid_value,

          @issue_type,
          @issue_message,
          @severity,
          @source_payload,

          CURRENT_TIMESTAMP()
        )
        """

        parameters = [
            bigquery.ScalarQueryParameter(
                "execution_id",
                "STRING",
                issue["execution_id"]
            ),
            bigquery.ScalarQueryParameter(
                "quality_config_id",
                "STRING",
                issue["quality_config_id"]
            ),
            bigquery.ScalarQueryParameter(
                "rule_id",
                "STRING",
                issue["rule_id"]
            ),
            bigquery.ScalarQueryParameter(
                "business_key",
                "STRING",
                issue.get("business_key")
            ),
            bigquery.ScalarQueryParameter(
                "column_name",
                "STRING",
                issue.get("column_name")
            ),
            bigquery.ScalarQueryParameter(
                "invalid_value",
                "STRING",
                issue.get("invalid_value")
            ),
            bigquery.ScalarQueryParameter(
                "issue_type",
                "STRING",
                issue.get("issue_type")
            ),
            bigquery.ScalarQueryParameter(
                "issue_message",
                "STRING",
                issue.get("issue_message")
            ),
            bigquery.ScalarQueryParameter(
                "severity",
                "STRING",
                issue.get("severity")
            ),
            bigquery.ScalarQueryParameter(
                "source_payload",
                "STRING",
                issue.get("source_payload")
            )
        ]

        self.client.query(
            query,
            job_config=bigquery.QueryJobConfig(
                query_parameters=parameters
            )
        ).result()

    def get_execution_issues(
        self,
        execution_id: str
    ) -> list[dict]:
        query = f"""
        SELECT *
        FROM `{self.project_id}.{self.dataset_id}.data_quality_issue_detail`
        WHERE execution_id = @execution_id
        ORDER BY rule_id, created_at
        """

        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter(
                    "execution_id",
                    "STRING",
                    execution_id
                )
            ]
        )

        rows = self.client.query(
            query,
            job_config=job_config
        ).result()

        return [
            dict(row.items())
            for row in rows
        ]

    def get_execution(
        self,
        execution_id: str
    ) -> dict:
        execution_query = f"""
        SELECT *
        FROM `{self.project_id}.{self.dataset_id}.data_quality_execution`
        WHERE execution_id = @execution_id
        LIMIT 1
        """

        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter(
                    "execution_id",
                    "STRING",
                    execution_id
                )
            ]
        )

        rows = list(
            self.client.query(
                execution_query,
                job_config=job_config
            ).result()
        )

        if not rows:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"No existe la ejecución {execution_id}"
                )
            )

        execution = dict(rows[0].items())

        result_query = f"""
        SELECT *
        FROM `{self.project_id}.{self.dataset_id}.data_quality_rule_result`
        WHERE execution_id = @execution_id
        ORDER BY rule_id
        """

        rule_rows = self.client.query(
            result_query,
            job_config=job_config
        ).result()

        return {
            "execution": execution,
            "rule_results": [
                dict(row.items())
                for row in rule_rows
            ],
            "issues": self.get_execution_issues(
                execution_id
            )
        }

    def get_latest_execution(
        self,
        quality_config_id: str
    ) -> dict:
        query = f"""
        SELECT execution_id
        FROM `{self.project_id}.{self.dataset_id}.data_quality_execution`
        WHERE quality_config_id = @quality_config_id
        ORDER BY execution_ts DESC
        LIMIT 1
        """

        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter(
                    "quality_config_id",
                    "STRING",
                    quality_config_id
                )
            ]
        )

        rows = list(
            self.client.query(
                query,
                job_config=job_config
            ).result()
        )

        if not rows:
            raise HTTPException(
                status_code=404,
                detail=(
                    "No existen ejecuciones para "
                    f"{quality_config_id}"
                )
            )

        return self.get_execution(
            rows[0]["execution_id"]
        )