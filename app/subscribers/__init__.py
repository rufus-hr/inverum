# Import all subscribers here so they register via @subscribe decorator
# when this package is imported by the Celery task.
from app.subscribers import checklist_subscriber  # noqa: F401
