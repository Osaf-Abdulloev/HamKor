import pytest
import uuid
import base64
from app.models.domain import User, Company
from app.models.enums import UserRole
from app.services.user import UserService
from app.schemas.user import UserUpdate
from app.schemas.profile import CompanyUpdate
from app.utils.storage import save_base64_image

@pytest.mark.asyncio
async def test_employer_avatar_update_base64_conversion_and_sync(db_session):
    # 1. Create Employer User
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email=f"employer_avatar_{user_id.hex[:6]}@hamkor.tj",
        username=f"employer_avatar_{user_id.hex[:6]}",
        password_hash="test_hash_123",
        full_name="ООО Таджик ИТ Солюшнс",
        role=UserRole.EMPLOYER,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()

    service = UserService(db_session)
    company = await service.get_company_profile(user_id)
    assert company is not None
    assert company.company_name == "ООО Таджик ИТ Солюшнс"

    # 2. Test Base64 image payload conversion
    dummy_png_base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    
    # Update via CompanyUpdate
    await service.update_company_profile(
        user_id,
        CompanyUpdate(company_name="ООО ИТ Солюшнс 2026", logo_url=dummy_png_base64)
    )

    updated_company = await service.get_company_profile(user_id)
    assert updated_company.logo_url is not None
    assert updated_company.logo_url.startswith("/api/v1/files/logos/")

    # Verify user.avatar_url is automatically synchronized to PostgreSQL
    updated_user = await service.get_user_profile(user_id)
    assert updated_user.avatar_url == updated_company.logo_url

    # 3. Direct User avatar_url update via UserUpdate
    dummy_jpg_base64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP/bAEMAAwICAwICAwMDAwQDAwQIBAICAwQECg4PDxAQERAVEREREREREREREREREREREREREREREREREREREREREREREP/2wBDAQMDAwQDAwQIBAQEEREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREP/AABEIAAEAAgMBAREA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwC5gA=="
    await service.update_user(
        user_id,
        UserUpdate(avatar_url=dummy_jpg_base64)
    )

    user_after_avatar_update = await service.get_user_profile(user_id)
    assert user_after_avatar_update.avatar_url is not None
    assert user_after_avatar_update.avatar_url.startswith("/api/v1/files/avatars/")

    # Verify Company logo_url was synced as well
    company_after_sync = await service.get_company_profile(user_id)
    assert company_after_sync.logo_url == user_after_avatar_update.avatar_url

@pytest.mark.asyncio
async def test_employer_change_and_delete_photo(db_session):
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email=f"employer_photo_change_{user_id.hex[:6]}@hamkor.tj",
        username=f"employer_photo_change_{user_id.hex[:6]}",
        password_hash="test_hash_123",
        full_name="ЗАО Памир Трейд",
        role=UserRole.EMPLOYER,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()

    service = UserService(db_session)

    # 1. Set initial logo
    await service.update_company_profile(
        user_id,
        CompanyUpdate(logo_url="/api/v1/files/logos/old_logo.png")
    )
    comp1 = await service.get_company_profile(user_id)
    assert comp1.logo_url == "/api/v1/files/logos/old_logo.png"

    # 2. Change / Replace logo with a NEW logo
    await service.update_company_profile(
        user_id,
        CompanyUpdate(logo_url="/api/v1/files/logos/new_logo.png")
    )
    comp2 = await service.get_company_profile(user_id)
    assert comp2.logo_url == "/api/v1/files/logos/new_logo.png"
    user2 = await service.get_user_profile(user_id)
    assert user2.avatar_url == "/api/v1/files/logos/new_logo.png"

    # 3. Delete logo explicitly
    await service.update_company_profile(
        user_id,
        CompanyUpdate(logo_url="DELETE")
    )
    comp3 = await service.get_company_profile(user_id)
    assert comp3.logo_url is None
    user3 = await service.get_user_profile(user_id)
    assert user3.avatar_url is None
