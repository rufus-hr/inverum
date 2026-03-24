"""
FieldNormalizer — rule-based field value normalization.
Interface is AI-ready: normalize(field, value) -> NormalizedValue.
Future: plug in Ollama/external LLM as alternative implementation.
"""

from dataclasses import dataclass
from typing import Any


@dataclass
class NormalizedValue:
    value: Any           # parsed/cleaned value
    original: str        # original raw string
    confidence: float    # 1.0 = certain, <1.0 = guessed
    warning: str | None  # shown to user if confidence < 1.0


class FieldNormalizer:
    """
    Normalize raw CSV string values to typed Python values.
    Rules are per-field. Unknown fields pass through as-is.
    """

    def normalize(self, field: str, value: str) -> NormalizedValue:
        """
        Dispatch to per-field normalizer.
        Returns NormalizedValue with parsed result.
        """
        value = value.strip()
        method = self._dispatch.get(field)
        if method:
            return method(self, value)
        return NormalizedValue(value=value, original=value, confidence=1.0, warning=None)

    def _normalize_capacity(self, value: str) -> NormalizedValue:
        """
        16GB → 16, 16 GB → 16, 1TB → 1024, 512MB → 0 (rounds to 0 if < 1GB)
        Returns value in GB as int.
        """
        # TODO: implement with regex
        raise NotImplementedError

    def _normalize_date(self, value: str) -> NormalizedValue:
        """
        Try common date formats: DD.MM.YYYY, YYYY-MM-DD, MM/DD/YYYY
        Returns ISO 8601 string or raises with clear message.
        """
        # TODO: implement with dateutil.parser as fallback
        raise NotImplementedError

    def _normalize_oib(self, value: str) -> NormalizedValue:
        """
        Strip spaces/dashes, validate OIB checksum (ISO 7064 MOD 11,10).
        Returns 11-digit string or NormalizedValue with confidence=0.
        """
        # TODO: implement checksum algorithm
        raise NotImplementedError

    def _normalize_vatid(self, value: str) -> NormalizedValue:
        """
        VATID = "HR" + OIB. Strip prefix if present, validate underlying OIB.
        Returns canonical "HR{OIB}" format.
        """
        # TODO: implement — delegate OIB part to _normalize_oib
        raise NotImplementedError

    def _normalize_boolean(self, value: str) -> NormalizedValue:
        """da/ne/yes/no/true/false/1/0 → bool"""
        # TODO: implement
        raise NotImplementedError

    # Dispatch table — maps field name to normalizer method
    _dispatch: dict = {
        "ram": _normalize_capacity,
        "storage": _normalize_capacity,
        "purchase_date": _normalize_date,
        "warranty_expiry": _normalize_date,
        "oib": _normalize_oib,
        "vat_id": _normalize_vatid,
        "is_active": _normalize_boolean,
    }


normalizer = FieldNormalizer()
