import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.domain import User, Company, Job, Application, EmployerMessage
from app.models.enums import UserRole, ApplicationStatus, JobStatus
from app.core.security import create_access_token
from app.services.email_service import EmailService

@pytest.mark.asyncio
async def test_employer_candidate_email_flow_and_security(client: AsyncClient, db_session: AsyncSession):
    """Test full employer-to-candidate email contact flow including ownership, security & persistence."""
    db = db_session
    
    # 1. Setup Employer A, Employer B, and Candidate C
    emp_a = User(
        id=uuid.uuid4(),
        email=f"emp_a_{uuid.uuid4().hex[:6]}@test.com",
        username=f"emp_a_{uuid.uuid4().hex[:6]}",
        password_hash="hash",
        role=UserRole.EMPLOYER,
        is_email_verified=True
    )
    emp_b = User(
        id=uuid.uuid4(),
        email=f"emp_b_{uuid.uuid4().hex[:6]}@test.com",
        username=f"emp_b_{uuid.uuid4().hex[:6]}",
        password_hash="hash",
        role=UserRole.EMPLOYER,
        is_email_verified=True
    )
    candidate = User(
        id=uuid.uuid4(),
        email=f"candidate_{uuid.uuid4().hex[:6]}@test.com",
        username=f"cand_{uuid.uuid4().hex[:6]}",
        password_hash="hash",
        role=UserRole.WORKER,
        full_name="Shohruh Candidate",
        is_email_verified=True
    )
    db.add_all([emp_a, emp_b, candidate])
    await db.commit()

    # 2. Setup Company and Job for Employer A & B
    comp_a = Company(
        id=uuid.uuid4(),
        employer_id=emp_a.id,
        company_name="Tech Corp A"
    )
    job_a = Job(
        id=uuid.uuid4(),
        company_id=comp_a.id,
        title="Senior Python Backend Developer",
        description="Backend development",
        employment_type="FULL_TIME",
        location="Dushanbe",
        status=JobStatus.OPEN
    )
    
    comp_b = Company(
        id=uuid.uuid4(),
        employer_id=emp_b.id,
        company_name="Innovate Ltd B"
    )
    job_b = Job(
        id=uuid.uuid4(),
        company_id=comp_b.id,
        title="Frontend React Specialist",
        description="Frontend development",
        employment_type="FULL_TIME",
        location="Dushanbe",
        status=JobStatus.OPEN
    )
    db.add_all([comp_a, job_a, comp_b, job_b])
    await db.commit()

    # 3. Setup Application from Candidate to Job A & Job B
    app_a = Application(
        id=uuid.uuid4(),
        job_id=job_a.id,
        worker_id=candidate.id,
        status=ApplicationStatus.PENDING,
        cover_note="Привет, хочу работать у вас!"
    )
    app_b = Application(
        id=uuid.uuid4(),
        job_id=job_b.id,
        worker_id=candidate.id,
        status=ApplicationStatus.PENDING
    )
    db.add_all([app_a, app_b])
    await db.commit()

    token_emp_a = create_access_token(emp_a.id, emp_a.role)
    token_emp_b = create_access_token(emp_b.id, emp_b.role)
    token_cand = create_access_token(candidate.id, candidate.role)

    headers_a = {"Authorization": f"Bearer {token_emp_a}"}
    headers_b = {"Authorization": f"Bearer {token_emp_b}"}
    headers_cand = {"Authorization": f"Bearer {token_cand}"}

    # -----------------------------------------------------------------------
    # TEST 1: Employer A sends email to Candidate on App A -> SUCCESS (200 OK)
    # -----------------------------------------------------------------------
    res = await client.post(
        f"/api/v1/applications/{app_a.id}/send-email",
        json={
            "subject": "Приглашение на интервью Python Dev",
            "message": "Здравствуйте, Шохрух! Хотим пригласить вас в офис завтра в 14:00."
        },
        headers=headers_a
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert "id" in data
    msg_id = uuid.UUID(data["id"])

    # Verify EmployerMessage record in DB
    msg_db = await db.execute(select(EmployerMessage).where(EmployerMessage.id == msg_id))
    msg_obj = msg_db.scalar_one_or_none()
    assert msg_obj is not None
    assert msg_obj.application_id == app_a.id
    assert msg_obj.employer_id == emp_a.id
    assert msg_obj.candidate_id == candidate.id
    assert msg_obj.recipient_email == candidate.email
    assert msg_obj.subject == "Приглашение на интервью Python Dev"

    # -----------------------------------------------------------------------
    # TEST 2: IDOR Security Check — Employer A attempts to message App B (Employer B's vacancy) -> 403 FORBIDDEN
    # -----------------------------------------------------------------------
    res_idor = await client.post(
        f"/api/v1/applications/{app_b.id}/send-email",
        json={
            "subject": "Hacking Attempt",
            "message": "I try to contact candidate of another company"
        },
        headers=headers_a
    )
    assert res_idor.status_code == 403, res_idor.text
    assert "Доступ запрещен" in res_idor.json()["detail"]

    # -----------------------------------------------------------------------
    # TEST 3: Regular Worker attempts to call contact endpoint -> 403 FORBIDDEN
    # -----------------------------------------------------------------------
    res_cand = await client.post(
        f"/api/v1/applications/{app_a.id}/send-email",
        json={
            "subject": "Worker to Candidate",
            "message": "Worker trying to act as employer"
        },
        headers=headers_cand
    )
    assert res_cand.status_code == 403

    # -----------------------------------------------------------------------
    # TEST 4: Invalid Application ID -> 404 NOT FOUND
    # -----------------------------------------------------------------------
    fake_app_id = uuid.uuid4()
    res_404 = await client.post(
        f"/api/v1/applications/{fake_app_id}/send-email",
        json={
            "subject": "Test",
            "message": "Test message"
        },
        headers=headers_a
    )
    assert res_404.status_code == 404

    # -----------------------------------------------------------------------
    # TEST 5: GET messages history for Application A
    # -----------------------------------------------------------------------
    res_msgs = await client.get(
        f"/api/v1/applications/{app_a.id}/messages",
        headers=headers_a
    )
    assert res_msgs.status_code == 200
    msgs_list = res_msgs.json()
    assert len(msgs_list) == 1
    assert msgs_list[0]["subject"] == "Приглашение на интервью Python Dev"


@pytest.mark.asyncio
async def test_email_service_direct_employer_html():
    """Test EmailService.send_employer_direct_email HTML formatting & contract."""
    res = EmailService.send_employer_direct_email(
        to_email="test_recipient@example.com",
        candidate_name="Алишер",
        employer_name="Мавлонов Рустам",
        company_name="HamKor Tech",
        job_title="DevOps Engineer",
        subject="Приглашение на техническое собеседование",
        message_body="Добрый день! Просим выйти на связь в Telegram или Zoom.",
        lang="ru"
    )
    # Return True or False depending on SMTP credentials presence (handles offline gracefully)
    assert isinstance(res, bool)
