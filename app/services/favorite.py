import uuid
from typing import Optional, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from app.models.domain import Favorite, SavedJob, Application
from app.models.enums import FavoriteTargetType
from app.schemas.favorite import FavoriteCreate
from app.repositories.favorite import FavoriteRepository
from app.repositories.job import JobRepository
from app.repositories.profile import WorkerProfileRepository, CompanyRepository
from app.core.exceptions import ConflictException, NotFoundException

class FavoriteService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.fav_repo = FavoriteRepository(session)
        self.job_repo = JobRepository(session)
        self.worker_repo = WorkerProfileRepository(session)
        self.company_repo = CompanyRepository(session)

    async def add_favorite(self, user_id: uuid.UUID, data: FavoriteCreate) -> Favorite:
        existing = await self.fav_repo.get_by_user_and_target(user_id, data.target_type, data.target_id)
        
        if data.target_type == FavoriteTargetType.JOB:
            job = await self.job_repo.get_by_id(data.target_id)
            if not job:
                raise NotFoundException("Job not found")

            # Sync to SavedJob table as well
            saved_stmt = select(SavedJob).where(SavedJob.user_id == user_id, SavedJob.job_id == data.target_id)
            saved_res = await self.session.execute(saved_stmt)
            if not saved_res.scalar_one_or_none():
                self.session.add(SavedJob(user_id=user_id, job_id=data.target_id))

        elif data.target_type == FavoriteTargetType.WORKER:
            worker = await self.worker_repo.get_by_user_id(data.target_id)
            if not worker:
                raise NotFoundException("Worker profile not found")

        elif data.target_type == FavoriteTargetType.COMPANY:
            company = await self.company_repo.get_by_id(data.target_id)
            if not company:
                raise NotFoundException("Company not found")

        if existing:
            await self.session.commit()
            return existing

        favorite = Favorite(
            user_id=user_id,
            target_type=data.target_type,
            target_id=data.target_id
        )
        favorite = await self.fav_repo.create(favorite)
        await self.session.commit()
        return favorite

    async def remove_favorite(self, user_id: uuid.UUID, target_type: FavoriteTargetType, target_id: uuid.UUID) -> None:
        favorite = await self.fav_repo.get_by_user_and_target(user_id, target_type, target_id)
        if favorite:
            await self.fav_repo.delete(favorite)

        if target_type == FavoriteTargetType.JOB:
            await self.session.execute(
                delete(SavedJob).where(SavedJob.user_id == user_id, SavedJob.job_id == target_id)
            )

        await self.session.commit()

    async def list_favorites(
        self,
        user_id: uuid.UUID,
        target_type: Optional[FavoriteTargetType] = None,
        skip: int = 0,
        limit: int = 20
    ) -> Tuple[List[Favorite], int]:
        from app.schemas.job import JobOut
        from app.schemas.profile import WorkerProfileOut, CompanyOut
        from app.services.match_service import JobMatchService
        
        items, total = await self.fav_repo.get_user_favorites(user_id, target_type=target_type, skip=skip, limit=limit)
        
        # Load user applications for status check
        app_res = await self.session.execute(
            select(Application.job_id).where(Application.worker_id == user_id)
        )
        applied_job_ids = set(app_res.scalars().all())

        for item in items:
            if item.target_type == FavoriteTargetType.JOB:
                job = await self.job_repo.get_with_company(item.target_id)
                if job:
                    job_dict = JobOut.model_validate(job).model_dump()
                    eval_data = JobMatchService.evaluate_job_match(job, None, None, None)
                    job_dict.update({
                        "match_score": eval_data["match_score"],
                        "commute_estimate": eval_data["commute_estimate"],
                        "distance_estimate": eval_data["distance_estimate"],
                        "matched_reasons": eval_data["matched_reasons"],
                        "matched_skills": eval_data["matched_skills"],
                        "has_applied": job.id in applied_job_ids,
                        "is_saved": True,
                        "is_favorite": True
                    })
                    item.target_details = job_dict
                else:
                    item.target_details = None

            elif item.target_type == FavoriteTargetType.WORKER:
                worker = await self.worker_repo.get_by_user_id(item.target_id)
                item.target_details = WorkerProfileOut.model_validate(worker) if worker else None

            elif item.target_type == FavoriteTargetType.COMPANY:
                company = await self.company_repo.get_by_id(item.target_id)
                item.target_details = CompanyOut.model_validate(company) if company else None

        return items, total
