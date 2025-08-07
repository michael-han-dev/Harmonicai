import os
from celery import Celery
from kombu import Queue

# Create Celery instance
celery_app = Celery(
    "harmonic_backend",
    broker=os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0"),
    include=["backend.tasks"]
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_ignore_result=False,
    task_queues=(
        Queue("interactive"),
        Queue("bulk"),
    ),
    task_default_queue="bulk",
)