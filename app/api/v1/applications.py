import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.schemas.application import ApplicationCreate, ApplicationStatusUpdate, ApplicationOut, ApplicationCoverNoteUpdate, EmployerContactEmailRequest, EmployerMessageOut
from app.schemas.common import PaginatedResponse
from app.services.application import ApplicationService
from app.auth.deps import get_current_user, require_roles
from app.models.domain import User
from app.models.enums import UserRole, ApplicationStatus

router = APIRouter(tags=["Applications"])

@router.post("/applications", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
async def apply_to_job(
    data: ApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    service = ApplicationService(db)
    app_res = await service.apply_to_job(current_user.id, data)

    # Dispatch real-time notifications
    from app.services.notification_service import NotificationService
    from app.models.enums import NotificationType
    from app.repositories.job import JobRepository

    job_repo = JobRepository(db)
    job = await job_repo.get_by_id(data.job_id)
    job_title = job.title if job else "вакансию"

    # Worker confirmation notification
    await NotificationService.send_notification(
        db,
        current_user.id,
        "Отклик успешно отправлен",
        f"Ваш отклик на вакансию '{job_title}' успешно отправлен работодателю.",
        type=NotificationType.STATUS_CHANGE
    )

    # Employer notification if company exists
    if job and job.company and job.company.employer_id:
        await NotificationService.send_notification(
            db,
            job.company.employer_id,
            "Новый отклик на вакансию",
            f"Соискатель {current_user.full_name or current_user.username} откликнулся на вашу вакансию '{job_title}'.",
            type=NotificationType.NEW_APPLICATION
        )

    return app_res

@router.get("/applications/check/{job_id}")
async def check_application_status(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    service = ApplicationService(db)
    existing = await service.app_repo.get_by_worker_and_job(current_user.id, job_id)
    return {
        "has_applied": existing is not None,
        "application_id": str(existing.id) if existing else None,
        "status": existing.status.value if existing and hasattr(existing.status, 'value') else (str(existing.status) if existing else None)
    }

@router.post("/applications/{application_id}/cancel", response_model=ApplicationOut)
async def cancel_application(
    application_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    service = ApplicationService(db)
    return await service.cancel_application(current_user.id, application_id)

@router.patch("/applications/{application_id}/cover-note", response_model=ApplicationOut)
async def update_cover_note(
    application_id: uuid.UUID,
    data: ApplicationCoverNoteUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    service = ApplicationService(db)
    return await service.update_cover_note(current_user.id, application_id, data.cover_note)

@router.get("/applications/my", response_model=PaginatedResponse[ApplicationOut])
async def get_my_applications(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    service = ApplicationService(db)
    skip = (page - 1) * limit
    items, total = await service.get_worker_applications(current_user.id, skip=skip, limit=limit)
    pages = (total + limit - 1) // limit if total > 0 else 1
    return PaginatedResponse(items=items, total=total, page=page, limit=limit, pages=pages)

def parse_status_filter(status_str: Optional[str]) -> Optional[ApplicationStatus]:
    if not status_str or str(status_str).strip().lower() in ("all", "none", ""):
        return None
    val = str(status_str).strip().lower()
    try:
        return ApplicationStatus(val)
    except ValueError:
        return None

@router.get("/jobs/{job_id}/applications", response_model=PaginatedResponse[ApplicationOut])
async def get_job_applications(
    job_id: uuid.UUID,
    status: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(require_roles([UserRole.EMPLOYER])),
    db: AsyncSession = Depends(get_db)
):
    service = ApplicationService(db)
    skip = (page - 1) * limit
    status_enum = parse_status_filter(status)
    items, total = await service.get_job_applications(current_user.id, job_id, status_filter=status_enum, skip=skip, limit=limit)
    pages = (total + limit - 1) // limit if total > 0 else 1
    return PaginatedResponse(items=items, total=total, page=page, limit=limit, pages=pages)

@router.get("/applications/employer", response_model=PaginatedResponse[ApplicationOut])
async def get_employer_applications_all(
    job_id: Optional[uuid.UUID] = Query(default=None),
    status: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(require_roles([UserRole.EMPLOYER])),
    db: AsyncSession = Depends(get_db)
):
    service = ApplicationService(db)
    skip = (page - 1) * limit
    status_enum = parse_status_filter(status)
    if job_id:
        items, total = await service.get_job_applications(current_user.id, job_id, status_filter=status_enum, skip=skip, limit=limit)
    else:
        items, total = await service.get_all_employer_applications(current_user.id, status_filter=status_enum, skip=skip, limit=limit)
    pages = (total + limit - 1) // limit if total > 0 else 1
    return PaginatedResponse(items=items, total=total, page=page, limit=limit, pages=pages)

@router.patch("/applications/{application_id}/status", response_model=ApplicationOut)
async def update_application_status(
    application_id: uuid.UUID,
    data: ApplicationStatusUpdate,
    current_user: User = Depends(require_roles([UserRole.EMPLOYER])),
    db: AsyncSession = Depends(get_db)
):
    service = ApplicationService(db)
    updated_app = await service.update_application_status(
        current_user.id,
        application_id,
        data.status,
        employer_feedback=data.employer_feedback,
        rejection_reason=data.rejection_reason,
        rating=data.rating
    )

    # Notify applicant about status update
    from app.services.notification_service import NotificationService
    from app.models.enums import NotificationType
    
    status_ru_map = {
        "accepted": "Принят",
        "rejected": "Отклонен",
        "pending": "В рассмотрении",
        "cancelled": "Отменен"
    }
    status_val = data.status.value if hasattr(data.status, "value") else str(data.status)
    status_ru = status_ru_map.get(status_val, status_val)
    msg_body = f"Работодатель обновил статус вашего отклика на '{status_ru}'."
    if data.employer_feedback:
        msg_body += f"\nПримечание: {data.employer_feedback}"

    await NotificationService.send_notification(
        db,
        updated_app.worker_id,
        f"Отклик: {status_ru}",
        msg_body,
        type=NotificationType.STATUS_CHANGE
    )

    return updated_app

@router.post("/applications/{application_id}/contact")
async def contact_candidate(
    application_id: uuid.UUID,
    current_user: User = Depends(require_roles([UserRole.EMPLOYER])),
    db: AsyncSession = Depends(get_db)
):
    service = ApplicationService(db)
    chat = await service.contact_candidate(current_user.id, application_id)
    return {
        "status": "success",
        "chat_id": str(chat.id),
        "message": "Чат с кандидатом успешно открыт"
    }

@router.post("/applications/{application_id}/send-email")
async def send_employer_email_to_candidate(
    application_id: uuid.UUID,
    data: EmployerContactEmailRequest,
    current_user: User = Depends(require_roles([UserRole.EMPLOYER, UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import select, func
    from sqlalchemy.orm import selectinload
    from datetime import datetime, timezone, timedelta
    from app.models.domain import Application, Job, Company, EmployerMessage
    from app.services.notification_service import NotificationService
    from app.models.enums import NotificationType, UserRole
    from fastapi import HTTPException

    if not data.subject.strip() or not data.message.strip():
        raise HTTPException(status_code=400, detail="Тема и текст сообщения не могут быть пустыми.")

    # 1. Fetch application with job, company, and candidate
    stmt = (
        select(Application)
        .options(
            selectinload(Application.job).selectinload(Job.company),
            selectinload(Application.worker)
        )
        .where(Application.id == application_id)
    )
    res = await db.execute(stmt)
    app_obj = res.scalar_one_or_none()

    if not app_obj:
        raise HTTPException(status_code=404, detail="Отклик не найден.")

    job = app_obj.job
    if not job:
        raise HTTPException(status_code=404, detail="Вакансия не найдена.")

    # 2. Strict ownership check (IDOR Protection)
    is_owner = False
    if current_user.role == UserRole.ADMIN:
        is_owner = True
    elif job.company and job.company.employer_id == current_user.id:
        is_owner = True
    elif getattr(job, "employer_id", None) and getattr(job, "employer_id", None) == current_user.id:
        is_owner = True

    if not is_owner:
        raise HTTPException(
            status_code=403,
            detail="Доступ запрещен: Вы не можете отправлять сообщения кандидатам чужих вакансий."
        )

    # 3. Candidate verification & email check
    candidate = app_obj.worker
    if not candidate or not candidate.email:
        raise HTTPException(
            status_code=400,
            detail="Отправка письма недоступна: у соискателя отсутствует подтвержденный email адрес на HamKor."
        )

    # 4. Anti-spam rate limiting (max 10 emails per hour per employer-candidate pair)
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    msg_count_res = await db.execute(
        select(func.count(EmployerMessage.id))
        .where(EmployerMessage.employer_id == current_user.id)
        .where(EmployerMessage.candidate_id == candidate.id)
        .where(EmployerMessage.created_at >= one_hour_ago)
    )
    recent_count = msg_count_res.scalar() or 0
    if recent_count >= 10:
        raise HTTPException(
            status_code=429,
            detail="Превышен лимит отправки сообщений этому кандидату (максимум 10 писем в час)."
        )

    # 5. Persist EmployerMessage in PostgreSQL
    msg_record = EmployerMessage(
        application_id=app_obj.id,
        employer_id=current_user.id,
        candidate_id=candidate.id,
        subject=data.subject.strip(),
        body=data.message.strip(),
        recipient_email=candidate.email,
        status="pending"
    )
    db.add(msg_record)
    await db.commit()
    await db.refresh(msg_record)

    # 6. Celery dispatch with synchronous fallback
    try:
        from app.celery.tasks import send_employer_message_email_task
        send_employer_message_email_task.delay(str(msg_record.id))
    except Exception:
        # Fallback to direct synchronous execution if Celery worker or Redis is offline
        from app.services.email_service import EmailService
        comp_name = job.company.company_name if job.company else (current_user.company_name or "Компания HamKor")
        emp_name = current_user.full_name or current_user.username or "Работодатель"
        cand_name = candidate.full_name or candidate.username or "Кандидат"
        cand_lang = getattr(candidate, "language", "ru") or "ru"

        sent_ok = EmailService.send_employer_direct_email(
            to_email=candidate.email,
            candidate_name=cand_name,
            employer_name=emp_name,
            company_name=comp_name,
            job_title=job.title,
            subject=msg_record.subject,
            message_body=msg_record.body,
            lang=cand_lang
        )
        if sent_ok:
            msg_record.status = "sent"
            msg_record.sent_at = datetime.now(timezone.utc)
        else:
            msg_record.status = "failed"
            msg_record.error_message = "SMTP send error"
        await db.commit()

    # 7. Create in-app Web Notification for candidate
    comp_title = job.company.company_name if job.company else "Работодатель"
    await NotificationService.send_notification(
        db,
        candidate.id,
        f"Сообщение от {comp_title}",
        f"Вам поступило новое email-сообщение от работодателя по вашей заявке на вакансию '{job.title}'.",
        type=NotificationType.SYSTEM
    )

    return {
        "id": str(msg_record.id),
        "status": msg_record.status,
        "message": "Письмо успешно поставлено в очередь и отправлено кандидату на email!"
    }


@router.get("/applications/{application_id}/messages", response_model=List[EmployerMessageOut])
async def get_application_messages(
    application_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.domain import Application, EmployerMessage, Job

    # Verify user is either employer or candidate for this application
    app_res = await db.execute(select(Application).where(Application.id == application_id))
    app_obj = app_res.scalar_one_or_none()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Отклик не найден.")

    if current_user.role != UserRole.ADMIN and app_obj.worker_id != current_user.id:
        # Check job employer ownership
        job_res = await db.execute(select(Job).options(selectinload(Job.company)).where(Job.id == app_obj.job_id))
        job = job_res.scalar_one_or_none()
        is_job_owner = job and ((job.company and job.company.employer_id == current_user.id) or getattr(job, "employer_id", None) == current_user.id)
        if not is_job_owner:
            raise HTTPException(status_code=403, detail="Доступ к истории сообщений запрещен.")

    stmt = (
        select(EmployerMessage)
        .where(EmployerMessage.application_id == application_id)
        .order_by(EmployerMessage.created_at.desc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()

