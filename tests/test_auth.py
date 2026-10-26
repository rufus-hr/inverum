"""
Authentication & Token Security Tests (`T6.2`).
Verifies JWT access/refresh token claims, password hashing, and deactivated user/tenant rejection.
"""
from __future__ import annotations

import unittest
import uuid
from unittest.mock import MagicMock, patch

import jwt
from fastapi import HTTPException

from app.core.config import settings
from app.core.security import ALGORITHM, create_access_token, create_refresh_token
from app.routers.auth import login
from app.schemas.auth import LoginRequest
from tests.conftest import FakeTestingSession, create_test_tenant_and_admin


class TestAuthentication(unittest.TestCase):
    def setUp(self) -> None:
        self.db = FakeTestingSession()
        self.tenant, self.user, self.identity = create_test_tenant_and_admin(self.db, password="CorrectHorseBatteryStaple!")

    def test_jwt_access_and_refresh_token_claims(self) -> None:
        access_tok = create_access_token(self.user.id, self.tenant.id)
        refresh_tok = create_refresh_token(self.user.id, self.tenant.id)

        access_payload = jwt.decode(access_tok, settings.SECRET_KEY, algorithms=[ALGORITHM])
        refresh_payload = jwt.decode(refresh_tok, settings.SECRET_KEY, algorithms=[ALGORITHM])

        self.assertEqual(access_payload["sub"], str(self.user.id))
        self.assertEqual(access_payload["tenant_id"], str(self.tenant.id))
        self.assertEqual(access_payload["type"], "access")

        self.assertEqual(refresh_payload["sub"], str(self.user.id))
        self.assertEqual(refresh_payload["tenant_id"], str(self.tenant.id))
        self.assertEqual(refresh_payload["type"], "refresh")

    @patch("app.routers.auth.client")
    def test_login_success_and_wrong_password_rejection(self, mock_valkey: MagicMock) -> None:
        mock_req = MagicMock()
        mock_req.client.host = "127.0.0.1"
        mock_req.headers = {"user-agent": "unittest"}

        # 1. Valid login succeeds
        res = login(
            LoginRequest(
                tenant_slug="hp-test",
                provider="local",
                provider_id="admin",
                password="CorrectHorseBatteryStaple!",
            ),
            mock_req,
            self.db,
        )
        self.assertTrue(res.access_token)
        self.assertTrue(res.refresh_token)
        mock_valkey.setex.assert_called_once()

        # 2. Wrong password raises 401
        with self.assertRaises(HTTPException) as ctx:
            login(
                LoginRequest(
                    tenant_slug="hp-test",
                    provider="local",
                    provider_id="admin",
                    password="WrongPassword123",
                ),
                mock_req,
                self.db,
            )
        self.assertEqual(ctx.exception.status_code, 401)

    def test_deactivated_tenant_rejected(self) -> None:
        # Remove active tenant from store to simulate deactivated/missing tenant
        self.db.store.clear()
        mock_req = MagicMock()
        mock_req.client.host = "127.0.0.1"
        mock_req.headers = {}

        with self.assertRaises(HTTPException) as ctx:
            login(
                LoginRequest(
                    tenant_slug="deactivated-tenant",
                    provider="local",
                    provider_id="admin",
                    password="CorrectHorseBatteryStaple!",
                ),
                mock_req,
                self.db,
            )
        self.assertEqual(ctx.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
