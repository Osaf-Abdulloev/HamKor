from datetime import datetime, timezone
import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Header, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database.session import get_db
from app.auth.deps import get_current_user
from app.models.domain import User, UserSettings
from app.core.config import settings
from app.telegram.bot import telegram_bot
from app.telegram.utils import generate_telegram_linking_token, normalize_telegram_username
from app.schemas.telegram import (
    TelegramStatusOut, TelegramConnectOut, TelegramSettingsUpdate
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/profile/telegram", tags=["Telegram Integration"])


@router.get("", response_model=TelegramStatusOut)
@router.get("/me", response_model=TelegramStatusOut)
async def get_telegram_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user's Telegram integration status, linked username, verification status, and notification preferences.
    """
    stmt = select(UserSettings).where(UserSettings.user_id == current_user.id)
    res = await db.execute(stmt)
    us = res.scalar_one_or_none()

    user_settings_dict = {
        "telegram_notifications_enabled": current_user.telegram_notifications_enabled,
        "telegram_job_recommendations_enabled": us.telegram_job_recommendations_enabled if us else True,
        "telegram_messages_enabled": us.telegram_messages_enabled if us else True,
        "telegram_system_notifications_enabled": us.telegram_system_notifications_enabled if us else True,
        "telegram_promotional_enabled": us.telegram_promotional_enabled if us else True,
    }

    bot_username = settings.TELEGRAM_BOT_USERNAME or "HamKorJobsBot"

    return TelegramStatusOut(
        telegram_username=current_user.telegram_username,
        telegram_chat_id=current_user.telegram_chat_id,
        telegram_user_id=current_user.telegram_user_id,
        telegram_is_verified=current_user.telegram_is_verified,
        telegram_linked_at=current_user.telegram_linked_at,
        telegram_notifications_enabled=current_user.telegram_notifications_enabled,
        bot_username=bot_username,
        settings=user_settings_dict
    )


@router.post("/connect", response_model=TelegramConnectOut)
@router.post("/link", response_model=TelegramConnectOut)
async def connect_telegram_generate_link(
    data: Optional[Dict[str, Any]] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate a cryptographically secure one-time linking token and Telegram Bot deep-link (t.me/<BOT>?start=<TOKEN>).
    """
    token, expires_at = generate_telegram_linking_token(expires_in_minutes=15)
    
    # If user provided a username in the request, save/normalize it provisionally
    if data and data.get("telegram_username"):
        try:
            norm_user = normalize_telegram_username(data["telegram_username"])
            current_user.telegram_username = norm_user
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    current_user.telegram_link_code = token
    current_user.telegram_link_code_expires_at = expires_at
    await db.commit()

    bot_username = settings.TELEGRAM_BOT_USERNAME or "HamKorJobsBot"
    bot_url = f"https://t.me/{bot_username}?start={token}"
    instructions = f"Перейдите по ссылке {bot_url} и нажмите 'Запустить' ('/start') в Telegram-боте HamKor."

    return TelegramConnectOut(
        link_code=token,
        bot_url=bot_url,
        expires_at=expires_at,
        instructions=instructions
    )


@router.post("/disconnect")
@router.post("/unlink")
async def disconnect_telegram(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Unlink Telegram integration from user profile. Restores user site notifications while disabling Telegram.
    """
    current_user.telegram_chat_id = None
    current_user.telegram_user_id = None
    current_user.telegram_username = None
    current_user.telegram_is_verified = False
    current_user.telegram_notifications_enabled = False
    current_user.telegram_linked_at = None
    current_user.telegram_link_code = None
    current_user.telegram_link_code_expires_at = None

    stmt = select(UserSettings).where(UserSettings.user_id == current_user.id)
    res = await db.execute(stmt)
    us = res.scalar_one_or_none()
    if us:
        us.telegram_notifications_enabled = False

    await db.commit()

    return {"status": "unlinked", "message": "Telegram аккаунт успешно отключен."}


@router.patch("/settings")
async def update_telegram_settings(
    data: TelegramSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update user Telegram notification settings (recommendations, promotional, messages, system).
    """
    stmt = select(UserSettings).where(UserSettings.user_id == current_user.id)
    res = await db.execute(stmt)
    us = res.scalar_one_or_none()
    if not us:
        us = UserSettings(user_id=current_user.id)
        db.add(us)

    if data.telegram_notifications_enabled is not None:
        current_user.telegram_notifications_enabled = data.telegram_notifications_enabled
        us.telegram_notifications_enabled = data.telegram_notifications_enabled

    if data.telegram_job_recommendations_enabled is not None:
        us.telegram_job_recommendations_enabled = data.telegram_job_recommendations_enabled

    if data.telegram_messages_enabled is not None:
        us.telegram_messages_enabled = data.telegram_messages_enabled

    if data.telegram_system_notifications_enabled is not None:
        us.telegram_system_notifications_enabled = data.telegram_system_notifications_enabled

    if data.telegram_promotional_enabled is not None:
        us.telegram_promotional_enabled = data.telegram_promotional_enabled

    if data.telegram_username is not None:
        if data.telegram_username.strip() == "":
            current_user.telegram_username = None
        else:
            try:
                norm_username = normalize_telegram_username(data.telegram_username)
                current_user.telegram_username = norm_username
            except ValueError as e:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    await db.commit()

    return {
        "status": "updated",
        "message": "Настройки Telegram уведомлений обновлены.",
        "settings": {
            "telegram_notifications_enabled": current_user.telegram_notifications_enabled,
            "telegram_job_recommendations_enabled": us.telegram_job_recommendations_enabled,
            "telegram_messages_enabled": us.telegram_messages_enabled,
            "telegram_system_notifications_enabled": us.telegram_system_notifications_enabled,
            "telegram_promotional_enabled": us.telegram_promotional_enabled,
        }
    }


# Webhook Router for receiving Telegram updates directly from Telegram Bot API
webhook_router = APIRouter(prefix="/telegram", tags=["Telegram Bot Webhook"])

@webhook_router.post("/webhook")
async def telegram_bot_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_telegram_bot_api_secret_token: Optional[str] = Header(None)
):
    """
    Webhook endpoint for receiving Telegram updates.
    """
    # Verify secret token if configured (skip check if TELEGRAM_SECRET_TOKEN contains ':' as bot token fallback)
    sec_token = settings.TELEGRAM_SECRET_TOKEN
    if sec_token and ":" not in sec_token and x_telegram_bot_api_secret_token != sec_token:
        logger.warning("Unauthorized webhook request (invalid secret token)")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid secret token")

    try:
        update_data = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload")

    result = await telegram_bot.process_update(update_data, db)
    return {"status": "ok", "result": result}
