"""
VendorEnricher — async enrichment of import records from external APIs.
Interface is AI-ready: enrich(record) -> EnrichedData.
Implementations: Lenovo, Dell, HRRegistry.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class EnrichedData:
    """
    Suggested values from external API.
    These are suggestions only — never overwrite user-provided data.
    Stored as ImportRecord.suggested_data.
    """
    source: str                        # "lenovo_api" | "dell_api" | "hr_registry"
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
    """Enrich assets with Lenovo API data using serial number."""

    def can_enrich(self, record: dict) -> bool:
        # TODO: check vendor == "Lenovo" (case-insensitive) and serial_number present
        raise NotImplementedError

    def enrich(self, record: dict) -> EnrichedData:
        # TODO: call Lenovo Warranty API
        # https://pcsupport.lenovo.com/us/en/api/v4/upsell/esupport/Warranty
        # Map response fields to Inverum fields: model, purchase_date, warranty_expiry
        raise NotImplementedError


class DellEnricher(VendorEnricher):
    """Enrich assets with Dell TechDirect API data using serial number."""

    def can_enrich(self, record: dict) -> bool:
        # TODO: check vendor == "Dell" and serial_number present
        raise NotImplementedError

    def enrich(self, record: dict) -> EnrichedData:
        # TODO: call Dell TechDirect Warranty API (requires API key)
        raise NotImplementedError


class HRRegistryEnricher(VendorEnricher):
    """Enrich vendors with Croatian business registry data using OIB."""

    def can_enrich(self, record: dict) -> bool:
        # TODO: check oib or vat_id present and looks like HR OIB
        raise NotImplementedError

    def enrich(self, record: dict) -> EnrichedData:
        # TODO: call FinReg / sudski registar API
        # Fields: company name, address, VAT status, registration number
        raise NotImplementedError


# Ordered list — first matching enricher wins
ENRICHERS: list[VendorEnricher] = [
    LenovoEnricher(),
    DellEnricher(),
    HRRegistryEnricher(),
]


def get_enricher(record: dict) -> VendorEnricher | None:
    """Return first enricher that can handle this record, or None."""
    for enricher in ENRICHERS:
        try:
            if enricher.can_enrich(record):
                return enricher
        except NotImplementedError:
            continue
    return None
