import pytest
import uuid
from sqlalchemy.future import select
from app.models.domain import User, Job, Favorite, SavedJob
from app.models.enums import UserRole, JobStatus, EmploymentType, FavoriteTargetType
from app.services.favorite import FavoriteService
from app.schemas.favorite import FavoriteCreate

@pytest.mark.asyncio
async def test_favorites_persistence_sync_and_isolation(db_session):
    # 1. Create Test Users & Job
    user1_id = uuid.uuid4()
    user1 = User(
        id=user1_id,
        email=f"fav_user1_{user1_id.hex[:6]}@hamkor.tj",
        username=f"fav_user1_{user1_id.hex[:6]}",
        password_hash="test_hash_123",
        full_name="Пользователь Тест 1",
        role=UserRole.WORKER,
        is_active=True
    )

    user2_id = uuid.uuid4()
    user2 = User(
        id=user2_id,
        email=f"fav_user2_{user2_id.hex[:6]}@hamkor.tj",
        username=f"fav_user2_{user2_id.hex[:6]}",
        password_hash="test_hash_123",
        full_name="Пользователь Тест 2",
        role=UserRole.WORKER,
        is_active=True
    )

    job_id = uuid.uuid4()
    job = Job(
        id=job_id,
        title="Senior Python Backend Engineer",
        description="Разработка высоконагруженных микросервисов на FastAPI и PostgreSQL",
        salary_min=12000.0,
        salary_max=16000.0,
        currency="TJS",
        location="г. Душанбе",
        employment_type=EmploymentType.FULL_TIME,
        status=JobStatus.OPEN
    )

    db_session.add_all([user1, user2, job])
    await db_session.commit()

    fav_service = FavoriteService(db_session)

    # 2. Add Job to Favorites for User 1
    fav_data = FavoriteCreate(target_type=FavoriteTargetType.JOB, target_id=job_id)
    created_fav = await fav_service.add_favorite(user1_id, fav_data)
    assert created_fav is not None
    assert created_fav.target_id == job_id

    # Verify PostgreSQL persistence in both `favorites` and `saved_jobs` tables
    fav_db_res = await db_session.execute(
        select(Favorite).where(Favorite.user_id == user1_id, Favorite.target_id == job_id)
    )
    assert fav_db_res.scalar_one_or_none() is not None

    saved_db_res = await db_session.execute(
        select(SavedJob).where(SavedJob.user_id == user1_id, SavedJob.job_id == job_id)
    )
    assert saved_db_res.scalar_one_or_none() is not None

    # 3. Test Listing Favorites with Rich Details
    items1, total1 = await fav_service.list_favorites(user1_id, target_type=FavoriteTargetType.JOB)
    assert total1 == 1
    assert len(items1) == 1
    assert items1[0].target_details is not None
    assert items1[0].target_details["title"] == "Senior Python Backend Engineer"
    assert items1[0].target_details["is_saved"] is True

    # 4. Verify User Isolation (User 2 has 0 favorites)
    items2, total2 = await fav_service.list_favorites(user2_id, target_type=FavoriteTargetType.JOB)
    assert total2 == 0
    assert len(items2) == 0

    # 5. Test Idempotency (adding duplicate favorite does not crash)
    dup_fav = await fav_service.add_favorite(user1_id, fav_data)
    assert dup_fav is not None

    # 6. Remove Favorite and verify DB deletion
    await fav_service.remove_favorite(user1_id, FavoriteTargetType.JOB, job_id)
    
    items_after_remove, total_after_remove = await fav_service.list_favorites(user1_id, target_type=FavoriteTargetType.JOB)
    assert total_after_remove == 0

    fav_deleted = await db_session.execute(
        select(Favorite).where(Favorite.user_id == user1_id, Favorite.target_id == job_id)
    )
    assert fav_deleted.scalar_one_or_none() is None

    saved_deleted = await db_session.execute(
        select(SavedJob).where(SavedJob.user_id == user1_id, SavedJob.job_id == job_id)
    )
    assert saved_deleted.scalar_one_or_none() is None
