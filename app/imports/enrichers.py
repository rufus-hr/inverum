"""
VendorEnricher — async enrichment of import records from external APIs.
Interface is AI-ready: enrich(record) -> EnrichedData.
Implementations: Lenovo, Dell, HP.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
import base64
import logging
import re

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

_LENOVO_PRODUCTS_URL = "https://pcsupport.lenovo.com/us/en/api/v4/mse/getproducts"
_LENOVO_WARRANTY_URL = "https://pcsupport.lenovo.com/us/en/products/{product_id}/warranty"
_LENOVO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
    "Accept": "application/json, text/html",
}

_DELL_TOKEN_URL = "https://apigtwb2c.us.dell.com/auth/oauth/v2/token"
_DELL_WARRANTY_URL = "https://apigtwb2c.us.dell.com/PROD/sbil/eapi/v5/asset-entitlements"

_LENOVO_VENDOR_NAMES = {"lenovo", "ibm"}  # IBM ThinkPad legacy
_DELL_VENDOR_NAMES = {"dell", "dell emc"}
_HP_VENDOR_NAMES = {"hp", "hewlett-packard", "hewlett packard", "hpe"}


@dataclass
class EnrichedData:
    """
    Suggested values from external API.
    These are suggestions only — never overwrite user-provided data.
    Stored as ImportRecord.suggested_data.
    """
    source: str                        # "lenovo_api" | "dell_api" | "hp"
    suggestions: dict                  # {field: suggested_value}
    confidence: float                  # 0.0 - 1.0
    raw_response: dict = field(default_factory=dict)  # full API response for audit


class VendorEnricher(ABC):
    """
    Base interface for all enrichers.
    Each enricher is responsible for one data source.
    """

    @abstractmethod
    def can_enrich(self, record: dict) -> bool:
        """Return True if this enricher can handle the given record."""
        ...

    @abstractmethod
    def enrich(self, record: dict) -> EnrichedData:
        """
        Fetch data from external source and return suggestions.
        Must not raise — return EnrichedData with confidence=0.0 on failure.
        """
        ...


class LenovoEnricher(VendorEnricher):
    """
    Enrich Lenovo assets using the pcsupport.lenovo.com public API.
    No API key required. Uses serial number to look up model + warranty.

    Step 1: GET /api/v4/mse/getproducts?productId={serial} → product_id
    Step 2: GET /products/{product_id}/warranty → warranty JSON in HTML
    """

    def can_enrich(self, record: dict) -> bool:
        vendor = (record.get("vendor") or record.get("manufacturer") or "").lower().strip()
        serial = (record.get("serial_number") or "").strip()
        return vendor in _LENOVO_VENDOR_NAMES and bool(serial)

    def enrich(self, record: dict) -> EnrichedData:
        serial = record["serial_number"].strip()
        try:
            product_id = self._resolve_product_id(serial)
            if not product_id:
                return EnrichedData(source="lenovo_api", suggestions={}, confidence=0.0)

            warranty = self._fetch_warranty(product_id)
            suggestions = {}
            if warranty.get("Model"):
                suggestions["model"] = warranty["Model"]
            if warranty.get("Start"):
                suggestions["warranty_start"] = warranty["Start"]
            if warranty.get("End"):
                suggestions["warranty_end"] = warranty["End"]
            if warranty.get("Name"):
                suggestions["warranty_type"] = warranty["Name"]

            confidence = 0.9 if suggestions else 0.0
            return EnrichedData(
                source="lenovo_api",
                suggestions=suggestions,
                confidence=confidence,
                raw_response=warranty,
            )
        except Exception as e:
            logger.warning("LenovoEnricher failed for serial=%s: %s", serial, e)
            return EnrichedData(source="lenovo_api", suggestions={}, confidence=0.0)

    def _resolve_product_id(self, serial: str) -> str | None:
        resp = requests.get(
            _LENOVO_PRODUCTS_URL,
            params={"productId": serial},
            headers=_LENOVO_HEADERS,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        # Response: {"id": "...", "name": "...", ...} or list
        if isinstance(data, list) and data:
            return data[0].get("id")
        if isinstance(data, dict):
            return data.get("id")
        return None

    def _fetch_warranty(self, product_id: str) -> dict:
        url = _LENOVO_WARRANTY_URL.format(product_id=product_id)
        resp = requests.get(url, headers=_LENOVO_HEADERS, timeout=10)
        resp.raise_for_status()
        # Warranty data is embedded as JSON in a <script> block
        match = re.search(r'var warrantyData\s*=\s*(\{.*?\});', resp.text, re.DOTALL)
        if not match:
            return {}
        import json
        return json.loads(match.group(1))


class DellEnricher(VendorEnricher):
    """
    Enrich Dell assets using the TechDirect OAuth API.
    Requires DELL_API_KEY and DELL_API_SECRET in config.
    Register at: https://tdm.dell.com (free, API enrollment).

    Uses service tag (7-char alphanumeric) from serial_number field.
    """

    def can_enrich(self, record: dict) -> bool:
        if not settings.DELL_API_KEY or not settings.DELL_API_SECRET:
            return False
        vendor = (record.get("vendor") or record.get("manufacturer") or "").lower().strip()
        serial = (record.get("serial_number") or "").strip()
        # Dell service tags are 7 alphanumeric chars
        return vendor in _DELL_VENDOR_NAMES and bool(re.match(r'^[A-Z0-9]{7}$', serial, re.IGNORECASE))

    def enrich(self, record: dict) -> EnrichedData:
        serial = record["serial_number"].strip().upper()
        try:
            token = self._get_token()
            if not token:
                return EnrichedData(source="dell_api", suggestions={}, confidence=0.0)

            resp = requests.get(
                _DELL_WARRANTY_URL,
                params={"servicetags": serial},
                headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()

            if not data:
                return EnrichedData(source="dell_api", suggestions={}, confidence=0.0)

            asset = data[0] if isinstance(data, list) else data
            suggestions = {}
            if asset.get("productLineDescription"):
                suggestions["model"] = asset["productLineDescription"]
            if asset.get("shipDate"):
                suggestions["purchase_date"] = asset["shipDate"][:10]  # ISO date

            entitlements = asset.get("entitlements", [])
            if entitlements:
                # Pick the latest warranty end date
                ends = [e["endDate"][:10] for e in entitlements if e.get("endDate")]
                starts = [e["startDate"][:10] for e in entitlements if e.get("startDate")]
                if ends:
                    suggestions["warranty_end"] = max(ends)
                if starts:
                    suggestions["warranty_start"] = min(starts)
                # Primary warranty description
                primary = next((e for e in entitlements if e.get("entitlementType") == "INITIAL"), entitlements[0])
                if primary.get("serviceLevelDescription"):
                    suggestions["warranty_type"] = primary["serviceLevelDescription"]

            confidence = 0.9 if suggestions else 0.0
            return EnrichedData(
                source="dell_api",
                suggestions=suggestions,
                confidence=confidence,
                raw_response=asset,
            )
        except Exception as e:
            logger.warning("DellEnricher failed for serial=%s: %s", serial, e)
            return EnrichedData(source="dell_api", suggestions={}, confidence=0.0)

    def _get_token(self) -> str | None:
        credentials = base64.b64encode(
            f"{settings.DELL_API_KEY}:{settings.DELL_API_SECRET}".encode()
        ).decode()
        resp = requests.post(
            _DELL_TOKEN_URL,
            headers={"Authorization": f"Basic {credentials}"},
            data={"grant_type": "client_credentials"},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json().get("access_token")


class HPEnricher(VendorEnricher):
    """
    HP warranty lookup is not reliably available via public API as of 2025.
    HP's official endpoints require partner enrollment (warrantyapi.customers@hp.com).
    Unofficial endpoints return 403 due to Akamai bot protection.

    This enricher is a stub — returns confidence=0.0 until HP opens a public API.
    TODO: revisit when HP publishes a developer API.
    """

    def can_enrich(self, record: dict) -> bool:
        vendor = (record.get("vendor") or record.get("manufacturer") or "").lower().strip()
        serial = (record.get("serial_number") or "").strip()
        return vendor in _HP_VENDOR_NAMES and bool(serial)

    def enrich(self, record: dict) -> EnrichedData:
        logger.debug("HPEnricher: no public API available, skipping serial=%s", record.get("serial_number"))
        return EnrichedData(source="hp", suggestions={}, confidence=0.0)


# Ordered list — first matching enricher wins
ENRICHERS: list[VendorEnricher] = [
    LenovoEnricher(),
    DellEnricher(),
    HPEnricher(),
]


def get_enricher(record: dict) -> VendorEnricher | None:
    """Return first enricher that can handle this record, or None."""
    for enricher in ENRICHERS:
        if enricher.can_enrich(record):
            return enricher
    return None
