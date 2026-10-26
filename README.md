# Inverum — Sovereign Enterprise ITAM, Logistics & Regulatory Compliance Platform

[![License: AGPL v3 + Commercial](https://img.shields.io/badge/License-AGPLv3%20%2B%20Enterprise-blue.svg)](LICENSE)
[![Compliance: ISO/IEC 27001:2022](https://img.shields.io/badge/ISO%2FIEC%2027001%3A2022-Annex%20A-indigo.svg)](#regulatory-compliance--monthly-iso-27001--nis2-pack)
[![Compliance: EU NIS2 & GDPR](https://img.shields.io/badge/EU-NIS2%20%7C%20GDPR%20%7C%20eIDAS-emerald.svg)](#pades-b-lta-cryptographic-archival)
[![Air-Gapped Ready](https://img.shields.io/badge/Offline%20%2F%20Air--Gapped-100%25%20Ed25519-amber.svg)](#fair-use-offline-enterprise-licensing-ed25519)

**Inverum** (`cadastre-am`) is an air-gapped-ready, multi-tenant **IT Asset Management (ITAM), Physical Container & Rack Logistics, and Regulatory Evidence Platform** engineered for European enterprises, postal/logistics operators, critical infrastructure (NIS2), and Managed Service Providers (MSPs).

Unlike conventional asset trackers that stop at flat spreadsheets of serial numbers, Inverum enforces **physical container hierarchy in PostgreSQL (`Location → StorageUnit/Rack → Box → Asset`)**, automates **SOP sanitization & lifecycle checklists**, and compiles **deterministic, cryptographically signed (PAdES-B-LTA) handover protocols and monthly ISO 27001 / NIS2 compliance reports**.

---

## Core Architectural Pillars

### 1. Physical Hierarchy & $O(1)$ Container Cascades
Assets in the real world do not float in abstract lists—they sit inside sealed transport boxes (`Box`), which sit inside locked cabinets or 42U server racks (`StorageUnit`), which belong to hierarchical sites (`Location`).
- **Single-Parent Integrity:** Enforced via PostgreSQL constraints and recursive breadcrumb resolution (`Location → StorageUnit → Box → Asset`).
- **$O(1)$ Container Relocation:** Moving a sealed field box (`BOX-2026-001`) or storage rack from *NSC Zagreb* to *Logistics Center Split* automatically resolves the effective location of every asset inside it without manual per-item updates.
- **Physical Security Clearance Guardrails (`ISO 27001 A.7.1 / A.7.8`):** Placing an asset with a higher security classification (`security_level`) into a lower-tier cabinet or rack automatically triggers an audit event (`security_placement_violation`).

### 2. Distinct Serialized Assets vs. Bulk SKU Supplies
Inverum cleanly separates serialized capital equipment from bulk operational stock:
- **`Asset`:** Individually tracked hardware with unique serial/inventory numbers, warranties, maintenance schedules, work orders, and custodian assignments.
- **`Supply` & `StockItem` / `Consumable` / `Accessory`:** Catalog SKUs (SFP+ optics, toners, patch cords, spare drives) tracked by quantity across locations, racks, or field boxes with automated `below_minimum` BCP threshold alerts (`ISO 27001 A.8.14`) and an immutable `StockMovement` ledger (`purchase`, `usage`, `transfer`, `adjustment`, `wasted`).

### 3. Zero-UI-Editor Deterministic Reporting & Thermal Stickers
Inverum eliminates fragile WYSIWYG drag-and-drop editors in favor of version-controlled, deterministic templates (`DocumentTemplate`):
- **Thermal Barcode & QR Stickers (`.svg`):** Pure-Python zero-dependency **ISO/IEC 15417 Code128-B** and **ISO/IEC 18004 QR Code** inline SVG generation (`62×29mm` asset labels and `100×50mm` Chain-of-Custody box seals) ready for Zebra and Brother thermal printers.
- **Transactional Protocols (`.typ` / PDF 1.7):** Deterministic compilation of Equipment Handover / Return Protocols (*Zapisnik o zaduženju i razduženju opreme — Revers*), User A → User B Sanitization Certificates, and 4-Eyes NIST SP 800-88 Decommission Certificates.

### 4. PAdES-B-LTA Cryptographic Archival
Every generated handover protocol and compliance report is cryptographically sealed (`app/services/pades_signer.py`):
- **3-Tier PKI Flexibility:**
  1. *Out-of-the-Box Self-Signed Tenant CA* (zero-config cryptographic integrity & `SHA-256` verification),
  2. *Internal Enterprise PKI* (AD CS / EJBCA root pushed via GPO/Intune for instant green checkmarks across corporate endpoints),
  3. *Qualified eIDAS Seal / Signature* (FINA / AKD `.p12` + RFC 3161 TSA).
- **Automated LTA Timestamp Renewal (`app/tasks/tsa_renewal.py`):** A monthly Celery Beat job queries `idx_asset_documents_tsa_expires` for signed PDFs whose TSA certificate expires within 180 days and appends a fresh incremental `/Type /DocTimeStamp` (`/ETSI.RFC3161`) to preserve long-term non-repudiation for 10+ years.

---

## Regulatory Compliance & Monthly ISO 27001 / NIS2 Pack

Inverum ships out-of-the-box with **6 lifecycle SOP checklists** (Onboarding, User A → User B Reassignment Sanitization, Offboarding, External Vendor Repair, EOL Decommission with 4-Eyes, and Sealed Box Custody) and **16 automated Monthly/Periodic Compliance Reports**:

| # | Control Reference | Report Title | Default Cadence |
|---|---|---|---|
| 1 | **ISO A.5.9 & A.5.12** | Master Register of Information Assets, Ownership & Classification (*RoA*) | Monthly |
| 2 | **ISO A.5.10 & A.5.11** | Asset Handover, Return & Unsigned Revers Compliance | Monthly |
| 3 | **ISO A.5.13** | Asset Labelling, Barcode & Naming Schema Audit | Monthly |
| 4 | **ISO A.5.15 & A.5.18** | Access Rights, RBAC Roles & Security Clearance Review | Monthly |
| 5 | **ISO A.5.19–A.5.22 & NIS2 Art. 21.2(d)** | Supplier Security, SLA/MTTR Performance & Expiring Contracts | Monthly |
| 6 | **ISO A.5.24–A.5.28 & GDPR Art. 33/34** | Security Incidents, Lost/Stolen Assets & FDE Encryption Evidence | Monthly |
| 7 | **ISO A.6.5** | Offboarding & Unreturned Equipment from Terminated Employees | Monthly |
| 8 | **ISO A.7.1–A.7.8** | Physical Security Perimeters, Lockable Cabinets & Rack Capacity | Monthly |
| 9 | **ISO A.7.9 & A.7.10** | Off-Premises Equipment, External Repairs & Sealed Boxes in Transit | Weekly |
| 10 | **ISO A.7.13** | Preventive Maintenance Schedules, Calibrations & Overdue Work Orders | Monthly |
| 11 | **ISO A.7.14 & A.8.10** | User A → User B Sanitization & NIST 800-88 4-Eyes Disposal Register | Monthly |
| 12 | **ISO A.8.1 & A.8.24** | Endpoint Security Posture (FDE BitLocker/LUKS, MDM/EDR & SOP Status) | Monthly |
| 13 | **ISO A.8.8 & NIS2 Art. 21.2(e)** | Technical Lifecycle Vulnerabilities (EoL / EoS Hardware & Warranties) | Monthly |
| 14 | **ISO A.8.14 & NIS2 Art. 21.2(c)** | Critical Spares, BCP Redundancy & Minimum Stock Shortages | Weekly |
| 15 | **ISO A.8.15 & A.8.16** | Immutable Audit Log Extract & Privileged Administrative Actions | Monthly |
| 16 | **ISO A.8.24 (PKI)** | Cryptographic Keys, Certificates & PAdES-B-LTA Timestamp Horizon | Monthly |

---

## Fair-Use Offline Enterprise Licensing (Ed25519)

Inverum operates on a **100% air-gapped, zero-telemetry Fair-Use Enterprise model**:
- **Zero Phone-Home:** The backend never contacts external licensing servers. License keys (`INV-ENT-<payload_b64>.<sig_b64>`) are verified locally using an embedded **Ed25519 (RFC 8032)** public key (`app/core/licensing.py`).
- **Community Free Tier:** Deployments with up to **50 active employees** across all tenants run completely free without a license key.
- **Zero Feature Lockouts:** Exceeding licensed employee seats or running an expired key never blocks API calls, logins, or emergency operations—it only displays a non-intrusive `<UnlicensedEnterpriseBanner />` in the UI header.

Issue an offline license key via CLI:
```bash
venv/bin/python scripts/issue_license.py \
  --customer "Example Enterprise d.d." \
  --tier enterprise \
  --max-employees 2500 \
  --days 365
```

---

## Technology Stack

- **Backend:** Python 3.12+, FastAPI, SQLAlchemy 2.0, PostgreSQL 16+ (UUIDv7 primary keys, JSONB, recursive CTEs, partial indexes), Celery + Valkey/Redis, MinIO (S3-compatible document storage).
- **Cryptography & Reporting:** Ed25519 (RFC 8032), RSA-2048 / PKCS#1 v1.5 PAdES-B-LTA PDF 1.7 incremental signing & RFC 3161 `DocTimeStamp`, Typst & pure-Python SVG barcode/QR engine.
- **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS, Lucide Icons, Recharts.

---

## Quick Start

### 1. Backend Setup
```bash
python3 -m venv venv
venv/bin/pip install -r requirements.txt

# Start FastAPI server (auto-seeds system reference data & dev tenant on startup)
venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 3. Run Automated Tests
```bash
venv/bin/python -m unittest discover -s tests -v
npm --prefix frontend run lint && npm --prefix frontend run build
```

---

## License

Dual-licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0-only)** for open-source/community use and the **Inverum Commercial Enterprise License** for organizations requiring commercial distribution, air-gapped SLA support, or enterprise seat capacity. See [LICENSE](file:///home/ivan/projects/cadastre-am/LICENSE) and [CLA.md](file:///home/ivan/projects/cadastre-am/CLA.md) for details.
