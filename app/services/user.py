import uuid
from typing import Optional, List, Tuple
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.models.domain import User, UserSettings, WorkerProfile, Company, Experience, Certificate, Skill, WorkerSkill
from app.schemas.user import UserUpdate
from app.schemas.profile import WorkerProfileUpdate, CompanyUpdate, ExperienceCreate, CertificateCreate
from app.repositories.user import UserRepository
from app.repositories.profile import WorkerProfileRepository, CompanyRepository, SkillRepository
from app.core.exceptions import NotFoundException, ForbiddenException

from app.utils.storage import save_base64_image, storage_service

class UserService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)
        self.worker_repo = WorkerProfileRepository(session)
        self.company_repo = CompanyRepository(session)
        self.skill_repo = SkillRepository(session)

    async def get_user_profile(self, user_id: uuid.UUID) -> User:
        user = await self.user_repo.get_with_profile(user_id)
        if not user:
            raise NotFoundException("User not found")
        return user

    async def update_user(self, user_id: uuid.UUID, update_data: UserUpdate) -> User:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise NotFoundException("User not found")

        if update_data.username is not None:
            user.username = update_data.username
        if update_data.full_name is not None:
            user.full_name = update_data.full_name
        if update_data.phone is not None:
            user.phone = update_data.phone
        if update_data.city is not None:
            user.city = update_data.city
        if update_data.avatar_url is not None:
            if update_data.avatar_url in ["", "DELETE", "REMOVE", "NULL"]:
                user.avatar_url = None
            else:
                clean_avatar = update_data.avatar_url
                if clean_avatar.startswith("data:image/"):
                    clean_avatar = await save_base64_image(clean_avatar, folder="avatars")
                user.avatar_url = clean_avatar

            # If user is employer, also sync company.logo_url
            if str(user.role).lower().endswith("employer"):
                company = await self.company_repo.get_by_employer_id(user_id)
                if company:
                    company.logo_url = user.avatar_url
                    await self.company_repo.update(company)

        if update_data.language is not None:
            user.language = update_data.language

        await self.user_repo.update(user)
        await self.session.commit()
        return user

    async def get_worker_profile(self, user_id: uuid.UUID) -> WorkerProfile:
        profile = await self.worker_repo.get_by_user_id(user_id)
        if not profile:
            profile = WorkerProfile(
                user_id=user_id,
                desired_position="",
                desired_salary=0.0,
                bio="",
                education="",
                portfolio_links={}
            )
            self.session.add(profile)
            await self.session.commit()
            profile = await self.worker_repo.get_by_user_id(user_id)
        return profile

    async def get_candidate_full_profile(self, candidate_user_id: uuid.UUID) -> dict:
        profile = await self.get_worker_profile(candidate_user_id)
        
        from app.models.domain import Resume
        stmt = select(Resume).where(
            Resume.user_id == candidate_user_id,
            Resume.is_published == True
        )
        res = await self.session.execute(stmt)
        published_resumes = res.scalars().all()

        return {
            "profile": profile,
            "published_resumes": list(published_resumes)
        }

    async def update_worker_profile(self, user_id: uuid.UUID, data: WorkerProfileUpdate) -> WorkerProfile:
        profile = await self.worker_repo.get_by_user_id(user_id)
        if not profile:
            profile = WorkerProfile(
                user_id=user_id,
                desired_position=data.desired_position or "",
                desired_salary=data.desired_salary or 0.0,
                bio=data.bio or "",
                education=data.education or "",
                portfolio_links=data.portfolio_links or {}
            )
            self.session.add(profile)
            await self.session.flush()

        if data.desired_position is not None:
            profile.desired_position = data.desired_position
        if data.desired_salary is not None:
            profile.desired_salary = data.desired_salary
        if data.bio is not None:
            profile.bio = data.bio
        if data.education is not None:
            profile.education = data.education
        if data.portfolio_links is not None:
            profile.portfolio_links = data.portfolio_links
        if data.relocation_preference is not None:
            profile.relocation_preference = data.relocation_preference
        if data.commute_preference is not None:
            profile.commute_preference = data.commute_preference
        if data.work_format is not None:
            profile.work_format = data.work_format
        if data.has_driving_license is not None:
            profile.has_driving_license = data.has_driving_license
        if data.driving_categories is not None:
            profile.driving_categories = data.driving_categories
        if data.has_own_car is not None:
            profile.has_own_car = data.has_own_car

        if data.skills is not None:
            profile.worker_skills.clear()
            for skill_name in data.skills:
                skill = await self.skill_repo.get_or_create(skill_name)
                ws = WorkerSkill(worker_profile_id=profile.id, skill_id=skill.id)
                profile.worker_skills.append(ws)

        if data.experiences is not None:
            profile.experiences.clear()
            for exp_item in data.experiences:
                exp = Experience(
                    worker_profile_id=profile.id,
                    company_name=exp_item.company_name,
                    role_title=exp_item.role_title,
                    start_date=exp_item.start_date,
                    end_date=exp_item.end_date,
                    description=exp_item.description
                )
                profile.experiences.append(exp)

        if data.certificates is not None:
            profile.certificates.clear()
            for cert_item in data.certificates:
                cert = Certificate(
                    worker_profile_id=profile.id,
                    title=cert_item.title,
                    issuer=cert_item.issuer,
                    year=cert_item.year,
                    credential_url=cert_item.credential_url
                )
                profile.certificates.append(cert)

        await self.worker_repo.update(profile)
        await self.session.commit()

        # Trigger intelligent job match recalculation
        try:
            from app.services.match_service import JobMatchService
            await JobMatchService.recalculate_user_matches(self.session, user_id)
            from app.celery.tasks import recalculate_user_job_matches_task
            recalculate_user_job_matches_task.delay(str(user_id))
        except Exception as err:
            pass

        return await self.get_worker_profile(user_id)

    async def add_experience(self, user_id: uuid.UUID, exp_data: ExperienceCreate) -> Experience:
        profile = await self.get_worker_profile(user_id)
        exp = Experience(
            worker_profile_id=profile.id,
            company_name=exp_data.company_name,
            role_title=exp_data.role_title,
            start_date=exp_data.start_date,
            end_date=exp_data.end_date,
            description=exp_data.description
        )
        self.session.add(exp)
        await self.session.commit()

        try:
            from app.services.match_service import JobMatchService
            await JobMatchService.recalculate_user_matches(self.session, user_id)
            from app.celery.tasks import recalculate_user_job_matches_task
            recalculate_user_job_matches_task.delay(str(user_id))
        except Exception:
            pass

        return exp

    async def add_certificate(self, user_id: uuid.UUID, cert_data: CertificateCreate) -> Certificate:
        profile = await self.get_worker_profile(user_id)
        cert = Certificate(
            worker_profile_id=profile.id,
            title=cert_data.title,
            issuer=cert_data.issuer,
            year=cert_data.year,
            credential_url=cert_data.credential_url
        )
        self.session.add(cert)
        await self.session.commit()
        return cert

    async def delete_certificate(self, user_id: uuid.UUID, cert_id: uuid.UUID) -> None:
        profile = await self.get_worker_profile(user_id)
        stmt = delete(Certificate).where(Certificate.id == cert_id, Certificate.worker_profile_id == profile.id)
        await self.session.execute(stmt)
        await self.session.commit()

    async def delete_experience(self, user_id: uuid.UUID, exp_id: uuid.UUID) -> None:
        profile = await self.get_worker_profile(user_id)
        stmt = delete(Experience).where(Experience.id == exp_id, Experience.worker_profile_id == profile.id)
        await self.session.execute(stmt)
        await self.session.commit()

    async def get_user_settings(self, user_id: uuid.UUID) -> UserSettings:
        stmt = select(UserSettings).where(UserSettings.user_id == user_id)
        res = await self.session.execute(stmt)
        settings_obj = res.scalar_one_or_none()
        if not settings_obj:
            settings_obj = UserSettings(
                user_id=user_id,
                language="ru",
                timezone="Asia/Dushanbe",
                email_notifications=True,
                push_notifications=True,
                theme="light"
            )
            self.session.add(settings_obj)
            await self.session.commit()
        return settings_obj

    async def update_user_settings(self, user_id: uuid.UUID, data: dict) -> UserSettings:
        settings_obj = await self.get_user_settings(user_id)
        if "language" in data:
            settings_obj.language = data["language"]
        if "timezone" in data:
            settings_obj.timezone = data["timezone"]
        if "email_notifications" in data:
            settings_obj.email_notifications = bool(data["email_notifications"])
        if "push_notifications" in data:
            settings_obj.push_notifications = bool(data["push_notifications"])
        if "theme" in data:
            settings_obj.theme = data["theme"]
        if "extra_preferences" in data:
            settings_obj.extra_preferences = data["extra_preferences"]

        await self.session.commit()
        return settings_obj

    async def get_company_profile(self, employer_id: uuid.UUID) -> Company:
        company = await self.company_repo.get_by_employer_id(employer_id)
        user = await self.user_repo.get_by_id(employer_id)
        if not company:
            c_name = (user.full_name or user.username or "Компания") if user else "Компания"
            company = Company(
                employer_id=employer_id,
                company_name=c_name,
                contact_email=user.email if user else None,
                contact_phone=user.phone if user else None,
                logo_url=user.avatar_url if user else None,
                is_verified=True
            )
            self.session.add(company)
            await self.session.commit()
        elif user:
            # Dual-sync logo_url and avatar_url if one is missing in PostgreSQL
            if not company.logo_url and user.avatar_url:
                company.logo_url = user.avatar_url
                self.session.add(company)
                await self.session.commit()
            elif company.logo_url and not user.avatar_url:
                user.avatar_url = company.logo_url
                self.session.add(user)
                await self.session.commit()

        return company

    async def update_company_profile(self, employer_id: uuid.UUID, data: CompanyUpdate) -> Company:
        company = await self.get_company_profile(employer_id)
        if data.company_name is not None:
            company.company_name = data.company_name
        if data.inn is not None and not company.inn:
            company.inn = data.inn
        if data.description is not None:
            company.description = data.description
        if data.logo_url is not None:
            if data.logo_url in ["", "DELETE", "REMOVE", "NULL"]:
                company.logo_url = None
            else:
                clean_logo = data.logo_url
                if clean_logo.startswith("data:image/"):
                    clean_logo = await save_base64_image(clean_logo, folder="logos")
                company.logo_url = clean_logo

        if data.website is not None:
            company.website = data.website
        if data.industry is not None:
            company.industry = data.industry
        if data.address is not None:
            company.address = data.address
        if data.contact_email is not None:
            company.contact_email = data.contact_email
        if data.contact_phone is not None:
            company.contact_phone = data.contact_phone
        if data.employee_count is not None:
            company.employee_count = data.employee_count
        if data.target_position is not None:
            company.target_position = data.target_position
        if data.required_skills is not None:
            company.required_skills = data.required_skills
        if data.min_experience_years is not None:
            company.min_experience_years = data.min_experience_years
        if data.offered_salary_min is not None:
            company.offered_salary_min = data.offered_salary_min
        if data.offered_salary_max is not None:
            company.offered_salary_max = data.offered_salary_max

        await self.company_repo.update(company)

        # Sync User details
        user = await self.user_repo.get_by_id(employer_id)
        if user:
            if data.company_name:
                user.full_name = data.company_name
            if data.logo_url is not None:
                user.avatar_url = company.logo_url
            if data.contact_phone:
                user.phone = data.contact_phone
            await self.user_repo.update(user)

        await self.session.commit()
        await self.session.refresh(company)
        return company

    async def update_company_logo(self, employer_id: uuid.UUID, file: UploadFile) -> Company:
        import time
        company = await self.get_company_profile(employer_id)
        old_logo_url = company.logo_url

        prefix = f"company_{employer_id.hex[:8]}"
        rel_path, _ = await storage_service.save_file(file, folder="logos", prefix=prefix)
        cache_busting_url = f"/api/v1/files/{rel_path}?v={int(time.time())}"

        company.logo_url = cache_busting_url
        await self.company_repo.update(company)

        user = await self.user_repo.get_by_id(employer_id)
        if user:
            user.avatar_url = cache_busting_url
            await self.user_repo.update(user)

        await self.session.commit()
        await self.session.refresh(company)

        # Safely delete old logo file from storage AFTER PostgreSQL transaction succeeds
        if old_logo_url:
            await storage_service.delete_file(old_logo_url)

        return company

    async def delete_company_logo(self, employer_id: uuid.UUID) -> Company:
        company = await self.get_company_profile(employer_id)
        old_logo_url = company.logo_url

        company.logo_url = None
        await self.company_repo.update(company)

        user = await self.user_repo.get_by_id(employer_id)
        if user:
            user.avatar_url = None
            await self.user_repo.update(user)

        await self.session.commit()
        await self.session.refresh(company)

        if old_logo_url:
            await storage_service.delete_file(old_logo_url)

        return company

    async def search_workers(
        self,
        name: Optional[str] = None,
        skill: Optional[str] = None,
        city: Optional[str] = None,
        skip: int = 0,
        limit: int = 20
    ) -> Tuple[List[WorkerProfile], int]:
        return await self.worker_repo.search_workers(name=name, skill=skill, city=city, skip=skip, limit=limit)

    async def get_sidebar_profile(self, user_id: uuid.UUID) -> dict:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise NotFoundException("User not found")

        role_val = user.role.value if hasattr(user.role, 'value') else str(user.role)

        display_name = user.full_name or user.username
        subtitle = user.city or "Пользователь"
        avatar_url = user.avatar_url
        badge_label = "Соискатель"
        active_jobs_count = 0
        applications_count = 0

        if role_val == "employer":
            badge_label = "Работодатель"
            comp_stmt = select(Company).where(Company.employer_id == user_id)
            comp_res = await self.session.execute(comp_stmt)
            company = comp_res.scalar_one_or_none()
            if company:
                display_name = company.company_name or display_name
                subtitle = company.industry or company.address or user.city or "Компания"
                avatar_url = company.logo_url or avatar_url
                
                from app.models.domain import Job
                job_stmt = select(Job).where(Job.company_id == company.id)
                job_res = await self.session.execute(job_stmt)
                active_jobs_count = len(job_res.scalars().all())

        elif role_val == "worker":
            badge_label = "Соискатель"
            wp_stmt = select(WorkerProfile).where(WorkerProfile.user_id == user_id)
            wp_res = await self.session.execute(wp_stmt)
            wp = wp_res.scalar_one_or_none()
            if wp and wp.desired_position:
                subtitle = wp.desired_position
            
            from app.models.domain import Application
            app_stmt = select(Application).where(Application.worker_id == user_id)
            app_res = await self.session.execute(app_stmt)
            applications_count = len(app_res.scalars().all())

        elif role_val == "admin":
            badge_label = "Администратор"
            subtitle = "Платформа HamKor"

        return {
            "user_id": user.id,
            "email": user.email,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
            "is_email_verified": user.is_email_verified,
            "display_name": display_name,
            "subtitle": subtitle,
            "avatar_url": avatar_url,
            "city": user.city,
            "badge_label": badge_label,
            "active_jobs_count": active_jobs_count,
            "applications_count": applications_count,
            "created_at": user.created_at
        }

