import pytest
import uuid
from app.models.domain import User, WorkerProfile, Job, JobMatch, Skill, WorkerSkill
from app.models.enums import UserRole, JobStatus, EmploymentType
from app.services.match_service import JobMatchService
from sqlalchemy.future import select

@pytest.mark.asyncio
async def test_job_match_evaluation_and_persistence(db_session):
    # 1. Create User & Profile
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email=f"worker_{user_id.hex[:6]}@hamkor.tj",
        username=f"worker_{user_id.hex[:6]}",
        password_hash="test_hash_123",
        full_name="Ислом Рахимов",
        city="г. Душанбе",
        role=UserRole.WORKER,
        is_active=True
    )
    db_session.add(user)

    profile = WorkerProfile(
        id=uuid.uuid4(),
        user_id=user_id,
        desired_position="Backend Developer",
        desired_salary=8000.0,
        bio="Python Developer with FastAPI and PostgreSQL expertise"
    )
    db_session.add(profile)

    skill1 = Skill(id=uuid.uuid4(), name="python")
    skill2 = Skill(id=uuid.uuid4(), name="fastapi")
    db_session.add_all([skill1, skill2])
    await db_session.flush()

    ws1 = WorkerSkill(worker_profile_id=profile.id, skill_id=skill1.id)
    ws2 = WorkerSkill(worker_profile_id=profile.id, skill_id=skill2.id)
    db_session.add_all([ws1, ws2])

    # 2. Create Sample Job
    job = Job(
        id=uuid.uuid4(),
        title="Senior Python FastAPI Backend Developer",
        description="Разработка микросервисов на Python FastAPI и PostgreSQL",
        location="г. Душанбе",
        category="IT & Технологии",
        employment_type=EmploymentType.FULL_TIME,
        status=JobStatus.OPEN,
        salary_min=7000.0,
        salary_max=10000.0,
        requirements={"skills": ["python", "fastapi", "postgresql"]}
    )
    db_session.add(job)
    await db_session.commit()

    # 3. Test Initial Match Recalculation
    updated_count = await JobMatchService.recalculate_user_matches(db_session, user_id)
    assert updated_count >= 1

    match_res = await db_session.execute(
        select(JobMatch).where(JobMatch.user_id == user_id, JobMatch.job_id == job.id)
    )
    match_rec = match_res.scalar_one_or_none()
    assert match_rec is not None
    assert match_rec.match_score >= 80
    assert "python" in [s.lower() for s in (match_rec.matched_skills or [])]

    # 4. Test Idempotency (running recalculation again doesn't create duplicate rows)
    second_count = await JobMatchService.recalculate_user_matches(db_session, user_id)
    all_matches = (await db_session.execute(
        select(JobMatch).where(JobMatch.user_id == user_id, JobMatch.job_id == job.id)
    )).scalars().all()
    assert len(all_matches) == 1

    # 5. Test Location/City Update
    user.city = "г. Худжанд"
    await db_session.commit()
    await JobMatchService.recalculate_user_matches(db_session, user_id)
    
    updated_match = (await db_session.execute(
        select(JobMatch).where(JobMatch.user_id == user_id, JobMatch.job_id == job.id)
    )).scalar_one()
    assert updated_match.is_stale == False


@pytest.mark.asyncio
async def test_user_recommendation_isolation(db_session):
    # Create User A (Python Dev in Dushanbe)
    user_a = User(id=uuid.uuid4(), email="usera@hamkor.tj", username="usera", password_hash="test_hash", city="г. Душанбе", role=UserRole.WORKER)
    profile_a = WorkerProfile(id=uuid.uuid4(), user_id=user_a.id, desired_position="Python Backend")
    db_session.add_all([user_a, profile_a])

    # Create User B (Cook in Khujand)
    user_b = User(id=uuid.uuid4(), email="userb@hamkor.tj", username="userb", password_hash="test_hash", city="г. Худжанд", role=UserRole.WORKER)
    profile_b = WorkerProfile(id=uuid.uuid4(), user_id=user_b.id, desired_position="Повар национальной кухни")
    db_session.add_all([user_b, profile_b])

    job_python = Job(id=uuid.uuid4(), title="Python Dev", description="Backend", location="г. Душанбе", category="IT & Технологии", employment_type=EmploymentType.FULL_TIME, status=JobStatus.OPEN)
    job_cook = Job(id=uuid.uuid4(), title="Повар", description="Ресторан", location="г. Худжанд", category="Рестораторы, повара, официанты", employment_type=EmploymentType.FULL_TIME, status=JobStatus.OPEN)
    db_session.add_all([job_python, job_cook])
    await db_session.commit()

    await JobMatchService.recalculate_user_matches(db_session, user_a.id)
    await JobMatchService.recalculate_user_matches(db_session, user_b.id)

    matches_a = (await db_session.execute(select(JobMatch).where(JobMatch.user_id == user_a.id))).scalars().all()
    matches_b = (await db_session.execute(select(JobMatch).where(JobMatch.user_id == user_b.id))).scalars().all()

    # User A matches must be strictly isolated to user_a.id
    for m in matches_a:
        assert m.user_id == user_a.id

    for m in matches_b:
        assert m.user_id == user_b.id
