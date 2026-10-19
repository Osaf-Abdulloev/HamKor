import os
import dotenv
dotenv.load_dotenv()
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "HamKor Job Search Platform"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ergon_db"
    
    JWT_SECRET: str = "ergon_super_secret_jwt_key_2026_change_in_production_32bytes"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 43200  # 30 days (43200 minutes)
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 90     # 90 days
    FRONTEND_URL: str = "http://171.22.174.199:2212"
    
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = ""
    CELERY_RESULT_BACKEND: str = ""
    
    EMAIL_HOST: str = "smtp.gmail.com"
    EMAIL_PORT: int = 587
    EMAIL_USERNAME: str = ""
    EMAIL_USER: str = ""
    EMAIL_PASSWORD: str = ""
    EMAIL_FROM: str = ""
    
    SMTP_HOST: str = ""
    SMTP_PORT: int = 0
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM_EMAIL: str = ""
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    SMTP_SSL: bool = False

    @property
    def get_smtp_host(self) -> str:
        return self.SMTP_HOST or self.EMAIL_HOST or "smtp.gmail.com"

    @property
    def get_smtp_port(self) -> int:
        return self.SMTP_PORT or self.EMAIL_PORT or 587

    @property
    def get_smtp_user(self) -> str:
        return self.SMTP_USER or self.EMAIL_USERNAME or self.MAIL_USERNAME or self.EMAIL_USER or ""

    @property
    def get_smtp_password(self) -> str:
        return self.SMTP_PASSWORD or self.MAIL_PASSWORD or self.EMAIL_PASSWORD or ""

    @property
    def get_email_from(self) -> str:
        return self.EMAILS_FROM_EMAIL or self.EMAIL_FROM or self.get_smtp_user
    
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_BOT_USERNAME: str = "HamKorJobsBot"
    TELEGRAM_WEBHOOK_URL: str = ""
    TELEGRAM_SECRET_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""

    @property
    def get_telegram_bot_token(self) -> str:
        token = self.TELEGRAM_BOT_TOKEN
        if not token or len(token) < 10:
            if self.TELEGRAM_SECRET_TOKEN and ":" in self.TELEGRAM_SECRET_TOKEN:
                return self.TELEGRAM_SECRET_TOKEN
            return self.TELEGRAM_SECRET_TOKEN or ""
        return token
    
    FILE_STORAGE_PATH: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 10
    
    GROQ_API_KEY_1: str = ""
    GEMINI_API_KEY_1: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
