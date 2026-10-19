from datetime import datetime, timedelta, timezone
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch, MagicMock

from app.telegram.utils import normalize_telegram_username, generate_telegram_linking_token
from app.telegram.locales import get_message
from app.telegram.bot import TelegramBotService
from app.models.domain import User, UserSettings, Job, Notification, TelegramNotificationLog
from app.models.enums import UserRole, JobStatus, EmploymentType, NotificationType
from app.core.security import hash_password


def test_normalize_telegram_username():
    assert normalize_telegram_username("@valid_user") == "valid_user"
    assert normalize_telegram_username("  @John_Doe  ") == "John_Doe"
    assert normalize_telegram_username("user123") == "user123"
    assert normalize_telegram_username(None) is None
    assert normalize_telegram_username("") is None

    with pytest.raises(ValueError):
        normalize_telegram_username("shor")  # less than 5 chars

    with pytest.raises(ValueError):
        normalize_telegram_username("user!invalid@name")


def test_generate_telegram_linking_token():
    token, expires_at = generate_telegram_linking_token(expires_in_minutes=15)
    assert token.startswith("HK-")
    assert len(token) > 10
    now = datetime.now(timezone.utc)
    assert expires_at > now
    assert (expires_at - now) <= timedelta(minutes=16)


def test_multilingual_locales():
    ru_welcome = get_message("ru", "welcome")
    tj_welcome = get_message("tj", "welcome")
    en_welcome = get_message("en", "welcome")

    assert "Telegram успешно подключён" in ru_welcome
    assert "Telegram бо муваффақият" in tj_welcome
    assert "Telegram has been successfully connected" in en_welcome

    formatted = get_message("ru", "link_success", full_name="Иван Иванов")
    assert "Иван Иванов" in formatted


@pytest.mark.asyncio
async def test_process_update_start_with_valid_token(db_session):
    # Setup test user with link token
    token, expires_at = generate_telegram_linking_token(expires_in_minutes=15)
    user = User(
        email="tg_test_user@hamkor.tj",
        username="tg_test_user",
        full_name="Тестовый Пользователь",
        password_hash=hash_password("Password123!"),
        role=UserRole.WORKER,
        language="ru",
        telegram_link_code=token,
        telegram_link_code_expires_at=expires_at,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()

    bot_service = TelegramBotService(token="123456:FAKE_TEST_TOKEN")
    
    update_payload = {
        "update_id": 10001,
        "message": {
            "message_id": 1,
            "from": {"id": 987654321, "username": "tg_test_username"},
            "chat": {"id": 987654321, "type": "private"},
            "text": f"/start {token}"
        }
    }

    with patch.object(bot_service, "send_message_async", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = {"success": True, "message_id": "999"}

        res = await bot_service.process_update(update_payload, db_session)
        assert res == "Linked user successfully"

        # Verify user record updated
        await db_session.refresh(user)
        assert user.telegram_chat_id == "987654321"
        assert user.telegram_user_id == "987654321"
        assert user.telegram_username == "tg_test_username"
        assert user.telegram_is_verified is True
        assert user.telegram_notifications_enabled is True
        assert user.telegram_link_code is None
        assert mock_send.called


@pytest.mark.asyncio
async def test_process_update_expired_token(db_session):
    token = "HK-EXPIREDTOKEN"
    expires_at = datetime.now(timezone.utc) - timedelta(minutes=10)
    user = User(
        email="tg_expired_user@hamkor.tj",
        username="tg_expired_user",
        password_hash=hash_password("Password123!"),
        role=UserRole.WORKER,
        telegram_link_code=token,
        telegram_link_code_expires_at=expires_at,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()

    bot_service = TelegramBotService(token="123456:FAKE_TEST_TOKEN")
    update_payload = {
        "update_id": 10002,
        "message": {
            "message_id": 2,
            "from": {"id": 111222333},
            "chat": {"id": 111222333, "type": "private"},
            "text": f"/start {token}"
        }
    }

    with patch.object(bot_service, "send_message_async", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = {"success": True}
        res = await bot_service.process_update(update_payload, db_session)
        assert res == "Expired token"
        
        await db_session.refresh(user)
        assert user.telegram_is_verified is False


@pytest.mark.asyncio
async def test_process_update_bot_commands(db_session):
    user = User(
        email="tg_cmd_user@hamkor.tj",
        username="tg_cmd_user",
        full_name="Пользователь",
        password_hash=hash_password("Password123!"),
        role=UserRole.WORKER,
        language="ru",
        telegram_chat_id="555666777",
        telegram_user_id="555666777",
        telegram_is_verified=True,
        telegram_notifications_enabled=True,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()

    bot_service = TelegramBotService(token="123456:FAKE_TEST_TOKEN")

    for cmd in ["/help", "/profile", "/settings", "/jobs", "/notifications", "/unsubscribe"]:
        update_payload = {
            "update_id": 20000,
            "message": {
                "message_id": 3,
                "from": {"id": 555666777},
                "chat": {"id": 555666777, "type": "private"},
                "text": cmd
            }
        }
        with patch.object(bot_service, "send_message_async", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = {"success": True}
            res = await bot_service.process_update(update_payload, db_session)
            assert res in ["Sent help", "Sent profile", "Sent settings", "Sent jobs", "No jobs", "Sent notifications", "No notifications", "Unsubscribed"]
            assert mock_send.called
