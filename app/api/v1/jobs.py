import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from app.database.session import get_db
from app.schemas.job import JobCreate, JobUpdate, JobOut
from app.schemas.common import PaginatedResponse, MessageResponse
from app.services.job import JobService
from app.auth.deps import get_current_user, get_current_user_optional, require_roles, require_verified_user
from app.models.domain import User, SavedJob, Job
from app.models.enums import UserRole, EmploymentType, JobStatus

router = APIRouter(prefix="/jobs", tags=["Jobs"])

@router.post("", response_model=JobOut, status_code=status.HTTP_201_CREATED)
async def create_job(
    data: JobCreate,
    current_user: User = Depends(require_roles([UserRole.EMPLOYER])),
    db: AsyncSession = Depends(get_db)
):
    service = JobService(db)
    return await service.create_job(current_user.id, data)

@router.get("", response_model=PaginatedResponse[JobOut])
async def search_jobs(
    title: Optional[str] = None,
    search: Optional[str] = None,
    category: Optional[str] = None,
    location: Optional[str] = None,
    employment_type: Optional[EmploymentType] = None,
    salary_min: Optional[float] = None,
    salary_max: Optional[float] = None,
    source: Optional[str] = None,
    status: Optional[JobStatus] = JobStatus.OPEN,
    company_id: Optional[uuid.UUID] = None,
    sort_by_match: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=1000),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    service = JobService(db)
    skip = (page - 1) * limit

    # Load candidate profile & published resume for real-time backend scanning
    worker_profile = None
    published_resume = None
    if current_user:
        from app.repositories.profile import WorkerProfileRepository
        from app.repositories.resume import ResumeRepository
        wp_repo = WorkerProfileRepository(db)
        res_repo = ResumeRepository(db)
        worker_profile = await wp_repo.get_by_user_id(current_user.id)
        published_resume = await res_repo.get_user_published_resume(current_user.id)

    # Fetch matching jobs from repo (with automatic user_id outer join sorting for logged-in workers)
    user_id_param = current_user.id if current_user else None
    items, total = await service.search_jobs(
        title=title,
        search=search,
        category=category,
        location=location,
        employment_type=employment_type,
        salary_min=salary_min,
        salary_max=salary_max,
        source=source,
        status=status,
        company_id=company_id,
        user_id=user_id_param,
        skip=skip,
        limit=limit
    )

    # Fetch user's submitted application & saved job IDs if authenticated
    applied_job_ids = set()
    saved_job_ids = set()
    job_match_map = {}
    if current_user:
        from app.models.domain import Application, JobMatch, SavedJob, Favorite
        from app.models.enums import FavoriteTargetType
        
        app_res = await db.execute(
            select(Application.job_id).where(Application.worker_id == current_user.id)
        )
        applied_job_ids = set(app_res.scalars().all())

        saved_res = await db.execute(
            select(SavedJob.job_id).where(SavedJob.user_id == current_user.id)
        )
        saved_job_ids = set(saved_res.scalars().all())

        fav_res = await db.execute(
            select(Favorite.target_id).where(
                Favorite.user_id == current_user.id,
                Favorite.target_type == FavoriteTargetType.JOB
            )
        )
        saved_job_ids.update(fav_res.scalars().all())

        # Load persistent JobMatch records for returned jobs
        item_ids = [j.id for j in items]
        if item_ids:
            jm_res = await db.execute(
                select(JobMatch).where(
                    JobMatch.user_id == current_user.id,
                    JobMatch.job_id.in_(item_ids),
                    JobMatch.is_stale == False
                )
            )
            job_match_map = {m.job_id: m for m in jm_res.scalars().all()}

    from app.services.match_service import JobMatchService
    annotated_items = []
    for job in items:
        job_dict = JobOut.model_validate(job).model_dump()
        jm = job_match_map.get(job.id)
        is_job_saved = job.id in saved_job_ids

        if jm:
            job_dict.update({
                "match_score": jm.match_score,
                "commute_estimate": jm.commute_estimate,
                "distance_estimate": jm.distance_estimate,
                "matched_reasons": jm.matched_reasons or ["Подходит по параметрам вашего профиля"],
                "matched_skills": jm.matched_skills or [],
                "has_applied": job.id in applied_job_ids,
                "is_saved": is_job_saved,
                "is_favorite": is_job_saved,
            })
        elif current_user:
            # Inline fallback for newly registered worker if background task hasn't completed
            eval_data = JobMatchService.evaluate_job_match(job, worker_profile, current_user, published_resume)
            job_dict.update({
                "match_score": eval_data["match_score"],
                "commute_estimate": eval_data["commute_estimate"],
                "distance_estimate": eval_data["distance_estimate"],
                "matched_reasons": eval_data["matched_reasons"],
                "matched_skills": eval_data["matched_skills"],
                "has_applied": job.id in applied_job_ids,
                "is_saved": is_job_saved,
                "is_favorite": is_job_saved,
            })
        else:
            # Guest view
            job_dict.update({
                "match_score": 0,
                "commute_estimate": None,
                "distance_estimate": None,
                "matched_reasons": [],
                "matched_skills": [],
                "has_applied": False,
                "is_saved": False,
                "is_favorite": False,
            })

        annotated_items.append(job_dict)

    pages = (total + limit - 1) // limit if total > 0 else 1
    return PaginatedResponse(items=annotated_items, total=total, page=page, limit=limit, pages=pages)

@router.get("/my", response_model=PaginatedResponse[JobOut])
async def get_my_created_jobs(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(require_roles([UserRole.EMPLOYER])),
    db: AsyncSession = Depends(get_db)
):
    service = JobService(db)
    skip = (page - 1) * limit
    items, total = await service.get_my_jobs(current_user.id, skip=skip, limit=limit)
    pages = (total + limit - 1) // limit if total > 0 else 1
    return PaginatedResponse(items=items, total=total, page=page, limit=limit, pages=pages)

@router.get("/saved/my", response_model=PaginatedResponse[JobOut])
async def get_my_saved_jobs(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Job)
        .join(SavedJob, SavedJob.job_id == Job.id)
        .options(selectinload(Job.company))
        .where(SavedJob.user_id == current_user.id)
        .order_by(SavedJob.created_at.desc())
    )
    res = await db.execute(stmt)
    jobs = res.scalars().all()
    total = len(jobs)
    paginated = jobs[(page - 1) * limit : page * limit]

    app_res = await db.execute(
        select(Application.job_id).where(Application.worker_id == current_user.id)
    )
    applied_job_ids = set(app_res.scalars().all())

    from app.services.match_service import JobMatchService
    annotated_items = []
    for job in paginated:
        job_dict = JobOut.model_validate(job).model_dump()
        eval_data = JobMatchService.evaluate_job_match(job, None, current_user, None)
        job_dict.update({
            "match_score": eval_data["match_score"],
            "commute_estimate": eval_data["commute_estimate"],
            "distance_estimate": eval_data["distance_estimate"],
            "matched_reasons": eval_data["matched_reasons"],
            "matched_skills": eval_data["matched_skills"],
            "has_applied": job.id in applied_job_ids,
            "is_saved": True,
            "is_favorite": True,
        })
        annotated_items.append(job_dict)

    pages = (total + limit - 1) // limit if total > 0 else 1
    return PaginatedResponse(items=annotated_items, total=total, page=page, limit=limit, pages=pages)

@router.post("/{job_id}/save", response_model=MessageResponse)
@router.post("/{job_id}/favorite", response_model=MessageResponse)
async def save_job_to_bookmarks(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.models.domain import Favorite
    from app.models.enums import FavoriteTargetType

    stmt = select(SavedJob).where(SavedJob.user_id == current_user.id, SavedJob.job_id == job_id)
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()
    if not existing:
        saved_job = SavedJob(user_id=current_user.id, job_id=job_id)
        db.add(saved_job)

    fav_stmt = select(Favorite).where(
        Favorite.user_id == current_user.id,
        Favorite.target_type == FavoriteTargetType.JOB,
        Favorite.target_id == job_id
    )
    fav_res = await db.execute(fav_stmt)
    if not fav_res.scalar_one_or_none():
        fav = Favorite(user_id=current_user.id, target_type=FavoriteTargetType.JOB, target_id=job_id)
        db.add(fav)

    await db.commit()
    return MessageResponse(message="Job saved to bookmarks in PostgreSQL")

@router.delete("/{job_id}/save", response_model=MessageResponse)
@router.delete("/{job_id}/favorite", response_model=MessageResponse)
async def remove_job_from_bookmarks(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.models.domain import Favorite
    from app.models.enums import FavoriteTargetType

    await db.execute(delete(SavedJob).where(SavedJob.user_id == current_user.id, SavedJob.job_id == job_id))
    await db.execute(delete(Favorite).where(
        Favorite.user_id == current_user.id,
        Favorite.target_type == FavoriteTargetType.JOB,
        Favorite.target_id == job_id
    ))
    await db.commit()
    return MessageResponse(message="Job removed from bookmarks in PostgreSQL")

@router.get("/{job_id}/match")
async def evaluate_job_match_for_user(
    job_id: uuid.UUID,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    service = JobService(db)
    job = await service.get_job_by_id(job_id)

    worker_profile = None
    published_resume = None

    if current_user:
        from app.repositories.profile import WorkerProfileRepository
        from app.repositories.resume import ResumeRepository
        wp_repo = WorkerProfileRepository(db)
        res_repo = ResumeRepository(db)
        worker_profile = await wp_repo.get_by_user_id(current_user.id)
        published_resume = await res_repo.get_user_published_resume(current_user.id)

    from app.services.match_service import JobMatchService
    return JobMatchService.evaluate_job_match(job, worker_profile, current_user, published_resume)

@router.get("/{job_id}/commute")
async def calculate_job_commute(
    job_id: uuid.UUID,
    origin_address: Optional[str] = Query(default=None),
    origin_lat: Optional[float] = Query(default=None),
    origin_lng: Optional[float] = Query(default=None),
    transport_mode: str = Query(default="car"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    service = JobService(db)
    job = await service.get_job_by_id(job_id)
    
    user_location = origin_address or (current_user.city if current_user else None) or "Душанбе"
    is_remote = (job.employment_type.value if hasattr(job.employment_type, 'value') else str(job.employment_type)) == 'remote'
    
    from app.services.location_service import LocationService
    return LocationService.calculate_commute(
        origin_location=user_location,
        destination_location=job.location,
        origin_lat=origin_lat,
        origin_lng=origin_lng,
        transport_mode=transport_mode,
        is_remote=is_remote
    )

@router.get("/{job_id}", response_model=JobOut)
async def get_job(
    job_id: uuid.UUID,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    service = JobService(db)
    job = await service.get_job_by_id(job_id)
    job_dict = JobOut.model_validate(job).model_dump()
    if current_user:
        from app.models.domain import Application
        app_res = await db.execute(
            select(Application.id).where(Application.worker_id == current_user.id, Application.job_id == job_id)
        )
        job_dict["has_applied"] = app_res.scalar_one_or_none() is not None
    return job_dict


@router.put("/{job_id}", response_model=JobOut)
async def update_job(
    job_id: uuid.UUID,
    data: JobUpdate,
    current_user: User = Depends(require_roles([UserRole.EMPLOYER])),
    db: AsyncSession = Depends(get_db)
):
    service = JobService(db)
    return await service.update_job(current_user.id, job_id, data)

@router.delete("/{job_id}", response_model=MessageResponse)
async def delete_job(
    job_id: uuid.UUID,
    current_user: User = Depends(require_roles([UserRole.EMPLOYER])),
    db: AsyncSession = Depends(get_db)
):
    service = JobService(db)
    await service.delete_job(current_user.id, job_id)
    return MessageResponse(message="Job deleted successfully")

@router.post("/sync/yora")
async def sync_yora_jobs(
    max_pages: Optional[int] = Query(default=None, ge=1, description="Max pages to fetch, default fetches all"),
    full_import: bool = Query(default=True, description="Whether to perform full import with soft delete"),
    db: AsyncSession = Depends(get_db)
):
    from app.services.yora_parser import YoraParserService
    parser = YoraParserService(db)
    stats = await parser.fetch_and_sync(max_pages=max_pages, full_import=full_import)
    return {
        "status": "success",
        "source": "yora.tj",
        "stats": stats
    }

@router.post("/sync/somon")
async def sync_somon_jobs(
    max_pages: Optional[int] = Query(default=None, ge=1, description="Max pages to fetch from Somon.tj"),
    full_import: bool = Query(default=True, description="Whether to perform full import with soft delete"),
    db: AsyncSession = Depends(get_db)
):
    from app.services.somon_parser import SomonParserService
    parser = SomonParserService(db)
    stats = await parser.fetch_and_sync(max_pages=max_pages, full_import=full_import)
    return {
        "status": "success",
        "source": "somon.tj",
        "stats": stats
    }

@router.get("/sync/status")
async def get_sync_status(
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import func
    from app.models.domain import Job
    from app.models.enums import JobStatus

    total_res = await db.execute(select(func.count(Job.id)))
    total_jobs = total_res.scalar_one()

    yora_res = await db.execute(select(func.count(Job.id)).where(Job.external_source == "yora.tj"))
    total_yora = yora_res.scalar_one()

    somon_res = await db.execute(select(func.count(Job.id)).where(Job.external_source == "somon.tj"))
    total_somon = somon_res.scalar_one()

    active_res = await db.execute(select(func.count(Job.id)).where(Job.status == JobStatus.OPEN))
    active_jobs = active_res.scalar_one()

    last_seen_res = await db.execute(select(func.max(Job.last_seen_at)))
    last_synced_at = last_seen_res.scalar_one_or_none()

    return {
        "total_jobs": total_jobs,
        "yora_jobs": total_yora,
        "somon_jobs": total_somon,
        "active_jobs": active_jobs,
        "inactive_jobs": total_jobs - active_jobs,
        "last_synced_at": last_synced_at
    }


