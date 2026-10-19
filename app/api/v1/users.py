import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.schemas.user import UserOut, UserUpdate, UserSidebarProfileOut
from app.schemas.profile import (
    WorkerProfileOut, WorkerProfileUpdate, CompanyOut, CompanyUpdate, 
    ExperienceOut, ExperienceCreate, CertificateOut, CertificateCreate,
    CandidateFullProfileOut
)
from app.schemas.common import PaginatedResponse, MessageResponse
from app.services.user import UserService
from app.auth.deps import get_current_user, require_roles
from app.models.domain import User
from app.models.enums import UserRole

router = APIRouter(prefix="/users", tags=["Users & Profiles"])

@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/me/sidebar-profile", response_model=UserSidebarProfileOut)
async def get_my_sidebar_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    service = UserService(db)
    return await service.get_sidebar_profile(current_user.id)

@router.put("/me", response_model=UserOut)
async def update_me(data: UserUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    return await service.update_user(current_user.id, data)

from fastapi import APIRouter, Depends, Query, status, HTTPException, UploadFile, File

@router.post("/me/avatar", response_model=UserOut)
async def upload_my_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.utils.storage import storage_service
    rel_path, _ = await storage_service.save_file(file, folder="avatars")
    file_url = f"/api/v1/files/{rel_path}"
    service = UserService(db)
    return await service.update_user(current_user.id, UserUpdate(avatar_url=file_url))

@router.get("/me/settings")
async def get_my_settings(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    settings_obj = await service.get_user_settings(current_user.id)
    return {
        "language": settings_obj.language,
        "timezone": settings_obj.timezone,
        "email_notifications": settings_obj.email_notifications,
        "push_notifications": settings_obj.push_notifications,
        "theme": settings_obj.theme,
        "extra_preferences": settings_obj.extra_preferences,
        "telegram_chat_id": current_user.telegram_chat_id,
        "telegram_username": current_user.telegram_username,
        "is_telegram_connected": bool(current_user.telegram_chat_id)
    }

@router.put("/me/settings")
async def update_my_settings(data: dict, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    settings_obj = await service.update_user_settings(current_user.id, data)
    return {
        "language": settings_obj.language,
        "timezone": settings_obj.timezone,
        "email_notifications": settings_obj.email_notifications,
        "push_notifications": settings_obj.push_notifications,
        "theme": settings_obj.theme,
        "extra_preferences": settings_obj.extra_preferences,
        "telegram_chat_id": current_user.telegram_chat_id,
        "telegram_username": current_user.telegram_username,
        "is_telegram_connected": bool(current_user.telegram_chat_id)
    }

@router.post("/me/telegram-link")
async def generate_telegram_link(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Generate a unique Telegram linking code and Bot deep link."""
    code = f"HAMKOR-{current_user.id.hex[:6].upper()}"
    current_user.telegram_link_code = code
    await db.commit()
    bot_username = "HamKorJobsBot"
    return {
        "link_code": code,
        "bot_url": f"https://t.me/{bot_username}?start={code}",
        "instructions": f"Нажмите 'Открыть Telegram', запустите бота и отправьте код {code} или вашу ID команду."
    }

@router.post("/me/telegram-connect")
async def connect_telegram(data: dict, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Connect a Telegram chat_id or username to the user's account and send confirmation via Celery."""
    chat_id = data.get("telegram_chat_id") or data.get("chat_id")
    username = data.get("telegram_username") or data.get("username")
    
    if not chat_id and not username:
        raise HTTPException(status_code=400, detail="Укажите telegram_chat_id или telegram_username")

    if chat_id:
        current_user.telegram_chat_id = str(chat_id)
    if username:
        clean_user = str(username).replace("@", "").strip()
        current_user.telegram_username = clean_user
        if not current_user.telegram_chat_id:
            current_user.telegram_chat_id = f"@{clean_user}"

    await db.commit()

    # Dispatch confirmation message via Celery task for instant (< 5ms) HTTP response
    from app.celery.tasks import send_telegram_notification_task
    tg_target = current_user.telegram_chat_id or (f"@{current_user.telegram_username}" if current_user.telegram_username else None)
    
    if tg_target:
        welcome_text = (
            f"🎉 <b>Telegram аккаунт успешно привязан!</b>\n\n"
            f"Здравствуйте, <b>{current_user.full_name or current_user.username}</b>!\n\n"
            f"Ваша учетная запись на платформе <b>HamKor.tj</b> успешно связана с этим аккаунтом Telegram.\n\n"
            f"🔔 Теперь вы будете получать важные уведомления прямо сюда:\n"
            f"• Новые отклики и статусы рассмотрения ваших заявок\n"
            f"• Важные сообщения от работодателей и кандидатов\n"
            f"• Подходящие предложения по работе и обновления\n\n"
            f"<i>С уважением, команда платформы HamKor.tj</i>"
        )
        try:
            send_telegram_notification_task.delay(welcome_text, tg_target)
        except Exception:
            # Fallback to direct async bot call if Redis/Celery is temporarily offline
            from app.telegram.bot import telegram_bot
            await telegram_bot.send_message_async(welcome_text, target_chat_id=tg_target)

    return {
        "status": "connected",
        "telegram_chat_id": current_user.telegram_chat_id,
        "telegram_username": current_user.telegram_username,
        "message": "Telegram аккаунт успешно привязан к вашей учетной записи HamKor.tj. Подтверждающее сообщение отправлено!"
    }



@router.post("/me/telegram-unlink")
async def unlink_telegram(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Unlink Telegram account from user profile."""
    current_user.telegram_chat_id = None
    current_user.telegram_username = None
    current_user.telegram_link_code = None
    await db.commit()
    return {"status": "unlinked", "message": "Telegram аккаунт отвязан"}

@router.get("/me/worker-profile", response_model=WorkerProfileOut)
async def get_my_worker_profile(current_user: User = Depends(require_roles([UserRole.WORKER])), db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    return await service.get_worker_profile(current_user.id)

@router.put("/me/worker-profile", response_model=WorkerProfileOut)
async def update_my_worker_profile(data: WorkerProfileUpdate, current_user: User = Depends(require_roles([UserRole.WORKER])), db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    return await service.update_worker_profile(current_user.id, data)

@router.post("/me/experience", response_model=ExperienceOut, status_code=status.HTTP_201_CREATED)
async def add_experience(data: ExperienceCreate, current_user: User = Depends(require_roles([UserRole.WORKER])), db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    return await service.add_experience(current_user.id, data)

@router.delete("/me/experience/{exp_id}", response_model=MessageResponse)
async def delete_experience(exp_id: uuid.UUID, current_user: User = Depends(require_roles([UserRole.WORKER])), db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    await service.delete_experience(current_user.id, exp_id)
    return MessageResponse(message="Experience deleted successfully")

@router.post("/me/certificates", response_model=CertificateOut, status_code=status.HTTP_201_CREATED)
async def add_certificate(data: CertificateCreate, current_user: User = Depends(require_roles([UserRole.WORKER])), db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    return await service.add_certificate(current_user.id, data)

@router.delete("/me/certificates/{cert_id}", response_model=MessageResponse)
async def delete_certificate(cert_id: uuid.UUID, current_user: User = Depends(require_roles([UserRole.WORKER])), db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    await service.delete_certificate(current_user.id, cert_id)
    return MessageResponse(message="Certificate deleted successfully")

@router.get("/me/company-profile", response_model=CompanyOut)
async def get_my_company_profile(current_user: User = Depends(require_roles([UserRole.EMPLOYER])), db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    return await service.get_company_profile(current_user.id)

@router.put("/me/company-profile", response_model=CompanyOut)
async def update_my_company_profile(data: CompanyUpdate, current_user: User = Depends(require_roles([UserRole.EMPLOYER])), db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    return await service.update_company_profile(current_user.id, data)

@router.post("/me/company-profile/logo", response_model=CompanyOut)
async def upload_my_company_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles([UserRole.EMPLOYER])),
    db: AsyncSession = Depends(get_db)
):
    service = UserService(db)
    return await service.update_company_logo(current_user.id, file)

@router.delete("/me/company-profile/logo", response_model=CompanyOut)
async def delete_my_company_logo(
    current_user: User = Depends(require_roles([UserRole.EMPLOYER])),
    db: AsyncSession = Depends(get_db)
):
    service = UserService(db)
    return await service.delete_company_logo(current_user.id)

@router.get("/workers", response_model=PaginatedResponse[WorkerProfileOut])
async def search_workers(
    name: Optional[str] = None,
    skill: Optional[str] = None,
    city: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    service = UserService(db)
    skip = (page - 1) * limit
    items, total = await service.search_workers(name=name, skill=skill, city=city, skip=skip, limit=limit)
    pages = (total + limit - 1) // limit if total > 0 else 1
    return PaginatedResponse(items=items, total=total, page=page, limit=limit, pages=pages)

@router.get("/workers/{user_id}", response_model=WorkerProfileOut)
async def get_worker_profile_by_id(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    service = UserService(db)
    return await service.get_worker_profile(user_id)

@router.get("/candidate/{candidate_user_id}/full", response_model=CandidateFullProfileOut)
async def get_candidate_full_profile_endpoint(
    candidate_user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    service = UserService(db)
    return await service.get_candidate_full_profile(candidate_user_id)

@router.post("/candidates/sync-yora")
async def sync_yora_candidates(
    db: AsyncSession = Depends(get_db)
):
    from app.services.yora_candidate_parser import YoraCandidateParserService
    parser = YoraCandidateParserService(db)
    stats = await parser.sync_candidates()
    return {"status": "ok", "stats": stats}

from pydantic import BaseModel


class SendCandidateEmailSchema(BaseModel):
    candidate_user_id: Optional[uuid.UUID] = None
    recipient_email: Optional[str] = None
    subject: str
    message: str


@router.post("/candidates/send-email")
async def send_candidate_email(
    data: SendCandidateEmailSchema,
    current_user: User = Depends(require_roles([UserRole.EMPLOYER, UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    from app.models.domain import AuditLog, User
    from sqlalchemy import select

    target_email = data.recipient_email
    candidate_name = "Кандидат"

    if data.candidate_user_id:
        res = await db.execute(select(User).where(User.id == data.candidate_user_id))
        target_user = res.scalar_one_or_none()
        if not target_user:
            raise HTTPException(status_code=404, detail="Зарегистрированный кандидат не найден.")
        target_email = target_user.email
        candidate_name = target_user.full_name or target_user.username or "Кандидат"
    
    if not target_email:
        raise HTTPException(
            status_code=400,
            detail="Этот кандидат импортирован из внешнего источника. Прямая отправка email недоступна."
        )

    employer_name = current_user.full_name or current_user.username or "Работодатель HamKor"

    # Audit log entry
    audit = AuditLog(
        user_id=current_user.id,
        action="SEND_CANDIDATE_EMAIL",
        entity_type="user",
        entity_id=str(data.candidate_user_id) if data.candidate_user_id else target_email,
        details={
            "recipient_email": target_email,
            "subject": data.subject,
            "employer_id": str(current_user.id)
        }
    )
    db.add(audit)
    await db.commit()

    # Dispatch email via Celery background worker (reliable, with retry)
    try:
        from app.celery.tasks import send_email_task
        # Build simple HTML wrapper for the message body
        html_body = (
            f"<p><strong>Сообщение от {employer_name}:</strong></p>"
            f"<div style='padding:12px;background:#f5f5f5;border-radius:8px;'>{data.message}</div>"
            f"<p><small>Отправлено через платформу HamKor.tj</small></p>"
        )
        send_email_task.delay(target_email, data.subject, html_body)
    except Exception:
        pass  # If Redis/Celery unavailable, don't fail the request

    return {
        "status": "ok",
        "message": f"Сообщение успешно поставлено в очередь на отправку кандидату {candidate_name}!"
    }

