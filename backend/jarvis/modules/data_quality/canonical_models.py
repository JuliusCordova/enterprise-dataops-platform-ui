from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class ConfigurationStatus(str, Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    ARCHIVED = "ARCHIVED"


class VersionStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    SUPERSEDED = "SUPERSEDED"


class QualityConfigurationPayload(BaseModel):
    connection_id: str
    project_id: Optional[str] = None
    dataset_id: str
    table_id: str

    selected_columns: list[str] = Field(default_factory=list)
    business_key: list[str] = Field(default_factory=list)

    date_column: Optional[str] = None
    table_filter: Optional[str] = None
    related_reconciliation_id: Optional[str] = None

    rules: list[dict[str, Any]] = Field(default_factory=list)


class QualityConfigurationCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    domain_name: Optional[str] = None

    owner_email: str
    requested_by: str

    payload: QualityConfigurationPayload
    change_summary: Optional[str] = None


class QualityConfigurationUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    domain_name: Optional[str] = None
    owner_email: Optional[str] = None

    requested_by: str
    expected_row_version: int = Field(ge=1)

    payload: QualityConfigurationPayload
    change_summary: Optional[str] = None


class QualityConfigurationVersionCreateRequest(BaseModel):
    requested_by: str
    expected_row_version: int = Field(ge=1)
    payload: Optional[QualityConfigurationPayload] = None
    change_summary: Optional[str] = None


class QualityConfigurationStatusChangeRequest(BaseModel):
    status: ConfigurationStatus
    requested_by: str
    expected_row_version: int = Field(ge=1)
    reason: Optional[str] = None


class QualityConfigurationArchiveRequest(BaseModel):
    requested_by: str
    expected_row_version: int = Field(ge=1)
    reason: Optional[str] = None


class QualityConfigurationPublishRequest(BaseModel):
    requested_by: str
    expected_row_version: int = Field(ge=1)


class QualityConfigurationSummary(BaseModel):
    configuration_id: str
    configuration_type: str
    name: str
    description: Optional[str] = None
    domain_name: Optional[str] = None

    current_version_id: str
    current_version_number: int

    status: ConfigurationStatus
    archived_flag: bool
    owner_email: str
    row_version: int

    created_at: Any
    updated_at: Any


class QualityConfigurationDetail(QualityConfigurationSummary):
    version_status: VersionStatus
    payload: dict[str, Any]
    change_summary: Optional[str] = None
    version_created_by: str
    version_created_at: Any
