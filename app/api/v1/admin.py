import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc, or_

from app.database.session import get_db
from app.schemas.profile import CompanyOut
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.user import UserOut
from app.auth.deps import require_roles
from app.models.domain import User, Company, Job, Application
from app.models.enums import UserRole, JobStatus, ApplicationStatus
from app.repositories.profile import CompanyRepository
from app.core.exceptions import NotFoundException
from app.services.telegram_parser import TelegramParserService
from app.services.yora_parser import YoraParserService

router = APIRouter(prefix="/admin", tags=["Admin Portal"])

class UpdateRoleSchema(BaseModel):
    role: UserRole

class MuteUserSchema(BaseModel):
    is_muted: Optional[bool] = True
    duration_hours: Optional[int] = None
    reason: Optional[str] = "Заблокирован администратором"

@router.get("/stats")
async def get_admin_dashboard_stats(
    admin: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    now = datetime.now(timezone.utc)

    user_stats = (await db.execute(
        select(
            func.count(User.id).label("total"),
            func.count(User.id).filter(User.role == UserRole.WORKER).label("workers"),
            func.count(User.id).filter(User.role == UserRole.EMPLOYER).label("employers"),
            func.count(User.id).filter(User.role == UserRole.ADMIN).label("admins"),
            func.count(User.id).filter(or_(User.is_muted == True, User.muted_until > now)).label("muted")
        )
    )).one()

    job_stats = (await db.execute(
        select(
            func.count(Job.id).label("total"),
            func.count(Job.id).filter(Job.status == JobStatus.OPEN).label("active"),
            func.count(Job.id).filter(Job.status == JobStatus.CLOSED).label("closed"),
            func.count(Job.id).filter(Job.is_external == True).label("external"),
            func.count(Job.id).filter(or_(Job.external_source == "telegram_kortj1", Job.external_source.ilike("%telegram%"))).label("telegram"),
            func.count(Job.id).filter(or_(Job.external_source == "yora_tj", Job.external_source == "yora.tj", Job.external_source.ilike("%yora%"))).label("yora")
        )
    )).one()

    app_stats = (await db.execute(
        select(
            func.count(Application.id).label("total"),
            func.count(Application.id).filter(Application.status == ApplicationStatus.PENDING).label("pending"),
            func.count(Application.id).filter(Application.status == ApplicationStatus.REVIEWED).label("reviewed"),
            func.count(Application.id).filter(Application.status == ApplicationStatus.ACCEPTED).label("accepted"),
            func.count(Application.id).filter(Application.status == ApplicationStatus.REJECTED).label("rejected")
        )
    )).one()

    total_users = user_stats.total
    candidates_count = user_stats.workers
    employers_count = user_stats.employers
    admins_count = user_stats.admins
    muted_users_count = user_stats.muted

    total_jobs = job_stats.total
    active_jobs = job_stats.active
    closed_jobs = job_stats.closed
    external_jobs = job_stats.external
    direct_jobs = total_jobs - external_jobs
    telegram_jobs = job_stats.telegram
    yora_jobs = job_stats.yora

    total_applications = app_stats.total
    pending_apps = app_stats.pending
    reviewed_apps = app_stats.reviewed
    accepted_apps = app_stats.accepted
    rejected_apps = app_stats.rejected

    # Recent Signups
    recent_users_res = await db.execute(select(User).order_by(desc(User.created_at)).limit(10))
    recent_users = recent_users_res.scalars().all()

    # Recent Applications
    recent_apps_res = await db.execute(
        select(Application).order_by(desc(Application.created_at)).limit(10)
    )
    recent_apps = recent_apps_res.scalars().all()

    return {
        "users": {
            "total": total_users,
            "candidates": candidates_count,
            "employers": employers_count,
            "admins": admins_count,
            "muted": muted_users_count
        },
        "jobs": {
            "total": total_jobs,
            "active": active_jobs,
            "closed": closed_jobs,
            "direct": direct_jobs,
            "external": external_jobs,
            "telegram_kortj1": telegram_jobs,
            "yora_tj": yora_jobs
        },
        "applications": {
            "total": total_applications,
            "pending": pending_apps,
            "reviewed": reviewed_apps,
            "accepted": accepted_apps,
            "rejected": rejected_apps
        },
        "recent_signups": [
            {
                "id": str(u.id),
                "email": u.email,
                "username": u.username,
                "full_name": u.full_name,
                "role": u.role.value,
                "created_at": u.created_at.isoformat() if u.created_at else None
            } for u in recent_users
        ]
    }

@router.get("/users")
async def get_users_list(
    q: Optional[str] = None,
    role: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    admin: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    query = select(User)

    if q:
        search = f"%{q}%"
        query = query.where(
            or_(
                User.email.ilike(search),
                User.username.ilike(search),
                User.full_name.ilike(search)
            )
        )

    if role:
        try:
            user_role = UserRole(role.lower())
            query = query.where(User.role == user_role)
        except ValueError:
            pass

    # Count total
    count_stmt = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    # Paginate
    query = query.order_by(desc(User.created_at)).offset((page - 1) * limit).limit(limit)
    res = await db.execute(query)
    users = res.scalars().all()

    now = datetime.now(timezone.utc)
    items = []
    for u in users:
        is_muted_active = u.is_muted
        if u.muted_until:
            m_dt = u.muted_until
            if m_dt.tzinfo is None:
                m_dt = m_dt.replace(tzinfo=timezone.utc)
            if m_dt > now:
                is_muted_active = True

        items.append({
            "id": str(u.id),
            "email": u.email,
            "username": u.username,
            "full_name": u.full_name,
            "role": u.role.value,
            "is_active": u.is_active,
            "is_muted": is_muted_active,
            "muted_until": u.muted_until.isoformat() if u.muted_until else None,
            "mute_reason": u.mute_reason,
            "created_at": u.created_at.isoformat() if u.created_at else None
        })

    pages = (total + limit - 1) // limit if total > 0 else 1
    return {"items": items, "total": total, "page": page, "limit": limit, "pages": pages}

@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: uuid.UUID,
    body: UpdateRoleSchema,
    admin: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    if not user:
        raise NotFoundException("User not found")

    user.role = body.role
    await db.commit()
    return {"status": "ok", "message": f"Роль пользователя изменена на {body.role.value}"}

@router.post("/users/{user_id}/mute")
async def mute_user(
    user_id: uuid.UUID,
    body: MuteUserSchema,
    admin: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    if not user:
        raise NotFoundException("User not found")

    if body.is_muted is False:
        user.is_muted = False
        user.muted_until = None
        user.mute_reason = None
        await db.commit()
        return {
            "status": "ok",
            "message": f"Пользователь {user.username or user.email} успешно размучен",
            "is_muted": False
        }

    user.is_muted = True
    user.mute_reason = body.reason.strip() if body.reason else "Заблокирован администратором"

    if body.duration_hours and body.duration_hours > 0:
        user.muted_until = datetime.now(timezone.utc) + timedelta(hours=body.duration_hours)
    else:
        user.muted_until = None  # Permanent mute

    await db.commit()
    return {
        "status": "ok",
        "message": f"Пользователь {user.username or user.email} успешно замучен",
        "reason": user.mute_reason,
        "is_muted": True,
        "muted_until": user.muted_until.isoformat() if user.muted_until else "Бессрочно"
    }

@router.post("/users/{user_id}/unmute")
async def unmute_user(
    user_id: uuid.UUID,
    admin: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    if not user:
        raise NotFoundException("User not found")

    user.is_muted = False
    user.muted_until = None
    user.mute_reason = None

    await db.commit()
    return {"status": "ok", "message": f"Пользователь {user.username} разблокирован"}

@router.post("/sync/telegram")
async def sync_telegram_jobs(
    max_pages: int = Query(default=5, ge=1, le=20),
    admin: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    parser = TelegramParserService(db)
    stats = await parser.fetch_and_sync(max_pages=max_pages)
    return {"status": "ok", "stats": stats}

@router.post("/sync/yora")
async def sync_yora_jobs(
    max_pages: int = Query(default=3, ge=1, le=10),
    admin: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    parser = YoraParserService(db)
    stats = await parser.fetch_and_sync(max_pages=max_pages)
    return {"status": "ok", "stats": stats}

@router.patch("/companies/{company_id}/verify", response_model=CompanyOut)
async def verify_company(
    company_id: uuid.UUID,
    admin: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    repo = CompanyRepository(db)
    company = await repo.get_by_id(company_id)
    if not company:
        raise NotFoundException("Company not found")
    
    company.is_verified = True
    await repo.update(company)
    await db.commit()
    return company

@router.delete("/users/{user_id}", response_model=MessageResponse)
async def delete_user_permanently(
    user_id: uuid.UUID,
    admin: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Администратор не может удалить собственный аккаунт"
        )

    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    if not user:
        raise NotFoundException("User not found")

    username = user.username or user.email
    await db.delete(user)
    await db.commit()

    return MessageResponse(
        message=f"Пользователь {username} полностью удален из базы данных (Hard Delete)",
        status="ok"
    )

