"""
Field alias maps for column mapping suggestions.
Language: English (Phase 1). Croatian + LLM fallback in Phase 2.

Structure:
  FIELD_ALIASES[entity_type][system_field] = [list of known aliases]

"system_field" must match the model field name or a known resolved field:
  - Direct fields: map to Asset/Location/Employee/Vendor column
  - Resolved fields: looked up or created as related records during import
    e.g. "location" → Location.name, "vendor" → Vendor.name

suggest_mapping() checks aliases first (exact after normalize),
then falls back to pg_trgm similarity for anything not in the map.
"""

FIELD_ALIASES: dict[str, dict[str, list[str]]] = {

    "asset": {
        # --- Direct fields ---
        "name": [
            "name", "asset name", "device name", "computer name",
            "hostname", "host name", "label",
        ],
        "serial_number": [
            "serial number", "serial no", "serial no.", "serial",
            "s/n", "sn", "serialnumber", "service tag",
        ],
        "purchase_date": [
            "purchase date", "buy date", "acquisition date",
            "bought", "date of purchase", "procurement date",
        ],
        "purchase_cost": [
            "purchase cost", "price", "cost", "purchase price",
            "value", "amount", "unit price",
        ],
        "purchase_currency": [
            "currency", "purchase currency", "ccy",
        ],
        "mobility_type": [
            "mobility", "mobility type", "assignment type",
            "usage type", "mobile",
        ],
        "notes": [
            "notes", "note", "comments", "comment",
            "remarks", "remark", "description", "info",
        ],

        # --- Resolved fields (looked up by name/value during import) ---
        "location": [
            "location", "office", "site", "building", "room",
            "floor", "place", "physical location", "loc",
        ],
        "organization": [
            "organization", "organisation", "department", "dept",
            "team", "division", "business unit", "unit", "group",
        ],
        "vendor": [
            "vendor", "supplier", "reseller", "sold by",
            "purchased from", "source",
        ],
        "manufacturer": [
            "manufacturer", "make", "brand", "mfr", "mfg",
            "made by",
        ],
        "model": [
            "model", "model name", "model number", "model no",
            "device model", "product", "product name",
        ],
        "assigned_to": [
            "assigned to", "user", "employee", "owner",
            "used by", "assigned user",
        ],

        # --- Spec/config fields (go into AssetConfiguration or custom_fields) ---
        "cpu": [
            "cpu", "processor", "processor type", "cpu type",
            "chip", "chipset",
        ],
        "ram": [
            "ram", "memory", "mem", "ram gb", "memory gb",
            "installed memory",
        ],
        "storage": [
            "storage", "disk", "hdd", "ssd", "drive",
            "hard drive", "hard disk", "capacity",
        ],
        "display_size": [
            "display", "screen", "screen size", "display size",
            "monitor", "inches",
        ],
        "os": [
            "os", "operating system", "platform",
            "installed os", "system",
        ],
        "warranty_expiry": [
            "warranty", "warranty expiry", "warranty end",
            "warranty until", "warranty expires", "support until",
            "end of support", "eos",
        ],
    },

    "location": {
        "name": [
            "name", "location name", "location", "site name",
            "building name", "room name", "place",
        ],
        "location_type": [
            "type", "location type", "kind",
        ],
        "address_street": [
            "street", "address", "street address", "addr",
        ],
        "address_city": [
            "city", "town", "municipality",
        ],
        "address_country": [
            "country", "country code", "cc",
        ],
        "parent": [
            "parent", "parent location", "belongs to",
            "part of", "floor", "building",
        ],
    },

    "employee": {
        "first_name": [
            "first name", "firstname", "given name", "first",
            "name",
        ],
        "last_name": [
            "last name", "lastname", "surname", "family name",
            "last",
        ],
        "email": [
            "email", "e-mail", "email address", "mail",
            "work email",
        ],
        "phone": [
            "phone", "telephone", "mobile", "phone number",
            "cell", "contact",
        ],
        "employee_number": [
            "employee number", "employee no", "employee id",
            "emp no", "emp id", "staff id", "personnel number",
        ],
        "employment_type": [
            "employment type", "contract type", "type",
            "employment", "contract",
        ],
        "organization": [
            "department", "dept", "team", "division",
            "organization", "unit", "group",
        ],
        "location": [
            "location", "office", "site", "workplace",
        ],
        "manager": [
            "manager", "reports to", "supervisor",
            "manager email", "line manager",
        ],
        "start_date": [
            "start date", "hire date", "joined", "employment start",
            "start",
        ],
        "end_date": [
            "end date", "termination date", "left", "last day",
        ],
    },

    "vendor": {
        "name": [
            "name", "vendor name", "company", "company name",
            "supplier name", "supplier",
        ],
        "oib": [
            "oib", "tax id", "tax number", "vat number",
            "company number", "registration number",
        ],
        "vat_id": [
            "vat id", "vat number", "vat", "eu vat",
            "vatid", "tax id",
        ],
        "email": [
            "email", "contact email", "e-mail",
        ],
        "phone": [
            "phone", "telephone", "contact phone",
        ],
        "website": [
            "website", "web", "url", "homepage",
        ],
        "contact_name": [
            "contact", "contact name", "contact person",
            "sales rep", "account manager",
        ],
        "vendor_type": [
            "type", "vendor type", "supplier type",
            "category",
        ],
    },
}


def normalize_header(raw: str) -> str:
    """
    Lowercase, strip whitespace, collapse multiple spaces, remove special chars
    except space and slash (S/N should survive as "s/n").
    """
    import re
    s = raw.lower().strip()
    s = re.sub(r"[^\w\s/]", " ", s)   # keep word chars, spaces, slash
    s = re.sub(r"\s+", " ", s).strip()
    return s


def suggest_mapping_from_aliases(
    headers: list[str],
    entity_type: str,
) -> dict[str, str | None]:
    """
    Check each header against alias map for entity_type.
    Returns {original_header: system_field | None}.
    None = not found in aliases, will fall back to pg_trgm in C1.
    """
    aliases = FIELD_ALIASES.get(entity_type, {})
    # Invert: alias → field
    alias_lookup: dict[str, str] = {}
    for field, alias_list in aliases.items():
        for alias in alias_list:
            alias_lookup[alias] = field

    result: dict[str, str | None] = {}
    for header in headers:
        normalized = normalize_header(header)
        result[header] = alias_lookup.get(normalized)

    return result
