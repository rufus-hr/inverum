"""
Inverum system seed data — reference categories.
All entries: is_system=True, tenant_id=None (global defaults).
Tenants may add custom entries but cannot delete system ones.
"""

ASSET_STATUSES = [
    {
        "category": "asset_status",
        "code": "pending",
        "label": "Pending",
        "is_system": True,
        "display_order": 10,
        "metadata_": {"scoped_by_location": False},
    },
    {
        "category": "asset_status",
        "code": "in_stock",
        "label": "In Stock",
        "is_system": True,
        "display_order": 20,
        "metadata_": {"scoped_by_location": True},
    },
    {
        "category": "asset_status",
        "code": "active",
        "label": "Active",
        "is_system": True,
        "display_order": 30,
        "metadata_": {"scoped_by_location": True},
    },
    {
        "category": "asset_status",
        "code": "loaned",
        "label": "Loaned",
        "is_system": True,
        "display_order": 40,
        "metadata_": {"scoped_by_location": True},
    },
    {
        "category": "asset_status",
        "code": "in_service",
        "label": "In Service",
        "is_system": True,
        "display_order": 50,
        "metadata_": {"scoped_by_location": True},
    },
    {
        "category": "asset_status",
        "code": "retired",
        "label": "Retired",
        "is_system": True,
        "display_order": 60,
        "metadata_": {"scoped_by_location": True},
    },
    {
        "category": "asset_status",
        "code": "scrapped",
        "label": "Scrapped",
        "is_system": True,
        "display_order": 70,
        "metadata_": {"scoped_by_location": True},
    },
    {
        "category": "asset_status",
        "code": "stolen",
        "label": "Stolen",
        "is_system": True,
        "display_order": 80,
        "metadata_": {"scoped_by_location": False},
    },
    {
        "category": "asset_status",
        "code": "lost",
        "label": "Lost",
        "is_system": True,
        "display_order": 90,
        "metadata_": {"scoped_by_location": False},
    },
    {
        "category": "asset_status",
        "code": "import_pending",
        "label": "Import Pending",
        "is_system": True,
        "display_order": 100,
        "metadata_": {"scoped_by_location": False, "hidden_in_normal_queries": True},
    },
]

MOBILITY_PROFILES = [
    {
        "category": "mobility_profile",
        "code": "personal",
        "label": "Personal",
        "is_system": True,
        "display_order": 10,
        "metadata_": {"assignable_to": ["employee"]},
    },
    {
        "category": "mobility_profile",
        "code": "shared",
        "label": "Shared",
        "is_system": True,
        "display_order": 20,
        "metadata_": {"assignable_to": ["employee", "location"]},
    },
    {
        "category": "mobility_profile",
        "code": "workplace",
        "label": "Workplace",
        "is_system": True,
        "display_order": 30,
        "metadata_": {"assignable_to": ["location"]},
    },
    {
        "category": "mobility_profile",
        "code": "fixed",
        "label": "Fixed",
        "is_system": True,
        "display_order": 40,
        "metadata_": {"assignable_to": ["location"]},
    },
]

CLASSIFICATION_LEVELS = [
    {
        "category": "classification_level",
        "code": "public",
        "label": "Public",
        "is_system": True,
        "display_order": 10,
        "metadata_": {"level": 1},
    },
    {
        "category": "classification_level",
        "code": "internal",
        "label": "Internal",
        "is_system": True,
        "display_order": 20,
        "metadata_": {"level": 2},
    },
    {
        "category": "classification_level",
        "code": "restricted",
        "label": "Restricted",
        "is_system": True,
        "display_order": 30,
        "metadata_": {"level": 3},
    },
    {
        "category": "classification_level",
        "code": "confidential",
        "label": "Confidential",
        "is_system": True,
        "display_order": 40,
        "metadata_": {"level": 4},
    },
    {
        "category": "classification_level",
        "code": "critical",
        "label": "Critical",
        "is_system": True,
        "display_order": 50,
        "metadata_": {"level": 5},
    },
]

EMPLOYMENT_TYPES = [
    {
        "category": "employment_type",
        "code": "full_time",
        "label": "Full Time",
        "is_system": True,
        "display_order": 10,
        "metadata_": None,
    },
    {
        "category": "employment_type",
        "code": "part_time",
        "label": "Part Time",
        "is_system": True,
        "display_order": 20,
        "metadata_": None,
    },
    {
        "category": "employment_type",
        "code": "contractor",
        "label": "Contractor",
        "is_system": True,
        "display_order": 30,
        "metadata_": None,
    },
    {
        "category": "employment_type",
        "code": "intern",
        "label": "Intern",
        "is_system": True,
        "display_order": 40,
        "metadata_": None,
    },
    {
        "category": "employment_type",
        "code": "vendor",
        "label": "Vendor",
        "is_system": True,
        "display_order": 50,
        "metadata_": None,
    },
]

VENDOR_TYPES = [
    {
        "category": "vendor_type",
        "code": "manufacturer",
        "label": "Manufacturer",
        "is_system": True,
        "display_order": 10,
        "metadata_": None,
    },
    {
        "category": "vendor_type",
        "code": "reseller",
        "label": "Reseller",
        "is_system": True,
        "display_order": 20,
        "metadata_": None,
    },
    {
        "category": "vendor_type",
        "code": "service",
        "label": "Service",
        "is_system": True,
        "display_order": 30,
        "metadata_": None,
    },
    {
        "category": "vendor_type",
        "code": "distributor",
        "label": "Distributor",
        "is_system": True,
        "display_order": 40,
        "metadata_": None,
    },
]

LOCATION_TYPES = [
    {
        "category": "location_type",
        "code": "building",
        "label": "Building",
        "is_system": True,
        "display_order": 10,
        "metadata_": None,
    },
    {
        "category": "location_type",
        "code": "floor",
        "label": "Floor",
        "is_system": True,
        "display_order": 20,
        "metadata_": None,
    },
    {
        "category": "location_type",
        "code": "room",
        "label": "Room",
        "is_system": True,
        "display_order": 30,
        "metadata_": None,
    },
    {
        "category": "location_type",
        "code": "rack",
        "label": "Rack",
        "is_system": True,
        "display_order": 40,
        "metadata_": None,
    },
    {
        "category": "location_type",
        "code": "warehouse",
        "label": "Warehouse",
        "is_system": True,
        "display_order": 50,
        "metadata_": None,
    },
    {
        "category": "location_type",
        "code": "remote",
        "label": "Remote",
        "is_system": True,
        "display_order": 60,
        "metadata_": None,
    },
    {
        "category": "location_type",
        "code": "external",
        "label": "External",
        "is_system": True,
        "display_order": 70,
        "metadata_": None,
    },
]

ASSET_FIELDS = [
    # --- Compute / PC / Laptop / Server ---
    {
        "category": "asset_field",
        "code": "cpu",
        "label": "CPU",
        "is_system": True,
        "display_order": 10,
        "metadata_": {"asset_types": ["laptop", "desktop", "server", "workstation"]},
    },
    {
        "category": "asset_field",
        "code": "cpu_count",
        "label": "CPU Count",
        "is_system": True,
        "display_order": 11,
        "metadata_": {"asset_types": ["server"]},
    },
    {
        "category": "asset_field",
        "code": "ram",
        "label": "RAM",
        "is_system": True,
        "display_order": 20,
        "metadata_": {"asset_types": ["laptop", "desktop", "server", "workstation"], "unit": "GB"},
    },
    {
        "category": "asset_field",
        "code": "storage",
        "label": "Storage",
        "is_system": True,
        "display_order": 30,
        "metadata_": {"asset_types": ["laptop", "desktop", "server", "workstation"], "unit": "GB"},
    },
    {
        "category": "asset_field",
        "code": "os",
        "label": "Operating System",
        "is_system": True,
        "display_order": 40,
        "metadata_": {"asset_types": ["laptop", "desktop", "server", "workstation"]},
    },
    {
        "category": "asset_field",
        "code": "display_size",
        "label": "Display Size",
        "is_system": True,
        "display_order": 50,
        "metadata_": {"asset_types": ["laptop", "monitor"], "unit": "inch"},
    },

    # --- Network ---
    {
        "category": "asset_field",
        "code": "port_count",
        "label": "Port Count",
        "is_system": True,
        "display_order": 60,
        "metadata_": {"asset_types": ["switch", "patch_panel"]},
    },
    {
        "category": "asset_field",
        "code": "port_speed",
        "label": "Port Speed",
        "is_system": True,
        "display_order": 61,
        "metadata_": {"asset_types": ["switch"], "unit": "Gbps"},
    },
    {
        "category": "asset_field",
        "code": "uplink_count",
        "label": "Uplink Count",
        "is_system": True,
        "display_order": 62,
        "metadata_": {"asset_types": ["switch"]},
    },

    # --- Printer / Toner ---
    {
        "category": "asset_field",
        "code": "toner_black",
        "label": "Toner Black",
        "is_system": True,
        "display_order": 70,
        "metadata_": {"asset_types": ["printer"]},
    },
    {
        "category": "asset_field",
        "code": "toner_cyan",
        "label": "Toner Cyan",
        "is_system": True,
        "display_order": 71,
        "metadata_": {"asset_types": ["printer"]},
    },
    {
        "category": "asset_field",
        "code": "toner_magenta",
        "label": "Toner Magenta",
        "is_system": True,
        "display_order": 72,
        "metadata_": {"asset_types": ["printer"]},
    },
    {
        "category": "asset_field",
        "code": "toner_yellow",
        "label": "Toner Yellow",
        "is_system": True,
        "display_order": 73,
        "metadata_": {"asset_types": ["printer"]},
    },
    {
        "category": "asset_field",
        "code": "print_technology",
        "label": "Print Technology",
        "is_system": True,
        "display_order": 74,
        "metadata_": {"asset_types": ["printer"]},
    },

    # --- Power ---
    {
        "category": "asset_field",
        "code": "capacity_kva",
        "label": "Capacity (kVA)",
        "is_system": True,
        "display_order": 80,
        "metadata_": {"asset_types": ["ups", "pdu", "generator"], "unit": "kVA"},
    },
    {
        "category": "asset_field",
        "code": "battery_runtime",
        "label": "Battery Runtime",
        "is_system": True,
        "display_order": 81,
        "metadata_": {"asset_types": ["ups"], "unit": "min"},
    },

    # --- Universal ---
    {
        "category": "asset_field",
        "code": "mac_address",
        "label": "MAC Address",
        "is_system": True,
        "display_order": 90,
        "metadata_": {"asset_types": []},  # empty = applies to all
    },
    {
        "category": "asset_field",
        "code": "ip_address",
        "label": "IP Address",
        "is_system": True,
        "display_order": 91,
        "metadata_": {"asset_types": []},
    },
    {
        "category": "asset_field",
        "code": "firmware_version",
        "label": "Firmware Version",
        "is_system": True,
        "display_order": 92,
        "metadata_": {"asset_types": []},
    },
    {
        "category": "asset_field",
        "code": "color",
        "label": "Color",
        "is_system": True,
        "display_order": 93,
        "metadata_": {"asset_types": []},
    },
]

ASSET_RELATION_TYPES = [
    {"category": "asset_relation_type", "code": "owner",          "label": "Owner",           "is_system": True, "display_order": 10, "metadata_": None},
    {"category": "asset_relation_type", "code": "support",        "label": "Support",         "is_system": True, "display_order": 20, "metadata_": None},
    {"category": "asset_relation_type", "code": "responsible",    "label": "Responsible",     "is_system": True, "display_order": 30, "metadata_": None},
    {"category": "asset_relation_type", "code": "billing",        "label": "Billing",         "is_system": True, "display_order": 40, "metadata_": None},
    {"category": "asset_relation_type", "code": "maintenance",    "label": "Maintenance",     "is_system": True, "display_order": 50, "metadata_": None},
    {"category": "asset_relation_type", "code": "lease",          "label": "Lease",           "is_system": True, "display_order": 60, "metadata_": None},
    {"category": "asset_relation_type", "code": "insurance",      "label": "Insurance",       "is_system": True, "display_order": 70, "metadata_": None},
    {"category": "asset_relation_type", "code": "service_partner","label": "Service Partner", "is_system": True, "display_order": 80, "metadata_": None},
]

ALL_SYSTEM_SEEDS = (
    ASSET_STATUSES
    + MOBILITY_PROFILES
    + CLASSIFICATION_LEVELS
    + EMPLOYMENT_TYPES
    + VENDOR_TYPES
    + LOCATION_TYPES
    + ASSET_FIELDS
    + ASSET_RELATION_TYPES
)
