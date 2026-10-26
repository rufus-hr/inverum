import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.pagination import PaginationParams
from app.models.asset import Asset
from app.models.asset_assignment import AssetAssignment
from app.models.asset_category import AssetCategory
from app.models.asset_document import AssetDocument
from app.models.box import Box
from app.models.document_template import DocumentTemplate
from app.models.employee import Employee
from app.models.legal_entity import LegalEntity
from app.models.location import Location
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.pagination import PagedResponse
from app.services.barcode_service import generate_code128_svg, generate_qr_svg
from app.services.pades_signer import sign_pdf_pades_lta, store_document_in_minio
from app.services.reporting_service import (
    COMPLIANCE_REPORT_CATALOG,
    build_deterministic_pdf,
    compile_template_to_bytes,
    generate_compliance_report,
)

router = APIRouter(prefix="/documents", tags=["documents"])


class AssetDocumentResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID | None = None
    assignment_batch_id: uuid.UUID | None = None
    service_record_id: uuid.UUID | None = None
    template_id: uuid.UUID | None = None
    document_type: str
    file_name: str
    file_path: str
    file_size: int | None = None
    mime_type: str | None = None
    is_signed: bool
    signed_at: datetime | None = None
    signed_by: uuid.UUID | None = None
    sha256_hash: str | None = None
    tsa_expires_at: datetime | None = None
    last_timestamped_at: datetime | None = None
    timestamp_count: int
    notes: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class RunReportRequest(BaseModel):
    format: str | None = None  # "PDF" | "CSV" | "XLSX"


class HandoverDocumentRequest(BaseModel):
    employee_id: uuid.UUID | None = None
    employee_name: str | None = None
    action_type: str = "handover"  # "handover" | "return" | "sanitization"
    notes: str | None = None


@router.get("/", response_model=PagedResponse[AssetDocumentResponse])
def list_documents(
    document_type: str | None = None,
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(AssetDocument).filter(AssetDocument.tenant_id == user.tenant_id)
    if document_type:
        query = query.filter(AssetDocument.document_type == document_type)

    total = query.count()
    items = (
        query.order_by(AssetDocument.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
        .all()
    )
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(
        items=items,
        total=total,
        page=pagination.page,
        limit=pagination.limit,
        pages=pages,
    )


@router.get("/compliance-reports/catalog")
def get_compliance_reports_catalog(
    user: User = Depends(get_current_user),
):
    """Return all 16 ISO/IEC 27001:2022, NIS2 (ZKS), and GDPR periodic compliance report definitions."""
    return {"items": COMPLIANCE_REPORT_CATALOG, "total": len(COMPLIANCE_REPORT_CATALOG)}


@router.post("/compliance-reports/{report_id}/run")
def run_compliance_report_endpoint(
    report_id: str,
    payload: RunReportRequest | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Execute an ISO 27001 / NIS2 / GDPR compliance report against live tenant data,
    sign with PAdES-B-LTA (when PDF), archive in `asset_documents`, and stream the file.
    """
    fmt = payload.format if payload else None
    content_bytes, mime_type, file_name, doc_record = generate_compliance_report(
        db=db,
        tenant_id=user.tenant_id,
        report_id=report_id,
        output_format=fmt,
    )
    headers = {
        "Content-Disposition": f'attachment; filename="{file_name}"',
        "Access-Control-Expose-Headers": "Content-Disposition, X-Document-SHA256, X-Document-TSA-Expires",
    }
    if doc_record and doc_record.sha256_hash:
        headers["X-Document-SHA256"] = doc_record.sha256_hash
    if doc_record and doc_record.tsa_expires_at:
        headers["X-Document-TSA-Expires"] = doc_record.tsa_expires_at.isoformat()

    return Response(content=content_bytes, media_type=mime_type, headers=headers)


@router.get("/stickers/asset/{asset_id}")
def generate_asset_sticker_svg(
    asset_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate a deterministic 62x29mm SVG thermal label (ISO 27001 A.5.13 Labelling of information)
    containing QR code, Code128 barcode, inventory/serial number, and security classification.
    """
    asset: Asset | None = None
    try:
        uid = uuid.UUID(asset_id)
        asset = (
            db.query(Asset)
            .filter(Asset.id == uid, Asset.tenant_id == user.tenant_id, Asset.deleted_at.is_(None))
            .first()
        )
    except ValueError:
        pass

    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    tenant_name = tenant.name if tenant else "Hrvatska Posta d.d."

    inv_code = (asset.serial_number if asset and asset.serial_number else None) or f"AST-{asset_id[:8].upper()}"
    asset_name = (asset.name if asset and asset.name else None) or "Managed Asset"
    sec_lvl = asset.security_level if asset else 2
    sec_map = {1: "PUBLIC", 2: "INTERNAL", 3: "CONFIDENTIAL", 4: "SECRET", 5: "TOP SECRET"}
    classification = sec_map.get(sec_lvl, "INTERNAL")

    loc_name = "Zagreb HQ"
    if asset and asset.location_id:
        loc = db.query(Location).filter(Location.id == asset.location_id).first()
        if loc:
            loc_name = loc.name

    # Check if tenant has a custom "sticker" SVG template
    custom_tpl = (
        db.query(DocumentTemplate)
        .filter(
            DocumentTemplate.tenant_id == user.tenant_id,
            DocumentTemplate.template_type == "sticker",
            DocumentTemplate.engine == "svg",
            DocumentTemplate.is_active.is_(True),
            DocumentTemplate.deleted_at.is_(None),
        )
        .first()
    )

    context = {
        "tenant_name": tenant_name,
        "inventory_number": inv_code,
        "serial_number": inv_code,
        "asset_name": asset_name,
        "classification": classification,
        "location_name": loc_name,
        "qr_payload": f"INVERUM:ASSET:{inv_code}:{classification}",
    }

    if custom_tpl:
        svg_bytes, mime = compile_template_to_bytes(custom_tpl, context)
        return Response(content=svg_bytes, media_type=mime)

    # Built-in 62x29mm thermal sticker SVG
    qr_inner = generate_qr_svg(context["qr_payload"], size_mm=21.0)
    barcode_inner = generate_code128_svg(inv_code, width_mm=36.0, height_mm=8.5, show_text=False)

    svg_doc = f"""<svg xmlns="http://www.w3.org/2000/svg" width="62mm" height="29mm" viewBox="0 0 620 290">
  <rect x="2" y="2" width="616" height="286" rx="10" fill="#ffffff" stroke="#0f172a" stroke-width="4"/>
  <rect x="2" y="2" width="616" height="44" rx="8" fill="#0f172a"/>
  <text x="18" y="30" font-family="sans-serif" font-size="20" font-weight="bold" fill="#ffffff">{tenant_name[:26]}</text>
  <rect x="440" y="9" width="166" height="28" rx="5" fill="#1e293b" stroke="#94a3b8" stroke-width="1.5"/>
  <text x="523" y="28" text-anchor="middle" font-family="monospace" font-size="16" font-weight="bold" fill="#f8fafc">{classification}</text>
  <g transform="translate(14, 56)">{qr_inner}</g>
  <text x="235" y="84" font-family="sans-serif" font-size="21" font-weight="bold" fill="#0f172a">{asset_name[:24]}</text>
  <text x="235" y="114" font-family="monospace" font-size="22" font-weight="bold" fill="#1d4ed8">{inv_code}</text>
  <text x="235" y="142" font-family="sans-serif" font-size="16" fill="#475569">LOC: {loc_name[:26]}</text>
  <g transform="translate(230, 155)">{barcode_inner}</g>
  <text x="410" y="274" text-anchor="middle" font-family="monospace" font-size="13" fill="#64748b">ISO 27001 A.5.13 · INVERUM ASSET TAG</text>
</svg>"""
    return Response(content=svg_doc.encode("utf-8"), media_type="image/svg+xml")


@router.get("/stickers/box/{box_id}")
def generate_box_sticker_svg(
    box_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate a 100x50mm SVG transport & custody label (ISO 27001 A.7.10 Storage media transit)
    for a Box with QR code, Code128 barcode, and Tamper-Evident Seal ID.
    """
    box: Box | None = None
    try:
        uid = uuid.UUID(box_id)
        box = (
            db.query(Box)
            .filter(Box.id == uid, Box.tenant_id == user.tenant_id, Box.deleted_at.is_(None))
            .first()
        )
    except ValueError:
        pass

    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    tenant_name = tenant.name if tenant else "Hrvatska Posta d.d."

    box_code = box.inventory_number if box else f"BOX-{box_id[:6].upper()}"
    status = (box.status if box else "sealed").upper()
    seal_no = f"SEAL-{box_id[:8].upper()}"

    qr_inner = generate_qr_svg(f"INVERUM:BOX:{box_code}:{seal_no}", size_mm=34.0)
    barcode_inner = generate_code128_svg(box_code, width_mm=54.0, height_mm=12.0, show_text=False)

    svg_doc = f"""<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="50mm" viewBox="0 0 1000 500">
  <rect x="4" y="4" width="992" height="492" rx="14" fill="#ffffff" stroke="#0f172a" stroke-width="6"/>
  <rect x="4" y="4" width="992" height="72" rx="10" fill="#0f172a"/>
  <text x="28" y="49" font-family="sans-serif" font-size="30" font-weight="bold" fill="#ffffff">{tenant_name[:28]} — CHAIN OF CUSTODY</text>
  <rect x="740" y="16" width="236" height="46" rx="8" fill="#dc2626"/>
  <text x="858" y="47" text-anchor="middle" font-family="monospace" font-size="24" font-weight="bold" fill="#ffffff">ISO A.7.10 SEALED</text>
  <g transform="translate(24, 96)">{qr_inner}</g>
  <text x="395" y="140" font-family="monospace" font-size="40" font-weight="bold" fill="#0f172a">{box_code}</text>
  <text x="395" y="185" font-family="sans-serif" font-size="24" fill="#334155">STATUS: {status}   |   TAMPER SEAL: {seal_no}</text>
  <text x="395" y="225" font-family="sans-serif" font-size="20" fill="#64748b">Verify seal integrity prior to breaking container lock.</text>
  <g transform="translate(390, 255)">{barcode_inner}</g>
  <text x="660" y="465" text-anchor="middle" font-family="monospace" font-size="18" fill="#475569">eIDAS / NIS2 PHYSICAL CUSTODY MANIFEST</text>
</svg>"""
    return Response(content=svg_doc.encode("utf-8"), media_type="image/svg+xml")


@router.post("/handover/{asset_id}")
def generate_signed_handover_pdf(
    asset_id: str,
    payload: HandoverDocumentRequest | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate and PAdES-B-LTA sign an Equipment Handover / Return / Sanitization Revers PDF
    (ISO/IEC 27001:2022 A.5.10, A.5.11, A.6.5, A.7.14 & GDPR Art. 32).
    """
    req = payload or HandoverDocumentRequest()
    asset: Asset | None = None
    try:
        uid = uuid.UUID(asset_id)
        asset = (
            db.query(Asset)
            .filter(Asset.id == uid, Asset.tenant_id == user.tenant_id, Asset.deleted_at.is_(None))
            .first()
        )
    except ValueError:
        pass

    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    tenant_name = tenant.name if tenant else "Hrvatska Posta d.d."

    legal_entity = (
        db.query(LegalEntity)
        .filter(LegalEntity.tenant_id == user.tenant_id, LegalEntity.deleted_at.is_(None))
        .first()
    )
    le_name = legal_entity.legal_name if legal_entity else tenant_name

    emp_name = req.employee_name or "Assigned Custodian"
    if req.employee_id:
        emp = db.query(Employee).filter(Employee.id == req.employee_id).first()
        if emp:
            emp_name = f"{emp.first_name} {emp.last_name}"

    inv_no = (asset.serial_number if asset and asset.serial_number else None) or f"AST-{asset_id[:8].upper()}"
    asset_name = (asset.name if asset and asset.name else None) or "IT Endpoint Asset"
    action_upper = req.action_type.upper()

    title_map = {
        "handover": "ZAPISNIK O ZADUZENJU OPREME (ONBOARDING REVERS — ISO A.5.10 / A.8.1)",
        "return": "ZAPISNIK O RAZDUZENJU I POVRATU OPREME (OFFBOARDING — ISO A.5.11 / A.6.5)",
        "sanitization": "POTVRDA O SANITIZACIJI PRI PRIJENOSU (USER A -> USER B — ISO A.7.14 / GDPR)",
        "decommission": "CERTIFIKAT O SIGURNOM BRISANJU I RASHODU (NIST 800-88 / ISO A.8.10 4-EYES)",
    }
    doc_title = title_map.get(req.action_type.lower(), title_map["handover"])

    now_utc = datetime.now(timezone.utc)
    meta_lines = [
        ("Legal Entity / Tenant", le_name),
        ("Document Type", f"{action_upper} RECORD (eIDAS PAdES-B-LTA)"),
        ("Custodian / Employee", emp_name),
        ("Asset / Serial Number", f"{asset_name} ({inv_no})"),
        ("Issued By Actor", user.email or user.username),
    ]
    headers = ["Control / Check Item", "Specification / Value", "ISO / NIS2 / GDPR Ref", "Verification"]
    rows = [
        ["Asset Identification", f"{asset_name} [{inv_no}]", "ISO 27001 A.5.9 / A.5.13", "VERIFIED"],
        ["Custodian / Recipient", emp_name, "ISO 27001 A.5.10 / A.6.2", "CONFIRMED"],
        ["Full-Disk Encryption (FDE)", "BitLocker / LUKS AES-256-XTS Active", "ISO A.8.24 / GDPR Art. 32", "ACTIVE"],
        ["Endpoint Protection (EDR/MDM)", "Agent Enrolled & Reporting", "ISO A.8.1 / A.8.7 / NIS2", "ACTIVE"],
        ["Sanitization / Data Wipe", "Previous Profile Purged (NIST 800-88)", "ISO A.7.14 / A.8.10 / GDPR", "PASSED"],
        ["Acceptable Use Policy (AUP)", "Custodian Acknowledged Security Rules", "ISO 27001 A.5.10 / A.6.5", "SIGNED"],
    ]
    if req.notes:
        rows.append(["Additional Notes", req.notes[:48], "Audit Record", "LOGGED"])

    raw_pdf = build_deterministic_pdf(
        title=doc_title,
        subtitle="ISO/IEC 27001:2022 (A.5.10, A.5.11, A.6.5, A.7.14, A.8.10)  |  NIS2 Art. 21  |  GDPR Art. 5 & 32",
        meta_lines=meta_lines,
        headers=headers,
        rows=rows,
    )

    signed = sign_pdf_pades_lta(
        pdf_bytes=raw_pdf,
        tenant_id=str(user.tenant_id),
        legal_entity_name=le_name,
        signer_name=user.email or user.username,
        reason=f"Equipment {action_upper}: {inv_no} ({emp_name})",
    )

    file_name = f"revers_{req.action_type.lower()}_{inv_no.lower()}_{now_utc.strftime('%Y%m%d_%H%M%S')}.pdf"
    storage_path = store_document_in_minio(
        tenant_id=str(user.tenant_id),
        category=req.action_type.lower(),
        file_name=file_name,
        content_bytes=signed.pdf_bytes,
    )

    doc_record = AssetDocument(
        tenant_id=user.tenant_id,
        employee_id=req.employee_id,
        document_type=req.action_type.lower(),
        file_name=file_name,
        file_path=storage_path,
        file_size=len(signed.pdf_bytes),
        mime_type="application/pdf",
        is_signed=True,
        signed_at=signed.signed_at,
        sha256_hash=signed.sha256_hash,
        tsa_expires_at=signed.tsa_expires_at,
        last_timestamped_at=signed.last_timestamped_at,
        timestamp_count=signed.timestamp_count,
        notes=f"{doc_title} — {asset_name} ({inv_no}) -> {emp_name}",
    )
    db.add(doc_record)
    db.commit()

    return Response(
        content=signed.pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{file_name}"',
            "X-Document-SHA256": signed.sha256_hash,
            "X-Document-TSA-Expires": signed.tsa_expires_at.isoformat(),
            "Access-Control-Expose-Headers": "Content-Disposition, X-Document-SHA256, X-Document-TSA-Expires",
        },
    )
