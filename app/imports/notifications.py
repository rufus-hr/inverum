"""
NotificationService — hooks for import lifecycle events.
All methods are no-ops for now. Interface is ready for Phase 2 (email/websocket/push).
"""


class NotificationService:
    def on_import_confirmed(self, job) -> None:
        """Called when an import job is confirmed and records are materialized."""
        # TODO Phase 2: send email summary, websocket event, push notification
        pass

    def on_import_failed(self, job, reason: str) -> None:
        """Called when a job transitions to failed status."""
        # TODO Phase 2: notify job creator
        pass

    def on_import_rolled_back(self, job) -> None:
        """Called after successful undo."""
        # TODO Phase 2: notify job creator
        pass


notifications = NotificationService()
