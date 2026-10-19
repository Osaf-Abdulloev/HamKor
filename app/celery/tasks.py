import asyncio
import logging
from typing import Dict, Any, Optional

from app.celery.app import celery_app

logger = logging.getLogger("celery.tasks")


# ---------------------------------------------------------------------------
# Helper: run async code inside synchronous Celery worker
# ---------------------------------------------------------------------------
def _run_async(coro):
    """Run an async coroutine in a new event loop (safe for sync Celery workers)."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        try:
            loop.close()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# EMAIL TASKS
# ---------------------------------------------------------------------------
@celery_app.task(
    bind=True,
    name="app.celery.tasks.send_email_task",
    max_retries=5,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    soft_time_limit=30,
    time_limit=60,
)
def send_email_task(self, to_email: str, subject: str, body_html: str):
    """Send a generic email via SMTP. Retries on transient failures."""
    logger.info(
        "send_email_task started | task_id=%s to=%s subject=%s retry=%s",
        self.request.id, to_email, subject[:50], self.request.retries,
    )
    from app.utils.email import send_email_sync

    success = send_email_sync(to_email, subject, body_html)
    if not success:
        raise RuntimeError(f"SMTP send failed for {to_email}")

    logger.info("send_email_task completed | task_id=%s to=%s", self.request.id, to_email)
    return {"status": "sent", "to": to_email}


@celery_app.task(
    bind=True,
    name="app.celery.tasks.send_welcome_email_task",
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    soft_time_limit=30,
    time_limit=60,
)
def send_welcome_email_task(self, to_email: str, user_name: str = ""):
    """Send a rich HTML welcome email upon registration."""
    logger.info(
        "send_welcome_email_task started | task_id=%s to=%s retry=%s",
        self.request.id, to_email, self.request.retries,
    )
    from app.services.email_service import EmailService

    success = EmailService.send_welcome_email(to_email, user_name)
    if not success:
        raise RuntimeError(f"Welcome email send failed for {to_email}")

    logger.info("send_welcome_email_task completed | task_id=%s to=%s", self.request.id, to_email)
    return {"status": "sent", "to": to_email}


@celery_app.task(
    bind=True,
    name="app.celery.tasks.send_verification_email_task",
    max_retries=5,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    soft_time_limit=30,
    time_limit=60,
)
def send_verification_email_task(self, to_email: str, code: str):
    """Send 6-digit email verification OTP code."""
    logger.info(
        "send_verification_email_task started | task_id=%s to=%s retry=%s",
        self.request.id, to_email, self.request.retries,
    )
    from app.services.email_service import EmailService

    success = EmailService.send_verification_code_email(to_email, code)
    if not success:
        logger.warning(f"Verification email send failed for {to_email} (check SMTP settings in .env)")
        raise RuntimeError(f"Verification email send failed for {to_email}")

    logger.info("send_verification_email_task completed | task_id=%s to=%s", self.request.id, to_email)
    return {"status": "sent", "to": to_email}


@celery_app.task(
    bind=True,
    name="app.celery.tasks.send_application_status_email_task",
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=180,
    retry_jitter=True,
    soft_time_limit=30,
    time_limit=60,
)
def send_application_status_email_task(self, to_email: str, job_title: str, status_ru: str, feedback: str = ""):
    """Send application status change notification email."""
    logger.info(
        "send_application_status_email_task started | task_id=%s to=%s status=%s retry=%s",
        self.request.id, to_email, status_ru, self.request.retries,
    )
    from app.services.email_service import EmailService

    success = EmailService.send_application_status_email(to_email, job_title, status_ru, feedback)
    if not success:
        logger.warning(f"Application status email send failed for {to_email}")

    logger.info("send_application_status_email_task completed | task_id=%s to=%s", self.request.id, to_email)
    return {"status": "processed", "to": to_email}


@celery_app.task(
    bind=True,
    name="app.celery.tasks.send_application_accepted_candidate_email_task",
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=180,
    retry_jitter=True,
    soft_time_limit=30,
    time_limit=60,
)
def send_application_accepted_candidate_email_task(
    self, to_email: str, candidate_name: str, employer_name: str, job_title: str, chat_url: str
):
    """Send notification email to candidate when their application is accepted."""
    logger.info(
        "send_application_accepted_candidate_email_task started | task_id=%s to=%s employer=%s",
        self.request.id, to_email, employer_name,
    )
    from app.services.email_service import EmailService

    success = EmailService.send_application_accepted_candidate_email(
        to_email, candidate_name, employer_name, job_title, chat_url
    )
    if not success:
        logger.warning(f"Application accepted candidate email failed for {to_email}")

    return {"status": "processed", "to": to_email}


@celery_app.task(
    bind=True,
    name="app.celery.tasks.send_application_accepted_employer_email_task",
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=180,
    retry_jitter=True,
    soft_time_limit=30,
    time_limit=60,
)
def send_application_accepted_employer_email_task(
    self, to_email: str, employer_name: str, candidate_name: str, job_title: str, chat_url: str
):
    """Send confirmation email to employer when they accept an application."""
    logger.info(
        "send_application_accepted_employer_email_task started | task_id=%s to=%s candidate=%s",
        self.request.id, to_email, candidate_name,
    )
    from app.services.email_service import EmailService

    success = EmailService.send_application_accepted_employer_email(
        to_email, employer_name, candidate_name, job_title, chat_url
    )
    if not success:
        logger.warning(f"Application accepted employer email failed for {to_email}")

    return {"status": "processed", "to": to_email}



@celery_app.task(
    bind=True,
    name="app.celery.tasks.send_password_reset_email_task",
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=180,
    retry_jitter=True,
    soft_time_limit=30,
    time_limit=60,
)
def send_password_reset_email_task(self, to_email: str, reset_token: str):
    """Send password reset token notification email."""
    logger.info(
        "send_password_reset_email_task started | task_id=%s to=%s retry=%s",
        self.request.id, to_email, self.request.retries,
    )
    from app.services.email_service import EmailService

    success = EmailService.send_password_reset_email(to_email, reset_token)
    if not success:
        logger.warning(f"Password reset email send failed for {to_email}")

    logger.info("send_password_reset_email_task completed | task_id=%s to=%s", self.request.id, to_email)
    return {"status": "processed", "to": to_email}


# ---------------------------------------------------------------------------
# TELEGRAM TASK
# ---------------------------------------------------------------------------
@celery_app.task(
    bind=True,
    name="app.celery.tasks.send_telegram_notification_task",
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=120,
    retry_jitter=True,
    soft_time_limit=15,
    time_limit=30,
)
def send_telegram_notification_task(
    self,
    text: str,
    target_chat_id: str,
    user_id: Optional[str] = None,
    notification_type: str = "system"
):
    """
    Send Telegram message via Bot API with user preference checks, delivery log recording, anti-block detection, and exponential retry.
    """
    logger.info(
        "send_telegram_notification_task started | task_id=%s chat=%s user=%s type=%s retry=%s",
        self.request.id, target_chat_id, user_id, notification_type, self.request.retries,
    )
    from app.telegram.bot import telegram_bot

    if not target_chat_id or not telegram_bot.token:
        logger.warning("send_telegram_notification_task: missing bot token or target chat_id")
        return {"status": "skipped", "chat_id": target_chat_id, "reason": "Missing token or chat_id"}

    async def _send_and_log():
        import uuid as _uuid
        from datetime import datetime, timezone
        from sqlalchemy import select
        from app.database.session import AsyncSessionLocal
        from app.models.domain import User, UserSettings, TelegramNotificationLog

        async with AsyncSessionLocal() as session:
            db_user = None
            if user_id:
                try:
                    uid = _uuid.UUID(user_id)
                    stmt = select(User).where(User.id == uid)
                    res = await session.execute(stmt)
                    db_user = res.scalar_one_or_none()
                except Exception:
                    pass

            # Check user notification settings
            if db_user:
                if not db_user.telegram_notifications_enabled:
                    logger.info("Skipping Telegram notification for user %s: telegram notifications disabled", db_user.id)
                    return {"status": "disabled", "reason": "User disabled Telegram notifications"}

                # Check granular setting
                stmt_us = select(UserSettings).where(UserSettings.user_id == db_user.id)
                res_us = await session.execute(stmt_us)
                us = res_us.scalar_one_or_none()
                if us:
                    if notification_type == "job_recommendation" and not us.telegram_job_recommendations_enabled:
                        return {"status": "disabled", "reason": "User disabled job recommendations"}
                    elif notification_type == "message" and not us.telegram_messages_enabled:
                        return {"status": "disabled", "reason": "User disabled message notifications"}
                    elif notification_type == "system" and not us.telegram_system_notifications_enabled:
                        return {"status": "disabled", "reason": "User disabled system notifications"}
                    elif notification_type == "promotional" and not us.telegram_promotional_enabled:
                        return {"status": "disabled", "reason": "User disabled promotional notifications"}

            # Create Delivery Log record
            log_entry = TelegramNotificationLog(
                user_id=db_user.id if db_user else None,
                chat_id=target_chat_id,
                notification_type=notification_type,
                channel="telegram",
                status="pending",
                message_text=text
            )
            session.add(log_entry)
            await session.commit()
            await session.refresh(log_entry)

            # Execute sending
            send_res = telegram_bot.send_message_sync(text, target_chat_id)
            if send_res.get("success"):
                log_entry.status = "sent"
                log_entry.telegram_message_id = send_res.get("message_id")
                log_entry.sent_at = datetime.now(timezone.utc)
                if db_user:
                    db_user.telegram_last_message_at = datetime.now(timezone.utc)
                await session.commit()
                return {"status": "sent", "chat_id": target_chat_id, "message_id": send_res.get("message_id")}
            else:
                error_msg = send_res.get("error", "Unknown send error")
                log_entry.error_message = error_msg
                
                # Check for 403 Bot Blocked by user
                if "blocked" in error_msg.lower() or send_res.get("error_code") == 403:
                    log_entry.status = "failed"
                    if db_user:
                        db_user.telegram_notifications_enabled = False
                        db_user.telegram_is_verified = False
                    await session.commit()
                    logger.warning("Bot was blocked by Telegram user chat_id=%s. Disabled integration.", target_chat_id)
                    return {"status": "failed", "reason": "Bot blocked by user"}
                else:
                    log_entry.status = "retrying"
                    await session.commit()
                    raise RuntimeError(f"Telegram API delivery failed: {error_msg}")

    return _run_async(_send_and_log())


# ---------------------------------------------------------------------------
# NOTIFICATION DISPATCHER (fan-out to email + telegram)
# ---------------------------------------------------------------------------
@celery_app.task(
    bind=True,
    name="app.celery.tasks.dispatch_notification_task",
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    soft_time_limit=30,
    time_limit=60,
)
def dispatch_notification_task(
    self,
    user_id: str,
    title: str,
    body: str,
    notification_type: str = "system",
    payload: Optional[Dict[str, Any]] = None,
):
    """
    Dispatch external notifications (Email + Telegram) for a user.
    DB persistence and WebSocket delivery happen synchronously in the request.
    This task handles the slow I/O: email and Telegram.
    """
    logger.info(
        "dispatch_notification_task started | task_id=%s user=%s type=%s retry=%s",
        self.request.id, user_id, notification_type, self.request.retries,
    )

    async def _dispatch():
        from app.database.session import AsyncSessionLocal
        from sqlalchemy import select
        from app.models.domain import User, UserSettings

        async with AsyncSessionLocal() as session:
            import uuid as _uuid
            uid = _uuid.UUID(user_id)
            stmt = select(User).where(User.id == uid)
            res = await session.execute(stmt)
            user = res.scalar_one_or_none()
            if not user:
                logger.warning("dispatch_notification_task: user %s not found", user_id)
                return

            stmt_set = select(UserSettings).where(UserSettings.user_id == uid)
            res_set = await session.execute(stmt_set)
            user_settings = res_set.scalar_one_or_none()

            email_enabled = user_settings.email_notifications if user_settings else True

            # Fan out to Telegram if target chat_id exists and integration is enabled
            if user.telegram_notifications_enabled and user.telegram_chat_id:
                tg_text = f"🔔 <b>{title}</b>\n\n{body}\n\n<i>Платформа поиска работы HamKor.tj</i>"
                send_telegram_notification_task.delay(
                    text=tg_text,
                    target_chat_id=user.telegram_chat_id,
                    user_id=str(user.id),
                    notification_type=notification_type
                )

            # Fan out to Email
            if email_enabled and user.email:
                email_body = f"<p>{body}</p><p><small>Перейдите на HamKor.tj для подробной информации.</small></p>"
                send_email_task.delay(user.email, f"HamKor: {title}", email_body)

    _run_async(_dispatch())

    logger.info("dispatch_notification_task completed | task_id=%s user=%s", self.request.id, user_id)
    return {"status": "dispatched", "user_id": user_id}


@celery_app.task(
    bind=True,
    name="app.celery.tasks.send_periodic_telegram_recommendations_task",
    max_retries=2,
    soft_time_limit=180,
    time_limit=300,
)
def send_periodic_telegram_recommendations_task(self):
    """
    Periodic task to send personalized, anti-spam protected job recommendations
    to verified Telegram users based on real DB vacancies.
    """
    logger.info("send_periodic_telegram_recommendations_task started | task_id=%s", self.request.id)

    async def _run():
        from datetime import datetime, timedelta, timezone
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        from app.database.session import AsyncSessionLocal
        from app.models.domain import User, UserSettings, Job

        async with AsyncSessionLocal() as session:
            stmt = (
                select(User)
                .options(selectinload(User.user_settings), selectinload(User.worker_profile))
                .where(
                    User.telegram_is_verified == True,
                    User.telegram_notifications_enabled == True,
                    User.telegram_chat_id.isnot(None)
                )
            )
            res = await session.execute(stmt)
            users = res.scalars().all()

            sent_count = 0
            now = datetime.now(timezone.utc)
            min_cooldown = timedelta(hours=24)

            for u in users:
                if u.telegram_last_promotional_message_at and (now - u.telegram_last_promotional_message_at) < min_cooldown:
                    continue

                us = u.user_settings
                if us and (not us.telegram_notifications_enabled or not us.telegram_job_recommendations_enabled):
                    continue

                wp = u.worker_profile
                pos = wp.desired_position if wp else None
                city = u.city

                job_stmt = select(Job).where(Job.status == "OPEN").order_by(Job.created_at.desc())
                if pos:
                    first_word = pos.split()[0]
                    job_stmt = job_stmt.where(Job.title.ilike(f"%{first_word}%"))
                if city:
                    job_stmt = job_stmt.where(Job.location.ilike(f"%{city}%"))

                job_stmt = job_stmt.limit(3)
                job_res = await session.execute(job_stmt)
                matching_jobs = job_res.scalars().all()

                if not matching_jobs:
                    continue

                lang = u.language or "ru"
                user_name = u.full_name or u.username
                pos_title = pos or "вашему профилю"

                if lang == "tj":
                    msg = f"🎯 <b>Пешниҳодҳои нави вакансияҳо барои шумо, {user_name}!</b>\n\nБарои касби «{pos_title}» вакансияҳои нав пайдо шуданд:\n\n"
                elif lang == "en":
                    msg = f"🎯 <b>New job recommendations for you, {user_name}!</b>\n\nNew positions found matching '{pos_title}':\n\n"
                else:
                    msg = f"🎯 <b>Персональная подборка вакансий для вас, {user_name}!</b>\n\nПо вашему запросу «{pos_title}» найдены новые вакансии:\n\n"

                for j in matching_jobs:
                    salary = f"{int(j.salary_min)} - {int(j.salary_max)} {j.currency}" if j.salary_min and j.salary_max else "По договоренности"
                    comp = j.external_company_name or "Компания HamKor"
                    msg += f"• <b>{j.title}</b> ({comp})\n  📍 {j.location} | 💰 {salary}\n  🔗 <a href='http://171.22.174.199:2212/jobs/{j.id}'>Посмотреть</a>\n\n"

                msg += f"<i>Платформа поиска работы HamKor.tj</i>"

                tg_target = u.telegram_chat_id
                send_telegram_notification_task.delay(
                    text=msg,
                    target_chat_id=tg_target,
                    user_id=str(u.id),
                    notification_type="job_recommendation"
                )

                u.telegram_last_promotional_message_at = now
                sent_count += 1

            await session.commit()
            return sent_count

    count = _run_async(_run())
    logger.info("send_periodic_telegram_recommendations_task completed | recommendations_sent=%s", count)
    return {"status": "success", "sent_count": count}


# ---------------------------------------------------------------------------
# AI ANALYSIS TASK
# ---------------------------------------------------------------------------
@celery_app.task(
    bind=True,
    name="app.celery.tasks.ai_analysis_task",
    max_retries=2,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    soft_time_limit=120,
    time_limit=180,
)
def ai_analysis_task(self, user_id: str, prompt: str, task_type: str):
    """Run an AI analysis task in the background."""
    logger.info(
        "ai_analysis_task started | task_id=%s user=%s type=%s retry=%s",
        self.request.id, user_id, task_type, self.request.retries,
    )
    result = f"AI Analysis Completed for {task_type}. Results generated for prompt: {prompt[:50]}..."
    logger.info("ai_analysis_task completed | task_id=%s user=%s", self.request.id, user_id)
    return {"status": "completed", "user_id": user_id, "result": result}


# ---------------------------------------------------------------------------
# SCRAPER / SYNC TASKS
# ---------------------------------------------------------------------------
@celery_app.task(
    bind=True,
    name="app.celery.tasks.sync_yora_vacancies_task",
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    soft_time_limit=300,
    time_limit=600,
)
def sync_yora_vacancies_task(self, max_pages: int = None):
    """Fetch and sync job vacancies from yora.tj."""
    logger.info(
        "sync_yora_vacancies_task started | task_id=%s max_pages=%s retry=%s",
        self.request.id, max_pages, self.request.retries,
    )

    async def _run():
        from app.database.session import AsyncSessionLocal
        from app.services.yora_parser import YoraParserService

        async with AsyncSessionLocal() as session:
            parser = YoraParserService(session)
            return await parser.fetch_and_sync(max_pages=max_pages)

    stats = _run_async(_run())
    logger.info(
        "sync_yora_vacancies_task completed | task_id=%s stats=%s",
        self.request.id, stats,
    )
    return {"status": "success", "stats": stats}


@celery_app.task(
    bind=True,
    name="app.celery.tasks.sync_yora_candidates_task",
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    soft_time_limit=300,
    time_limit=600,
)
def sync_yora_candidates_task(self):
    """Fetch and sync candidate profiles from yora.tj."""
    logger.info(
        "sync_yora_candidates_task started | task_id=%s retry=%s",
        self.request.id, self.request.retries,
    )

    async def _run():
        from app.database.session import AsyncSessionLocal
        from app.services.yora_candidate_parser import YoraCandidateParserService

        async with AsyncSessionLocal() as session:
            parser = YoraCandidateParserService(session)
            return await parser.sync_candidates()

    stats = _run_async(_run())
    logger.info(
        "sync_yora_candidates_task completed | task_id=%s stats=%s",
        self.request.id, stats,
    )
    return {"status": "success", "stats": stats}


@celery_app.task(
    bind=True,
    name="app.celery.tasks.sync_telegram_vacancies_task",
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    soft_time_limit=300,
    time_limit=600,
)
def sync_telegram_vacancies_task(self, max_pages: int = 5):
    """Fetch and sync job vacancies from Telegram channels."""
    logger.info(
        "sync_telegram_vacancies_task started | task_id=%s max_pages=%s retry=%s",
        self.request.id, max_pages, self.request.retries,
    )

    async def _run():
        from app.database.session import AsyncSessionLocal
        from app.services.telegram_parser import TelegramParserService

        async with AsyncSessionLocal() as session:
            parser = TelegramParserService(session)
            return await parser.fetch_and_sync(max_pages=max_pages)

    stats = _run_async(_run())
    logger.info(
        "sync_telegram_vacancies_task completed | task_id=%s stats=%s",
        self.request.id, stats,
    )
    return {"status": "success", "stats": stats}


@celery_app.task(
    bind=True,
    name="app.celery.tasks.sync_somon_vacancies_task",
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    soft_time_limit=300,
    time_limit=600,
)
def sync_somon_vacancies_task(self, max_pages: int = 10):
    """Fetch and sync job vacancies from somon.tj."""
    logger.info(
        "sync_somon_vacancies_task started | task_id=%s max_pages=%s retry=%s",
        self.request.id, max_pages, self.request.retries,
    )

    async def _run():
        from app.database.session import AsyncSessionLocal
        from app.services.somon_parser import SomonParserService

        async with AsyncSessionLocal() as session:
            parser = SomonParserService(session)
            return await parser.fetch_and_sync(max_pages=max_pages)

    stats = _run_async(_run())
    logger.info(
        "sync_somon_vacancies_task completed | task_id=%s stats=%s",
        self.request.id, stats,
    )
    return {"status": "success", "stats": stats}


# ---------------------------------------------------------------------------
# CV DOCUMENT PROCESSING TASK
# ---------------------------------------------------------------------------
@celery_app.task(
    bind=True,
    name="app.celery.tasks.process_cv_document_task",
    max_retries=2,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    soft_time_limit=180,
    time_limit=300,
)
def process_cv_document_task(self, cv_document_id: str):
    """Asynchronously process uploaded CV document: text extraction, AI analysis, Pydantic validation, suggestions generation."""
    logger.info("process_cv_document_task started | task_id=%s cv_id=%s retry=%s", self.request.id, cv_document_id, self.request.retries)

    async def _run():
        import uuid as _uuid
        from app.database.session import AsyncSessionLocal
        from app.services.cv_processing_service import CVProcessingService

        async with AsyncSessionLocal() as session:
            service = CVProcessingService(session)
            return await service.process_cv_document(_uuid.UUID(cv_document_id))

    cv_doc = _run_async(_run())
    logger.info("process_cv_document_task completed | task_id=%s cv_id=%s status=%s", self.request.id, cv_document_id, cv_doc.processing_status)
    return {"status": "success", "cv_document_id": cv_document_id, "processing_status": cv_doc.processing_status}


# ---------------------------------------------------------------------------
# INTELLIGENT JOB MATCHING TASKS
# ---------------------------------------------------------------------------
@celery_app.task(
    bind=True,
    name="app.celery.tasks.recalculate_user_job_matches_task",
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=180,
    retry_jitter=True,
    soft_time_limit=180,
    time_limit=300,
)
def recalculate_user_job_matches_task(self, user_id: str):
    """Recalculate persistent JobMatch records for a worker user after profile/resume updates."""
    logger.info("recalculate_user_job_matches_task started | task_id=%s user_id=%s retry=%s", self.request.id, user_id, self.request.retries)

    async def _run():
        import uuid as _uuid
        from app.database.session import AsyncSessionLocal
        from app.services.match_service import JobMatchService

        async with AsyncSessionLocal() as session:
            return await JobMatchService.recalculate_user_matches(session, _uuid.UUID(user_id))

    count = _run_async(_run())
    logger.info("recalculate_user_job_matches_task completed | task_id=%s user_id=%s matches_updated=%s", self.request.id, user_id, count)
    return {"status": "success", "user_id": user_id, "matches_updated": count}


@celery_app.task(
    bind=True,
    name="app.celery.tasks.recalculate_job_matches_task",
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=180,
    retry_jitter=True,
    soft_time_limit=180,
    time_limit=300,
)
def recalculate_job_matches_task(self, job_id: str):
    """Recalculate persistent JobMatch records for a newly created or updated job against active worker profiles."""
    logger.info("recalculate_job_matches_task started | task_id=%s job_id=%s retry=%s", self.request.id, job_id, self.request.retries)

    async def _run():
        import uuid as _uuid
        from app.database.session import AsyncSessionLocal
        from app.services.match_service import JobMatchService

        async with AsyncSessionLocal() as session:
            return await JobMatchService.recalculate_job_matches(session, _uuid.UUID(job_id))

    count = _run_async(_run())
    logger.info("recalculate_job_matches_task completed | task_id=%s job_id=%s matches_updated=%s", self.request.id, job_id, count)
    return {"status": "success", "job_id": job_id, "matches_updated": count}


@celery_app.task(
    bind=True,
    name="app.celery.tasks.refresh_stale_matches_task",
    max_retries=2,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    soft_time_limit=120,
    time_limit=180,
)
def refresh_stale_matches_task(self):
    """Clean up obsolete job matches for closed/deleted jobs."""
    logger.info("refresh_stale_matches_task started | task_id=%s", self.request.id)

    async def _run():
        from app.database.session import AsyncSessionLocal
        from app.services.match_service import JobMatchService

        async with AsyncSessionLocal() as session:
            return await JobMatchService.refresh_stale_matches(session)

    deleted_count = _run_async(_run())
    logger.info("refresh_stale_matches_task completed | task_id=%s deleted=%s", self.request.id, deleted_count)
    return {"status": "success", "deleted": deleted_count}


# ---------------------------------------------------------------------------
# EMPLOYER TO CANDIDATE DIRECT EMAIL TASK
# ---------------------------------------------------------------------------
@celery_app.task(
    bind=True,
    name="app.celery.tasks.send_employer_message_email_task",
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    soft_time_limit=45,
    time_limit=90,
)
def send_employer_message_email_task(self, message_id: str):
    """Send direct email from employer to candidate with DB status tracking & idempotency."""
    logger.info("send_employer_message_email_task started | task_id=%s message_id=%s retry=%s", self.request.id, message_id, self.request.retries)

    async def _run():
        import uuid as _uuid
        from datetime import datetime, timezone
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        from app.database.session import AsyncSessionLocal
        from app.models.domain import EmployerMessage, Application, Job, Company, User
        from app.services.email_service import EmailService

        async with AsyncSessionLocal() as session:
            res = await session.execute(
                select(EmployerMessage)
                .options(
                    selectinload(EmployerMessage.employer),
                    selectinload(EmployerMessage.candidate),
                    selectinload(EmployerMessage.application).selectinload(Application.job).selectinload(Job.company)
                )
                .where(EmployerMessage.id == _uuid.UUID(message_id))
            )
            msg_obj = res.scalar_one_or_none()
            if not msg_obj:
                logger.error("EmployerMessage record %s not found", message_id)
                return {"status": "not_found"}

            # Idempotency check: avoid double sending if already sent
            if msg_obj.status == "sent":
                logger.info("EmployerMessage %s already sent. Skipping.", message_id)
                return {"status": "already_sent"}

            msg_obj.status = "sending"
            await session.commit()

            cand = msg_obj.candidate
            emp = msg_obj.employer
            app = msg_obj.application
            job = app.job if app else None
            comp = job.company if job else None

            cand_name = cand.full_name or cand.username or "Кандидат"
            emp_name = emp.full_name or emp.username or "Работодатель"
            comp_name = comp.company_name if comp else (emp.company_name or "Компания HamKor")
            job_title = job.title if job else "Вакансия"
            cand_lang = getattr(cand, "language", "ru") or "ru"

            success = EmailService.send_employer_direct_email(
                to_email=msg_obj.recipient_email,
                candidate_name=cand_name,
                employer_name=emp_name,
                company_name=comp_name,
                job_title=job_title,
                subject=msg_obj.subject,
                message_body=msg_obj.body,
                lang=cand_lang
            )

            if success:
                msg_obj.status = "sent"
                msg_obj.sent_at = datetime.now(timezone.utc)
                msg_obj.error_message = None
            else:
                msg_obj.status = "failed"
                msg_obj.error_message = "SMTP delivery failure"

            await session.commit()
            return {"status": msg_obj.status, "to": msg_obj.recipient_email}

    result = _run_async(_run())
    if result.get("status") == "failed":
        raise RuntimeError(f"Email delivery failed for EmployerMessage {message_id}")

    logger.info("send_employer_message_email_task completed | task_id=%s message_id=%s status=%s", self.request.id, message_id, result.get("status"))
    return result




