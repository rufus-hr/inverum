import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.pagination import PaginationParams
from app.models.asset import Asset
from app.models.document_template import DocumentTemplate
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.pagination import PagedResponse
from app.services.barcode_service import generate_code128_svg, generate_qr_svg
from app.services.pades_signer import sign_pdf_pades_lta
from app.services.reporting_service import compile_template_to_bytes

router = APIRouter(prefix="/document-templates", tags=["document-templates"])

DEFAULT_SYSTEM_TEMPLATES = [
    (
        "sticker_62x29.svg — Termo naljepnica za imovinu (ISO A.5.13)",
        "sticker",
        "svg",
        False,
        """<svg xmlns="http://www.w3.org/2000/svg" width="62mm" height="29mm" viewBox="0 0 620 290">
  <rect x="2" y="2" width="616" height="286" rx="10" fill="#ffffff" stroke="#0f172a" stroke-width="4"/>
  <rect x="2" y="2" width="616" height="44" rx="8" fill="#0f172a"/>
  <text x="18" y="30" font-family="sans-serif" font-size="20" font-weight="bold" fill="#ffffff">{{ tenant_name }}</text>
  <text x="520" y="28" text-anchor="middle" font-family="monospace" font-size="16" font-weight="bold" fill="#f8fafc">{{ classification }}</text>
  <g transform="translate(14, 56)">{{ qrcode_svg }}</g>
  <text x="235" y="84" font-family="sans-serif" font-size="21" font-weight="bold" fill="#0f172a">{{ asset_name }}</text>
  <text x="235" y="114" font-family="monospace" font-size="22" font-weight="bold" fill="#1d4ed8">{{ inventory_number }}</text>
  <text x="235" y="142" font-family="sans-serif" font-size="16" fill="#475569">LOC: {{ location_name }}</text>
  <g transform="translate(230, 155)">{{ barcode_svg }}</g>
  <text x="410" y="274" text-anchor="middle" font-family="monospace" font-size="13" fill="#64748b">ISO 27001 A.5.13 · INVERUM ASSET TAG</text>
</svg>""",
    ),
    (
        "handover_revers_hr.typ — Zapisnik o primopredaji opreme (ISO A.5.10 / A.5.11)",
        "handover",
        "typst",
        True,
        """// ISO/IEC 27001:2022 A.5.10 & A.5.11 — Zapisnik o primopredaji informacijske imovine
= ZAPISNIK O PRIMOPREDAJI OPREME (REVERS)
*Organizacija:* {{ tenant_name }}
*Zaposlenik / Zadužitelj:* {{ employee_name }}
*Imovina:* {{ asset_name }} ({{ inventory_number }})
*Klasifikacija:* {{ classification }} | *Lokacija:* {{ location_name }}
*PAdES-B-LTA Kriptografski potpis:* Da (eIDAS / RFC 3161 TSA)
""",
    ),
    (
        "sanitization_reuse_cert.typ — Potvrda o sanitizaciji pri prijenosu (ISO A.7.14 / GDPR Čl. 5.1.f)",
        "return",
        "typst",
        True,
        """// ISO/IEC 27001:2022 A.7.14 & GDPR Art. 5(1)(f) — Equipment Re-use Sanitization Record
= POTVRDA O SANITIZACIJI UREĐAJA ZA PONOVNU UPOTREBU
*Imovina:* {{ asset_name }} ({{ inventory_number }})
*Metoda brisanja:* NIST SP 800-88 Clear / OS Re-image & FDE Key Rotation
*Status 4-Eyes potvrde:* Potvrđeno
""",
    ),
    (
        "decommission_destruction_cert.typ — Certifikat o brisanju i rashodu (ISO A.7.14 / A.8.10)",
        "work_order",
        "typst",
        True,
        """// ISO/IEC 27001:2022 A.7.14 & A.8.10 — Certificate of Data Destruction & Decommissioning
= CERTIFIKAT O SIGURNOM BRISANJU PODATAKA I RASHODU
*Imovina:* {{ asset_name }} ({{ inventory_number }})
*Standard:* NIST SP 800-88 Rev. 1 Purge / Destroy (4-Eyes Verified)
""",
    ),
    (
        "box_custody_manifest.typ — Chain of Custody & Tamper-Seal Manifest (ISO A.7.10)",
        "shipping_manifest",
        "typst",
        True,
        """// ISO/IEC 27001:2022 A.7.10 — Physical Storage Media Transport & Tamper-Seal Manifest
= TRANSPORTNI MANIFEST I LANAC NADZORA (CHAIN OF CUSTODY)
*Kutija:* {{ inventory_number }}
*Lokacija:* {{ location_name }}
""",
    ),
    (
        "inventory_audit_report.typ — Izvještaj inventure i usklađenosti (ISO A.5.9 / NIS2 Čl. 21)",
        "audit_report",
        "typst",
        True,
        """// ISO/IEC 27001:2022 A.5.9 & NIS2 Art. 21 — Register of Assets & Physical Inventory Audit
= IZVJEŠTAJ O INVENTURI I USKLAĐENOSTI IMOVINE
*Organizacija:* {{ tenant_name }}
*Lokacija:* {{ location_name }}
""",
    ),
]


def _ensure_default_templates(db: Session, tenant_id: uuid.UUID) -> None:
    count = (
        db.query(DocumentTemplate)
        .filter(DocumentTemplate.tenant_id == tenant_id, DocumentTemplate.deleted_at.is_(None))
        .count()
    )
    if count > 0:
        return
    for dname, dtype, dengine, req_sig, dcontent in DEFAULT_SYSTEM_TEMPLATES:
        db.add(
            DocumentTemplate(
                tenant_id=tenant_id,
                name=dname,
                template_type=dtype,
                engine=dengine,
                content=dcontent,
                requires_signature=req_sig,
                is_system=True,
                is_active=True,
            )
        )
    db.commit()


class DocumentTemplateCreate(BaseModel):
    name: str
    template_type: str = "audit_report"
    engine: str = "typst"  # "svg" | "typst" | "html"
    content: str
    requires_signature: bool = True
    is_active: bool = True


class DocumentTemplateUpdate(BaseModel):
    name: str | None = None
    template_type: str | None = None
    engine: str | None = None
    content: str | None = None
    requires_signature: bool | None = None
    is_active: bool | None = None


class DocumentTemplateResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    template_type: str
    engine: str
    content: str
    requires_signature: bool
    is_system: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=PagedResponse[DocumentTemplateResponse])
def list_document_templates(
    template_type: str | None = None,
    engine: str | None = None,
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_default_templates(db, user.tenant_id)
    query = db.query(DocumentTemplate).filter(
        DocumentTemplate.tenant_id == user.tenant_id,
        DocumentTemplate.deleted_at.is_(None),
    )
    if template_type:
        query = query.filter(DocumentTemplate.template_type == template_type)
    if engine:
        query = query.filter(DocumentTemplate.engine == engine)

    total = query.count()
    items = (
        query.order_by(DocumentTemplate.name)
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


@router.get("/{template_id}", response_model=DocumentTemplateResponse)
def get_document_template(
    template_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tpl = (
        db.query(DocumentTemplate)
        .filter(
            DocumentTemplate.id == template_id,
            DocumentTemplate.tenant_id == user.tenant_id,
            DocumentTemplate.deleted_at.is_(None),
        )
        .first()
    )
    if not tpl:
        raise HTTPException(status_code=404, detail="Document template not found")
    return tpl


@router.post("/", response_model=DocumentTemplateResponse, status_code=201)
def create_document_template(
    payload: DocumentTemplateCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tpl = DocumentTemplate(
        tenant_id=user.tenant_id,
        name=payload.name,
        template_type=payload.template_type,
        engine=payload.engine,
        content=payload.content,
        requires_signature=payload.requires_signature,
        is_system=False,
        is_active=payload.is_active,
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    return tpl


@router.put("/{template_id}", response_model=DocumentTemplateResponse)
def update_document_template(
    template_id: uuid.UUID,
    payload: DocumentTemplateUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tpl = (
        db.query(DocumentTemplate)
        .filter(
            DocumentTemplate.id == template_id,
            DocumentTemplate.tenant_id == user.tenant_id,
            DocumentTemplate.deleted_at.is_(None),
        )
        .first()
    )
    if not tpl:
        raise HTTPException(status_code=404, detail="Document template not found")

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(tpl, field, val)
    tpl.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(tpl)
    return tpl


@router.delete("/{template_id}", status_code=204)
def delete_document_template(
    template_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tpl = (
        db.query(DocumentTemplate)
        .filter(
            DocumentTemplate.id == template_id,
            DocumentTemplate.tenant_id == user.tenant_id,
            DocumentTemplate.deleted_at.is_(None),
        )
        .first()
    )
    if not tpl:
        raise HTTPException(status_code=404, detail="Document template not found")
    if tpl.is_system:
        raise HTTPException(status_code=400, detail="System document templates cannot be deleted")

    tpl.deleted_at = datetime.now(timezone.utc)
    db.commit()


@router.post("/{template_id}/preview")
def preview_document_template(
    template_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tpl = (
        db.query(DocumentTemplate)
        .filter(
            DocumentTemplate.id == template_id,
            DocumentTemplate.tenant_id == user.tenant_id,
            DocumentTemplate.deleted_at.is_(None),
        )
        .first()
    )
    if not tpl:
        raise HTTPException(status_code=404, detail="Document template not found")

    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    tenant_name = tenant.name if tenant else "Hrvatska Posta d.d."

    sample_asset = (
        db.query(Asset)
        .filter(Asset.tenant_id == user.tenant_id, Asset.deleted_at.is_(None))
        .first()
    )
    inv_no = (sample_asset.serial_number if sample_asset and sample_asset.serial_number else "INV-2026-0042")
    asset_name = (sample_asset.name if sample_asset and sample_asset.name else "Lenovo ThinkPad T14 Gen 4")

    qr_svg = generate_qr_svg(f"INVERUM:ASSET:{inv_no}:{asset_name}", size_mm=20.0)
    barcode_svg = generate_code128_svg(inv_no, width_mm=36.0, height_mm=10.0)

    context = {
        "tenant_name": tenant_name,
        "asset_name": asset_name,
        "inventory_number": inv_no,
        "serial_number": inv_no,
        "employee_name": user.display_name or user.email or "Ivan Horvat",
        "classification": "CONFIDENTIAL",
        "location_name": "HQ Zagreb · Server Room A",
        "qrcode_svg": qr_svg,
        "barcode_svg": barcode_svg,
    }

    raw_bytes, mime_type = compile_template_to_bytes(tpl, context)
    if mime_type == "application/pdf" and tpl.requires_signature:
        signed = sign_pdf_pades_lta(
            pdf_bytes=raw_bytes,
            tenant_id=str(user.tenant_id),
            legal_entity_name=tenant_name,
            signer_name=user.display_name or user.email or "System Preview",
            reason=f"Template Preview: {tpl.name}",
        )
        return Response(
            content=signed.pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'inline; filename="preview_{tpl.template_type}.pdf"',
                "X-Document-SHA256": signed.sha256_hash,
                "Access-Control-Expose-Headers": "Content-Disposition, X-Document-SHA256",
            },
        )

    return Response(
        content=raw_bytes,
        media_type=mime_type,
        headers={
            "Content-Disposition": f'inline; filename="preview_{tpl.template_type}.svg"',
        },
    )
