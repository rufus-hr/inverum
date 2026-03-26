"""
Identifier validation for region-specific business identifiers.
Separate from FieldNormalizer — validation is cleaning + format check + checksum.
"""
from __future__ import annotations
import re
from dataclasses import dataclass


@dataclass
class ValidationResult:
    valid: bool
    value: str | None  # cleaned value if valid
    error: str | None


class IdentifierValidator:
    def validate(self, value: str, identifier_type: "RegionIdentifierType") -> ValidationResult:
        # 1. Strip whitespace, dashes, dots, spaces, parentheses
        cleaned = re.sub(r'[\s\-\.\(\)]', '', value).upper()

        # 2. Add/check prefix if exists
        if identifier_type.prefix and not cleaned.startswith(identifier_type.prefix):
            cleaned = identifier_type.prefix + cleaned

        # 3. Regex format validation
        if identifier_type.pattern:
            if not re.match(identifier_type.pattern, cleaned):
                return ValidationResult(valid=False, value=None, error="Invalid format")

        # 4. Checksum validation
        if identifier_type.checksum_method:
            if not self._check(cleaned, identifier_type.checksum_method, identifier_type.prefix):
                return ValidationResult(valid=False, value=None, error="Invalid checksum")

        return ValidationResult(valid=True, value=cleaned, error=None)

    def _check(self, value: str, method: str, prefix: str | None) -> bool:
        if method == "mod_11_10":
            return self._mod_11_10(value, prefix)
        # TODO: add "luhn" when needed
        return True

    def _mod_11_10(self, value: str, prefix: str | None) -> bool:
        """ISO 7064 MOD 11,10 — used for HR OIB."""
        # Strip prefix (e.g. "HR" from VAT ID) to get the numeric part
        digits = value[len(prefix):] if prefix and value.startswith(prefix) else value
        if not digits.isdigit() or len(digits) != 11:
            return False
        product = 10
        for digit in digits[:10]:
            product = ((product + int(digit)) % 10 or 10) * 2 % 11
        return (product + int(digits[10])) % 10 == 1
