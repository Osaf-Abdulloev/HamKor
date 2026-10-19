import uuid
from typing import Optional, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_
from app.models.domain import Job, Company, JobMatch
from app.models.enums import EmploymentType, JobStatus
from app.repositories.base import BaseRepository

class JobRepository(BaseRepository[Job]):
    def __init__(self, session: AsyncSession):
        super().__init__(Job, session)

    async def get_with_company(self, job_id: uuid.UUID) -> Optional[Job]:
        result = await self.session.execute(
            select(Job)
            .options(selectinload(Job.company))
            .where(Job.id == job_id)
        )
        return result.scalars().first()

    async def search_jobs(
        self,
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
        user_id: Optional[uuid.UUID] = None,
        skip: int = 0,
        limit: int = 20
    ) -> Tuple[List[Job], int]:
        query = select(Job).options(selectinload(Job.company))
        count_stmt = select(func.count(Job.id))

        filters = []

        if status:
            filters.append(Job.status == status)
        if company_id:
            filters.append(Job.company_id == company_id)
        if source:
            if source.lower() in ["yora", "yora.tj"]:
                filters.append(Job.external_source == "yora.tj")
            elif source.lower() in ["somon", "somon.tj"]:
                filters.append(Job.external_source == "somon.tj")
            elif source.lower() == "direct":
                filters.append(Job.is_external == False)
            else:
                filters.append(Job.external_source.ilike(f"%{source}%"))
        if search and search.strip():
            s_val = f"%{search.strip()}%"
            filters.append(
                or_(
                    Job.title.ilike(s_val),
                    Job.description.ilike(s_val),
                    Job.external_company_name.ilike(s_val),
                    Job.category.ilike(s_val),
                    Job.location.ilike(s_val)
                )
            )
        if title and not search:
            filters.append(Job.title.ilike(f"%{title}%"))
        if category:
            filters.append(Job.category.ilike(f"%{category}%"))
        if location:
            filters.append(Job.location.ilike(f"%{location}%"))
        if employment_type:
            filters.append(Job.employment_type == employment_type)
        if salary_min is not None:
            filters.append(Job.salary_max >= salary_min)
        if salary_max is not None:
            filters.append(Job.salary_min <= salary_max)

        if filters:
            query = query.where(*filters)
            count_stmt = count_stmt.where(*filters)

        total = (await self.session.execute(count_stmt)).scalar_one()

        if user_id:
            query = query.outerjoin(
                JobMatch,
                (JobMatch.job_id == Job.id) & (JobMatch.user_id == user_id) & (JobMatch.is_stale == False)
            ).order_by(
                func.coalesce(JobMatch.match_score, 0).desc(),
                Job.published_at.desc().nullslast(),
                Job.created_at.desc()
            )
        else:
            query = query.order_by(
                Job.published_at.desc().nullslast(),
                Job.created_at.desc()
            )

        query = query.offset(skip).limit(limit)

        result = await self.session.execute(query)
        return list(result.scalars().all()), total
