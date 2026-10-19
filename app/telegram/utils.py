import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple


def normalize_telegram_username(raw_username: Optional[str]) -> Optional[str]:
    """
    Normalizes a Telegram username:
    - Strips leading '@'
    - Trims whitespace
    - Removes internal spaces
    - Returns None if empty
    - Validates 5 to 32 chars format
    """
    if not raw_username:
        return None

    cleaned = str(raw_username).strip()
    if cleaned.startswith("@"):
        cleaned = cleaned[1:]
    
    cleaned = re.sub(r"\s+", "", cleaned)

    if not cleaned:
        return None

    # Telegram username format: 5 to 32 characters, A-Z, a-z, 0-9, and underscores
    pattern = r"^[a-zA-Z0-9_]{5,32}$"
    if not re.match(pattern, cleaned):
        raise ValueError("Имя пользователя Telegram должно состоять из 5–32 символов (буквы, цифры, _).")

    return cleaned


def generate_telegram_linking_token(expires_in_minutes: int = 15) -> Tuple[str, datetime]:
    """
    Generates a cryptographically secure random token for Telegram deep linking.
    Returns (token_string, expiration_datetime).
    """
    random_part = secrets.token_urlsafe(16).replace("-", "").replace("_", "")[:16].upper()
    token = f"HK-{random_part}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes)
    return token, expires_at
