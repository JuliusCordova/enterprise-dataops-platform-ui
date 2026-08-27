import json
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException
from google.cloud import bigquery

from .canonical_models import (
    QualityConfigurationArchiveRequest,
    QualityConfigurationCreateRequest,
    QualityConfigurationPublishRequest,
    QualityConfigurationStatusChangeRequest,
    QualityConfigurationUpdateRequest,
)


class CanonicalQualityConfigurationRepository:

    def __init__(
        self,
        client: bigquery.Client,
        project_id: str,
        dataset_id: str
    ):
        self.client = client
        self.project_id = project_id
        self.dataset_id = dataset_id

    def _table(self, name: str) -> str:
        return f"`{self.project_id}.{self.dataset_id}.{name}`"

    @staticmethod
    def _model_to_dict(model) -> dict:
        if hasattr(model, "model_dump"):
            return model.model_dump(mode="json")
        return model.dict()

    @staticmethod
    def _raise_row_version_conflict(expected: int, current: int) -> None:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "ROW_VERSION_CONFLICT",
                "expected": expected,
                "current": current
            }
        )

    def create_configuration(
        self,
        request: QualityConfigurationCreateRequest
    ) -> dict:
        configuration_id = f"QCFG_{uuid4().hex.upper()}"
        version_id = f"QVER_{uuid4().hex.upper()}"
        event_id = f"QEVT_{uuid4().hex.upper()}"
        payload = self._model_to_dict(request.payload)

        query = f"""
        BEGIN TRANSACTION;
        INSERT INTO {self._table("quality_configuration")}
        (configuration_id, configuration_type, name, description, domain_name,
         current_version_id, current_version_number, status, archived_flag,
         owner_email, created_by, updated_by, row_version, created_at,
         updated_at, archived_at)
        VALUES
        (@configuration_id, 'QUALITY', @name, @description, @domain_name,
         @version_id, 1, 'DRAFT', FALSE, @owner_email, @requested_by,
         @requested_by, 1, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), NULL);

        INSERT INTO {self._table("quality_configuration_version")}
        (version_id, configuration_id, version_number, version_status, payload,
         change_summary, created_by, created_at, published_by, published_at)
        VALUES
        (@version_id, @configuration_id, 1, 'DRAFT', PARSE_JSON(@payload),
         @change_summary, @requested_by, CURRENT_TIMESTAMP(), NULL, NULL);

        INSERT INTO {self._table("quality_configuration_audit_event")}
        (event_id, configuration_id, version_id, event_type, actor,
         event_payload, occurred_at)
        VALUES
        (@event_id, @configuration_id, @version_id, 'CONFIGURATION_CREATED',
         @requested_by, PARSE_JSON(@event_payload), CURRENT_TIMESTAMP());
        COMMIT TRANSACTION;
        """
        parameters = [
            bigquery.ScalarQueryParameter("configuration_id", "STRING", configuration_id),
            bigquery.ScalarQueryParameter("version_id", "STRING", version_id),
            bigquery.ScalarQueryParameter("event_id", "STRING", event_id),
            bigquery.ScalarQueryParameter("name", "STRING", request.name),
            bigquery.ScalarQueryParameter("description", "STRING", request.description),
            bigquery.ScalarQueryParameter("domain_name", "STRING", request.domain_name),
            bigquery.ScalarQueryParameter("owner_email", "STRING", request.owner_email),
            bigquery.ScalarQueryParameter("requested_by", "STRING", request.requested_by),
            bigquery.ScalarQueryParameter("change_summary", "STRING", request.change_summary),
            bigquery.ScalarQueryParameter("payload", "STRING", json.dumps(payload, ensure_ascii=False)),
            bigquery.ScalarQueryParameter(
                "event_payload", "STRING",
                json.dumps({"status": "DRAFT", "version_number": 1, "configuration_type": "QUALITY"})
            )
        ]
        self.client.query(query, job_config=bigquery.QueryJobConfig(query_parameters=parameters)).result()
        return self.get_configuration(configuration_id)

    def list_configurations(
        self,
        status: Optional[str] = None,
        include_archived: bool = False,
        limit: int = 100
    ) -> list[dict]:
        predicates = []
        if not include_archived:
            predicates.append("archived_flag = FALSE")
        if status:
            predicates.append("status = @status")
        where_clause = "WHERE " + " AND ".join(predicates) if predicates else ""
        query = f"""
        SELECT configuration_id, configuration_type, name, description,
               domain_name, current_version_id, current_version_number,
               status, archived_flag, owner_email, row_version,
               created_at, updated_at
        FROM {self._table("quality_configuration")}
        {where_clause}
        ORDER BY updated_at DESC
        LIMIT @limit
        """
        parameters = [bigquery.ScalarQueryParameter("limit", "INT64", limit)]
        if status:
            parameters.append(bigquery.ScalarQueryParameter("status", "STRING", status))
        rows = self.client.query(
            query,
            job_config=bigquery.QueryJobConfig(query_parameters=parameters)
        ).result()
        return [dict(row.items()) for row in rows]

    def get_configuration(self, configuration_id: str) -> dict:
        query = f"""
        SELECT c.configuration_id, c.configuration_type, c.name, c.description,
               c.domain_name, c.current_version_id, c.current_version_number,
               c.status, c.archived_flag, c.owner_email, c.row_version,
               c.created_at, c.updated_at, v.version_status, v.payload,
               v.change_summary, v.created_by AS version_created_by,
               v.created_at AS version_created_at
        FROM {self._table("quality_configuration")} c
        JOIN {self._table("quality_configuration_version")} v
          ON v.version_id = c.current_version_id
        WHERE c.configuration_id = @configuration_id
        LIMIT 1
        """
        rows = list(self.client.query(
            query,
            job_config=bigquery.QueryJobConfig(query_parameters=[
                bigquery.ScalarQueryParameter("configuration_id", "STRING", configuration_id)
            ])
        ).result())
        if not rows:
            raise HTTPException(status_code=404, detail=f"No existe la configuración canónica {configuration_id}")
        result = dict(rows[0].items())
        if isinstance(result.get("payload"), str):
            result["payload"] = json.loads(result["payload"])
        return result

    def update_configuration(
        self,
        configuration_id: str,
        request: QualityConfigurationUpdateRequest
    ) -> dict:
        current = self.get_configuration(configuration_id)
        if current.get("archived_flag"):
            raise HTTPException(status_code=409, detail={"code": "CONFIGURATION_ARCHIVED"})
        current_row_version = int(current["row_version"])
        if current_row_version != request.expected_row_version:
            self._raise_row_version_conflict(request.expected_row_version, current_row_version)

        version_number = int(current["current_version_number"]) + 1
        version_id = f"QVER_{uuid4().hex.upper()}"
        event_id = f"QEVT_{uuid4().hex.upper()}"
        payload = self._model_to_dict(request.payload)
        name = request.name or current["name"]
        description = request.description if request.description is not None else current.get("description")
        domain_name = request.domain_name if request.domain_name is not None else current.get("domain_name")
        owner_email = request.owner_email or current["owner_email"]

        query = f"""
        BEGIN TRANSACTION;
        ASSERT (SELECT row_version FROM {self._table("quality_configuration")}
                WHERE configuration_id = @configuration_id) = @expected_row_version
        AS 'ROW_VERSION_CONFLICT';

        UPDATE {self._table("quality_configuration")}
        SET name=@name, description=@description, domain_name=@domain_name,
            owner_email=@owner_email, current_version_id=@version_id,
            current_version_number=@version_number, updated_by=@requested_by,
            row_version=row_version+1, updated_at=CURRENT_TIMESTAMP()
        WHERE configuration_id=@configuration_id;

        INSERT INTO {self._table("quality_configuration_version")}
        (version_id, configuration_id, version_number, version_status, payload,
         change_summary, created_by, created_at, published_by, published_at)
        VALUES (@version_id, @configuration_id, @version_number, 'DRAFT',
                PARSE_JSON(@payload), @change_summary, @requested_by,
                CURRENT_TIMESTAMP(), NULL, NULL);

        INSERT INTO {self._table("quality_configuration_audit_event")}
        (event_id, configuration_id, version_id, event_type, actor,
         event_payload, occurred_at)
        VALUES (@event_id, @configuration_id, @version_id,
                'CONFIGURATION_UPDATED', @requested_by,
                PARSE_JSON(@event_payload), CURRENT_TIMESTAMP());
        COMMIT TRANSACTION;
        """
        parameters = [
            bigquery.ScalarQueryParameter("configuration_id", "STRING", configuration_id),
            bigquery.ScalarQueryParameter("expected_row_version", "INT64", request.expected_row_version),
            bigquery.ScalarQueryParameter("version_id", "STRING", version_id),
            bigquery.ScalarQueryParameter("event_id", "STRING", event_id),
            bigquery.ScalarQueryParameter("version_number", "INT64", version_number),
            bigquery.ScalarQueryParameter("name", "STRING", name),
            bigquery.ScalarQueryParameter("description", "STRING", description),
            bigquery.ScalarQueryParameter("domain_name", "STRING", domain_name),
            bigquery.ScalarQueryParameter("owner_email", "STRING", owner_email),
            bigquery.ScalarQueryParameter("requested_by", "STRING", request.requested_by),
            bigquery.ScalarQueryParameter("change_summary", "STRING", request.change_summary),
            bigquery.ScalarQueryParameter("payload", "STRING", json.dumps(payload, ensure_ascii=False)),
            bigquery.ScalarQueryParameter(
                "event_payload", "STRING",
                json.dumps({"previous_row_version": current_row_version,
                            "new_row_version": current_row_version + 1,
                            "version_number": version_number})
            )
        ]
        try:
            self.client.query(query, job_config=bigquery.QueryJobConfig(query_parameters=parameters)).result()
        except Exception as exc:
            if "ROW_VERSION_CONFLICT" in str(exc):
                raise HTTPException(status_code=409, detail={"code": "ROW_VERSION_CONFLICT", "expected": request.expected_row_version}) from exc
            raise
        return self.get_configuration(configuration_id)

    def list_versions(self, configuration_id: str) -> list[dict]:
        self.get_configuration(configuration_id)
        query = f"""
        SELECT version_id, configuration_id, version_number, version_status,
               payload, change_summary, created_by, created_at,
               published_by, published_at
        FROM {self._table("quality_configuration_version")}
        WHERE configuration_id=@configuration_id
        ORDER BY version_number DESC
        """
        rows = self.client.query(
            query,
            job_config=bigquery.QueryJobConfig(query_parameters=[
                bigquery.ScalarQueryParameter("configuration_id", "STRING", configuration_id)
            ])
        ).result()
        result = []
        for row in rows:
            item = dict(row.items())
            if isinstance(item.get("payload"), str):
                item["payload"] = json.loads(item["payload"])
            result.append(item)
        return result

    def change_status(
        self,
        configuration_id: str,
        request: QualityConfigurationStatusChangeRequest
    ) -> dict:
        current = self.get_configuration(configuration_id)
        current_status = str(current["status"])
        current_row_version = int(current["row_version"])
        target_status = request.status.value

        if current.get("archived_flag"):
            raise HTTPException(status_code=409, detail={"code": "CONFIGURATION_ARCHIVED"})
        if current_row_version != request.expected_row_version:
            self._raise_row_version_conflict(request.expected_row_version, current_row_version)

        allowed = {("ACTIVE", "INACTIVE"), ("INACTIVE", "ACTIVE")}
        if (current_status, target_status) not in allowed:
            raise HTTPException(
                status_code=409,
                detail={"code": "INVALID_STATUS_TRANSITION", "from": current_status, "to": target_status}
            )

        event_type = "CONFIGURATION_ACTIVATED" if target_status == "ACTIVE" else "CONFIGURATION_DEACTIVATED"
        self._mutate_lifecycle(
            configuration_id, current["current_version_id"], current_row_version,
            target_status, False, request.requested_by, event_type,
            {"from": current_status, "to": target_status, "reason": request.reason}
        )
        return self.get_configuration(configuration_id)

    def archive_configuration(
        self,
        configuration_id: str,
        request: QualityConfigurationArchiveRequest
    ) -> None:
        current = self.get_configuration(configuration_id)
        current_row_version = int(current["row_version"])
        if current.get("archived_flag"):
            raise HTTPException(status_code=409, detail={"code": "CONFIGURATION_ALREADY_ARCHIVED"})
        if current_row_version != request.expected_row_version:
            self._raise_row_version_conflict(request.expected_row_version, current_row_version)

        self._mutate_lifecycle(
            configuration_id, current["current_version_id"], current_row_version,
            "ARCHIVED", True, request.requested_by, "CONFIGURATION_ARCHIVED",
            {"reason": request.reason}
        )

    def publish_configuration(
        self,
        configuration_id: str,
        request: QualityConfigurationPublishRequest
    ) -> dict:
        current = self.get_configuration(configuration_id)
        current_row_version = int(current["row_version"])
        if current.get("archived_flag"):
            raise HTTPException(status_code=409, detail={"code": "CONFIGURATION_ARCHIVED"})
        if current_row_version != request.expected_row_version:
            self._raise_row_version_conflict(request.expected_row_version, current_row_version)
        if str(current["version_status"]) != "DRAFT":
            raise HTTPException(status_code=409, detail={"code": "CURRENT_VERSION_NOT_DRAFT"})

        event_id = f"QEVT_{uuid4().hex.upper()}"
        query = f"""
        BEGIN TRANSACTION;
        ASSERT (SELECT row_version FROM {self._table("quality_configuration")}
                WHERE configuration_id=@configuration_id) = @expected_row_version
        AS 'ROW_VERSION_CONFLICT';

        UPDATE {self._table("quality_configuration_version")}
        SET version_status='SUPERSEDED'
        WHERE configuration_id=@configuration_id
          AND version_status='PUBLISHED'
          AND version_id<>@version_id;

        UPDATE {self._table("quality_configuration_version")}
        SET version_status='PUBLISHED', published_by=@requested_by,
            published_at=CURRENT_TIMESTAMP()
        WHERE version_id=@version_id AND version_status='DRAFT';

        UPDATE {self._table("quality_configuration")}
        SET status='ACTIVE', updated_by=@requested_by,
            row_version=row_version+1, updated_at=CURRENT_TIMESTAMP()
        WHERE configuration_id=@configuration_id;

        INSERT INTO {self._table("quality_configuration_audit_event")}
        (event_id, configuration_id, version_id, event_type, actor,
         event_payload, occurred_at)
        VALUES (@event_id, @configuration_id, @version_id,
                'CONFIGURATION_PUBLISHED', @requested_by,
                PARSE_JSON(@event_payload), CURRENT_TIMESTAMP());
        COMMIT TRANSACTION;
        """
        parameters = [
            bigquery.ScalarQueryParameter("configuration_id", "STRING", configuration_id),
            bigquery.ScalarQueryParameter("version_id", "STRING", current["current_version_id"]),
            bigquery.ScalarQueryParameter("event_id", "STRING", event_id),
            bigquery.ScalarQueryParameter("expected_row_version", "INT64", request.expected_row_version),
            bigquery.ScalarQueryParameter("requested_by", "STRING", request.requested_by),
            bigquery.ScalarQueryParameter(
                "event_payload", "STRING",
                json.dumps({"version_number": int(current["current_version_number"]),
                            "previous_status": str(current["status"]),
                            "new_status": "ACTIVE"})
            )
        ]
        try:
            self.client.query(query, job_config=bigquery.QueryJobConfig(query_parameters=parameters)).result()
        except Exception as exc:
            if "ROW_VERSION_CONFLICT" in str(exc):
                raise HTTPException(status_code=409, detail={"code": "ROW_VERSION_CONFLICT", "expected": request.expected_row_version}) from exc
            raise
        return self.get_configuration(configuration_id)

    def _mutate_lifecycle(
        self,
        configuration_id: str,
        version_id: str,
        expected_row_version: int,
        status: str,
        archived_flag: bool,
        requested_by: str,
        event_type: str,
        event_payload: dict
    ) -> None:
        event_id = f"QEVT_{uuid4().hex.upper()}"
        query = f"""
        BEGIN TRANSACTION;
        ASSERT (SELECT row_version FROM {self._table("quality_configuration")}
                WHERE configuration_id=@configuration_id) = @expected_row_version
        AS 'ROW_VERSION_CONFLICT';

        UPDATE {self._table("quality_configuration")}
        SET status=@status, archived_flag=@archived_flag,
            archived_at=IF(@archived_flag, CURRENT_TIMESTAMP(), archived_at),
            updated_by=@requested_by, row_version=row_version+1,
            updated_at=CURRENT_TIMESTAMP()
        WHERE configuration_id=@configuration_id;

        INSERT INTO {self._table("quality_configuration_audit_event")}
        (event_id, configuration_id, version_id, event_type, actor,
         event_payload, occurred_at)
        VALUES (@event_id, @configuration_id, @version_id, @event_type,
                @requested_by, PARSE_JSON(@event_payload), CURRENT_TIMESTAMP());
        COMMIT TRANSACTION;
        """
        parameters = [
            bigquery.ScalarQueryParameter("configuration_id", "STRING", configuration_id),
            bigquery.ScalarQueryParameter("version_id", "STRING", version_id),
            bigquery.ScalarQueryParameter("event_id", "STRING", event_id),
            bigquery.ScalarQueryParameter("expected_row_version", "INT64", expected_row_version),
            bigquery.ScalarQueryParameter("status", "STRING", status),
            bigquery.ScalarQueryParameter("archived_flag", "BOOL", archived_flag),
            bigquery.ScalarQueryParameter("requested_by", "STRING", requested_by),
            bigquery.ScalarQueryParameter("event_type", "STRING", event_type),
            bigquery.ScalarQueryParameter("event_payload", "STRING", json.dumps(event_payload, ensure_ascii=False))
        ]
        try:
            self.client.query(query, job_config=bigquery.QueryJobConfig(query_parameters=parameters)).result()
        except Exception as exc:
            if "ROW_VERSION_CONFLICT" in str(exc):
                raise HTTPException(status_code=409, detail={"code": "ROW_VERSION_CONFLICT", "expected": expected_row_version}) from exc
            raise