from datetime import datetime
import uuid
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from app.models.enums import EmploymentType, JobStatus
from app.schemas.profile import CompanyOut

class JobCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    description: str = Field(min_length=10)
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    currency: str = "TJS"
    location: str
    category: str
    employment_type: EmploymentType
    status: JobStatus = JobStatus.OPEN

class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    currency: Optional[str] = None
    location: Optional[str] = None
    category: Optional[str] = None
    employment_type: Optional[EmploymentType] = None
    status: Optional[JobStatus] = None

class JobOut(BaseModel):
    id: uuid.UUID
    company_id: Optional[uuid.UUID] = None
    title: str
    description: str
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    currency: str = "TJS"
    location: str
    category: Optional[str] = None
    employment_type: EmploymentType
    status: JobStatus
    created_at: datetime
    updated_at: datetime
    company: Optional[CompanyOut] = None

    # External vacancy fields
    is_external: bool = False
    external_source: Optional[str] = None
    external_id: Optional[str] = None
    external_url: Optional[str] = None
    external_company_name: Optional[str] = None
    external_company_logo: Optional[str] = None
    published_at: Optional[datetime] = None
    requirements: Optional[dict] = None

    # Dynamic backend profile match fields
    match_score: Optional[int] = None
    commute_estimate: Optional[str] = None
    distance_estimate: Optional[str] = None
    matched_reasons: Optional[List[str]] = None
    matched_skills: Optional[List[str]] = None

    # Application status for current authenticated worker
    has_applied: Optional[bool] = False

    # Saved / Favorite status for current authenticated user
    is_saved: Optional[bool] = False
    is_favorite: Optional[bool] = False

    model_config = ConfigDict(from_attributes=True)
