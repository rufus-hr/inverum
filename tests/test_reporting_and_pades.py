"""
Tests for Phase 3 (`T3.1`-`T3.6` Deterministic Reporting, Barcodes/QR, 16 ISO/NIS2 Reports & eIDAS PAdES-B-LTA / TSA Renewal).
"""
from __future__ import annotations

import unittest
import uuid
from unittest.mock import patch

from app.models.document_template import DocumentTemplate
from app.services.barcode_service import encode_code128b, generate_code128_svg, generate_qr_svg
from app.services.pades_signer import renew_pdf_lta_timestamp, sign_pdf_pades_lta
from app.services.reporting_service import (
    COMPLIANCE_REPORT_CATALOG,
    build_deterministic_pdf,
    compile_template_to_bytes,
    generate_compliance_report,
)
from tests.conftest import FakeTestingSession, create_test_tenant_and_admin


class TestReportingBarcodesAndPadesLta(unittest.TestCase):
    def setUp(self) -> None:
        self.db = FakeTestingSession()
        self.tenant, self.user, _ = create_test_tenant_and_admin(self.db)

    def test_barcode_and_qr_svg_deterministic_generation(self) -> None:
        codes = encode_code128b("INV-2026-0042")
        self.assertEqual(codes[0], 104)  # Start Code B
        self.assertEqual(codes[-1], 106)  # Stop Code

        barcode_svg = generate_code128_svg("INV-2026-0042", width_mm=48.0, height_mm=12.0)
        self.assertTrue(barcode_svg.startswith("<svg"))
        self.assertIn("INV-2026-0042", barcode_svg)
        self.assertIn("<rect", barcode_svg)

        qr_svg = generate_qr_svg("INVERUM:ASSET:INV-2026-0042", size_mm=22.0)
        self.assertTrue(qr_svg.startswith("<svg"))
        self.assertIn("<path", qr_svg)
        # Deterministic check: identical input yields byte-for-byte identical SVG
        self.assertEqual(qr_svg, generate_qr_svg("INVERUM:ASSET:INV-2026-0042", size_mm=22.0))

    def test_template_engines_svg_typst_and_html(self) -> None:
        context = {
            "asset_name": "Dell PowerEdge R760",
            "inventory_number": "INV-SRV-01",
            "serial_number": "SN-998877",
            "tenant_name": self.tenant.name,
            "barcode_svg": generate_code128_svg("INV-SRV-01"),
        }

        svg_tpl = DocumentTemplate(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            name="Sticker 62x29",
            template_type="sticker",
            engine="svg",
            content='<svg xmlns="http://www.w3.org/2000/svg"><text>{{ asset_name }}</text>{{ barcode_svg }}</svg>',
        )
        svg_bytes, svg_mime = compile_template_to_bytes(template=svg_tpl, context=context)
        self.assertEqual(svg_mime, "image/svg+xml")
        self.assertIn(b"Dell PowerEdge R760", svg_bytes)

        typst_tpl = DocumentTemplate(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            name="Handover Revers",
            template_type="handover",
            engine="typst",
            content="= Handover Revers\nAsset: {{ asset_name }} ({{ inventory_number }})",
        )
        pdf_bytes, pdf_mime = compile_template_to_bytes(template=typst_tpl, context=context)
        self.assertEqual(pdf_mime, "application/pdf")
        self.assertTrue(pdf_bytes.startswith(b"%PDF-"))

    @patch("app.services.reporting_service.store_document_in_minio", return_value="compliance-reports/test.pdf")
    def test_compliance_report_catalog_all_16_iso_nis2_gdpr_controls(self, _mock_minio) -> None:
        self.assertEqual(len(COMPLIANCE_REPORT_CATALOG), 16)

        # Verify PDF, CSV, and XLSX generation for ISO 27001 / NIS2 reports
        pdf_bytes, pdf_mime, pdf_fname, doc_rec = generate_compliance_report(
            db=self.db,
            tenant_id=self.tenant.id,
            report_id="iso_a5_9_roa",
            output_format="PDF",
        )
        self.assertEqual(pdf_mime, "application/pdf")
        self.assertTrue(pdf_fname.endswith(".pdf"))
        self.assertTrue(pdf_bytes.startswith(b"%PDF-"))
        self.assertIsNotNone(doc_rec)

        csv_bytes, csv_mime, csv_fname, _ = generate_compliance_report(
            db=self.db,
            tenant_id=self.tenant.id,
            report_id="iso_a5_19_supply_chain",
            output_format="CSV",
        )
        self.assertIn("text/csv", csv_mime)
        self.assertTrue(csv_fname.endswith(".csv"))
        self.assertTrue(len(csv_bytes) > 0)

        xlsx_bytes, xlsx_mime, xlsx_fname, _ = generate_compliance_report(
            db=self.db,
            tenant_id=self.tenant.id,
            report_id="iso_a8_14_bcp_spares",
            output_format="XLSX",
        )
        self.assertTrue(xlsx_fname.endswith(".xlsx"))
        self.assertTrue(len(xlsx_bytes) > 0)

    def test_pades_b_lta_signing_and_tsa_timestamp_renewal(self) -> None:
        raw_pdf = build_deterministic_pdf(
            title="TEST REVERS DOCUMENT",
            subtitle="ISO 27001 A.5.10",
            meta_lines=[("Tenant", self.tenant.name)],
            headers=["Col A", "Col B"],
            rows=[["Val 1", "Val 2"]],
        )
        signed = sign_pdf_pades_lta(
            pdf_bytes=raw_pdf,
            tenant_id=str(self.tenant.id),
            legal_entity_name=self.tenant.name,
            signer_name="Test Signer",
            reason="Unit Test PAdES-B-LTA",
        )
        self.assertTrue(signed.pdf_bytes.startswith(b"%PDF-"))
        self.assertEqual(len(signed.sha256_hash), 64)
        self.assertEqual(signed.timestamp_count, 1)
        self.assertGreater(signed.tsa_expires_at, signed.signed_at)

        # Simulate Celery archival timestamp renewal (`tsa_renewal.py`)
        renewed = renew_pdf_lta_timestamp(
            signed_pdf_bytes=signed.pdf_bytes,
            existing_timestamp_count=signed.timestamp_count,
        )
        self.assertEqual(renewed.timestamp_count, 2)
        self.assertNotEqual(renewed.sha256_hash, signed.sha256_hash)
        self.assertGreaterEqual(renewed.tsa_expires_at, signed.tsa_expires_at)


if __name__ == "__main__":
    unittest.main()
