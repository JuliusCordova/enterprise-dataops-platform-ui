from __future__ import annotations

import json
from uuid import uuid4

from fastapi import HTTPException
from google.cloud import bigquery

from .models import (
    ReconciliationCreateRequest,
    ReconciliationMutationRequest,
    ReconciliationStatusRequest,
    ReconciliationUpdateRequest,
    ReconciliationVersionCreateRequest,
)


class CanonicalReconciliationRepository:
    def __init__(self, client: bigquery.Client, project_id: str, dataset_id: str):
        self.client = client
        self.project_id = project_id
        self.dataset_id = dataset_id

    def _table(self, name: str) -> str:
        return f"`{self.project_id}.{self.dataset_id}.{name}`"

    @staticmethod
    def _dump(model) -> dict:
        return model.model_dump(mode="json") if hasattr(model, "model_dump") else model.dict()

    @staticmethod
    def _conflict(expected: int, current: int):
        raise HTTPException(status_code=409, detail={"code": "ROW_VERSION_CONFLICT", "expected": expected, "current": current})

    def _query(self, sql: str, parameters: list):
        return self.client.query(sql, job_config=bigquery.QueryJobConfig(query_parameters=parameters)).result()

    def get(self, configuration_id: str) -> dict:
        sql = f"""
        SELECT c.*, v.version_status, v.payload, v.validation_result,
               v.change_summary, v.created_by AS version_created_by,
               v.created_at AS version_created_at
        FROM {self._table('reconciliation_configuration')} c
        JOIN {self._table('reconciliation_configuration_version')} v
          ON v.version_id=c.current_version_id
        WHERE c.configuration_id=@configuration_id
        LIMIT 1
        """
        rows = list(self._query(sql, [bigquery.ScalarQueryParameter("configuration_id", "STRING", configuration_id)]))
        if not rows:
            raise HTTPException(status_code=404, detail=f"No existe la configuración canónica {configuration_id}")
        result = dict(rows[0].items())
        for field in ("payload", "validation_result"):
            if isinstance(result.get(field), str):
                result[field] = json.loads(result[field])
        return result

    def list(self, status: str | None = None, include_archived: bool = False, limit: int = 100) -> list[dict]:
        predicates = []
        params = [bigquery.ScalarQueryParameter("limit", "INT64", limit)]
        if not include_archived:
            predicates.append("archived_flag=FALSE")
        if status:
            predicates.append("status=@status")
            params.append(bigquery.ScalarQueryParameter("status", "STRING", status))
        where = "WHERE " + " AND ".join(predicates) if predicates else ""
        sql = f"SELECT * FROM {self._table('reconciliation_configuration')} {where} ORDER BY updated_at DESC LIMIT @limit"
        return [dict(r.items()) for r in self._query(sql, params)]

    def create(self, request: ReconciliationCreateRequest) -> dict:
        cid, vid, eid = (f"RCFG_{uuid4().hex.upper()}", f"RVER_{uuid4().hex.upper()}", f"REVT_{uuid4().hex.upper()}")
        payload = json.dumps(self._dump(request.payload), ensure_ascii=False)
        sql = f"""
        BEGIN TRANSACTION;
        INSERT INTO {self._table('reconciliation_configuration')}
        (configuration_id, configuration_type, name, description, domain_name,
         current_version_id, current_version_number, status, archived_flag,
         owner_email, created_by, updated_by, row_version, created_at, updated_at, archived_at)
        VALUES (@cid, 'RECONCILIATION', @name, @description, @domain_name,
                @vid, 1, 'DRAFT', FALSE, @owner, @actor, @actor, 1,
                CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), NULL);
        INSERT INTO {self._table('reconciliation_configuration_version')}
        (version_id, configuration_id, version_number, version_status, payload,
         validation_result, change_summary, created_by, created_at,
         validated_by, validated_at, published_by, published_at)
        VALUES (@vid, @cid, 1, 'DRAFT', PARSE_JSON(@payload), NULL,
                @summary, @actor, CURRENT_TIMESTAMP(), NULL, NULL, NULL, NULL);
        INSERT INTO {self._table('reconciliation_configuration_audit_event')}
        (event_id, configuration_id, version_id, event_type, actor, event_payload, occurred_at)
        VALUES (@eid, @cid, @vid, 'CONFIGURATION_CREATED', @actor,
                PARSE_JSON(@event), CURRENT_TIMESTAMP());
        COMMIT TRANSACTION;
        """
        p = [
            bigquery.ScalarQueryParameter("cid", "STRING", cid), bigquery.ScalarQueryParameter("vid", "STRING", vid),
            bigquery.ScalarQueryParameter("eid", "STRING", eid), bigquery.ScalarQueryParameter("name", "STRING", request.name),
            bigquery.ScalarQueryParameter("description", "STRING", request.description), bigquery.ScalarQueryParameter("domain_name", "STRING", request.domain_name),
            bigquery.ScalarQueryParameter("owner", "STRING", request.owner_email), bigquery.ScalarQueryParameter("actor", "STRING", request.requested_by),
            bigquery.ScalarQueryParameter("summary", "STRING", request.change_summary), bigquery.ScalarQueryParameter("payload", "STRING", payload),
            bigquery.ScalarQueryParameter("event", "STRING", json.dumps({"version_number": 1, "status": "DRAFT"}))
        ]
        self._query(sql, p)
        return self.get(cid)

    def _new_version(self, configuration_id: str, request, event_type: str) -> dict:
        current = self.get(configuration_id)
        if current["archived_flag"]:
            raise HTTPException(status_code=409, detail={"code": "CONFIGURATION_ARCHIVED"})
        if int(current["row_version"]) != request.expected_row_version:
            self._conflict(request.expected_row_version, int(current["row_version"]))
        payload_obj = self._dump(request.payload) if request.payload is not None else current["payload"]
        vid, eid = f"RVER_{uuid4().hex.upper()}", f"REVT_{uuid4().hex.upper()}"
        version_number = int(current["current_version_number"]) + 1
        sql = f"""
        BEGIN TRANSACTION;
        ASSERT (SELECT row_version FROM {self._table('reconciliation_configuration')} WHERE configuration_id=@cid)=@rv AS 'ROW_VERSION_CONFLICT';
        UPDATE {self._table('reconciliation_configuration')}
        SET current_version_id=@vid, current_version_number=@vn, status='DRAFT',
            updated_by=@actor, row_version=row_version+1, updated_at=CURRENT_TIMESTAMP()
        WHERE configuration_id=@cid;
        INSERT INTO {self._table('reconciliation_configuration_version')}
        (version_id, configuration_id, version_number, version_status, payload,
         validation_result, change_summary, created_by, created_at,
         validated_by, validated_at, published_by, published_at)
        VALUES (@vid, @cid, @vn, 'DRAFT', PARSE_JSON(@payload), NULL, @summary,
                @actor, CURRENT_TIMESTAMP(), NULL, NULL, NULL, NULL);
        INSERT INTO {self._table('reconciliation_configuration_audit_event')}
        (event_id, configuration_id, version_id, event_type, actor, event_payload, occurred_at)
        VALUES (@eid, @cid, @vid, @etype, @actor, PARSE_JSON(@event), CURRENT_TIMESTAMP());
        COMMIT TRANSACTION;
        """
        p = [
            bigquery.ScalarQueryParameter("cid", "STRING", configuration_id), bigquery.ScalarQueryParameter("rv", "INT64", request.expected_row_version),
            bigquery.ScalarQueryParameter("vid", "STRING", vid), bigquery.ScalarQueryParameter("vn", "INT64", version_number),
            bigquery.ScalarQueryParameter("actor", "STRING", request.requested_by), bigquery.ScalarQueryParameter("summary", "STRING", request.change_summary),
            bigquery.ScalarQueryParameter("payload", "STRING", json.dumps(payload_obj, ensure_ascii=False)), bigquery.ScalarQueryParameter("eid", "STRING", eid),
            bigquery.ScalarQueryParameter("etype", "STRING", event_type), bigquery.ScalarQueryParameter("event", "STRING", json.dumps({"version_number": version_number}))
        ]
        try:
            self._query(sql, p)
        except Exception as exc:
            if "ROW_VERSION_CONFLICT" in str(exc):
                raise HTTPException(status_code=409, detail={"code": "ROW_VERSION_CONFLICT"}) from exc
            raise
        return self.get(configuration_id)

    def update(self, configuration_id: str, request: ReconciliationUpdateRequest) -> dict:
        current = self.get(configuration_id)
        self._new_version(configuration_id, request, "CONFIGURATION_UPDATED")
        sql = f"""UPDATE {self._table('reconciliation_configuration')}
        SET name=@name, description=@description, domain_name=@domain_name, owner_email=@owner
        WHERE configuration_id=@cid"""
        self._query(sql, [
            bigquery.ScalarQueryParameter("name", "STRING", request.name or current["name"]),
            bigquery.ScalarQueryParameter("description", "STRING", request.description if request.description is not None else current.get("description")),
            bigquery.ScalarQueryParameter("domain_name", "STRING", request.domain_name if request.domain_name is not None else current.get("domain_name")),
            bigquery.ScalarQueryParameter("owner", "STRING", request.owner_email or current["owner_email"]),
            bigquery.ScalarQueryParameter("cid", "STRING", configuration_id),
        ])
        return self.get(configuration_id)

    def create_version(self, configuration_id: str, request: ReconciliationVersionCreateRequest) -> dict:
        return self._new_version(configuration_id, request, "CONFIGURATION_VERSION_CREATED")

    def versions(self, configuration_id: str) -> list[dict]:
        self.get(configuration_id)
        sql = f"SELECT * FROM {self._table('reconciliation_configuration_version')} WHERE configuration_id=@cid ORDER BY version_number DESC"
        rows = self._query(sql, [bigquery.ScalarQueryParameter("cid", "STRING", configuration_id)])
        result = []
        for row in rows:
            item = dict(row.items())
            for field in ("payload", "validation_result"):
                if isinstance(item.get(field), str):
                    item[field] = json.loads(item[field])
            result.append(item)
        return result

    def validate(self, configuration_id: str, request: ReconciliationMutationRequest) -> dict:
        current = self.get(configuration_id)
        if current["archived_flag"]:
            raise HTTPException(status_code=409, detail={"code": "CONFIGURATION_ARCHIVED"})
        if int(current["row_version"]) != request.expected_row_version:
            self._conflict(request.expected_row_version, int(current["row_version"]))
        payload = current["payload"]
        errors = []
        if not payload.get("source") or not payload.get("target"):
            errors.append("source y target son obligatorios")
        if not payload.get("comparison"):
            errors.append("comparison es obligatorio")
        valid = not errors
        status = "VALID" if valid else "DRAFT"
        result = {"valid": valid, "errors": errors}
        sql = f"""
        BEGIN TRANSACTION;
        UPDATE {self._table('reconciliation_configuration_version')}
        SET version_status=@status, validation_result=PARSE_JSON(@result), validated_by=@actor, validated_at=CURRENT_TIMESTAMP()
        WHERE version_id=@vid;
        INSERT INTO {self._table('reconciliation_configuration_audit_event')}
        (event_id, configuration_id, version_id, event_type, actor, event_payload, occurred_at)
        VALUES (@eid, @cid, @vid, 'CONFIGURATION_VALIDATED', @actor, PARSE_JSON(@result), CURRENT_TIMESTAMP());
        COMMIT TRANSACTION;
        """
        self._query(sql, [
            bigquery.ScalarQueryParameter("status", "STRING", status), bigquery.ScalarQueryParameter("result", "STRING", json.dumps(result)),
            bigquery.ScalarQueryParameter("actor", "STRING", request.requested_by), bigquery.ScalarQueryParameter("vid", "STRING", current["current_version_id"]),
            bigquery.ScalarQueryParameter("eid", "STRING", f"REVT_{uuid4().hex.upper()}"), bigquery.ScalarQueryParameter("cid", "STRING", configuration_id)
        ])
        return {"configuration": self.get(configuration_id), "validation": result}

    def publish(self, configuration_id: str, request: ReconciliationMutationRequest) -> dict:
        current = self.get(configuration_id)
        if int(current["row_version"]) != request.expected_row_version:
            self._conflict(request.expected_row_version, int(current["row_version"]))
        if current["version_status"] != "VALID":
            raise HTTPException(status_code=409, detail={"code": "CURRENT_VERSION_NOT_VALID"})
        sql = f"""
        BEGIN TRANSACTION;
        UPDATE {self._table('reconciliation_configuration_version')} SET version_status='SUPERSEDED'
        WHERE configuration_id=@cid AND version_status='PUBLISHED' AND version_id<>@vid;
        UPDATE {self._table('reconciliation_configuration_version')}
        SET version_status='PUBLISHED', published_by=@actor, published_at=CURRENT_TIMESTAMP() WHERE version_id=@vid;
        UPDATE {self._table('reconciliation_configuration')}
        SET status='ACTIVE', updated_by=@actor, row_version=row_version+1, updated_at=CURRENT_TIMESTAMP() WHERE configuration_id=@cid;
        INSERT INTO {self._table('reconciliation_configuration_audit_event')}
        VALUES (@eid, @cid, @vid, 'CONFIGURATION_PUBLISHED', @actor, PARSE_JSON('{{}}'), CURRENT_TIMESTAMP());
        COMMIT TRANSACTION;
        """
        self._query(sql, [
            bigquery.ScalarQueryParameter("cid", "STRING", configuration_id),
            bigquery.ScalarQueryParameter("vid", "STRING", current["current_version_id"]),
            bigquery.ScalarQueryParameter("actor", "STRING", request.requested_by),
            bigquery.ScalarQueryParameter("eid", "STRING", f"REVT_{uuid4().hex.upper()}")
        ])
        return self.get(configuration_id)

    def status(self, configuration_id: str, request: ReconciliationStatusRequest) -> dict:
        current = self.get(configuration_id)
        target = request.status.value
        if int(current["row_version"]) != request.expected_row_version:
            self._conflict(request.expected_row_version, int(current["row_version"]))
        if (current["status"], target) not in {("ACTIVE", "INACTIVE"), ("INACTIVE", "ACTIVE")}:
            raise HTTPException(status_code=409, detail={"code": "INVALID_STATUS_TRANSITION"})
        self._lifecycle(configuration_id, request, target, False, "CONFIGURATION_STATUS_CHANGED")
        return self.get(configuration_id)

    def archive(self, configuration_id: str, request: ReconciliationMutationRequest):
        current = self.get(configuration_id)
        if int(current["row_version"]) != request.expected_row_version:
            self._conflict(request.expected_row_version, int(current["row_version"]))
        self._lifecycle(configuration_id, request, "ARCHIVED", True, "CONFIGURATION_ARCHIVED")

    def _lifecycle(self, configuration_id, request, status, archived, event_type):
        sql = f"""
        BEGIN TRANSACTION;
        UPDATE {self._table('reconciliation_configuration')}
        SET status=@status, archived_flag=@archived, archived_at=IF(@archived,CURRENT_TIMESTAMP(),archived_at),
            updated_by=@actor, row_version=row_version+1, updated_at=CURRENT_TIMESTAMP() WHERE configuration_id=@cid;
        INSERT INTO {self._table('reconciliation_configuration_audit_event')}
        VALUES (@eid, @cid, NULL, @etype, @actor, PARSE_JSON(@event), CURRENT_TIMESTAMP());
        COMMIT TRANSACTION;
        """
        self._query(sql, [
            bigquery.ScalarQueryParameter("status", "STRING", status),
            bigquery.ScalarQueryParameter("archived", "BOOL", archived),
            bigquery.ScalarQueryParameter("actor", "STRING", request.requested_by),
            bigquery.ScalarQueryParameter("cid", "STRING", configuration_id),
            bigquery.ScalarQueryParameter("eid", "STRING", f"REVT_{uuid4().hex.upper()}"),
            bigquery.ScalarQueryParameter("etype", "STRING", event_type),
            bigquery.ScalarQueryParameter("event", "STRING", json.dumps({"reason": request.reason}))
        ])