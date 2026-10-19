import uuid
from typing import List, Callable, Optional
from datetime import datetime, timezone
from fastapi import Depends, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.models.domain import User
from app.models.enums import UserRole
from app.core.security import decode_token
from app.core.exceptions import UnauthorizedException, ForbiddenException, UnverifiedUserException
from app.repositories.user import UserRepository

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    token = credentials.credentials
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise UnauthorizedException("Invalid token type")
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise UnauthorizedException("Subject missing in token")
        user_id = uuid.UUID(user_id_str)
    except Exception:
        raise UnauthorizedException("Invalid or expired access token")

    user_repo = UserRepository(db)
    user = await user_repo.get_with_profile(user_id)
    if not user:
        raise UnauthorizedException("User no longer exists")
    if not user.is_active:
        raise UnauthorizedException("User account is inactive")
    if not user.is_email_verified:
        raise UnverifiedUserException("Email не подтверждён. Пожалуйста, введите код подтверждения.")

    return user

async def require_unmuted_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.is_muted or current_user.muted_until:
        now = datetime.now(timezone.utc)
        muted_until = current_user.muted_until
        if muted_until and muted_until.tzinfo is None:
            muted_until = muted_until.replace(tzinfo=timezone.utc)
        
        is_muted_now = current_user.is_muted or (muted_until and muted_until > now)
        if is_muted_now:
            reason = current_user.mute_reason or "Нарушение правил сообщества"
            until_str = muted_until.strftime("%d.%m.%Y %H:%M") if muted_until else "Бессрочно"
            raise ForbiddenException(f"Вы были замучены админом. Причина: {reason}. Срок: {until_str}")
    return current_user

async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ")[1]
    try:
        payload = decode_token(token)
        user_id_str = payload.get("sub")
        if not user_id_str:
            return None
        user_repo = UserRepository(db)
        return await user_repo.get_with_profile(uuid.UUID(user_id_str))
    except Exception:
        return None

def require_roles(allowed_roles: List[UserRole]) -> Callable:
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role_str = str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).lower()
        allowed_strs = [str(r.value if hasattr(r, 'value') else r).lower() for r in allowed_roles]
        if user_role_str not in allowed_strs and "admin" not in user_role_str:
            raise ForbiddenException(f"Action requires one of roles: {[r.value if hasattr(r, 'value') else r for r in allowed_roles]}")
        return current_user
    return role_checker

async def require_verified_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_email_verified:
        raise UnverifiedUserException("Email verification is required for this action")
    return current_user
