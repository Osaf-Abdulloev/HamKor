import pytest
import uuid
from app.models.domain import User
from app.models.enums import UserRole
from app.services.user import UserService
from app.schemas.profile import CompanyUpdate

@pytest.mark.asyncio
async def test_employer_inn_lock_and_photo_persistence(db_session):
    # 1. Create Employer User
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email=f"inn_lock_{user_id.hex[:6]}@hamkor.tj",
        username=f"inn_lock_{user_id.hex[:6]}",
        password_hash="test_hash_123",
        full_name="ООО Сомон ИТ",
        role=UserRole.EMPLOYER,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()

    service = UserService(db_session)
    company = await service.get_company_profile(user_id)
    assert company is not None

    # 2. Set initial INN
    initial_inn = "040998877"
    updated_company = await service.update_company_profile(
        user_id,
        CompanyUpdate(company_name="ООО Сомон ИТ", inn=initial_inn)
    )
    assert updated_company.inn == initial_inn

    # 3. Attempt to mutate INN -> should be ignored by backend
    attempted_new_inn = "999000111"
    tampered_company = await service.update_company_profile(
        user_id,
        CompanyUpdate(inn=attempted_new_inn, logo_url="/api/v1/files/logos/test_logo.png")
    )
    assert tampered_company.inn == initial_inn  # INN remains locked!
    assert tampered_company.logo_url == "/api/v1/files/logos/test_logo.png"

    # 4. Verify User avatar_url is synced as well
    updated_user = await service.get_user_profile(user_id)
    assert updated_user.avatar_url == "/api/v1/files/logos/test_logo.png"
