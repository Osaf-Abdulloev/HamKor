from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "ergon_tasks",
    broker=settings.CELERY_BROKER_URL or settings.REDIS_URL,
    backend=settings.CELERY_RESULT_BACKEND or settings.REDIS_URL,
    include=["app.celery.tasks"]
)

celery_app.conf.update(
    # Explicit task imports
    imports=["app.celery.tasks"],

    # Serialization — JSON only, no pickle
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,

    # Reliability
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
    broker_connection_max_retries=5,

    # Default timeouts (overridable per-task)
    task_soft_time_limit=120,   # 2 min soft
    task_time_limit=180,        # 3 min hard

    # Default queue
    task_default_queue="default",

    # Task routing
    task_routes={
        "app.celery.tasks.send_email_task": {"queue": "notifications"},
        "app.celery.tasks.send_welcome_email_task": {"queue": "notifications"},
        "app.celery.tasks.send_verification_email_task": {"queue": "notifications"},
        "app.celery.tasks.send_application_status_email_task": {"queue": "notifications"},
        "app.celery.tasks.send_password_reset_email_task": {"queue": "notifications"},
        "app.celery.tasks.send_telegram_notification_task": {"queue": "notifications"},
        "app.celery.tasks.dispatch_notification_task": {"queue": "notifications"},
        "app.celery.tasks.ai_analysis_task": {"queue": "ai_tasks"},
        "app.celery.tasks.sync_yora_vacancies_task": {"queue": "scrapers"},
        "app.celery.tasks.sync_yora_candidates_task": {"queue": "scrapers"},
        "app.celery.tasks.sync_telegram_vacancies_task": {"queue": "scrapers"},
    },

    # Beat schedule — periodic tasks
    beat_schedule={
        "sync-yora-vacancies-hourly": {
            "task": "app.celery.tasks.sync_yora_vacancies_task",
            "schedule": 3600.0,
        },
        "sync-yora-candidates-hourly": {
            "task": "app.celery.tasks.sync_yora_candidates_task",
            "schedule": 3600.0,
        },
        "sync-telegram-vacancies-hourly": {
            "task": "app.celery.tasks.sync_telegram_vacancies_task",
            "schedule": 3600.0,
        },
        "send-telegram-job-recommendations-daily": {
            "task": "app.celery.tasks.send_periodic_telegram_recommendations_task",
            "schedule": 86400.0, # 24 hours
        },
    },
)
