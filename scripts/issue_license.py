#!/usr/bin/env python3
"""
Inverum Fair-Use Enterprise Offline License Issuer CLI (Ed25519 RFC 8032).

Usage:
  1. Generate a new offline Ed25519 keypair (saves private key to .inverum_ed25519_private.pem):
     venv/bin/python scripts/issue_license.py --generate-keys

  2. Issue a signed offline license key (INV-ENT-<payload_b64>.<sig_b64>):
     venv/bin/python scripts/issue_license.py \
       --customer "Hrvatska Pošta d.d." \
       --tier enterprise \
       --max-employees 10000 \
       --days 365
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from Crypto.PublicKey import ECC
from Crypto.Signature import eddsa

DEFAULT_PRIVATE_KEY_PATH = Path(".inverum_ed25519_private.pem")
# Deterministic fallback issuer seed used only when no local .inverum_ed25519_private.pem is present
DEFAULT_ISSUER_SEED = hashlib.sha256(b"inverum-sovereign-enterprise-issuer-v1").digest()


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def load_or_create_signing_key(key_path: Path, generate_new: bool = False) -> ECC.EccKey:
    if generate_new:
        key = ECC.generate(curve="Ed25519")
        key_path.write_text(key.export_key(format="PEM"), encoding="utf-8")
        os.chmod(key_path, 0o600)
        return key

    if key_path.exists():
        return ECC.import_key(key_path.read_text(encoding="utf-8"))

    return ECC.construct(curve="Ed25519", seed=DEFAULT_ISSUER_SEED)


def issue_license_token(
    *,
    customer: str,
    tier: str = "enterprise",
    max_employees: int = 1000,
    days_valid: int = 365,
    private_key: ECC.EccKey | None = None,
    issued_at: datetime | None = None,
    expires_at: datetime | None = None,
) -> str:
    if private_key is None:
        private_key = ECC.construct(curve="Ed25519", seed=DEFAULT_ISSUER_SEED)

    now = issued_at or datetime.now(timezone.utc)
    exp = expires_at or (now + timedelta(days=days_valid))

    payload = {
        "license_id": f"LIC-{str(uuid.uuid4())[:8].upper()}",
        "customer": customer.strip(),
        "tier": tier.strip().lower(),
        "max_employees": int(max_employees),
        "issued_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "expires_at": exp.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "issuer": "Inverum Sovereign Open-Core Authority (Ed25519)",
        "enforcement": "fair-use-advisory",
    }

    payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    signer = eddsa.new(private_key, "rfc8032")
    signature = signer.sign(payload_bytes)

    return f"INV-ENT-{_b64url_encode(payload_bytes)}.{_b64url_encode(signature)}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Inverum Offline Enterprise License Issuer (Ed25519)")
    parser.add_argument("--generate-keys", action="store_true", help="Generate a new Ed25519 keypair")
    parser.add_argument("--key-file", type=str, default=str(DEFAULT_PRIVATE_KEY_PATH), help="Path to Ed25519 private key PEM")
    parser.add_argument("--customer", type=str, default="Hrvatska Pošta d.d.", help="Customer legal entity name")
    parser.add_argument("--tier", type=str, default="enterprise", choices=["community", "professional", "enterprise", "msp", "gov"], help="License tier")
    parser.add_argument("--max-employees", type=int, default=10000, help="Maximum licensed active employees across all tenants")
    parser.add_argument("--days", type=int, default=365, help="Validity period in days")
    args = parser.parse_args()

    key_path = Path(args.key_file)
    if args.generate_keys:
        key = load_or_create_signing_key(key_path, generate_new=True)
        pub_pem = key.public_key().export_key(format="PEM")
        print(f"[OK] Private key written to: {key_path} (keep out of Git!)")
        print("\nEmbed this Ed25519 Public Key in app/core/licensing.py (or INVERUM_LICENSE_PUBLIC_KEY_PEM):")
        print(pub_pem)
        return 0

    key = load_or_create_signing_key(key_path, generate_new=False)
    token = issue_license_token(
        customer=args.customer,
        tier=args.tier,
        max_employees=args.max_employees,
        days_valid=args.days,
        private_key=key,
    )

    print("=" * 76)
    print("INVERUM ENTERPRISE OFFLINE LICENSE KEY (Ed25519 Signed)")
    print("=" * 76)
    print(f"Customer      : {args.customer}")
    print(f"Tier          : {args.tier.upper()}")
    print(f"Max Employees : {args.max_employees}")
    print(f"Validity      : {args.days} days")
    print("-" * 76)
    print(token)
    print("=" * 76)
    return 0


if __name__ == "__main__":
    sys.exit(main())
