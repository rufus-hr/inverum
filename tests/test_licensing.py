"""
Fair-Use Offline Enterprise Licensing Tests (`T6.2`).
Verifies Ed25519 RFC 8032 signature verification, tamper detection, expiration detection,
and soft-enforcement (`banner_required`) across employee seat counts.
"""
from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from app.core.licensing import (
    COMMUNITY_FREE_MAX_EMPLOYEES,
    get_system_license_status,
    save_system_license_key,
    verify_license_token,
)
from scripts.issue_license import issue_license_token
from tests.conftest import FakeTestingSession


class TestOfflineLicensing(unittest.TestCase):
    def test_ed25519_valid_license_token_verification(self) -> None:
        token = issue_license_token(
            customer="Končar d.d.",
            tier="enterprise",
            max_employees=2500,
            days_valid=365,
        )
        self.assertTrue(token.startswith("INV-ENT-"))
        verified = verify_license_token(token)
        self.assertTrue(verified["signature_valid"])
        self.assertFalse(verified["is_expired"])
        self.assertEqual(verified["customer"], "Končar d.d.")
        self.assertEqual(verified["tier"], "enterprise")
        self.assertEqual(verified["max_employees"], 2500)

    def test_tampered_payload_or_signature_rejected(self) -> None:
        token = issue_license_token(
            customer="Test Corp",
            tier="enterprise",
            max_employees=100,
            days_valid=365,
        )
        # Flip last character of signature
        tampered = token[:-2] + ("AA" if not token.endswith("AA") else "BB")
        with self.assertRaises(ValueError):
            verify_license_token(tampered)

    def test_expired_license_triggers_soft_advisory_banner(self) -> None:
        past_issue = datetime.now(timezone.utc) - timedelta(days=400)
        past_expiry = datetime.now(timezone.utc) - timedelta(days=35)
        expired_token = issue_license_token(
            customer="Expired Corp",
            tier="enterprise",
            max_employees=500,
            issued_at=past_issue,
            expires_at=past_expiry,
        )
        db = FakeTestingSession(active_employee_count_override=120)
        status = save_system_license_key(db, expired_token)
        self.assertTrue(status["signature_valid"])
        self.assertTrue(status["is_expired"])
        self.assertTrue(status["banner_required"])
        self.assertIn("expired", (status["banner_reason"] or "").lower())

    def test_community_tier_and_seat_exceeded_soft_enforcement(self) -> None:
        # 1. Under Community threshold (30 <= 50) -> no banner required
        db_small = FakeTestingSession(active_employee_count_override=30)
        st_small = get_system_license_status(db_small)
        self.assertEqual(st_small["tier"], "community")
        self.assertEqual(st_small["max_employees"], COMMUNITY_FREE_MAX_EMPLOYEES)
        self.assertFalse(st_small["banner_required"])

        # 2. Above Community threshold without license (120 > 50) -> banner_required = True
        db_large = FakeTestingSession(active_employee_count_override=120)
        st_large = get_system_license_status(db_large)
        self.assertTrue(st_large["banner_required"])

        # 3. Activate valid 500-seat Enterprise license -> banner_required becomes False
        valid_token = issue_license_token(
            customer="Hrvatska Pošta d.d.",
            tier="enterprise",
            max_employees=500,
            days_valid=365,
        )
        st_licensed = save_system_license_key(db_large, valid_token)
        self.assertTrue(st_licensed["is_licensed"])
        self.assertFalse(st_licensed["banner_required"])
        self.assertEqual(st_licensed["active_employees_count"], 120)
        self.assertEqual(st_licensed["max_employees"], 500)


if __name__ == "__main__":
    unittest.main()
