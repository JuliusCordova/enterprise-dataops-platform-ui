import json
from uuid import uuid4

from fastapi import HTTPException
from google.cloud import bigquery

from .canonical_models import QualityConfigurationVersionCreateRequest
from .canonical_repository import CanonicalQualityConfigurationRepository


def create_configuration_version(
    repository: CanonicalQualityConfigurationRepository,
    configuration_id: str,
    request: QualityConfigurationVersionCreateRequest
) -> dict:
    current = repository.get_configuration(configuration_id)

    if current.get("archived_flag"):
        raise HTTPException(
            status_code=409,
            detail={"code": "CONFIGURATION_ARCHIVED"}
        )

    current_row_version = int(current["row_version"])
    if current_row_version != request.expected_row_version:
        repository._raise_row_version_conflict(
            request.expected_row_version,
            current_row_version
        )

    version_number = int(current["current_version_number"]) + 1
    version_id = f"QVER_{uuid4().hex.upper()}"
    event_id = f"QEVT_{uuid4().hex.upper()}"
    payload = (
        repository._model_to_dict(request.payload)
        if request.payload is not None
        else current["payload"]
    )

    query = f"""
    BEGIN TRANSACTION;

    ASSERT (
      SELECT row_version
      FROM {repository._table("quality_configuration")}
      WHERE configuration_id = @configuration_id
    ) = @expected_row_version
    AS 'ROW_VERSION_CONFLICT';

    UPDATE {repository._table("quality_configuration")}
    SET current_version_id = @version_id,
        current_version_number = @version_number,
        updated_by = @requested_by,
        row_version = row_version + 1,
        updated_at = CURRENT_TIMESTAMP()
    WHERE configuration_id = @configuration_id;

    INSERT INTO {repository._table("quality_configuration_version")}
    (version_id, configuration_id, version_number, version_status, payload,
     change_summary, created_by, created_at, published_by, published_at)
    VALUES
    (@version_id, @configuration_id, @version_number, 'DRAFT',
     PARSE_JSON(@payload), @change_summary, @requested_by,
     CURRENT_TIMESTAMP(), NULL, NULL);

    INSERT INTO {repository._table("quality_configuration_audit_event")}
    (event_id, configuration_id, version_id, event_type, actor,
     event_payload, occurred_at)
    VALUES
    (@event_id, @configuration_id, @version_id,
     'CONFIGURATION_VERSION_CREATED', @requested_by,
     PARSE_JSON(@event_payload), CURRENT_TIMESTAMP());

    COMMIT TRANSACTION;
    """

    parameters = [
        bigquery.ScalarQueryParameter(
            "configuration_id", "STRING", configuration_id
        ),
        bigquery.ScalarQueryParameter(
            "expected_row_version", "INT64", request.expected_row_version
        ),
        bigquery.ScalarQueryParameter("version_id", "STRING", version_id),
        bigquery.ScalarQueryParameter("event_id", "STRING", event_id),
        bigquery.ScalarQueryParameter(
            "version_number", "INT64", version_number
        ),
        bigquery.ScalarQueryParameter(
            "requested_by", "STRING", request.requested_by
        ),
        bigquery.ScalarQueryParameter(
            "change_summary", "STRING", request.change_summary
        ),
        bigquery.ScalarQueryParameter(
            "payload", "STRING", json.dumps(payload, ensure_ascii=False)
        ),
        bigquery.ScalarQueryParameter(
            "event_payload",
            "STRING",
            json.dumps(
                {
                    "previous_version_number": int(
                        current["current_version_number"]
                    ),
                    "version_number": version_number,
                    "source": (
                        "REQUEST_PAYLOAD"
                        if request.payload is not None
                        else "CURRENT_VERSION"
                    )
                },
                ensure_ascii=False
            )
        )
    ]

    try:
        repository.client.query(
            query,
            job_config=bigquery.QueryJobConfig(
                query_parameters=parameters
            )
        ).result()
    except Exception as exc:
        if "ROW_VERSION_CONFLICT" in str(exc):
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "ROW_VERSION_CONFLICT",
                    "expected": request.expected_row_version
                }
            ) from exc
        raise

    return repository.get_configuration(configuration_id)
