from datetime import datetime
import uuid
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict


class TelegramStatusOut(BaseModel):
    telegram_username: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    telegram_user_id: Optional[str] = None
    telegram_is_verified: bool = False
    telegram_linked_at: Optional[datetime] = None
    telegram_notifications_enabled: bool = True
    bot_username: str = "HamKorJobsBot"
    
    settings: Dict[str, bool] = {
        "telegram_notifications_enabled": True,
        "telegram_job_recommendations_enabled": True,
        "telegram_messages_enabled": True,
        "telegram_system_notifications_enabled": True,
        "telegram_promotional_enabled": True,
    }

    model_config = ConfigDict(from_attributes=True)


class TelegramConnectOut(BaseModel):
    link_code: str
    bot_url: str
    expires_at: datetime
    instructions: str


class TelegramSettingsUpdate(BaseModel):
    telegram_notifications_enabled: Optional[bool] = None
    telegram_job_recommendations_enabled: Optional[bool] = None
    telegram_messages_enabled: Optional[bool] = None
    telegram_system_notifications_enabled: Optional[bool] = None
    telegram_promotional_enabled: Optional[bool] = None
    telegram_username: Optional[str] = None


class TelegramNotificationLogOut(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    chat_id: Optional[str] = None
    notification_type: str
    channel: str
    status: str
    message_text: str
    error_message: Optional[str] = None
    sent_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
