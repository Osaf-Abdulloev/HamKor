import uuid
from typing import Optional, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.domain import Job, Company
from app.models.enums import EmploymentType, JobStatus
from app.schemas.job import JobCreate, JobUpdate
from app.repositories.job import JobRepository
from app.repositories.profile import CompanyRepository
from app.core.exceptions import NotFoundException, ForbiddenException

class JobService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.job_repo = JobRepository(session)
        self.company_repo = CompanyRepository(session)

    async def create_job(self, employer_id: uuid.UUID, data: JobCreate) -> Job:
        company = await self.company_repo.get_by_employer_id(employer_id)
        if not company:
            from app.repositories.user import UserRepository
            user_repo = UserRepository(self.session)
            user = await user_repo.get_by_id(employer_id)
            c_name = (user.full_name or user.username or "Компания") if user else "Компания"
            company = Company(
                employer_id=employer_id,
                company_name=c_name,
                is_verified=True
            )
            self.session.add(company)
            await self.session.flush()

        job = Job(
            company_id=company.id,
            title=data.title,
            description=data.description,
            salary_min=data.salary_min,
            salary_max=data.salary_max,
            currency=data.currency,
            location=data.location,
            category=data.category,
            employment_type=data.employment_type,
            status=data.status
        )
        job = await self.job_repo.create(job)
        await self.session.commit()
        return await self.job_repo.get_with_company(job.id)

    async def get_my_jobs(self, employer_id: uuid.UUID, skip: int = 0, limit: int = 50) -> Tuple[List[Job], int]:
        company = await self.company_repo.get_by_employer_id(employer_id)
        if not company:
            return [], 0
        return await self.job_repo.search_jobs(company_id=company.id, status=None, skip=skip, limit=limit)

    async def update_job(self, employer_id: uuid.UUID, job_id: uuid.UUID, data: JobUpdate) -> Job:
        company = await self.company_repo.get_by_employer_id(employer_id)
        if not company:
            raise NotFoundException("Employer company profile not found")

        job = await self.job_repo.get_by_id(job_id)
        if not job:
            raise NotFoundException("Job not found")

        if job.company_id != company.id:
            raise ForbiddenException("Not authorized to modify this job listing")

        if data.title is not None:
            job.title = data.title
        if data.description is not None:
            job.description = data.description
        if data.salary_min is not None:
            job.salary_min = data.salary_min
        if data.salary_max is not None:
            job.salary_max = data.salary_max
        if data.currency is not None:
            job.currency = data.currency
        if data.location is not None:
            job.location = data.location
        if data.category is not None:
            job.category = data.category
        if data.employment_type is not None:
            job.employment_type = data.employment_type
        if data.status is not None:
            job.status = data.status

        await self.job_repo.update(job)
        await self.session.commit()
        return await self.job_repo.get_with_company(job.id)

    async def get_job_by_id(self, job_id: uuid.UUID) -> Job:
        job = await self.job_repo.get_with_company(job_id)
        if not job:
            raise NotFoundException("Job not found")
        return job

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
        return await self.job_repo.search_jobs(
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
            user_id=user_id,
            skip=skip,
            limit=limit
        )

    async def delete_job(self, employer_id: uuid.UUID, job_id: uuid.UUID) -> None:
        company = await self.company_repo.get_by_employer_id(employer_id)
        if not company:
            raise NotFoundException("Company not found")

        job = await self.job_repo.get_by_id(job_id)
        if not job:
            raise NotFoundException("Job not found")

        if job.company_id != company.id:
            raise ForbiddenException("Not authorized to delete this job")

        await self.job_repo.delete(job)
        await self.session.commit()
