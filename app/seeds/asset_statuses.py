"""
Seed: asset_status reference data
These are system-locked statuses required by application logic.
Tenants may add custom statuses but cannot delete these.
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
]
