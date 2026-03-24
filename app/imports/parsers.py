"""
CSV and Excel file parsers.
Both return the same ParseResult shape so callers don't care about format.
"""

from dataclasses import dataclass, field


@dataclass
class SheetInfo:
    name: str
    suggested_order: int  # lower = process first
    likely_entity_type: str | None  # asset | location | employee | vendor | None


@dataclass
class ParseResult:
    headers: list[str]
    preview_rows: list[dict]       # first 10 rows, {header: value}
    total_rows: int | None         # None if not determinable without full parse
    sheets: list[SheetInfo] = field(default_factory=list)  # Excel only


class CsvParser:
    """
    Parse CSV files with auto-delimiter detection.
    Priority: ; → , → \t
    """

    def parse(self, content: bytes, encoding: str = "utf-8") -> ParseResult:
        """
        Detect delimiter, parse headers and first 10 rows.
        Returns ParseResult.
        """
        # TODO: implement
        # Hints:
        #   - decode content with encoding, fallback to latin-1
        #   - try csv.Sniffer().sniff() on first 4KB
        #   - if Sniffer picks wrong delimiter, override with priority list
        #   - count consistent columns per row to validate delimiter choice
        raise NotImplementedError


class ExcelParser:
    """
    Parse .xlsx files with openpyxl.
    Detects multiple sheets and suggests processing order.
    """

    def parse(self, content: bytes, sheet_name: str | None = None) -> ParseResult:
        """
        If sheet_name given: parse that sheet only.
        If None: analyse all sheets, return SheetInfo list with suggested order.
        """
        # TODO: implement
        # Hints:
        #   - openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        #   - detect entity type per sheet from sheet name + column names
        #   - locations always get suggested_order=1
        #   - detect cross-sheet references: column looks like location_name/employee_name
        raise NotImplementedError

    def _detect_entity_type(self, sheet_name: str, headers: list[str]) -> str | None:
        """Guess entity type from sheet name and headers."""
        # TODO: implement keyword matching
        raise NotImplementedError

    def _detect_dependencies(self, headers: list[str], all_sheet_names: list[str]) -> list[str]:
        """Return sheet names that this sheet likely references."""
        # TODO: implement
        raise NotImplementedError
