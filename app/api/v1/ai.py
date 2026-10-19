import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database.session import get_db
from app.schemas.ai import AIRequest, AIResponse, ResumeAnalysisRequest, ProfileAnalysisRequest, ProfileAnalysisResponse
from app.schemas.common import MessageResponse
from app.ai.service import AIService
from app.ai.tools import AITools
from app.celery.tasks import ai_analysis_task
from app.auth.deps import get_current_user, get_current_user_optional
from app.models.domain import User, AIChatSession, AIMessage, AIGeneratedCV

router = APIRouter(prefix="/ai", tags=["AI Assistant"])

@router.post("/chat", response_model=AIResponse)
async def ai_chat(
    req: AIRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    service = AIService(db)
    context = {}
    if current_user:
        context = {
            "user_id": str(current_user.id),
            "email": current_user.email,
            "full_name": current_user.full_name,
            "role": current_user.role.value
        }
    if req.user_profile:
        context["user_profile"] = req.user_profile

    prompt_text = req.prompt or getattr(req, 'message', '') or ''

    # 1. Resolve AIChatSession
    session_obj = None
    if req.session_id:
        try:
            sid = uuid.UUID(req.session_id)
            stmt = select(AIChatSession).options(selectinload(AIChatSession.messages)).where(AIChatSession.id == sid)
            res = await db.execute(stmt)
            session_obj = res.scalar_one_or_none()
        except Exception:
            session_obj = None

    if not session_obj and current_user:
        stmt = (
            select(AIChatSession)
            .options(selectinload(AIChatSession.messages))
            .where(AIChatSession.user_id == current_user.id)
            .order_by(AIChatSession.updated_at.desc())
        )
        res = await db.execute(stmt)
        session_obj = res.scalars().first()

    if not session_obj:
        session_title = prompt_text[:40] if prompt_text else "Новый диалог"
        session_obj = AIChatSession(
            user_id=current_user.id if current_user else None,
            title=session_title
        )
        db.add(session_obj)
        await db.flush()

    # 2. Build history from PostgreSQL session messages if not provided by request
    history_payload = []
    if req.history or req.messages:
        raw_list = req.history or req.messages or []
        history_payload = [{"role": h.role, "content": h.content} for h in raw_list]
    elif session_obj and session_obj.id:
        stmt_msg = select(AIMessage).where(AIMessage.session_id == session_obj.id).order_by(AIMessage.created_at.desc()).limit(10)
        res_msg = await db.execute(stmt_msg)
        recent_msgs = list(reversed(res_msg.scalars().all()))
        history_payload = [{"role": m.role, "content": m.content} for m in recent_msgs]

    # 3. Process query via real AI service
    result_text = await service.process_user_query(
        prompt_text, 
        context=context,
        history=history_payload
    )

    # 4. Save messages to PostgreSQL
    if prompt_text:
        msg_user = AIMessage(
            session_id=session_obj.id,
            role="user",
            content=prompt_text
        )
        db.add(msg_user)

    msg_ai = AIMessage(
        session_id=session_obj.id,
        role="assistant",
        content=result_text
    )
    db.add(msg_ai)

    # Update session title if default
    if session_obj.title == "Новый диалог" and prompt_text:
        session_obj.title = prompt_text[:35]

    await db.commit()

    return AIResponse(result=result_text, session_id=str(session_obj.id))

@router.post("/sessions")
async def create_new_ai_session(
    title: Optional[str] = "Новый диалог",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    session_obj = AIChatSession(
        user_id=current_user.id,
        title=title or "Новый диалог"
    )
    db.add(session_obj)
    await db.commit()
    await db.refresh(session_obj)
    return {
        "id": str(session_obj.id),
        "title": session_obj.title,
        "created_at": session_obj.created_at,
        "messages_count": 0
    }

@router.delete("/sessions/{session_id}")
async def delete_ai_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(AIChatSession).where(AIChatSession.id == session_id, AIChatSession.user_id == current_user.id)
    res = await db.execute(stmt)
    session_obj = res.scalar_one_or_none()
    if not session_obj:
        raise HTTPException(status_code=404, detail="AI Session not found")

    await db.delete(session_obj)
    await db.commit()
    return MessageResponse(message="AI Session deleted successfully")

@router.get("/sessions")
async def get_my_ai_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(AIChatSession)
        .options(selectinload(AIChatSession.messages))
        .where(AIChatSession.user_id == current_user.id)
        .order_by(AIChatSession.updated_at.desc())
    )
    res = await db.execute(stmt)
    sessions = res.scalars().all()
    return [
        {
            "id": str(s.id),
            "title": s.title,
            "created_at": s.created_at,
            "messages_count": len(s.messages)
        }
        for s in sessions
    ]

@router.get("/sessions/{session_id}")
async def get_ai_session_detail(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(AIChatSession)
        .options(selectinload(AIChatSession.messages))
        .where(AIChatSession.id == session_id, AIChatSession.user_id == current_user.id)
    )
    res = await db.execute(stmt)
    session_obj = res.scalar_one_or_none()
    if not session_obj:
        raise HTTPException(status_code=404, detail="AI Session not found")

    return {
        "id": str(session_obj.id),
        "title": session_obj.title,
        "created_at": session_obj.created_at,
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at
            }
            for m in session_obj.messages
        ]
    }

@router.post("/generate-cv")
async def generate_ai_cv(
    req: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    prompt_text = req.get("prompt") or req.get("message") or "Составить резюме"
    user_details = req.get("user_details") or {}

    service = AIService(db)
    cv_prompt = f"Составь профессиональное резюме (CV) на основе данных: {prompt_text}. Детали: {user_details}"
    cv_result = await service.process_user_query(cv_prompt)

    # Persist Generated CV in PostgreSQL
    cv_obj = AIGeneratedCV(
        user_id=current_user.id,
        title=f"Резюме - {prompt_text[:30]}",
        prompt=prompt_text,
        cv_text=cv_result
    )
    db.add(cv_obj)
    await db.commit()
    await db.refresh(cv_obj)

    return {
        "id": str(cv_obj.id),
        "result": cv_result,
        "cv_text": cv_result,
        "created_at": cv_obj.created_at
    }

@router.get("/cvs")
async def get_my_generated_cvs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(AIGeneratedCV)
        .where(AIGeneratedCV.user_id == current_user.id)
        .order_by(AIGeneratedCV.created_at.desc())
    )
    res = await db.execute(stmt)
    cvs = res.scalars().all()
    return [
        {
            "id": str(c.id),
            "title": c.title,
            "prompt": c.prompt,
            "cv_text": c.cv_text,
            "created_at": c.created_at
        }
        for c in cvs
    ]

@router.post("/analyze-profile", response_model=ProfileAnalysisResponse)
async def analyze_candidate_profile(
    req: ProfileAnalysisRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    tools = AITools(db)
    user_prof = req.user_profile or {}
    if current_user and not user_prof:
        prof_res = await tools.get_user_profile(str(current_user.id))
        user_prof = prof_res.get("worker_profile") or {}
    
    analysis = await tools.analyze_candidate_profile(user_prof)
    return ProfileAnalysisResponse(**analysis)

@router.post("/analyze-resume", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED)
async def trigger_resume_analysis(
    req: ResumeAnalysisRequest,
    current_user: User = Depends(get_current_user)
):
    prompt_text = req.resume_text or f"Worker ID: {current_user.id}"
    ai_analysis_task.delay(str(current_user.id), prompt_text, "resume_analysis")
    return MessageResponse(message="Resume analysis task dispatched to background worker")
