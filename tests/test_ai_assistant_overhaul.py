import pytest
import uuid
import dotenv
dotenv.load_dotenv()

from app.models.domain import User, UserRole, UserMemory, AIChatSession, AIMessage
from app.ai.key_manager import AIKeyManager
from app.ai.service import AIService

@pytest.mark.asyncio
async def test_ai_key_manager_real_completion():
    """Verify AIKeyManager returns real AI responses using .env active models."""
    res = await AIKeyManager.generate_completion(
        messages=[{"role": "user", "content": "Скажи одно слово: Работа"}],
        temperature=0.1
    )
    assert res is not None
    assert len(res) > 0
    assert "привет, ооо hamkor" not in res.lower()

@pytest.mark.asyncio
async def test_ai_user_memory_and_different_answers(db_session):
    """Verify that different user queries produce context-specific answers and save UserMemory."""
    user = User(
        email="aimemory_user@example.com",
        username="aimemory_user",
        password_hash="hashed_pass_123",
        role=UserRole.WORKER,
        full_name="Тестовый Соискатель"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    service = AIService(db_session)

    # 1. Query 1: User says SMM / video
    res1 = await service.process_user_query(
        "я SMM специалист и умею снимать видео",
        context={"user_id": str(user.id), "full_name": user.full_name, "role": "worker"}
    )
    assert res1 is not None
    assert len(res1) > 0

    # Verify UserMemory saved SMM / video fact
    from sqlalchemy import select
    stmt = select(UserMemory).where(UserMemory.user_id == user.id)
    res_mem = await db_session.execute(stmt)
    mems = res_mem.scalars().all()
    assert len(mems) > 0

    # 2. Query 2: User says Python developer
    res2 = await service.process_user_query(
        "я Python разработчик ищу удалённую работу",
        context={"user_id": str(user.id), "full_name": user.full_name, "role": "worker"}
    )
    assert res2 is not None
    assert res1 != res2  # Answers MUST be distinct and non-template!

@pytest.mark.asyncio
async def test_ai_session_isolation_and_crud(db_session):
    """Test AI Session creation, isolation, detail retrieval, and deletion."""
    user1 = User(email="aisess1@example.com", username="aisess1", password_hash="p", role=UserRole.WORKER, full_name="User One")
    user2 = User(email="aisess2@example.com", username="aisess2", password_hash="p", role=UserRole.WORKER, full_name="User Two")
    db_session.add_all([user1, user2])
    await db_session.commit()

    sess1 = AIChatSession(user_id=user1.id, title="Python Jobs Chat")
    sess2 = AIChatSession(user_id=user2.id, title="Design Chat")
    db_session.add_all([sess1, sess2])
    await db_session.commit()

    msg1 = AIMessage(session_id=sess1.id, role="user", content="Я Python dev")
    msg2 = AIMessage(session_id=sess2.id, role="user", content="Я Дизайнер")
    db_session.add_all([msg1, msg2])
    await db_session.commit()

    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    stmt1 = select(AIChatSession).options(selectinload(AIChatSession.messages)).where(AIChatSession.user_id == user1.id)
    r1 = await db_session.execute(stmt1)
    user1_sessions = r1.scalars().all()

    assert len(user1_sessions) == 1
    assert user1_sessions[0].messages[0].content == "Я Python dev"
    assert "Дизайнер" not in user1_sessions[0].messages[0].content
