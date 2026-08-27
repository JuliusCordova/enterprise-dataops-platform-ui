from typing import Optional

from fastapi import APIRouter, Query, Response, status

from .canonical_models import (
    QualityConfigurationArchiveRequest,
    QualityConfigurationCreateRequest,
    QualityConfigurationPublishRequest,
    QualityConfigurationStatusChangeRequest,
    QualityConfigurationUpdateRequest,
    QualityConfigurationVersionCreateRequest,
)
from .canonical_repository import CanonicalQualityConfigurationRepository
from .canonical_versioning import create_configuration_version


def register_canonical_quality_routes(router: APIRouter, repository: CanonicalQualityConfigurationRepository) -> None:
    @router.post("/configurations", status_code=status.HTTP_201_CREATED)
    def create_configuration(request: QualityConfigurationCreateRequest):
        return {"configuration": repository.create_configuration(request)}

    @router.get("/configurations")
    def list_configurations(configuration_status: Optional[str] = Query(default=None, alias="status"), include_archived: bool = False, limit: int = Query(default=100, ge=1, le=500)):
        configurations = repository.list_configurations(status=configuration_status, include_archived=include_archived, limit=limit)
        return {"total": len(configurations), "configurations": configurations}

    @router.put("/configurations/{configuration_id}")
    def update_configuration(configuration_id: str, request: QualityConfigurationUpdateRequest):
        return {"configuration": repository.update_configuration(configuration_id=configuration_id, request=request)}

    @router.get("/configurations/{configuration_id}/versions")
    def list_configuration_versions(configuration_id: str):
        versions = repository.list_versions(configuration_id)
        return {"total": len(versions), "versions": versions}

    @router.post("/configurations/{configuration_id}/versions", status_code=status.HTTP_201_CREATED)
    def create_version(configuration_id: str, request: QualityConfigurationVersionCreateRequest):
        return {"configuration": create_configuration_version(repository=repository, configuration_id=configuration_id, request=request)}

    @router.post("/configurations/{configuration_id}/publish")
    def publish_configuration(configuration_id: str, request: QualityConfigurationPublishRequest):
        return {"configuration": repository.publish_configuration(configuration_id, request)}

    @router.patch("/configurations/{configuration_id}/status")
    def change_configuration_status(configuration_id: str, request: QualityConfigurationStatusChangeRequest):
        return {"configuration": repository.change_status(configuration_id, request)}

    @router.delete("/configurations/{configuration_id}", status_code=status.HTTP_204_NO_CONTENT)
    def archive_configuration(configuration_id: str, request: QualityConfigurationArchiveRequest):
        repository.archive_configuration(configuration_id, request)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @router.get("/configurations/{configuration_id}")
    def get_configuration(configuration_id: str):
        return {"configuration": repository.get_configuration(configuration_id)}
