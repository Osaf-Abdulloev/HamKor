import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import httpx
from sqlalchemy import select, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.telegram.locales import get_message
from app.telegram.utils import normalize_telegram_username

logger = logging.getLogger(__name__)


class TelegramBotService:
    def __init__(self, token: Optional[str] = None):
        self.token = token or settings.get_telegram_bot_token
        self.base_url = f"https://api.telegram.org/bot{self.token}" if self.token else ""

    def is_configured(self) -> bool:
        if not self.token:
            self.token = settings.get_telegram_bot_token
            if self.token:
                self.base_url = f"https://api.telegram.org/bot{self.token}"
        return bool(self.token and len(self.token) > 10)

    async def set_webhook(self, webhook_url: str, secret_token: Optional[str] = None) -> bool:
        """Configures Telegram Bot API Webhook URL."""
        if not self.is_configured():
            logger.warning("Telegram Bot is not configured (missing TELEGRAM_BOT_TOKEN).")
            return False

        url = f"{self.base_url}/setWebhook"
        payload = {"url": webhook_url}
        if secret_token:
            payload["secret_token"] = secret_token

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                res = await client.post(url, json=payload)
                data = res.json()
                if data.get("ok"):
                    logger.info("Telegram Webhook set successfully to %s", webhook_url)
                    return True
                else:
                    logger.error("Failed to set Telegram Webhook: %s", data)
                    return False
            except Exception as e:
                logger.error("Exception setting Telegram Webhook: %s", e)
                return False

    async def send_message_async(
        self,
        text: str,
        target_chat_id: str,
        parse_mode: str = "HTML",
        disable_web_page_preview: bool = True
    ) -> Dict[str, Any]:
        """
        Send message asynchronously to a Telegram chat.
        Returns dict with status, telegram_message_id, or error_message.
        """
        if not self.is_configured() or not target_chat_id:
            return {"success": False, "error": "Bot token or chat_id missing"}

        url = f"{self.base_url}/sendMessage"
        payload = {
            "chat_id": target_chat_id,
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": disable_web_page_preview
        }

        async with httpx.AsyncClient(timeout=12.0) as client:
            try:
                res = await client.post(url, json=payload)
                data = res.json()
                if res.status_code == 200 and data.get("ok"):
                    msg_id = str(data.get("result", {}).get("message_id"))
                    return {"success": True, "message_id": msg_id}
                else:
                    error_desc = data.get("description", f"HTTP {res.status_code}")
                    error_code = data.get("error_code")
                    logger.warning("Telegram API send_message failed [chat=%s]: %s", target_chat_id, error_desc)
                    return {"success": False, "error": error_desc, "error_code": error_code}
            except Exception as exc:
                logger.error("Network error sending Telegram message to %s: %s", target_chat_id, exc)
                return {"success": False, "error": str(exc)}

    def send_message_sync(
        self,
        text: str,
        target_chat_id: str,
        parse_mode: str = "HTML",
        disable_web_page_preview: bool = True
    ) -> Dict[str, Any]:
        """
        Synchronous message sending helper for Celery workers.
        """
        if not self.is_configured() or not target_chat_id:
            return {"success": False, "error": "Bot token or chat_id missing"}

        url = f"{self.base_url}/sendMessage"
        payload = {
            "chat_id": target_chat_id,
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": disable_web_page_preview
        }

        try:
            with httpx.Client(timeout=12.0) as client:
                res = client.post(url, json=payload)
                data = res.json()
                if res.status_code == 200 and data.get("ok"):
                    msg_id = str(data.get("result", {}).get("message_id"))
                    return {"success": True, "message_id": msg_id}
                else:
                    error_desc = data.get("description", f"HTTP {res.status_code}")
                    error_code = data.get("error_code")
                    logger.warning("Telegram API sync send failed [chat=%s]: %s", target_chat_id, error_desc)
                    return {"success": False, "error": error_desc, "error_code": error_code}
        except Exception as exc:
            logger.error("Network error in sync Telegram send [chat=%s]: %s", target_chat_id, exc)
            return {"success": False, "error": str(exc)}

    async def process_update(self, update: Dict[str, Any], session: AsyncSession) -> Optional[str]:
        """
        Parses incoming Telegram Update (webhook/polling), routes commands,
        executes user linking, and responds directly via Telegram Bot API.
        """
        from app.models.domain import User, UserSettings, Job, Notification, WorkerProfile, Company

        message = update.get("message") or update.get("edited_message")
        if not message:
            return "Ignored non-message update"

        chat = message.get("chat", {})
        chat_id = str(chat.get("id"))
        from_user = message.get("from", {})
        user_id = str(from_user.get("id")) if from_user.get("id") else chat_id
        tg_username = normalize_telegram_username(from_user.get("username"))
        text = (message.get("text") or "").strip()

        if not chat_id or not text:
            return "Empty message or chat_id"

        # Separate command from arguments
        parts = text.split(maxsplit=1)
        command = parts[0].lower()
        arg = parts[1].strip() if len(parts) > 1 else ""

        # -------------------------------------------------------------------
        # COMMAND: /start [TOKEN]
        # -------------------------------------------------------------------
        if command.startswith("/start"):
            token = arg.strip()
            if token:
                # 1. Lookup user by link token
                stmt = select(User).options(selectinload(User.user_settings)).where(User.telegram_link_code == token)
                res = await session.execute(stmt)
                user = res.scalar_one_or_none()

                if not user:
                    await self.send_message_async(
                        get_message("ru", "invalid_token"),
                        target_chat_id=chat_id
                    )
                    return "Invalid linking token"

                # Check expiration
                now = datetime.now(timezone.utc)
                if user.telegram_link_code_expires_at and user.telegram_link_code_expires_at < now:
                    await self.send_message_async(
                        get_message(user.language, "expired_token"),
                        target_chat_id=chat_id
                    )
                    return "Expired token"

                # Check if this telegram user_id is already bound to another HamKor user
                stmt_other = select(User).where(User.telegram_user_id == user_id, User.id != user.id)
                res_other = await session.execute(stmt_other)
                other_user = res_other.scalar_one_or_none()
                if other_user:
                    # Unlink from old user
                    other_user.telegram_chat_id = None
                    other_user.telegram_user_id = None
                    other_user.telegram_username = None
                    other_user.telegram_is_verified = False

                # 2. Perform Linking
                user.telegram_chat_id = chat_id
                user.telegram_user_id = user_id
                if tg_username:
                    user.telegram_username = tg_username
                user.telegram_is_verified = True
                user.telegram_notifications_enabled = True
                user.telegram_linked_at = now
                user.telegram_link_code = None
                user.telegram_link_code_expires_at = None

                # Also update UserSettings
                if user.user_settings:
                    user.user_settings.telegram_notifications_enabled = True

                await session.commit()

                # 3. Send Immediate Localized Welcome Message
                user_lang = user.language or "ru"
                welcome_text = get_message(
                    user_lang,
                    "welcome"
                )
                link_success_msg = get_message(
                    user_lang,
                    "link_success",
                    full_name=user.full_name or user.username
                )
                full_welcome = f"{link_success_msg}\n\n{welcome_text}"

                await self.send_message_async(full_welcome, target_chat_id=chat_id)
                logger.info("Successfully linked Telegram chat_id=%s to user_id=%s", chat_id, user.id)
                return "Linked user successfully"

            else:
                # /start without token -> check if chat_id already linked
                stmt = select(User).where(User.telegram_chat_id == chat_id)
                res = await session.execute(stmt)
                user = res.scalar_one_or_none()
                if user:
                    msg = get_message(user.language, "already_linked")
                    await self.send_message_async(msg, target_chat_id=chat_id)
                    return "Already linked"
                else:
                    msg = get_message("ru", "not_linked_instructions")
                    await self.send_message_async(msg, target_chat_id=chat_id)
                    return "Sent link instructions"

        # Fetch current user by chat_id or telegram_user_id for remaining commands
        stmt_curr = select(User).options(
            selectinload(User.user_settings),
            selectinload(User.worker_profile),
            selectinload(User.company)
        ).where((User.telegram_chat_id == chat_id) | (User.telegram_user_id == user_id))
        res_curr = await session.execute(stmt_curr)
        user = res_curr.scalar_one_or_none()

        user_lang = user.language if user else "ru"

        if not user and command in ["/profile", "/settings", "/jobs", "/notifications"]:
            msg = get_message("ru", "not_linked_instructions")
            await self.send_message_async(msg, target_chat_id=chat_id)
            return "User not linked"

        # -------------------------------------------------------------------
        # COMMAND: /help
        # -------------------------------------------------------------------
        if command.startswith("/help"):
            msg = get_message(user_lang, "help")
            await self.send_message_async(msg, target_chat_id=chat_id)
            return "Sent help"

        # -------------------------------------------------------------------
        # COMMAND: /profile
        # -------------------------------------------------------------------
        if command.startswith("/profile") and user:
            role_map = {"worker": "Соискатель (Кандидат)", "employer": "Работодатель", "admin": "Администратор"}
            pos_comp = "—"
            if user.role.value == "worker" and user.worker_profile:
                pos_comp = user.worker_profile.desired_position or "Желаемая должность не указана"
            elif user.role.value == "employer" and user.company:
                pos_comp = user.company.company_name or "Компания"

            notif_status = "✅ Включены" if user.telegram_notifications_enabled else "❌ Отключены"
            
            msg = get_message(
                user_lang,
                "profile_info",
                full_name=user.full_name or user.username,
                username=user.username,
                email=user.email,
                role_str=role_map.get(user.role.value, user.role.value),
                city=user.city or "Таджикистан",
                position_or_company=pos_comp,
                notifications_status=notif_status
            )
            await self.send_message_async(msg, target_chat_id=chat_id)
            return "Sent profile"

        # -------------------------------------------------------------------
        # COMMAND: /settings
        # -------------------------------------------------------------------
        if command.startswith("/settings") and user:
            us = user.user_settings
            status_symbol = lambda val: "✅ Вкл" if val else "❌ Выкл"
            msg = get_message(
                user_lang,
                "settings_info",
                status=status_symbol(user.telegram_notifications_enabled),
                jobs_status=status_symbol(us.telegram_job_recommendations_enabled if us else True),
                msg_status=status_symbol(us.telegram_messages_enabled if us else True),
                sys_status=status_symbol(us.telegram_system_notifications_enabled if us else True),
                promo_status=status_symbol(us.telegram_promotional_enabled if us else True)
            )
            await self.send_message_async(msg, target_chat_id=chat_id)
            return "Sent settings"

        # -------------------------------------------------------------------
        # COMMAND: /jobs
        # -------------------------------------------------------------------
        if command.startswith("/jobs") and user:
            # Query top relevant jobs
            wp = user.worker_profile
            query = select(Job).where(Job.status == "OPEN").order_by(Job.created_at.desc())
            if wp and wp.desired_position:
                pos_keyword = wp.desired_position.split()[0]
                query = query.where(Job.title.ilike(f"%{pos_keyword}%"))
            query = query.limit(5)

            res_jobs = await session.execute(query)
            jobs = res_jobs.scalars().all()

            if not jobs:
                # Fallback to general latest open jobs
                res_gen = await session.execute(select(Job).where(Job.status == "OPEN").order_by(Job.created_at.desc()).limit(5))
                jobs = res_gen.scalars().all()

            if not jobs:
                msg = get_message(user_lang, "no_jobs")
                await self.send_message_async(msg, target_chat_id=chat_id)
                return "No jobs"

            header = get_message(user_lang, "jobs_header")
            job_items = []
            for j in jobs:
                salary = f"{int(j.salary_min)} - {int(j.salary_max)} {j.currency}" if j.salary_min and j.salary_max else "По договоренности"
                job_url = f"http://171.22.174.199:2212/jobs/{j.id}"
                comp_title = j.external_company_name or (j.company.company_name if j.company else "HamKor Jobs")
                item = (
                    f"📌 <b>{j.title}</b>\n"
                    f"🏢 {comp_title} | 📍 {j.location}\n"
                    f"💰 {salary}\n"
                    f"🔗 <a href='{job_url}'>Посмотреть вакансию</a>\n"
                )
                job_items.append(item)

            full_msg = header + "\n".join(job_items)
            await self.send_message_async(full_msg, target_chat_id=chat_id)
            return "Sent jobs"

        # -------------------------------------------------------------------
        # COMMAND: /notifications
        # -------------------------------------------------------------------
        if command.startswith("/notifications") and user:
            stmt_notif = select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(5)
            res_notif = await session.execute(stmt_notif)
            notifs = res_notif.scalars().all()

            if not notifs:
                msg = get_message(user_lang, "no_notifications")
                await self.send_message_async(msg, target_chat_id=chat_id)
                return "No notifications"

            header = get_message(user_lang, "notifications_header")
            notif_items = []
            for n in notifs:
                status_icon = "🟢" if n.is_read else "🔵"
                item = f"{status_icon} <b>{n.title}</b>\n{n.body}\n"
                notif_items.append(item)

            full_msg = header + "\n".join(notif_items)
            await self.send_message_async(full_msg, target_chat_id=chat_id)
            return "Sent notifications"

        # -------------------------------------------------------------------
        # COMMAND: /unsubscribe
        # -------------------------------------------------------------------
        if command.startswith("/unsubscribe") and user:
            user.telegram_notifications_enabled = False
            if user.user_settings:
                user.user_settings.telegram_notifications_enabled = False
            await session.commit()

            msg = get_message(user_lang, "unsubscribed")
            await self.send_message_async(msg, target_chat_id=chat_id)
            return "Unsubscribed"

        # Default fallback for unknown text or message
        help_msg = get_message(user_lang, "help")
        await self.send_message_async(help_msg, target_chat_id=chat_id)
        return "Sent help default"


telegram_bot = TelegramBotService()
