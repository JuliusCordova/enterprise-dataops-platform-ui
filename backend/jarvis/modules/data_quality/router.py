from fastapi import APIRouter, HTTPException
from google.cloud import bigquery

from modules.reconciliation_canonical.router import create_reconciliation_router

from .execution import DataQualityExecutionEngine
from .execution_repository import DataQualityExecutionRepository
from .canonical_repository import CanonicalQualityConfigurationRepository
from .canonical_router import register_canonical_quality_routes
from .models import (
    DataQualityConfirmRequest,
    DataQualityDraftRequest,
    DataQualityDraftUpdateRequest,
    DataQualityExecuteRequest,
    DataQualityProfileRequest,
)
from .profiling import DataProfiler
from .repository import DataQualityRepository
from .service import DataQualityService


def create_data_quality_router(
    bq_client: bigquery.Client,
    project_id: str,
    control_dataset: str,
    get_connection_function,
) -> APIRouter:
    root_router = APIRouter()
    router = APIRouter(prefix="/data-quality", tags=["Data Quality"])

    repository = DataQualityRepository(
        client=bq_client,
        project_id=project_id,
        dataset_id=control_dataset,
    )
    canonical_repository = CanonicalQualityConfigurationRepository(
        client=bq_client,
        project_id=project_id,
        dataset_id=control_dataset,
    )
    profiler = DataProfiler(client=bq_client)
    service = DataQualityService(
        repository=repository,
        bq_client=bq_client,
        get_connection_function=get_connection_function,
    )
    execution_repository = DataQualityExecutionRepository(
        client=bq_client,
        project_id=project_id,
        dataset_id=control_dataset,
    )
    execution_engine = DataQualityExecutionEngine(
        client=bq_client,
        repository=execution_repository,
    )

    @router.get("/health")
    def data_quality_health():
        return {"status": "ok", "module": "data-quality"}

    @router.get("/rule-types")
    def list_rule_types():
        return {"rule_types": repository.list_rule_types()}

    @router.get("/configs")
    def list_configs(active_only: bool = True):
        configurations = repository.list_quality_configs(active_only=active_only)
        return {"total": len(configurations), "configurations": configurations}

    @router.get("/config/{quality_config_id}")
    def get_config(quality_config_id: str):
        return {"configuration": repository.get_quality_config(quality_config_id)}

    @router.post("/profile")
    def profile_table(req: DataQualityProfileRequest):
        connection = get_connection_function(req.connection_id)
        if connection.get("connection_type") != "BIGQUERY":
            raise HTTPException(
                status_code=400,
                detail="El motor de calidad actualmente solo soporta conexiones BIGQUERY",
            )
        return profiler.profile_table(
            project_id=connection["project_id"],
            dataset_id=req.dataset_id,
            table_id=req.table_id,
            selected_columns=req.selected_columns,
        )

    @router.post("/configure/draft")
    def create_draft(req: DataQualityDraftRequest):
        return service.create_draft(req)

    @router.get("/configure/draft/{draft_id}")
    def get_draft(draft_id: str):
        return {"draft": service.get_draft(draft_id)}

    @router.put("/configure/draft/{draft_id}")
    def update_draft(draft_id: str, req: DataQualityDraftUpdateRequest):
        return {"draft": service.update_draft(draft_id=draft_id, request=req)}

    @router.post("/configure/validate/{draft_id}")
    def validate_draft(draft_id: str):
        return service.validate_draft(draft_id)

    @router.post("/configure/confirm/{draft_id}")
    def confirm_draft(draft_id: str, req: DataQualityConfirmRequest):
        return service.confirm_draft(draft_id=draft_id, request=req)

    @router.post("/execute")
    def execute_quality_scan(req: DataQualityExecuteRequest):
        return execution_engine.execute(req)

    @router.get("/result/{execution_id}")
    def get_quality_result(execution_id: str):
        return execution_repository.get_execution(execution_id)

    @router.get("/latest/{quality_config_id}")
    def get_latest_quality_result(quality_config_id: str):
        return execution_repository.get_latest_execution(quality_config_id)

    register_canonical_quality_routes(router=router, repository=canonical_repository)
    root_router.include_router(router)
    root_router.include_router(
        create_reconciliation_router(
            bq_client=bq_client,
            project_id=project_id,
            control_dataset=control_dataset,
        )
    )
    return root_router
