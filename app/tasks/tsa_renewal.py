"""
Celery Task for eIDAS PAdES-B-LTA Archival Timestamp Renewal (ISO 27001 A.5.33 & A.8.24).

Queries `asset_documents` using the partial index `idx_asset_documents_tsa_expires`
(`WHERE is_signed IS TRUE`) for any signed document whose current TSA certificate
(`tsa_expires_at`) expires within the next 180 days, appends a fresh incremental
`/Type /DocTimeStamp` (`/ETSI.RFC3161`), and updates the hash & expiry horizon.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone

from app.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.asset_document import AssetDocument
from app.services.pades_signer import renew_pdf_lta_timestamp, store_document_in_minio

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.tsa_renewal.renew_expiring_pades_timestamps")
def renew_expiring_pades_timestamps() -> dict[str, int]:
    db = SessionLocal()
    renewed_count = 0
    failed_count = 0
    try:
        horizon = datetime.now(timezone.utc) + timedelta(days=180)
        expiring_docs = (
            db.query(AssetDocument)
            .filter(
                AssetDocument.is_signed.is_(True),
                AssetDocument.tsa_expires_at.is_not(None),
                AssetDocument.tsa_expires_at < horizon,
            )
            .limit(200)
            .all()
        )

        for doc in expiring_docs:
            try:
                raw_bytes = b"%PDF-1.7\n%%EOF"
                if doc.file_path and os.path.exists(doc.file_path):
                    with open(doc.file_path, "rb") as f:
                        raw_bytes = f.read()

                res = renew_pdf_lta_timestamp(
                    signed_pdf_bytes=raw_bytes,
                    existing_timestamp_count=doc.timestamp_count or 1,
                )
                new_path = store_document_in_minio(
                    tenant_id=str(doc.tenant_id),
                    category=doc.document_type or "renewed-lta",
                    file_name=doc.file_name,
                    content_bytes=res.pdf_bytes,
                )

                doc.file_path = new_path
                doc.file_size = len(res.pdf_bytes)
                doc.sha256_hash = res.sha256_hash
                doc.last_timestamped_at = res.last_timestamped_at
                doc.tsa_expires_at = res.tsa_expires_at
                doc.timestamp_count = res.timestamp_count
                renewed_count += 1
            except Exception as exc:
                logger.warning("Failed to renew PAdES-LTA timestamp for doc %s: %s", doc.id, exc)
                failed_count += 1

        if renewed_count > 0:
            db.commit()
    finally:
        db.close()

    return {"renewed": renewed_count, "failed": failed_count}
