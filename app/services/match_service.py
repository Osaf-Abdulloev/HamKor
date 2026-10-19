import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import delete, update
from app.models.domain import Job, WorkerProfile, User, Resume, JobMatch
from app.models.enums import JobStatus
from app.services.location_service import LocationService

class JobMatchService:
    @staticmethod
    def evaluate_job_match(
        job: Job,
        worker_profile: Optional[WorkerProfile] = None,
        user: Optional[User] = None,
        published_resume: Optional[Resume] = None
    ) -> Dict[str, Any]:
        """
        Evaluate match score between a Job and a Worker/User profile,
        using real location & commute metrics calculated by LocationService.
        """
        user_city = (user.city if user else None) or "Душанбе"
        user_salary = worker_profile.desired_salary if worker_profile else None
        pos_title = worker_profile.desired_position if worker_profile else None
        bio_text = worker_profile.bio if worker_profile else ""
        
        # Gather candidate skills
        candidate_skills = []
        if worker_profile:
            candidate_skills.extend([s.name.lower() for s in worker_profile.skills if s and s.name])
        
        if published_resume and published_resume.content:
            tech_skills = published_resume.content.get("skills", {}).get("technical", [])
            for ts in tech_skills:
                val = ts if isinstance(ts, str) else ts.get("name")
                if val and val.lower() not in candidate_skills:
                    candidate_skills.append(val.lower())
            
            if not pos_title:
                pos_title = published_resume.content.get("personal_info", {}).get("desired_position")
            if not bio_text:
                bio_text = published_resume.content.get("personal_info", {}).get("summary", "")


        position_score = 15
        if pos_title and job.title:
            pos_words = set(pos_title.lower().split())
            job_words = set(job.title.lower().split())
            common = pos_words.intersection(job_words)
            if common:
                position_score = 38
            elif any(w in job.title.lower() for w in pos_words):
                position_score = 30

        # B. Skills Match (Max 30 pts)
        job_reqs = []
        if job.requirements and isinstance(job.requirements, dict):
            job_reqs = job.requirements.get("skills", [])
        elif job.requirements and isinstance(job.requirements, list):
            job_reqs = job.requirements

        matched_skills = []
        missing_skills = []
        
        for req in job_reqs:
            req_str = req if isinstance(req, str) else req.get("name", "")
            if not req_str:
                continue
            if any(cs in req_str.lower() or req_str.lower() in cs for cs in candidate_skills):
                matched_skills.append(req_str)
            else:
                missing_skills.append(req_str)

        if job_reqs:
            match_ratio = len(matched_skills) / len(job_reqs)
            skill_score = int(match_ratio * 30)
        else:
            skill_score = 20

        # C. Salary Alignment (Max 15 pts)
        salary_score = 15
        if user_salary and job.salary_min:
            if user_salary <= job.salary_min * 1.2:
                salary_score = 15
            elif user_salary <= job.salary_min * 1.5:
                salary_score = 10
            else:
                salary_score = 5

        # D. Real Location & Commute Calculation (Max 10 pts)
        commute_info = LocationService.calculate_commute(
            origin_location=user_city,
            destination_location=job.location,
            is_remote=(job.employment_type.value if hasattr(job.employment_type, 'value') else str(job.employment_type)) == 'remote'
        )

        location_score = 10 if commute_info["location_fit_score"] >= 80 else 5

        # E. Profile Completeness (Max 5 pts)
        completeness_score = 5 if (bio_text or candidate_skills) else 2

        # Final Match Percentage
        raw_total = position_score + skill_score + salary_score + location_score + completeness_score
        final_score = min(99, max(72, raw_total))

        # Highlights & Growth Advice
        matched_reasons = []
        if position_score >= 25:
            matched_reasons.append(f"Высокое соответствие специальности ({pos_title or 'Специалист'})")
        if matched_skills:
            matched_reasons.append(f"Совпадение ключевых навыков ({', '.join(matched_skills[:3])})")
        if commute_info.get("commute_text"):
            matched_reasons.append(f"Логистика: {commute_info['commute_text']} ({job.location})")

        growth_advice = []
        if missing_skills:
            growth_advice.append(f"Рекомендуется добавить навыки: {', '.join(missing_skills[:3])}")
        if not bio_text or len(bio_text) < 30:
            growth_advice.append("Заполните блок 'О себе' или сгенерируйте ИИ Резюме для повышения рейтинга")

        return {
            "match_score": final_score,
            "score_breakdown": {
                "position_score": position_score,
                "skill_score": skill_score,
                "salary_score": salary_score,
                "location_score": location_score,
                "completeness_score": completeness_score
            },
            "commute_estimate": commute_info["commute_text"],
            "distance_estimate": commute_info["distance_text"],
            "distance_km": commute_info["distance_km"],
            "commute_minutes": commute_info["commute_minutes"],
            "matched_reasons": matched_reasons if matched_reasons else ["Подходит по ключевым критериям соискателя"],
            "matched_skills": matched_skills,
            "missing_skills": missing_skills,
            "growth_advice": growth_advice
        }

    @staticmethod
    async def recalculate_user_matches(session: AsyncSession, user_id: uuid.UUID) -> int:
        """
        Recalculate persistent JobMatch records for a worker user against active open jobs.
        """
        # Fetch user
        u_res = await session.execute(select(User).where(User.id == user_id))
        user = u_res.scalar_one_or_none()
        if not user:
            return 0

        # Fetch worker profile with skills
        from app.models.domain import WorkerSkill
        wp_res = await session.execute(
            select(WorkerProfile)
            .options(selectinload(WorkerProfile.worker_skills).selectinload(WorkerSkill.skill))
            .where(WorkerProfile.user_id == user_id)
        )
        worker_profile = wp_res.scalar_one_or_none()

        # Fetch published resume
        from app.repositories.resume import ResumeRepository
        res_repo = ResumeRepository(session)
        published_resume = await res_repo.get_user_published_resume(user_id)

        # Mark existing matches as stale
        await session.execute(
            update(JobMatch)
            .where(JobMatch.user_id == user_id)
            .values(is_stale=True)
        )

        # Fetch active open jobs
        jobs_res = await session.execute(
            select(Job).where(Job.status == JobStatus.OPEN).limit(500)
        )
        active_jobs = list(jobs_res.scalars().all())

        if not active_jobs:
            await session.commit()
            return 0

        # Fetch existing match objects for user to reuse IDs
        existing_matches_res = await session.execute(
            select(JobMatch).where(JobMatch.user_id == user_id)
        )
        match_map = {m.job_id: m for m in existing_matches_res.scalars().all()}

        count = 0
        now = datetime.now(timezone.utc)

        for job in active_jobs:
            eval_data = JobMatchService.evaluate_job_match(
                job=job,
                worker_profile=worker_profile,
                user=user,
                published_resume=published_resume
            )

            existing = match_map.get(job.id)
            if existing:
                existing.match_score = eval_data["match_score"]
                existing.position_score = eval_data["score_breakdown"]["position_score"]
                existing.skill_score = eval_data["score_breakdown"]["skill_score"]
                existing.salary_score = eval_data["score_breakdown"]["salary_score"]
                existing.location_score = eval_data["score_breakdown"]["location_score"]
                existing.commute_estimate = eval_data["commute_estimate"]
                existing.distance_estimate = eval_data["distance_estimate"]
                existing.matched_reasons = eval_data["matched_reasons"]
                existing.matched_skills = eval_data["matched_skills"]
                existing.missing_skills = eval_data["missing_skills"]
                existing.is_stale = False
                existing.version += 1
                existing.updated_at = now
            else:
                new_match = JobMatch(
                    user_id=user_id,
                    job_id=job.id,
                    match_score=eval_data["match_score"],
                    position_score=eval_data["score_breakdown"]["position_score"],
                    skill_score=eval_data["score_breakdown"]["skill_score"],
                    salary_score=eval_data["score_breakdown"]["salary_score"],
                    location_score=eval_data["score_breakdown"]["location_score"],
                    commute_estimate=eval_data["commute_estimate"],
                    distance_estimate=eval_data["distance_estimate"],
                    matched_reasons=eval_data["matched_reasons"],
                    matched_skills=eval_data["matched_skills"],
                    missing_skills=eval_data["missing_skills"],
                    is_stale=False,
                    version=1,
                    created_at=now,
                    updated_at=now
                )
                session.add(new_match)
            count += 1

        await session.commit()
        return count

    @staticmethod
    async def recalculate_job_matches(session: AsyncSession, job_id: uuid.UUID) -> int:
        """
        Recalculate persistent JobMatch records for a specific job against active worker users.
        """
        j_res = await session.execute(select(Job).where(Job.id == job_id))
        job = j_res.scalar_one_or_none()
        if not job or job.status != JobStatus.OPEN:
            # Remove matches for closed/deleted job
            await session.execute(delete(JobMatch).where(JobMatch.job_id == job_id))
            await session.commit()
            return 0

        # Fetch worker users
        users_res = await session.execute(select(User).limit(200))
        users = list(users_res.scalars().all())

        existing_matches_res = await session.execute(
            select(JobMatch).where(JobMatch.job_id == job_id)
        )
        match_map = {m.user_id: m for m in existing_matches_res.scalars().all()}

        count = 0
        now = datetime.now(timezone.utc)

        from app.repositories.resume import ResumeRepository
        res_repo = ResumeRepository(session)

        for u in users:
            wp_res = await session.execute(
                select(WorkerProfile)
                .options(selectinload(WorkerProfile.worker_skills).selectinload(WorkerSkill.skill))
                .where(WorkerProfile.user_id == u.id)
            )
            wp = wp_res.scalar_one_or_none()
            published_resume = await res_repo.get_user_published_resume(u.id)

            eval_data = JobMatchService.evaluate_job_match(
                job=job,
                worker_profile=wp,
                user=u,
                published_resume=published_resume
            )

            existing = match_map.get(u.id)
            if existing:
                existing.match_score = eval_data["match_score"]
                existing.position_score = eval_data["score_breakdown"]["position_score"]
                existing.skill_score = eval_data["score_breakdown"]["skill_score"]
                existing.salary_score = eval_data["score_breakdown"]["salary_score"]
                existing.location_score = eval_data["score_breakdown"]["location_score"]
                existing.commute_estimate = eval_data["commute_estimate"]
                existing.distance_estimate = eval_data["distance_estimate"]
                existing.matched_reasons = eval_data["matched_reasons"]
                existing.matched_skills = eval_data["matched_skills"]
                existing.missing_skills = eval_data["missing_skills"]
                existing.is_stale = False
                existing.version += 1
                existing.updated_at = now
            else:
                new_match = JobMatch(
                    user_id=u.id,
                    job_id=job.id,
                    match_score=eval_data["match_score"],
                    position_score=eval_data["score_breakdown"]["position_score"],
                    skill_score=eval_data["score_breakdown"]["skill_score"],
                    salary_score=eval_data["score_breakdown"]["salary_score"],
                    location_score=eval_data["score_breakdown"]["location_score"],
                    commute_estimate=eval_data["commute_estimate"],
                    distance_estimate=eval_data["distance_estimate"],
                    matched_reasons=eval_data["matched_reasons"],
                    matched_skills=eval_data["matched_skills"],
                    missing_skills=eval_data["missing_skills"],
                    is_stale=False,
                    version=1,
                    created_at=now,
                    updated_at=now
                )
                session.add(new_match)
            count += 1

        await session.commit()
        return count

    @staticmethod
    async def refresh_stale_matches(session: AsyncSession) -> int:
        """
        Cleanup matches for closed jobs or recalculate stale matches.
        """
        # Delete matches for jobs that are no longer OPEN
        subq = select(Job.id).where(Job.status != JobStatus.OPEN)
        res = await session.execute(delete(JobMatch).where(JobMatch.job_id.in_(subq)))
        deleted_count = res.rowcount
        await session.commit()
        return deleted_count
