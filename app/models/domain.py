from datetime import datetime, timezone
import uuid
from typing import List, Optional
from sqlalchemy import String, Boolean, Integer, Float, Text, Enum, ForeignKey, UniqueConstraint, Index, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, TimestampMixin
from app.models.enums import (
    UserRole, EmploymentType, JobStatus, ApplicationStatus,
    FavoriteTargetType, MessageType, NotificationType, ResumeStatus
)

JSONType = JSON().with_variant(JSONB, "postgresql")

class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    language: Mapped[str] = mapped_column(String(10), default="ru", nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Dushanbe", nullable=False)
    settings: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_muted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    muted_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    mute_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Telegram Bot Integration fields
    telegram_chat_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    telegram_username: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    telegram_user_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    telegram_is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    telegram_linked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    telegram_link_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    telegram_link_code_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    telegram_notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    telegram_last_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    telegram_last_promotional_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    worker_profile: Mapped[Optional["WorkerProfile"]] = relationship("WorkerProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    company: Mapped[Optional["Company"]] = relationship("Company", back_populates="employer", uselist=False, cascade="all, delete-orphan")
    applications: Mapped[List["Application"]] = relationship("Application", back_populates="worker", cascade="all, delete-orphan")
    favorites: Mapped[List["Favorite"]] = relationship("Favorite", back_populates="user", cascade="all, delete-orphan")
    saved_jobs: Mapped[List["SavedJob"]] = relationship("SavedJob", back_populates="user", cascade="all, delete-orphan")
    chat_participants: Mapped[List["ChatParticipant"]] = relationship("ChatParticipant", back_populates="user", cascade="all, delete-orphan")
    messages: Mapped[List["Message"]] = relationship("Message", back_populates="sender", cascade="all, delete-orphan")
    notifications: Mapped[List["Notification"]] = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens: Mapped[List["RefreshToken"]] = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    file_uploads: Mapped[List["FileUpload"]] = relationship("FileUpload", back_populates="user", cascade="all, delete-orphan")
    ai_sessions: Mapped[List["AIChatSession"]] = relationship("AIChatSession", back_populates="user", cascade="all, delete-orphan")
    ai_cvs: Mapped[List["AIGeneratedCV"]] = relationship("AIGeneratedCV", back_populates="user", cascade="all, delete-orphan")
    resumes: Mapped[List["Resume"]] = relationship("Resume", back_populates="user", cascade="all, delete-orphan")
    user_settings: Mapped[Optional["UserSettings"]] = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    cv_documents: Mapped[List["CVDocument"]] = relationship("CVDocument", back_populates="user", cascade="all, delete-orphan")
    profile_ai_suggestions: Mapped[List["ProfileAISuggestion"]] = relationship("ProfileAISuggestion", back_populates="user", cascade="all, delete-orphan")
    profile_change_history: Mapped[List["ProfileChangeHistory"]] = relationship("ProfileChangeHistory", foreign_keys="[ProfileChangeHistory.user_id]", back_populates="user", cascade="all, delete-orphan")
    memories: Mapped[List["UserMemory"]] = relationship("UserMemory", back_populates="user", cascade="all, delete-orphan")
    telegram_logs: Mapped[List["TelegramNotificationLog"]] = relationship("TelegramNotificationLog", back_populates="user", cascade="all, delete-orphan")

    @property
    def company_name(self) -> Optional[str]:
        if 'company' in self.__dict__ and self.company is not None:
            return self.company.company_name
        return None



class UserSettings(Base, TimestampMixin):
    __tablename__ = "user_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    language: Mapped[str] = mapped_column(String(10), default="ru", nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Dushanbe", nullable=False)
    email_notifications: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    push_notifications: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    telegram_notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    telegram_job_recommendations_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    telegram_messages_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    telegram_system_notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    telegram_promotional_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    theme: Mapped[str] = mapped_column(String(20), default="light", nullable=False)
    extra_preferences: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="user_settings")


class TelegramNotificationLog(Base, TimestampMixin):
    __tablename__ = "telegram_notification_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    chat_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    notification_type: Mapped[str] = mapped_column(String(50), default="system", nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(20), default="telegram", nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False, index=True)
    message_text: Mapped[str] = mapped_column(Text, nullable=False)
    telegram_message_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[Optional["User"]] = relationship("User", back_populates="telegram_logs")


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)

    worker_skills: Mapped[List["WorkerSkill"]] = relationship("WorkerSkill", back_populates="skill", cascade="all, delete-orphan")

class WorkerProfile(Base, TimestampMixin):
    __tablename__ = "worker_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    desired_position: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    desired_salary: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    education: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    portfolio_links: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)
    relocation_preference: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    commute_preference: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    work_format: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    has_driving_license: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    driving_categories: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)
    has_own_car: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="worker_profile")
    worker_skills: Mapped[List["WorkerSkill"]] = relationship("WorkerSkill", back_populates="worker_profile", cascade="all, delete-orphan")
    experiences: Mapped[List["Experience"]] = relationship("Experience", back_populates="worker_profile", cascade="all, delete-orphan")
    certificates: Mapped[List["Certificate"]] = relationship("Certificate", back_populates="worker_profile", cascade="all, delete-orphan")

    @property
    def skills(self) -> List["Skill"]:
        return [ws.skill for ws in self.worker_skills if ws.skill is not None]

class WorkerSkill(Base):
    __tablename__ = "worker_skills"

    worker_profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("worker_profiles.id", ondelete="CASCADE"), primary_key=True)
    skill_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True)

    worker_profile: Mapped["WorkerProfile"] = relationship("WorkerProfile", back_populates="worker_skills")
    skill: Mapped["Skill"] = relationship("Skill", back_populates="worker_skills")

class Experience(Base):
    __tablename__ = "experiences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("worker_profiles.id", ondelete="CASCADE"), nullable=False)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role_title: Mapped[str] = mapped_column(String(255), nullable=False)
    start_date: Mapped[str] = mapped_column(String(50), nullable=False)
    end_date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    worker_profile: Mapped["WorkerProfile"] = relationship("WorkerProfile", back_populates="experiences")

class Certificate(Base, TimestampMixin):
    __tablename__ = "certificates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("worker_profiles.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    issuer: Mapped[str] = mapped_column(String(255), nullable=False)
    year: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    credential_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    worker_profile: Mapped["WorkerProfile"] = relationship("WorkerProfile", back_populates="certificates")

class Company(Base, TimestampMixin):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    inn: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    industry: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    employee_count: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    target_position: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    required_skills: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)
    min_experience_years: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    offered_salary_min: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    offered_salary_max: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    employer: Mapped["User"] = relationship("User", back_populates="company")
    jobs: Mapped[List["Job"]] = relationship("Job", back_populates="company", cascade="all, delete-orphan")

class Job(Base, TimestampMixin):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    salary_min: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    salary_max: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(50), default="TJS", nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    employment_type: Mapped[EmploymentType] = mapped_column(Enum(EmploymentType), nullable=False)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.OPEN, nullable=False)
    requirements: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)
    tags: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)
    benefits: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)
    views_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # External vacancy fields
    is_external: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    external_source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    external_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    external_company_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    external_company_logo: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    raw_data: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    first_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    job_group_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)

    company: Mapped[Optional["Company"]] = relationship("Company", back_populates="jobs")
    applications: Mapped[List["Application"]] = relationship("Application", back_populates="job", cascade="all, delete-orphan")
    saved_by_users: Mapped[List["SavedJob"]] = relationship("SavedJob", back_populates="job", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint('external_source', 'external_id', name='uq_job_external_source_id'),
        Index('idx_job_company_status', 'company_id', 'status'),
        Index('idx_job_status_created', 'status', 'created_at'),
    )

class Application(Base, TimestampMixin):
    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    worker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    cover_letter: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cover_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resume_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    resume_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True)
    employer_feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_read_by_employer: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[ApplicationStatus] = mapped_column(Enum(ApplicationStatus), default=ApplicationStatus.PENDING, nullable=False, index=True)
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    job: Mapped["Job"] = relationship("Job", back_populates="applications")
    worker: Mapped["User"] = relationship("User", back_populates="applications")
    resume: Mapped[Optional["Resume"]] = relationship("Resume")
    status_history: Mapped[List["ApplicationStatusHistory"]] = relationship("ApplicationStatusHistory", back_populates="application", cascade="all, delete-orphan", lazy="selectin")
    employer_messages: Mapped[List["EmployerMessage"]] = relationship("EmployerMessage", back_populates="application", cascade="all, delete-orphan", lazy="selectin")

    __table_args__ = (
        UniqueConstraint('job_id', 'worker_id', name='uq_job_worker_application'),
        Index('idx_application_worker_status', 'worker_id', 'status', 'created_at'),
        Index('idx_application_job_status', 'job_id', 'status', 'created_at'),
    )

class EmployerMessage(Base, TimestampMixin):
    __tablename__ = "employer_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=True, index=True)
    employer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    candidate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    recipient_email: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False) # pending, sending, sent, failed
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    application: Mapped[Optional["Application"]] = relationship("Application", back_populates="employer_messages")
    employer: Mapped["User"] = relationship("User", foreign_keys=[employer_id])
    candidate: Mapped["User"] = relationship("User", foreign_keys=[candidate_id])

class ApplicationStatusHistory(Base):
    __tablename__ = "application_status_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    previous_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    new_status: Mapped[str] = mapped_column(String(50), nullable=False)
    changed_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    application: Mapped["Application"] = relationship("Application", back_populates="status_history")
    changed_by_user: Mapped[Optional["User"]] = relationship("User")

class SavedJob(Base, TimestampMixin):
    __tablename__ = "saved_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="saved_jobs")
    job: Mapped["Job"] = relationship("Job", back_populates="saved_by_users")

    __table_args__ = (
        UniqueConstraint('user_id', 'job_id', name='uq_user_saved_job'),
    )

class JobMatch(Base, TimestampMixin):
    __tablename__ = "job_matches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    
    match_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)
    position_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    skill_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    salary_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    location_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    
    commute_estimate: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    distance_estimate: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    matched_reasons: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)
    matched_skills: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)
    missing_skills: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)
    
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_stale: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)

    user: Mapped["User"] = relationship("User")
    job: Mapped["Job"] = relationship("Job")

    __table_args__ = (
        UniqueConstraint('user_id', 'job_id', name='uq_user_job_match'),
        Index('idx_job_match_user_score', 'user_id', 'match_score'),
        Index('idx_job_match_stale', 'user_id', 'is_stale'),
    )

class Favorite(Base, TimestampMixin):
    __tablename__ = "favorites"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    target_type: Mapped[FavoriteTargetType] = mapped_column(Enum(FavoriteTargetType), nullable=False)
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="favorites")

    __table_args__ = (
        UniqueConstraint('user_id', 'target_type', 'target_id', name='uq_user_favorite_target'),
    )

class Chat(Base, TimestampMixin):
    __tablename__ = "chats"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_group: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)

    participants: Mapped[List["ChatParticipant"]] = relationship("ChatParticipant", back_populates="chat", cascade="all, delete-orphan")
    messages: Mapped[List["Message"]] = relationship("Message", back_populates="chat", cascade="all, delete-orphan")

class ChatParticipant(Base):
    __tablename__ = "chat_participants"

    chat_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chats.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    last_read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    chat: Mapped["Chat"] = relationship("Chat", back_populates="participants")
    user: Mapped["User"] = relationship("User", back_populates="chat_participants")

class Message(Base, TimestampMixin):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chats.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[MessageType] = mapped_column(Enum(MessageType), default=MessageType.TEXT, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_edited: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    edited_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    client_msg_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)

    chat: Mapped["Chat"] = relationship("Chat", back_populates="messages")
    sender: Mapped["User"] = relationship("User", back_populates="messages")

    __table_args__ = (
        Index('idx_message_chat_created', 'chat_id', 'created_at'),
    )

class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[NotificationType] = mapped_column(Enum(NotificationType), nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    payload: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="notifications")

    __table_args__ = (
        Index('idx_notification_user_unread', 'user_id', 'is_read', 'created_at'),
    )

class FileUpload(Base, TimestampMixin):
    __tablename__ = "file_uploads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    folder: Mapped[str] = mapped_column(String(100), default="general", nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False)
    url: Mapped[str] = mapped_column(String(512), nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="file_uploads")

class AIChatSession(Base, TimestampMixin):
    __tablename__ = "ai_chat_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), default="Новый диалог", nullable=False)

    user: Mapped[Optional["User"]] = relationship("User", back_populates="ai_sessions")
    messages: Mapped[List["AIMessage"]] = relationship("AIMessage", back_populates="session", cascade="all, delete-orphan")

class AIMessage(Base, TimestampMixin):
    __tablename__ = "ai_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ai_chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False) # 'user' or 'assistant'
    content: Mapped[str] = mapped_column(Text, nullable=False)

    session: Mapped["AIChatSession"] = relationship("AIChatSession", back_populates="messages")

class AIGeneratedCV(Base, TimestampMixin):
    __tablename__ = "ai_generated_cvs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cv_text: Mapped[str] = mapped_column(Text, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="ai_cvs")

class UserMemory(Base, TimestampMixin):
    __tablename__ = "user_memories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    key: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    importance: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="memories")

class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    details: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    expires_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    attempts_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_sent_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    expires_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    expires_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    revoked_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_ip: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")

class Resume(Base, TimestampMixin):
    __tablename__ = "resumes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    source_file_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("file_uploads.id", ondelete="SET NULL"), nullable=True)
    source_cv_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("cv_documents.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), default="Моё резюме", nullable=False)
    target_position: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    status: Mapped[ResumeStatus] = mapped_column(Enum(ResumeStatus), default=ResumeStatus.DRAFT, nullable=False, index=True)

    # Structured JSON content storing sections
    content: Mapped[dict] = mapped_column(JSONType, nullable=False)

    # AI Suggestions & completeness score
    ai_suggestions: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)
    completeness_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    pinned_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="resumes")
    source_file: Mapped[Optional["FileUpload"]] = relationship("FileUpload")
    source_cv: Mapped[Optional["CVDocument"]] = relationship("CVDocument")


class CVDocument(Base, TimestampMixin):
    __tablename__ = "cv_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    file_upload_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("file_uploads.id", ondelete="SET NULL"), nullable=True)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), default="pdf", nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), default="application/pdf", nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False)
    processing_status: Mapped[str] = mapped_column(String(50), default="UPLOADED", nullable=False, index=True)
    extraction_method: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    extracted_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    extracted_data: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)
    processing_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="cv_documents")
    file_upload: Mapped[Optional["FileUpload"]] = relationship("FileUpload")
    suggestions: Mapped[List["ProfileAISuggestion"]] = relationship("ProfileAISuggestion", back_populates="cv_document", cascade="all, delete-orphan")


class ProfileAISuggestion(Base, TimestampMixin):
    __tablename__ = "profile_ai_suggestions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    cv_document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cv_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False, index=True)
    suggested_changes: Mapped[dict] = mapped_column(JSONType, nullable=False)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="profile_ai_suggestions")
    cv_document: Mapped["CVDocument"] = relationship("CVDocument", back_populates="suggestions")


class ProfileChangeHistory(Base, TimestampMixin):
    __tablename__ = "profile_change_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    field_name: Mapped[str] = mapped_column(String(100), nullable=False)
    previous_value: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)
    new_value: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)
    source: Mapped[str] = mapped_column(String(50), default="CV_AI", nullable=False)
    confirmed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], back_populates="profile_change_history")
    confirmed_by_user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[confirmed_by])


