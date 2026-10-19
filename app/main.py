import os
import asyncio
import dotenv
dotenv.load_dotenv()

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.config import settings
from app.database.session import engine
from app.models.domain import Base
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.jobs import router as jobs_router
from app.api.v1.applications import router as applications_router
from app.api.v1.favorites import router as favorites_router
from app.api.v1.chat import router as chat_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.files import router as files_router
from app.api.v1.ai import router as ai_router
from app.api.v1.admin import router as admin_router
from app.api.v1.resumes import router as resumes_router
from app.api.v1.cv import router as cv_router
from app.api.v1.telegram import router as telegram_profile_router, webhook_router as telegram_webhook_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
            columns_to_add = [
                ("users", "full_name VARCHAR(255)"),
                ("users", "is_muted BOOLEAN DEFAULT 0"),
                ("users", "muted_until DATETIME"),
                ("users", "mute_reason TEXT"),
                ("users", "language VARCHAR(10) DEFAULT 'ru'"),
                ("users", "timezone VARCHAR(50) DEFAULT 'Asia/Dushanbe'"),
                ("users", "settings TEXT"),
                ("users", "last_login_at DATETIME"),
                ("applications", "cover_note TEXT"),
                ("applications", "employer_feedback TEXT"),
                ("applications", "rejection_reason VARCHAR(255)"),
                ("applications", "rating INTEGER"),
                ("applications", "is_read_by_employer BOOLEAN DEFAULT 0"),
                ("applications", "read_at DATETIME"),
                ("applications", "reviewed_at DATETIME"),
                ("applications", "cancelled_at DATETIME"),
                ("jobs", "requirements TEXT"),
                ("jobs", "tags TEXT"),
                ("jobs", "benefits TEXT"),
                ("jobs", "views_count INTEGER DEFAULT 0"),
                ("jobs", "experience VARCHAR(255)"),
                ("jobs", "is_top BOOLEAN DEFAULT 0"),
                ("favorites", "updated_at DATETIME"),
                ("jobs", "is_external BOOLEAN DEFAULT 0"),
                ("jobs", "external_source VARCHAR(100)"),
                ("jobs", "external_id VARCHAR(100)"),
                ("jobs", "external_url VARCHAR(512)"),
                ("jobs", "external_company_name VARCHAR(255)"),
                ("jobs", "external_company_logo VARCHAR(512)"),
                ("companies", "address VARCHAR(255)"),
                ("companies", "contact_email VARCHAR(255)"),
                ("companies", "contact_phone VARCHAR(50)"),
                ("companies", "employee_count VARCHAR(50)"),
                ("companies", "target_position VARCHAR(255)"),
                ("companies", "required_skills TEXT"),
                ("companies", "min_experience_years VARCHAR(50)"),
                ("companies", "offered_salary_min FLOAT"),
                ("companies", "offered_salary_max FLOAT"),
                ("worker_profiles", "relocation_preference VARCHAR(50)"),
                ("worker_profiles", "commute_preference VARCHAR(50)"),
                ("worker_profiles", "work_format VARCHAR(50)"),
                ("worker_profiles", "has_driving_license BOOLEAN DEFAULT 0"),
                ("worker_profiles", "driving_categories TEXT"),
                ("worker_profiles", "has_own_car BOOLEAN DEFAULT 0"),
                ("chats", "title VARCHAR(255)"),
                ("chats", "is_group BOOLEAN DEFAULT 0"),
                ("chats", "last_message_at DATETIME"),
                ("chat_participants", "joined_at DATETIME"),
                ("chat_participants", "last_read_at DATETIME"),
                ("messages", "is_edited BOOLEAN DEFAULT 0"),
                ("messages", "edited_at DATETIME"),
                ("messages", "is_deleted BOOLEAN DEFAULT 0"),
                ("messages", "client_msg_id VARCHAR(100)"),
                ("users", "telegram_chat_id VARCHAR(100)"),
                ("users", "telegram_username VARCHAR(100)"),
                ("users", "telegram_user_id VARCHAR(100)"),
                ("users", "telegram_is_verified BOOLEAN DEFAULT 0"),
                ("users", "telegram_linked_at DATETIME"),
                ("users", "telegram_link_code VARCHAR(100)"),
                ("users", "telegram_link_code_expires_at DATETIME"),
                ("users", "telegram_notifications_enabled BOOLEAN DEFAULT 1"),
                ("users", "telegram_last_message_at DATETIME"),
                ("users", "telegram_last_promotional_message_at DATETIME"),
                ("user_settings", "telegram_notifications_enabled BOOLEAN DEFAULT 1"),
                ("user_settings", "telegram_job_recommendations_enabled BOOLEAN DEFAULT 1"),
                ("user_settings", "telegram_messages_enabled BOOLEAN DEFAULT 1"),
                ("user_settings", "telegram_system_notifications_enabled BOOLEAN DEFAULT 1"),
                ("user_settings", "telegram_promotional_enabled BOOLEAN DEFAULT 1"),
                ("resumes", "source_cv_id CHAR(36)"),
                ("resumes", "is_default BOOLEAN DEFAULT 0"),
                ("resumes", "pinned_at DATETIME"),
                ("applications", "resume_id CHAR(36)"),
                ("email_verification_tokens", "attempts_count INTEGER DEFAULT 0"),
                ("email_verification_tokens", "last_sent_at DATETIME"),
                ("email_verification_tokens", "created_at DATETIME")
            ]
            
            for table, col_def in columns_to_add:
                col_name = col_def.split()[0]
                try:
                    async with engine.begin() as sub_conn:
                        if engine.dialect.name == "sqlite":
                            res = await sub_conn.execute(text(f"PRAGMA table_info({table});"))
                            existing_cols = [row[1] for row in res.fetchall()]
                            if col_name not in existing_cols:
                                await sub_conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_def};"))
                        else:
                            pg_col_def = (
                                col_def.replace("DATETIME", "TIMESTAMP WITH TIME ZONE")
                                .replace("BOOLEAN DEFAULT 0", "BOOLEAN DEFAULT false")
                                .replace("BOOLEAN DEFAULT 1", "BOOLEAN DEFAULT true")
                                .replace("CHAR(36)", "UUID")
                            )
                            await sub_conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {pg_col_def};"))
                except Exception as col_err:
                    pass

            
            if engine.dialect.name == "sqlite":
                try:
                    res = await conn.execute(text("PRAGMA table_info(jobs);"))
                    columns = res.fetchall()
                    company_col = next((c for c in columns if c[1] == "company_id"), None)
                    if company_col and company_col[3] == 1:
                        await conn.execute(text("PRAGMA foreign_keys=OFF;"))
                        await conn.execute(text("ALTER TABLE jobs RENAME TO jobs_old;"))
                        await conn.run_sync(Base.metadata.create_all)
                        old_cols = [c[1] for c in columns]
                        res_new = await conn.execute(text("PRAGMA table_info(jobs);"))
                        new_cols = [c[1] for c in res_new.fetchall()]
                        common_cols = [c for c in old_cols if c in new_cols]
                        cols_str = ", ".join(common_cols)
                        await conn.execute(text(f"INSERT INTO jobs ({cols_str}) SELECT {cols_str} FROM jobs_old;"))
                        await conn.execute(text("DROP TABLE jobs_old;"))
                        await conn.execute(text("PRAGMA foreign_keys=ON;"))
                except Exception:
                    pass
    except Exception as e:
        print(f"Startup DB init warning: {e}")

    # Seed Default Production Admin, Employer, and Worker Accounts on startup
    try:
        from app.database.session import AsyncSessionLocal
        from app.models.domain import User, WorkerProfile, Company
        from app.models.enums import UserRole
        from app.core.security import hash_password
        from sqlalchemy.future import select
        async with AsyncSessionLocal() as session:
            # 1. Admin
            res = await session.execute(select(User).where((User.email == "admin@hamkor.tj") | (User.username == "superadmin")))
            if not res.scalars().first():
                admin_user = User(
                    email="admin@hamkor.tj",
                    username="superadmin",
                    full_name="Главный Администратор",
                    password_hash=hash_password("SuperAdminPassword2026!"),
                    role=UserRole.ADMIN,
                    is_email_verified=True,
                    is_active=True
                )
                session.add(admin_user)
                try:
                    await session.commit()
                except Exception:
                    await session.rollback()
    except Exception as e:
        print(f"Startup seed warning: {e}")

    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

from fastapi.middleware.gzip import GZipMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(jobs_router, prefix=settings.API_V1_STR)
app.include_router(applications_router, prefix=settings.API_V1_STR)
app.include_router(favorites_router, prefix=settings.API_V1_STR)
app.include_router(chat_router, prefix=settings.API_V1_STR)
app.include_router(notifications_router, prefix=settings.API_V1_STR)
app.include_router(files_router, prefix=settings.API_V1_STR)
app.include_router(ai_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)
app.include_router(resumes_router, prefix=settings.API_V1_STR)
app.include_router(cv_router, prefix=settings.API_V1_STR)
app.include_router(telegram_profile_router, prefix=settings.API_V1_STR)
app.include_router(telegram_webhook_router, prefix=settings.API_V1_STR)

from fastapi import HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

@app.get("/health")
async def health_check():
    return {"status": "ok", "project": settings.PROJECT_NAME, "version": settings.VERSION}

frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path in ["docs", "redoc", "health", "openapi.json"]:
            raise HTTPException(status_code=404, detail="Not Found")
        file_path = os.path.join(frontend_dist, full_path)
        if full_path and os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))

