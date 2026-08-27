from enum import Enum
from typing import Any, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class CanonicalModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class ConfigurationStatus(str, Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    ARCHIVED = "ARCHIVED"


class VersionStatus(str, Enum):
    DRAFT = "DRAFT"
    VALID = "VALID"
    PUBLISHED = "PUBLISHED"
    SUPERSEDED = "SUPERSEDED"


class DataAssetReference(CanonicalModel):
    connection_id: str = Field(
        validation_alias=AliasChoices("connectionId", "connection_id"),
        serialization_alias="connectionId",
    )
    project_id: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("projectId", "project_id"),
        serialization_alias="projectId",
    )
    dataset_id: str = Field(
        validation_alias=AliasChoices("datasetId", "dataset_id"),
        serialization_alias="datasetId",
    )
    table_id: str = Field(
        validation_alias=AliasChoices("tableId", "table_id"),
        serialization_alias="tableId",
    )


class ReconciliationPayload(CanonicalModel):
    source: DataAssetReference
    target: DataAssetReference
    comparison: dict[str, Any]
    filters: list[dict[str, Any]] = Field(default_factory=list)
    business_date: dict[str, Any] = Field(
        default_factory=dict,
        validation_alias=AliasChoices("businessDate", "business_date"),
        serialization_alias="businessDate",
    )
    execution_parameters: dict[str, Any] = Field(
        default_factory=dict,
        validation_alias=AliasChoices("executionParameters", "execution_parameters"),
        serialization_alias="executionParameters",
    )


class ReconciliationCreateRequest(CanonicalModel):
    name: str
    description: Optional[str] = None
    domain_name: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("domainName", "domain_name"),
        serialization_alias="domainName",
    )
    owner_email: str = Field(
        validation_alias=AliasChoices("ownerEmail", "owner_email"),
        serialization_alias="ownerEmail",
    )
    requested_by: str = Field(
        validation_alias=AliasChoices("requestedBy", "requested_by"),
        serialization_alias="requestedBy",
    )
    payload: ReconciliationPayload
    change_summary: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("changeSummary", "change_summary"),
        serialization_alias="changeSummary",
    )


class ReconciliationUpdateRequest(CanonicalModel):
    name: Optional[str] = None
    description: Optional[str] = None
    domain_name: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("domainName", "domain_name"),
        serialization_alias="domainName",
    )
    owner_email: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("ownerEmail", "owner_email"),
        serialization_alias="ownerEmail",
    )
    requested_by: str = Field(
        validation_alias=AliasChoices("requestedBy", "requested_by"),
        serialization_alias="requestedBy",
    )
    expected_row_version: int = Field(
        ge=1,
        validation_alias=AliasChoices("rowVersion", "expectedRowVersion", "expected_row_version"),
        serialization_alias="rowVersion",
    )
    payload: ReconciliationPayload
    change_summary: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("changeSummary", "change_summary"),
        serialization_alias="changeSummary",
    )


class ReconciliationVersionCreateRequest(CanonicalModel):
    requested_by: str = Field(
        validation_alias=AliasChoices("requestedBy", "requested_by"),
        serialization_alias="requestedBy",
    )
    expected_row_version: int = Field(
        ge=1,
        validation_alias=AliasChoices("rowVersion", "expectedRowVersion", "expected_row_version"),
        serialization_alias="rowVersion",
    )
    change_summary: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("changeSummary", "change_summary"),
        serialization_alias="changeSummary",
    )
    payload: Optional[ReconciliationPayload] = None


class ReconciliationMutationRequest(CanonicalModel):
    requested_by: str = Field(
        validation_alias=AliasChoices("requestedBy", "requested_by"),
        serialization_alias="requestedBy",
    )
    expected_row_version: int = Field(
        ge=1,
        validation_alias=AliasChoices("rowVersion", "expectedRowVersion", "expected_row_version"),
        serialization_alias="rowVersion",
    )
    reason: Optional[str] = None


class ReconciliationStatusRequest(ReconciliationMutationRequest):
    status: ConfigurationStatus
