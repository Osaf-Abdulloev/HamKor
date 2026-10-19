import pytest
import uuid
import os
from io import BytesIO
from fastapi import UploadFile
from app.models.domain import User, Company
from app.models.enums import UserRole
from app.services.user import UserService
from app.schemas.profile import CompanyUpdate
from app.core.exceptions import AppException

# Valid 1x1 PNG image magic bytes
TINY_PNG_BYTES = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc\xf8\xff\xff?\x03\x00\x05\xfe\x02\xfe\xa7\x35\x81\x84\x00\x00\x00\x00IEND\xaeB`\x82'

# Valid 1x1 JPEG magic bytes
TINY_JPG_BYTES = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\x07\xff\xd9'

@pytest.mark.asyncio
async def test_company_logo_upload_replace_delete_pipeline(db_session):
    # 1. Create Employer User
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email=f"pipeline_emp_{user_id.hex[:6]}@hamkor.tj",
        username=f"pipeline_emp_{user_id.hex[:6]}",
        password_hash="test_hash_123",
        full_name="ОАО Согд Софт",
        role=UserRole.EMPLOYER,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()

    service = UserService(db_session)

    # 2. Upload Logo A
    file_a = UploadFile(filename="logo_a.png", file=BytesIO(TINY_PNG_BYTES))
    company_a = await service.update_company_logo(user_id, file_a)
    assert company_a.logo_url is not None
    assert "/api/v1/files/logos/company_" in company_a.logo_url
    assert company_a.logo_url.endswith(".png") or ".png?v=" in company_a.logo_url

    # Verify user.avatar_url is updated as well
    user_a = await service.get_user_profile(user_id)
    assert user_a.avatar_url == company_a.logo_url
    logo_a_url = company_a.logo_url

    # 3. Replace Logo A with Logo B (JPEG)
    file_b = UploadFile(filename="logo_b.jpg", file=BytesIO(TINY_JPG_BYTES))
    company_b = await service.update_company_logo(user_id, file_b)
    assert company_b.logo_url is not None
    assert company_b.logo_url != logo_a_url

    user_b = await service.get_user_profile(user_id)
    assert user_b.avatar_url == company_b.logo_url

    # 4. Delete Logo
    company_deleted = await service.delete_company_logo(user_id)
    assert company_deleted.logo_url is None

    user_deleted = await service.get_user_profile(user_id)
    assert user_deleted.avatar_url is None

@pytest.mark.asyncio
async def test_company_logo_magic_byte_validation():
    from app.utils.storage import validate_image_content

    # Valid PNG
    ext_png = validate_image_content(TINY_PNG_BYTES, "test.png")
    assert ext_png == ".png"

    # Valid JPG
    ext_jpg = validate_image_content(TINY_JPG_BYTES, "test.jpg")
    assert ext_jpg == ".jpg"

    # Invalid non-image content
    with pytest.raises(AppException) as exc_info:
        validate_image_content(b"<?php echo 'hack'; ?>", "shell.php")
    assert "Invalid image file format" in str(exc_info.value)

@pytest.mark.asyncio
async def test_non_destructive_profile_update(db_session):
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email=f"nondestruct_{user_id.hex[:6]}@hamkor.tj",
        username=f"nondestruct_{user_id.hex[:6]}",
        password_hash="test_hash_123",
        full_name="ООО Худжанд Плюс",
        role=UserRole.EMPLOYER,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()

    service = UserService(db_session)

    # Set logo
    file = UploadFile(filename="company_logo.png", file=BytesIO(TINY_PNG_BYTES))
    company_with_logo = await service.update_company_logo(user_id, file)
    current_logo = company_with_logo.logo_url
    assert current_logo is not None

    # Update description & company_name WITHOUT passing logo_url
    updated_company = await service.update_company_profile(
        user_id,
        CompanyUpdate(company_name="ООО Худжанд Плюс 2026", description="Ведущая ИТ компания")
    )
    
    assert updated_company.company_name == "ООО Худжанд Плюс 2026"
    assert updated_company.description == "Ведущая ИТ компания"
    assert updated_company.logo_url == current_logo
