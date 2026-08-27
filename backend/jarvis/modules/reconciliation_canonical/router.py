from typing import Optional

from fastapi import APIRouter, Query, Response, status
from google.cloud import bigquery

from .models import (
    ReconciliationCreateRequest,
    ReconciliationMutationRequest,
    ReconciliationStatusRequest,
    ReconciliationUpdateRequest,
    ReconciliationVersionCreateRequest,
)
from .repository import CanonicalReconciliationRepository


def create_reconciliation_router(
    bq_client: bigquery.Client,
    project_id: str,
    control_dataset: str,
) -> APIRouter:
    router = APIRouter(prefix="/reconciliation", tags=["Reconciliation"])
    repository = CanonicalReconciliationRepository(
        client=bq_client,
        project_id=project_id,
        dataset_id=control_dataset,
    )

    @router.get("/health")
    def health():
        return {"status": "ok", "module": "reconciliation"}

    @router.post("/configurations", status_code=status.HTTP_201_CREATED)
    def create_configuration(request: ReconciliationCreateRequest):
        return {"configuration": repository.create(request)}

    @router.get("/configurations")
    def list_configurations(
        configuration_status: Optional[str] = Query(default=None, alias="status"),
        include_archived: bool = False,
        limit: int = Query(default=100, ge=1, le=500),
    ):
        configurations = repository.list(configuration_status, include_archived, limit)
        return {"total": len(configurations), "configurations": configurations}

    @router.get("/configurations/{configuration_id}")
    def get_configuration(configuration_id: str):
        return {"configuration": repository.get(configuration_id)}

    @router.put("/configurations/{configuration_id}")
    def update_configuration(configuration_id: str, request: ReconciliationUpdateRequest):
        return {"configuration": repository.update(configuration_id, request)}

    @router.delete("/configurations/{configuration_id}", status_code=status.HTTP_204_NO_CONTENT)
    def archive_configuration(configuration_id: str, request: ReconciliationMutationRequest):
        repository.archive(configuration_id, request)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @router.get("/configurations/{configuration_id}/versions")
    def list_versions(configuration_id: str):
        versions = repository.versions(configuration_id)
        return {"total": len(versions), "versions": versions}

    @router.post("/configurations/{configuration_id}/versions", status_code=status.HTTP_201_CREATED)
    def create_version(configuration_id: str, request: ReconciliationVersionCreateRequest):
        return {"configuration": repository.create_version(configuration_id, request)}

    @router.post("/configurations/{configuration_id}/validate")
    def validate_configuration(configuration_id: str, request: ReconciliationMutationRequest):
        return repository.validate(configuration_id, request)

    @router.post("/configurations/{configuration_id}/publish")
    def publish_configuration(configuration_id: str, request: ReconciliationMutationRequest):
        return {"configuration": repository.publish(configuration_id, request)}

    @router.patch("/configurations/{configuration_id}/status")
    def change_status(configuration_id: str, request: ReconciliationStatusRequest):
        return {"configuration": repository.status(configuration_id, request)}

    return router
