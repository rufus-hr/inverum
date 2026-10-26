"""
Scheduled ISO/IEC 27001:2022, NIS2 (ZKS), and GDPR Continuous Compliance Report Generator.

Automatically generates and PAdES-B-LTA signs periodic compliance reports
(daily, weekly, monthly, quarterly, yearly) for all active tenants.
"""
from __future__ import annotations

import logging

from app.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.tenant import Tenant
from app.services.reporting_service import COMPLIANCE_REPORT_CATALOG, generate_compliance_report

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.compliance_reports.run_scheduled_compliance_reports")
def run_scheduled_compliance_reports(schedule_freq: str = "monthly") -> dict[str, int]:
    db = SessionLocal()
    generated = 0
    errors = 0
    try:
        tenants = (
            db.query(Tenant)
            .filter(Tenant.is_active.is_(True), Tenant.deleted_at.is_(None))
            .all()
        )
        matching_specs = [
            r for r in COMPLIANCE_REPORT_CATALOG if r.get("schedule") == schedule_freq
        ]

        for tenant in tenants:
            for spec in matching_specs:
                try:
                    generate_compliance_report(
                        db=db,
                        tenant_id=tenant.id,
                        report_id=spec["id"],
                        output_format="PDF",
                    )
                    generated += 1
                except Exception as exc:
                    logger.warning(
                        "Failed scheduled compliance report %s for tenant %s: %s",
                        spec["id"],
                        tenant.id,
                        exc,
                    )
                    errors += 1
    finally:
        db.close()

    return {"schedule": schedule_freq, "generated": generated, "errors": errors}
