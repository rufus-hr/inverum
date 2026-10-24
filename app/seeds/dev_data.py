"""
Inverum ITAM — comprehensive dev seed data.

Creates realistic business data for the dev tenant:
500 employees, 1000 assets, hierarchical locations, vendors, etc.

Usage: called from run.py after tenant + admin user creation.
"""

import logging
import random
import uuid
from datetime import datetime, timezone, date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

import app.models  # ensures all models registered + mappers configured
from app.models.asset import Asset
from app.models.asset_assignment import AssetAssignment
from app.models.asset_category import AssetCategory
from app.models.asset_identifier import AssetIdentifier
from app.models.box import Box
from app.models.department import Department
from app.models.employee import Employee
from app.models.legal_entity import LegalEntity
from app.models.location import Location
from app.models.manufacturer import Manufacturer
from app.models.organizations import Organization
from app.models.reference_data import ReferenceData
from app.models.storage_unit import StorageUnit
from app.models.vendor import Vendor
from app.models.vendor_contact import VendorContact
from app.models.vendor_contract import VendorContract
from app.models.warranty import Warranty
from app.models.work_order import WorkOrder

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ref(db: Session, category: str, code: str) -> uuid.UUID | None:
    """Look up a reference_data UUID by category+code."""
    r = db.query(ReferenceData).filter_by(category=category, code=code).first()
    return r.id if r else None


def _rand_date(start_year: int, end_year: int) -> date:
    """Random date between Jan 1 start_year and Dec 31 end_year."""
    start = date(start_year, 1, 1)
    end = date(end_year, 12, 31)
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, delta))


def _rand_phone() -> str:
    """Croatian-style phone number."""
    prefix = random.choice(["091", "092", "095", "098", "099"])
    return f"+385 {prefix[1:]} {random.randint(100, 999)} {random.randint(1000, 9999)}"


def _serial(prefix: str, length: int = 10) -> str:
    """Random alphanumeric serial number."""
    chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    return prefix + "".join(random.choice(chars) for _ in range(length))


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def seed_dev_data(db: Session, tenant_id: uuid.UUID, admin_user_id: uuid.UUID) -> None:
    """Create all dev business data in FK dependency order."""
    random.seed(42)

    # -----------------------------------------------------------------------
    # PHASE 0: Reference Data Lookups
    # -----------------------------------------------------------------------
    loc_type = {
        code: _ref(db, "location_type", code)
        for code in ("building", "floor", "room", "rack", "warehouse")
    }
    asset_status = {
        code: _ref(db, "asset_status", code)
        for code in ("active", "in_stock", "in_service", "retired", "pending")
    }
    emp_type = {
        code: _ref(db, "employment_type", code)
        for code in ("full_time", "part_time", "contractor", "intern")
    }
    logger.info("Phase 0: reference data lookups complete")

    # -----------------------------------------------------------------------
    # PHASE 1: Manufacturers (8, global — no tenant_id)
    # -----------------------------------------------------------------------
    mfr_defs = [
        ("Dell", "dell", "https://dell.com", "https://dell.com/support", True),
        ("Lenovo", "lenovo", "https://lenovo.com", "https://support.lenovo.com", True),
        ("HP", "hp", "https://hp.com", "https://support.hp.com", False),
        ("Apple", "apple", "https://apple.com", "https://support.apple.com", False),
        ("Cisco", "cisco", "https://cisco.com", "https://cisco.com/support", False),
        ("Samsung", "samsung", "https://samsung.com", "https://samsung.com/support", False),
        ("Brother", "brother", "https://brother.com", "https://brother.com/support", False),
        ("APC", "apc", "https://apc.com", "https://apc.com/support", False),
    ]
    manufacturers = []
    for name, slug, website, support_url, api in mfr_defs:
        existing = db.query(Manufacturer).filter_by(slug=slug).first()
        if existing:
            manufacturers.append(existing)
            continue
        m = Manufacturer(
            id=uuid.uuid7(),
            name=name,
            slug=slug,
            website=website,
            support_url=support_url,
            api_supported=api,
            is_active=True,
        )
        manufacturers.append(m)
        db.add(m)
    db.flush()
    logger.info("Phase 1: created %d manufacturers", len(manufacturers))

    # -----------------------------------------------------------------------
    # PHASE 2: Legal Entities -> Organizations -> Departments
    # -----------------------------------------------------------------------
    le1 = LegalEntity(
        id=uuid.uuid7(),
        tenant_id=tenant_id,
        name="Hrvatska Pošta",
        legal_name="Hrvatska Pošta d.d.",
        address_street="Jurišićeva 13",
        address_city="Zagreb",
        address_zip="10000",
        address_country="HR",
        is_active=True,
    )
    le2 = LegalEntity(
        id=uuid.uuid7(),
        tenant_id=tenant_id,
        name="HP Logistika",
        legal_name="HP Logistika d.o.o.",
        address_street="Jankomir 33",
        address_city="Zagreb",
        address_zip="10090",
        address_country="HR",
        is_active=True,
    )
    db.add_all([le1, le2])
    db.flush()

    org1 = Organization(
        id=uuid.uuid7(),
        tenant_id=tenant_id,
        legal_entity_id=le1.id,
        name="Hrvatska Pošta",
        description="Poštanski i financijski servisi",
        is_active=True,
    )
    org2 = Organization(
        id=uuid.uuid7(),
        tenant_id=tenant_id,
        legal_entity_id=le2.id,
        name="HP Logistika",
        description="Logistika i dostava paketa",
        is_active=True,
    )
    db.add_all([org1, org2])
    db.flush()

    dept_defs_org1 = [
        ("IT", "IT", "Informatička tehnologija"),
        ("HR", "HR", "Ljudski resursi"),
        ("Financije", "FIN", "Financije i računovodstvo"),
        ("Prodaja", "PROD", "Prodaja i marketing"),
        ("Uprava", "UPR", "Uprava i administracija"),
    ]
    dept_defs_org2 = [
        ("IT Operacije", "IT-OP", "IT operacije i infrastruktura"),
        ("Logistika", "LOG", "Logistika i transport"),
        ("Skladište", "SKL", "Upravljanje skladištem"),
        ("Dostava", "DOST", "Dostava paketa"),
        ("Administracija", "ADM", "Administracija"),
    ]

    departments_org1 = []
    for name, code, desc in dept_defs_org1:
        d = Department(
            id=uuid.uuid7(),
            tenant_id=tenant_id,
            organization_id=org1.id,
            name=name,
            code=code,
            description=desc,
            is_active=True,
        )
        departments_org1.append(d)

    departments_org2 = []
    for name, code, desc in dept_defs_org2:
        d = Department(
            id=uuid.uuid7(),
            tenant_id=tenant_id,
            organization_id=org2.id,
            name=name,
            code=code,
            description=desc,
            is_active=True,
        )
        departments_org2.append(d)

    all_departments = departments_org1 + departments_org2
    db.add_all(all_departments)
    db.flush()
    logger.info("Phase 2: 2 legal entities, 2 orgs, %d departments", len(all_departments))

    # -----------------------------------------------------------------------
    # PHASE 3: Locations (50, hierarchical)
    # -----------------------------------------------------------------------
    all_locations: list[Location] = []
    server_rooms: list[Location] = []
    warehouses: list[Location] = []
    room_locations: list[Location] = []

    def _make_loc(**kwargs) -> Location:
        loc = Location(id=uuid.uuid7(), tenant_id=tenant_id, **kwargs)
        all_locations.append(loc)
        return loc

    # --- Zagreb HQ ---
    zgb_hq = _make_loc(
        organization_id=org1.id,
        name="Zagreb HQ",
        location_type_id=loc_type["building"],
        address_street="Jurišićeva 13",
        address_city="Zagreb",
        address_zip="10000",
        address_country="HR",
        is_active=True,
        is_stock_location=False,
    )
    db.add(zgb_hq)
    db.flush()

    for floor_num in range(1, 4):
        floor = _make_loc(
            organization_id=org1.id,
            parent_id=zgb_hq.id,
            name=f"Kat {floor_num}",
            location_type_id=loc_type["floor"],
            address_city="Zagreb",
            address_country="HR",
            is_active=True,
            is_stock_location=False,
        )
        db.add(floor)
        db.flush()

        room_names = [f"Ured {floor_num}01", f"Ured {floor_num}02", f"Sala {floor_num}01"]
        if floor_num == 1:
            room_names.append("Server soba")
        for rname in room_names:
            is_server = rname == "Server soba"
            room = _make_loc(
                organization_id=org1.id,
                parent_id=floor.id,
                name=rname,
                location_type_id=loc_type["room"],
                address_city="Zagreb",
                address_country="HR",
                is_active=True,
                is_stock_location=is_server,
            )
            db.add(room)
            db.flush()
            room_locations.append(room)
            if is_server:
                server_rooms.append(room)

    # --- Sortirnica Zagreb ---
    sort_zgb = _make_loc(
        organization_id=org2.id,
        name="Sortirnica Zagreb",
        location_type_id=loc_type["building"],
        address_street="Jankomir 33",
        address_city="Zagreb",
        address_zip="10090",
        address_country="HR",
        is_active=True,
        is_stock_location=False,
    )
    db.add(sort_zgb)
    db.flush()

    for floor_num in range(0, 2):
        fname = "Prizemlje" if floor_num == 0 else "Kat 1"
        floor = _make_loc(
            organization_id=org2.id,
            parent_id=sort_zgb.id,
            name=fname,
            location_type_id=loc_type["floor"],
            address_city="Zagreb",
            address_country="HR",
            is_active=True,
            is_stock_location=False,
        )
        db.add(floor)
        db.flush()

        rooms = [f"Ured S{floor_num + 1}01", f"Ured S{floor_num + 1}02"]
        if floor_num == 0:
            rooms.append("Skladište Jankomir")
        for rname in rooms:
            is_wh = "Skladište" in rname
            lt = loc_type["warehouse"] if is_wh else loc_type["room"]
            room = _make_loc(
                organization_id=org2.id,
                parent_id=floor.id,
                name=rname,
                location_type_id=lt,
                address_city="Zagreb",
                address_country="HR",
                is_active=True,
                is_stock_location=is_wh,
            )
            db.add(room)
            db.flush()
            room_locations.append(room)
            if is_wh:
                warehouses.append(room)

    # --- Split RC ---
    split_rc = _make_loc(
        organization_id=org1.id,
        name="Split RC",
        location_type_id=loc_type["building"],
        address_street="Put Firula 29",
        address_city="Split",
        address_zip="21000",
        address_country="HR",
        is_active=True,
        is_stock_location=False,
    )
    db.add(split_rc)
    db.flush()

    for floor_num in range(0, 2):
        fname = "Prizemlje" if floor_num == 0 else "Kat 1"
        floor = _make_loc(
            organization_id=org1.id,
            parent_id=split_rc.id,
            name=fname,
            location_type_id=loc_type["floor"],
            address_city="Split",
            address_country="HR",
            is_active=True,
            is_stock_location=False,
        )
        db.add(floor)
        db.flush()

        for r in range(1, 4):
            room = _make_loc(
                organization_id=org1.id,
                parent_id=floor.id,
                name=f"Ured SP{floor_num + 1}{r:02d}",
                location_type_id=loc_type["room"],
                address_city="Split",
                address_country="HR",
                is_active=True,
                is_stock_location=False,
            )
            db.add(room)
            db.flush()
            room_locations.append(room)

    # --- Rijeka RC ---
    ri_rc = _make_loc(
        organization_id=org1.id,
        name="Rijeka RC",
        location_type_id=loc_type["building"],
        address_street="Krešimirova 14",
        address_city="Rijeka",
        address_zip="51000",
        address_country="HR",
        is_active=True,
        is_stock_location=False,
    )
    db.add(ri_rc)
    db.flush()

    ri_floor = _make_loc(
        organization_id=org1.id,
        parent_id=ri_rc.id,
        name="Prizemlje",
        location_type_id=loc_type["floor"],
        address_city="Rijeka",
        address_country="HR",
        is_active=True,
        is_stock_location=False,
    )
    db.add(ri_floor)
    db.flush()

    for rname in ["Ured RI01", "Ured RI02", "Server soba Rijeka", "Skladište Rijeka"]:
        is_wh = "Skladište" in rname
        is_server = "Server soba" in rname
        lt = loc_type["warehouse"] if is_wh else loc_type["room"]
        room = _make_loc(
            organization_id=org1.id,
            parent_id=ri_floor.id,
            name=rname,
            location_type_id=lt,
            address_city="Rijeka",
            address_country="HR",
            is_active=True,
            is_stock_location=is_wh or is_server,
        )
        db.add(room)
        db.flush()
        room_locations.append(room)
        if is_server:
            server_rooms.append(room)
        if is_wh:
            warehouses.append(room)

    # --- Osijek RC ---
    os_rc = _make_loc(
        organization_id=org1.id,
        name="Osijek RC",
        location_type_id=loc_type["building"],
        address_street="Europska avenija 5",
        address_city="Osijek",
        address_zip="31000",
        address_country="HR",
        is_active=True,
        is_stock_location=False,
    )
    db.add(os_rc)
    db.flush()

    os_floor = _make_loc(
        organization_id=org1.id,
        parent_id=os_rc.id,
        name="Prizemlje",
        location_type_id=loc_type["floor"],
        address_city="Osijek",
        address_country="HR",
        is_active=True,
        is_stock_location=False,
    )
    db.add(os_floor)
    db.flush()

    for rname in ["Ured OS01", "Ured OS02", "Ured OS03"]:
        room = _make_loc(
            organization_id=org1.id,
            parent_id=os_floor.id,
            name=rname,
            location_type_id=loc_type["room"],
            address_city="Osijek",
            address_country="HR",
            is_active=True,
            is_stock_location=False,
        )
        db.add(room)
        db.flush()
        room_locations.append(room)

    logger.info("Phase 3: created %d locations (%d rooms, %d server rooms, %d warehouses)",
                len(all_locations), len(room_locations), len(server_rooms), len(warehouses))

    # -----------------------------------------------------------------------
    # PHASE 4: Storage Units (12)
    # -----------------------------------------------------------------------
    storage_units: list[StorageUnit] = []

    # 4 racks in server rooms (cycle if < 4 server rooms)
    for i in range(4):
        sr = server_rooms[i % len(server_rooms)]
        su = StorageUnit(
            id=uuid.uuid7(),
            tenant_id=tenant_id,
            location_id=sr.id,
            name=f"Rack {chr(65 + i)}",
            type="rack",
            security_level=3,
            is_lockable=True,
            capacity=42,
        )
        storage_units.append(su)

    # 4 cabinets in warehouses
    cabinets: list[StorageUnit] = []
    for i in range(4):
        wh = warehouses[i % len(warehouses)]
        su = StorageUnit(
            id=uuid.uuid7(),
            tenant_id=tenant_id,
            location_id=wh.id,
            name=f"Ormar {i + 1}",
            type="cabinet",
            security_level=2,
            is_lockable=True,
            capacity=20,
        )
        storage_units.append(su)
        cabinets.append(su)

    db.add_all(storage_units)
    db.flush()

    # 4 shelves as children of cabinets
    shelves: list[StorageUnit] = []
    for i in range(4):
        cab = cabinets[i % len(cabinets)]
        su = StorageUnit(
            id=uuid.uuid7(),
            tenant_id=tenant_id,
            location_id=cab.location_id,
            parent_storage_unit_id=cab.id,
            name=f"Polica {chr(65 + i)}",
            type="shelf",
            security_level=1,
            is_lockable=False,
            capacity=10,
        )
        shelves.append(su)
        storage_units.append(su)

    db.add_all(shelves)
    db.flush()
    logger.info("Phase 4: created %d storage units", len(storage_units))

    # -----------------------------------------------------------------------
    # PHASE 5: Vendors (18) + Contacts (45) + Contracts (10)
    # -----------------------------------------------------------------------
    vendor_defs = [
        ("Combis d.o.o.", ["reseller", "service"], "41762801493", "Zagreb", "https://combis.hr"),
        ("King ICT d.o.o.", ["reseller", "service"], "39498943721", "Zagreb", "https://king-ict.hr"),
        ("SPAN d.d.", ["reseller", "service"], "43988102747", "Zagreb", "https://span.eu"),
        ("Kodeks d.o.o.", ["reseller"], "96085946348", "Zagreb", "https://kodeks.hr"),
        ("Multicom d.o.o.", ["reseller", "distributor"], "23095675458", "Zagreb", "https://multicom.hr"),
        ("Micronic d.o.o.", ["reseller"], "78126734569", "Zagreb", "https://micronic.hr"),
        ("CROZ d.o.o.", ["service"], "62753455628", "Zagreb", "https://croz.net"),
        ("Infinum d.o.o.", ["service"], "31928474592", "Zagreb", "https://infinum.com"),
        ("Duplico d.o.o.", ["service"], "82674923157", "Zagreb", "https://duplico.hr"),
        ("HT d.d.", ["service"], "81793146560", "Zagreb", "https://t.ht.hr"),
        ("A1 Hrvatska d.o.o.", ["service"], "29524210204", "Zagreb", "https://a1.hr"),
        ("Iskon d.d.", ["service"], "42667462123", "Zagreb", "https://iskon.hr"),
        ("Verso Altima d.o.o.", ["reseller", "service"], "14785236974", "Zagreb", "https://verso.hr"),
        ("Prolink d.o.o.", ["reseller"], "36925814703", "Split", "https://prolink.hr"),
        ("CS Computer Systems d.o.o.", ["reseller", "service"], "85274136902", "Rijeka", "https://cs.hr"),
        ("Euracom d.o.o.", ["distributor"], "69301478526", "Zagreb", "https://euracom.hr"),
        ("Storm Computers d.o.o.", ["reseller"], "74185296324", "Zagreb", "https://storm.hr"),
        ("Links d.o.o.", ["reseller"], "52968314708", "Zagreb", "https://links.hr"),
    ]

    vendors: list[Vendor] = []
    for name, vtypes, oib, city, website in vendor_defs:
        v = Vendor(
            id=uuid.uuid7(),
            tenant_id=tenant_id,
            name=name,
            oib=oib,
            vendor_types=vtypes,
            address_city=city,
            address_country="HR",
            website=website,
            phone=_rand_phone(),
            is_active=True,
        )
        vendors.append(v)
    db.add_all(vendors)
    db.flush()

    # Contacts: 2-3 per vendor, first is_primary
    contact_first_names = [
        "Marko", "Ivan", "Ana", "Petra", "Tomislav", "Maja", "Hrvoje",
        "Jelena", "Davor", "Luka", "Nina", "Goran", "Ivana", "Sanja",
        "Darko", "Mirela", "Ante", "Vesna", "Mario", "Kristina",
    ]
    contact_last_names = [
        "Horvat", "Kovačević", "Babić", "Marić", "Jurić", "Novak",
        "Knežević", "Vuković", "Matić", "Tomić", "Perić", "Barić",
    ]
    roles = ["account_manager", "technical_support", "billing", "service"]

    vendor_contacts: list[VendorContact] = []
    for v in vendors:
        n_contacts = random.choice([2, 2, 3])
        for ci in range(n_contacts):
            fn = random.choice(contact_first_names)
            ln = random.choice(contact_last_names)
            domain = v.website.replace("https://", "") if v.website else "example.com"
            vc = VendorContact(
                id=uuid.uuid7(),
                tenant_id=tenant_id,
                vendor_id=v.id,
                name=f"{fn} {ln}",
                role=roles[ci % len(roles)],
                email=f"{fn.lower()}.{ln.lower()}@{domain}",
                phone=_rand_phone(),
                is_primary=(ci == 0),
            )
            vendor_contacts.append(vc)
    db.add_all(vendor_contacts)
    db.flush()

    # Contracts: 10
    contract_defs = [
        ("Godišnji support ugovor 2025", "support", 0),
        ("Godišnji support ugovor 2026", "support", 1),
        ("Okvirni ugovor nabava IT opreme", "procurement", 2),
        ("Maintenance ugovor serveri", "maintenance", 3),
        ("SLA ugovor mrežna oprema", "sla", 4),
        ("Ugovor o najmu printera", "lease", 5),
        ("Licencni ugovor Microsoft", "license", 6),
        ("Ugovor o servisu UPS-ova", "maintenance", 7),
        ("Ugovor telekomunikacije", "service", 9),
        ("Ugovor skladištenje opreme", "service", 10),
    ]
    vendor_contracts: list[VendorContract] = []
    for name, ctype, vi in contract_defs:
        vend = vendors[vi % len(vendors)]
        start = _rand_date(2024, 2025)
        vc = VendorContract(
            id=uuid.uuid7(),
            tenant_id=tenant_id,
            vendor_id=vend.id,
            name=name,
            contract_number=f"UG-{2024 + (vi % 3)}-{vi + 1:03d}",
            contract_type=ctype,
            start_date=start,
            end_date=start + timedelta(days=365),
            value=Decimal(str(random.randint(5000, 150000))),
            currency="EUR",
            is_active=True,
        )
        vendor_contracts.append(vc)
    db.add_all(vendor_contracts)
    db.flush()
    logger.info("Phase 5: %d vendors, %d contacts, %d contracts",
                len(vendors), len(vendor_contacts), len(vendor_contracts))

    # -----------------------------------------------------------------------
    # PHASE 6: Asset Categories (6 top-level + subcategories)
    # -----------------------------------------------------------------------
    cat_tree = {
        ("IT Infrastruktura", "server", 10): [
            ("Serveri", "server", 11),
            ("UPS", "zap", 12),
        ],
        ("Korisnički uređaji", "laptop", 20): [
            ("Prijenosna računala", "laptop", 21),
            ("Stolna računala", "monitor", 22),
            ("Tableti", "tablet", 23),
        ],
        ("Mreža", "network", 30): [
            ("Switchevi", "network", 31),
            ("Access pointovi", "wifi", 32),
            ("Routeri", "router", 33),
        ],
        ("Periferija", "printer", 40): [
            ("Monitori", "monitor", 41),
            ("Pisači", "printer", 42),
            ("Skeneri", "scan", 43),
        ],
        ("Mobilni uređaji", "smartphone", 50): [
            ("Mobiteli", "smartphone", 51),
            ("Tableti", "tablet-smartphone", 52),
        ],
    }

    top_categories: list[AssetCategory] = []
    sub_categories: list[AssetCategory] = []
    all_categories: list[AssetCategory] = []

    for (top_name, top_icon, top_order), subs in cat_tree.items():
        top = AssetCategory(
            id=uuid.uuid7(),
            tenant_id=tenant_id,
            name=top_name,
            icon=top_icon,
            sort_order=top_order,
            is_active=True,
        )
        top_categories.append(top)
        all_categories.append(top)
        db.add(top)
        db.flush()

        for sub_name, sub_icon, sub_order in subs:
            sub = AssetCategory(
                id=uuid.uuid7(),
                tenant_id=tenant_id,
                parent_id=top.id,
                name=sub_name,
                icon=sub_icon,
                sort_order=sub_order,
                is_active=True,
            )
            sub_categories.append(sub)
            all_categories.append(sub)

    db.add_all(sub_categories)
    db.flush()
    logger.info("Phase 6: %d categories (%d top, %d sub)",
                len(all_categories), len(top_categories), len(sub_categories))

    # Build category lookup by name for asset generation
    cat_by_name = {c.name: c for c in all_categories}

    # -----------------------------------------------------------------------
    # PHASE 7: Employees (500)
    # -----------------------------------------------------------------------
    male_names = [
        "Ivan", "Marko", "Luka", "Tomislav", "Hrvoje", "Ante", "Davor",
        "Mario", "Goran", "Josip", "Nikola", "Petar", "Matej", "Filip",
        "Darko", "Branko", "Stjepan", "Zdenko", "Robert", "Marin",
    ]
    female_names = [
        "Ana", "Maja", "Petra", "Jelena", "Ivana", "Sanja", "Mirela",
        "Kristina", "Nina", "Vesna", "Marina", "Tamara", "Lea", "Sara",
        "Katarina", "Martina", "Dijana", "Renata", "Lidija", "Ankica",
    ]
    surnames = [
        "Horvat", "Kovačević", "Babić", "Marić", "Jurić", "Novak",
        "Knežević", "Vuković", "Matić", "Tomić", "Perić", "Barić",
        "Šarić", "Blažević", "Pavlović", "Radić", "Filipović", "Kos",
        "Božić", "Vidović",
    ]
    job_titles = [
        "Sistemski administrator", "Mrežni inženjer", "Help desk tehničar",
        "Voditelj odjela", "Poštanski djelatnik", "Poslovni analitičar",
        "Programer", "DBA", "Tajnica", "Vozač", "Skladištar",
        "Računovođa", "Pravnik", "Direktor", "Zamjenik direktora",
    ]

    employees: list[Employee] = []
    used_emails: set[str] = set()

    for i in range(500):
        is_org1 = i < 350
        org = org1 if is_org1 else org2
        depts = departments_org1 if is_org1 else departments_org2

        is_male = random.random() < 0.5
        fn = random.choice(male_names if is_male else female_names)
        ln = random.choice(surnames)

        # Ensure unique email
        base_email = f"{fn.lower()}.{ln.lower()}@hposta.hr"
        email = base_email
        suffix = 2
        while email in used_emails:
            email = f"{fn.lower()}.{ln.lower()}{suffix}@hposta.hr"
            suffix += 1
        used_emails.add(email)

        emp_types = ["full_time"] * 70 + ["part_time"] * 15 + ["contractor"] * 10 + ["intern"] * 5
        etype = random.choice(emp_types)

        is_active = random.random() < 0.95
        pebcak = 0
        tags = None
        if random.random() < 0.06:
            pebcak = random.randint(1, 8)
            if pebcak > 5:
                tags = ["PEBCAK"]
            elif pebcak > 3:
                tags = ["handle_with_care"]

        emp = Employee(
            id=uuid.uuid7(),
            tenant_id=tenant_id,
            organization_id=org.id,
            department_id=random.choice(depts).id,
            first_name=fn,
            last_name=ln,
            email=email,
            phone=_rand_phone() if random.random() < 0.8 else None,
            employee_number=f"HP-{i + 1:04d}",
            job_title=random.choice(job_titles),
            employment_type=etype,
            default_location_id=random.choice(room_locations).id if room_locations else None,
            start_date=_rand_date(2018, 2026),
            is_active=is_active,
            pebcak_score=pebcak,
            internal_tags=tags,
        )
        employees.append(emp)

    db.add_all(employees)
    db.flush()
    active_employees = [e for e in employees if e.is_active]
    logger.info("Phase 7: created %d employees (%d active)", len(employees), len(active_employees))

    # -----------------------------------------------------------------------
    # PHASE 8: Assets (1000) + Identifiers (~2000)
    # -----------------------------------------------------------------------
    # Distribution: 400 laptops, 100 desktops, 150 monitors, 30 printers,
    #               20 servers, 40 switches, 80 phones, 50 APs, 10 UPS, 120 other
    asset_types = (
        [("laptop", "Prijenosna računala")] * 400
        + [("desktop", "Stolna računala")] * 100
        + [("monitor", "Monitori")] * 150
        + [("printer", "Pisači")] * 30
        + [("server", "Serveri")] * 20
        + [("switch", "Switchevi")] * 40
        + [("phone", "Mobiteli")] * 80
        + [("ap", "Access pointovi")] * 50
        + [("ups", "UPS")] * 10
        + [("other", "Tableti")] * 120
    )
    random.shuffle(asset_types)

    laptop_models = [
        ("Dell Latitude 5540", "dell"), ("Dell Latitude 7440", "dell"),
        ("Lenovo ThinkPad T14s", "lenovo"), ("Lenovo ThinkPad X1 Carbon", "lenovo"),
        ("HP EliteBook 840 G10", "hp"), ("HP ProBook 450 G10", "hp"),
        ("Apple MacBook Pro 14", "apple"), ("Apple MacBook Air M2", "apple"),
    ]
    desktop_models = [
        ("Dell OptiPlex 7010", "dell"), ("Lenovo ThinkCentre M90q", "lenovo"),
        ("HP ProDesk 400 G9", "hp"),
    ]
    monitor_models = [
        ("Dell P2422H 24\"", "dell"), ("Dell U2723QE 27\"", "dell"),
        ("Samsung S24A400", "samsung"), ("Lenovo L24q-35", "lenovo"),
    ]
    printer_models = [
        ("Brother MFC-L8900CDW", "brother"), ("HP LaserJet Pro M404dn", "hp"),
        ("Brother HL-L5210DN", "brother"),
    ]
    server_models = [
        ("Dell PowerEdge R750", "dell"), ("Dell PowerEdge R650", "dell"),
        ("Lenovo ThinkSystem SR650", "lenovo"),
    ]
    switch_models = [
        ("Cisco Catalyst 9200L-48P", "cisco"), ("Cisco Catalyst 9300-24T", "cisco"),
    ]
    phone_models = [
        ("Apple iPhone 15", "apple"), ("Apple iPhone 14", "apple"),
        ("Samsung Galaxy S24", "samsung"), ("Samsung Galaxy A54", "samsung"),
    ]
    ap_models = [("Cisco Meraki MR46", "cisco"), ("Cisco WAP581", "cisco")]
    ups_models = [("APC Smart-UPS 3000", "apc"), ("APC Smart-UPS 1500", "apc")]
    other_models = [
        ("Apple iPad 10th Gen", "apple"), ("Samsung Galaxy Tab S9", "samsung"),
        ("Lenovo Tab P12", "lenovo"),
    ]

    model_map = {
        "laptop": laptop_models, "desktop": desktop_models, "monitor": monitor_models,
        "printer": printer_models, "server": server_models, "switch": switch_models,
        "phone": phone_models, "ap": ap_models, "ups": ups_models, "other": other_models,
    }

    mfr_by_slug = {m.slug: m for m in manufacturers}

    # Status distribution: 70% active, 15% in_stock, 5% in_service, 5% retired, 5% pending
    status_weights = (
        [asset_status["active"]] * 70
        + [asset_status["in_stock"]] * 15
        + [asset_status["in_service"]] * 5
        + [asset_status["retired"]] * 5
        + [asset_status["pending"]] * 5
    )

    mobility_map = {
        "laptop": "personal", "desktop": "workplace", "monitor": "workplace",
        "printer": "shared", "server": "fixed", "switch": "fixed",
        "phone": "personal", "ap": "fixed", "ups": "fixed", "other": "personal",
    }

    assets: list[Asset] = []
    identifiers: list[AssetIdentifier] = []

    for idx, (atype, cat_name) in enumerate(asset_types):
        models = model_map[atype]
        model_name, mfr_slug = random.choice(models)
        mfr = mfr_by_slug.get(mfr_slug)

        org = random.choice([org1, org2]) if random.random() < 0.3 else org1
        loc = random.choice(room_locations) if room_locations else None

        purchase = _rand_date(2020, 2025)
        cost_ranges = {
            "laptop": (600, 2500), "desktop": (400, 1200), "monitor": (150, 800),
            "printer": (200, 1500), "server": (3000, 15000), "switch": (500, 5000),
            "phone": (200, 1500), "ap": (200, 800), "ups": (300, 3000), "other": (300, 1200),
        }
        cmin, cmax = cost_ranges[atype]

        serial = _serial(mfr_slug[:2].upper() + "-", 10)

        asset = Asset(
            id=uuid.uuid7(),
            tenant_id=tenant_id,
            organization_id=org.id,
            name=model_name,
            serial_number=serial,
            status_id=random.choice(status_weights),
            category_id=cat_by_name.get(cat_name, sub_categories[0]).id if cat_name in cat_by_name else None,
            vendor_id=random.choice(vendors).id if random.random() < 0.7 else None,
            location_id=loc.id if loc else None,
            purchase_date=purchase,
            purchase_cost=Decimal(str(random.randint(cmin, cmax))),
            purchase_currency="EUR",
            mobility_type=mobility_map.get(atype, "personal"),
            is_active=True,
            custom_fields={},
        )
        assets.append(asset)

    db.add_all(assets)
    db.flush()

    # Identifiers: inventory_number + serial for each
    for idx, asset in enumerate(assets):
        inv_id = AssetIdentifier(
            id=uuid.uuid7(),
            tenant_id=tenant_id,
            asset_id=asset.id,
            identifier_type="inventory_number",
            value=f"INV-2024-{idx + 1:04d}",
        )
        identifiers.append(inv_id)

        if asset.serial_number:
            ser_id = AssetIdentifier(
                id=uuid.uuid7(),
                tenant_id=tenant_id,
                asset_id=asset.id,
                identifier_type="serial",
                value=asset.serial_number,
            )
            identifiers.append(ser_id)

    db.add_all(identifiers)
    db.flush()
    logger.info("Phase 8: created %d assets, %d identifiers", len(assets), len(identifiers))

    # -----------------------------------------------------------------------
    # PHASE 9: Boxes (25) + Place Assets in Boxes & Storage Units
    # -----------------------------------------------------------------------
    boxes: list[Box] = []

    # 15 at locations
    for i in range(15):
        loc = random.choice(room_locations)
        b = Box(
            id=uuid.uuid7(),
            tenant_id=tenant_id,
            inventory_number=f"BOX-{i + 1:04d}",
            location_id=loc.id,
            status="open" if i < 10 else "sealed",
        )
        boxes.append(b)

    # 5 in storage_units
    for i in range(5):
        su = random.choice(storage_units)
        b = Box(
            id=uuid.uuid7(),
            tenant_id=tenant_id,
            inventory_number=f"BOX-{16 + i:04d}",
            storage_unit_id=su.id,
            status="open",
        )
        boxes.append(b)

    db.add_all(boxes)
    db.flush()

    # 3 child boxes (parent_box_id)
    for i in range(3):
        parent = boxes[i]
        child = Box(
            id=uuid.uuid7(),
            tenant_id=tenant_id,
            inventory_number=f"BOX-{21 + i:04d}",
            parent_box_id=parent.id,
            status="open",
        )
        boxes.append(child)

    db.add_all(boxes[-3:])
    db.flush()

    # 2 in_transit
    for i in range(2):
        b = Box(
            id=uuid.uuid7(),
            tenant_id=tenant_id,
            inventory_number=f"BOX-{24 + i:04d}",
            status="in_transit",
        )
        boxes.append(b)

    db.add_all(boxes[-2:])
    db.flush()

    # Place servers/switches/UPS in racks and in_stock assets into boxes/cabinets
    rack_units = [su for su in storage_units if su.type == "rack"]
    non_rack_units = [su for su in storage_units if su.type != "rack"]
    open_boxes = [b for b in boxes if b.status in ("open", "sealed")]

    for a in assets:
        if rack_units and a.mobility_type == "fixed" and any(k in (a.name or "") for k in ("PowerEdge", "ThinkSystem", "Catalyst", "Smart-UPS")):
            su = random.choice(rack_units)
            a.storage_unit_id = su.id
            a.location_id = su.location_id
        elif a.status_id == asset_status["in_stock"]:
            if open_boxes and random.random() < 0.4:
                chosen_box = random.choice(open_boxes)
                a.box_id = chosen_box.id
            elif non_rack_units and random.random() < 0.4:
                chosen_su = random.choice(non_rack_units)
                a.storage_unit_id = chosen_su.id
                a.location_id = chosen_su.location_id
    db.flush()
    logger.info("Phase 9: created %d boxes and assigned containers to assets", len(boxes))

    # -----------------------------------------------------------------------
    # PHASE 10: Assignments (400)
    # -----------------------------------------------------------------------
    # Assign laptops/phones/monitors to active employees
    assignable_assets = [
        a for a in assets
        if a.status_id == asset_status["active"]
        and a.mobility_type in ("personal", "shared")
    ]
    random.shuffle(assignable_assets)
    assignable_assets = assignable_assets[:400]

    assignments: list[AssetAssignment] = []
    for i, asset in enumerate(assignable_assets):
        emp = active_employees[i % len(active_employees)]
        aa = AssetAssignment(
            id=uuid.uuid7(),
            tenant_id=tenant_id,
            asset_id=asset.id,
            assigned_to_type="employee",
            assigned_to_id=emp.id,
            assigned_by=admin_user_id,
            assigned_at=datetime.now(timezone.utc) - timedelta(days=random.randint(1, 365)),
            is_active=True,
        )
        assignments.append(aa)

    db.add_all(assignments)
    db.flush()
    logger.info("Phase 10: created %d assignments", len(assignments))

    # -----------------------------------------------------------------------
    # PHASE 11: Warranties (200)
    # -----------------------------------------------------------------------
    warranty_assets = random.sample(assets, min(200, len(assets)))
    warranty_types = ["manufacturer", "extended", "on_site", "next_business_day"]
    support_levels = ["basic", "standard", "premium", "next_business_day", "4_hour"]

    warranties: list[Warranty] = []
    for asset in warranty_assets:
        start = asset.purchase_date or _rand_date(2022, 2025)
        duration_years = random.choice([1, 2, 3, 5])
        w = Warranty(
            id=uuid.uuid7(),
            tenant_id=tenant_id,
            asset_id=asset.id,
            vendor_id=asset.vendor_id or random.choice(vendors).id,
            warranty_type=random.choice(warranty_types),
            starts_at=start,
            expires_at=start + timedelta(days=365 * duration_years),
            support_level=random.choice(support_levels),
            is_active=True,
        )
        warranties.append(w)

    db.add_all(warranties)
    db.flush()
    logger.info("Phase 11: created %d warranties", len(warranties))

    # -----------------------------------------------------------------------
    # PHASE 12: Work Orders (50)
    # -----------------------------------------------------------------------
    wo_types = ["maintenance", "repair", "installation", "replenishment"]
    wo_statuses = ["open"] * 20 + ["in_progress"] * 15 + ["completed"] * 10 + ["cancelled"] * 5
    wo_titles = [
        "Zamjena baterije", "Nadogradnja RAM-a", "Instalacija OS-a",
        "Zamjena toner kazete", "Čišćenje servera", "Zamjena diska",
        "Konfiguracija switcha", "Zamjena UPS baterije", "Popravak ekrana",
        "Instalacija softvera", "Zamjena matične ploče", "Kalibracija monitora",
        "Ažuriranje firmware-a", "Zamjena tipkovnice", "Mrežna dijagnostika",
    ]

    work_orders: list[WorkOrder] = []
    for i in range(50):
        wo_asset = random.choice(assets)
        status = random.choice(wo_statuses)
        scheduled = datetime.now(timezone.utc) - timedelta(days=random.randint(0, 180))
        completed_at = None
        if status == "completed":
            completed_at = scheduled + timedelta(days=random.randint(1, 14))

        wo = WorkOrder(
            id=uuid.uuid7(),
            tenant_id=tenant_id,
            number=f"WO-2025-{i + 1:03d}",
            type=random.choice(wo_types),
            status=status,
            asset_id=wo_asset.id,
            title=random.choice(wo_titles),
            description=f"Radni nalog za {wo_asset.name or 'asset'}",
            scheduled_at=scheduled,
            completed_at=completed_at,
            cost=Decimal(str(random.randint(50, 2000))) if status == "completed" else None,
            cost_currency="EUR" if status == "completed" else None,
            created_by=admin_user_id,
        )
        work_orders.append(wo)

    db.add_all(work_orders)
    db.flush()
    logger.info("Phase 12: created %d work orders", len(work_orders))

    # -------------------------------------------------------------------
    # PHASE 13: Supplies (consumables, spare parts, accessories)
    # -------------------------------------------------------------------
    from app.models.supply import Supply

    supply_data = [
        ("Toner HP 26A", "consumable", "CF226A", "Toner", "kom", Decimal("45.00")),
        ("Toner HP 58A", "consumable", "CF258A", "Toner", "kom", Decimal("52.00")),
        ("Toner Brother TN-2420", "consumable", "TN-2420", "Toner", "kom", Decimal("38.00")),
        ("SSD Samsung 870 EVO 1TB", "stock_item", "MZ-77E1T0", "Storage", "kom", Decimal("89.00")),
        ("SSD Samsung 870 EVO 500GB", "stock_item", "MZ-77E500", "Storage", "kom", Decimal("55.00")),
        ("RAM DDR4 16GB", "stock_item", "KVR32S22S8/16", "Memory", "kom", Decimal("42.00")),
        ("RAM DDR5 32GB", "stock_item", "KF556C36-32", "Memory", "kom", Decimal("95.00")),
        ("SFP+ 10G SR", "stock_item", "SFP-10G-SR", "Network", "kom", Decimal("35.00")),
        ("Patch kabel Cat6 2m", "stock_item", "PC6-2M-BL", "Network", "kom", Decimal("3.50")),
        ("USB-C Hub Dell DA310", "accessory", "DA310", "Accessories", "kom", Decimal("65.00")),
        ("Miš Logitech M750", "accessory", "910-006971", "Accessories", "kom", Decimal("35.00")),
        ("Tipkovnica Logitech K860", "accessory", "920-010933", "Accessories", "kom", Decimal("95.00")),
        ("Monitor kabel HDMI 2m", "accessory", "HDMI-2M", "Cables", "kom", Decimal("8.00")),
        ("Monitor kabel DP 2m", "accessory", "DP-2M", "Cables", "kom", Decimal("10.00")),
        ("Punjač USB-C 65W", "accessory", "USB-C-65W", "Power", "kom", Decimal("28.00")),
        ("Baterija CR2032", "consumable", "CR2032", "Batteries", "kom", Decimal("1.50")),
        ("Papir A4 500 listova", "consumable", "A4-500", "Office", "kutija", Decimal("4.50")),
        ("Etikete inventurne 100kom", "consumable", "INV-LABEL-100", "Labels", "pak", Decimal("12.00")),
        ("HDD 2.5\" 1TB", "stock_item", "ST1000LM048", "Storage", "kom", Decimal("45.00")),
        ("PSU 750W", "stock_item", "PSU-750W", "Power", "kom", Decimal("85.00")),
    ]

    vendor_list = list(vendors.values()) if isinstance(vendors, dict) else vendors
    supplies = []
    for name, stype, part_no, cat, unit, price in supply_data:
        s = Supply(
            id=uuid.uuid7(), tenant_id=tenant_id, name=name,
            supply_type=stype, part_number=part_no, category=cat,
            unit=unit, unit_price=price, currency="EUR",
            vendor_id=random.choice(vendor_list).id if vendor_list else None,
            is_active=True,
        )
        supplies.append(s)
    db.add_all(supplies)
    db.flush()

    from app.models.consumable import Consumable
    from app.models.stock_item import StockItem
    from app.models.accessory import Accessory
    from app.models.stock_policy import StockPolicy
    from app.models.stock_movement import StockMovement

    stock_locs = warehouses + server_rooms
    if not stock_locs:
        stock_locs = room_locations[:3]

    consumable_instances: list[Consumable] = []
    stock_item_instances: list[StockItem] = []
    accessory_instances: list[Accessory] = []
    stock_policies: list[StockPolicy] = []
    stock_movements: list[StockMovement] = []

    for s in supplies:
        # Place each supply in 2 stock locations
        chosen_locs = random.sample(stock_locs, min(2, len(stock_locs)))
        for idx_loc, sloc in enumerate(chosen_locs):
            min_qty = random.choice([5, 10, 15, 20])
            # Make ~25% below minimum so low-stock alerts/filters have real data
            curr_qty = random.randint(1, min_qty - 1) if idx_loc == 1 and random.random() < 0.4 else random.randint(min_qty, min_qty * 3)

            if s.supply_type == "consumable":
                inst = Consumable(
                    id=uuid.uuid7(),
                    tenant_id=tenant_id,
                    supply_id=s.id,
                    location_id=sloc.id,
                    current_quantity=curr_qty,
                    minimum_quantity=min_qty,
                    is_active=True,
                )
                consumable_instances.append(inst)
                db.add(inst)
                db.flush()
                entity_id = inst.id
            elif s.supply_type == "stock_item":
                inst = StockItem(
                    id=uuid.uuid7(),
                    tenant_id=tenant_id,
                    supply_id=s.id,
                    location_id=sloc.id,
                    quantity=curr_qty,
                    minimum_quantity=min_qty,
                    is_active=True,
                )
                stock_item_instances.append(inst)
                db.add(inst)
                db.flush()
                entity_id = inst.id
            else:
                inst = Accessory(
                    id=uuid.uuid7(),
                    tenant_id=tenant_id,
                    supply_id=s.id,
                    location_id=sloc.id,
                    current_quantity=curr_qty,
                    minimum_quantity=min_qty,
                    is_active=True,
                )
                accessory_instances.append(inst)
                db.add(inst)
                db.flush()
                entity_id = inst.id

            pol = StockPolicy(
                id=uuid.uuid7(),
                tenant_id=tenant_id,
                supply_id=s.id,
                location_id=sloc.id,
                minimum_quantity=min_qty,
                reorder_quantity=min_qty * 2,
                reorder_period_months=3,
                responsible_user_id=admin_user_id,
                is_active=True,
            )
            stock_policies.append(pol)

            mv = StockMovement(
                id=uuid.uuid7(),
                tenant_id=tenant_id,
                supply_id=s.id,
                entity_type=s.supply_type,
                entity_id=entity_id,
                location_id=sloc.id,
                quantity=curr_qty,
                reason="purchase",
                actor_id=admin_user_id,
                external_ref=f"PRIMA-2025-{random.randint(100, 999)}",
                notes="Inicijalno stanje skladišta",
            )
            stock_movements.append(mv)

    db.add_all(stock_policies)
    db.add_all(stock_movements)
    db.flush()
    logger.info(
        "Phase 13: created %d supplies, %d consumables, %d stock_items, %d accessories, %d policies",
        len(supplies), len(consumable_instances), len(stock_item_instances),
        len(accessory_instances), len(stock_policies),
    )

    # -------------------------------------------------------------------
    # PHASE 14: Checklist Templates + Items
    # -------------------------------------------------------------------
    from app.models.checklist_template import ChecklistTemplate
    from app.models.checklist_item import ChecklistItem

    templates_data = [
        ("User Onboarding", "asset_stock_to_assigned", None, "per_event", True, False, [
            ("Provjeri serijski broj", True, False, None),
            ("Instaliraj standardni softver", True, False, None),
            ("Konfiguriraj korisnički račun i email", True, False, None),
            ("Testiraj mrežnu povezivost", False, False, None),
            ("Predaj zaposleniku i prikupi potpis", True, True, None),
        ]),
        ("User Offboarding", "asset_assigned_to_stock", None, "per_event", True, True, [
            ("Backup korisničkih podataka na mrežni disk", True, False, None),
            ("Obriši lokalni storage (NIST 800-88)", True, True, None),
            ("Ukloni inventurne naljepnice", False, False, None),
            ("Vrati na skladišnu policu i ažuriraj lokaciju", True, False, None),
        ]),
        ("EOL Decommission", "asset_retired", None, "per_event", True, True, [
            ("Dokumentiraj stanje asseta s fotografijama", True, True, None),
            ("Kriptografsko brisanje podataka", True, True, None),
            ("Ukloni iz svih monitoring sustava", True, False, None),
            ("Ukloni inventurnu oznaku", False, False, None),
            ("Pakiraj za odvoz dobavljaču", True, False, None),
            ("Generiraj certifikat o zbrinjavanju", True, False, None),
        ]),
        ("Preventivno održavanje", "asset_to_service", None, "per_event", False, False, [
            ("Provjeri verziju firmwarea i ažuriraj", False, True, None),
            ("Očisti filtre prašine i ventilatore", False, False, None),
            ("Pokreni dijagnostičke testove", False, True, None),
        ]),
    ]

    chk_templates = []
    chk_items = []
    for tpl_name, trigger, asset_cat, freq, is_req, req_confirm, items in templates_data:
        tpl = ChecklistTemplate(
            id=uuid.uuid7(), tenant_id=tenant_id, name=tpl_name,
            trigger_event=trigger, asset_category=asset_cat,
            frequency=freq, is_required=is_req,
            requires_confirmation=req_confirm, is_active=True,
        )
        chk_templates.append(tpl)
        db.add(tpl)
        db.flush()

        prev_item_id = None
        for idx, (text, blocking, req_note, depends) in enumerate(items):
            item = ChecklistItem(
                id=uuid.uuid7(), tenant_id=tenant_id, template_id=tpl.id,
                order_index=idx, text=text, is_blocking=blocking,
                requires_note=req_note, depends_on_item_id=prev_item_id if idx > 0 and blocking else None,
                is_active=True,
            )
            chk_items.append(item)
            db.add(item)
            db.flush()
            prev_item_id = item.id

    logger.info("Phase 14: created %d checklist templates, %d items", len(chk_templates), len(chk_items))

    # -------------------------------------------------------------------
    # PHASE 15: Maintenance Schedules
    # -------------------------------------------------------------------
    from app.models.maintenance_schedule import MaintenanceSchedule

    # Find some locations for schedules
    warehouse_locs = [l for l in all_locations if "Skladište" in l.name or "warehouse" in (l.name or "").lower()]
    server_locs = [l for l in all_locations if "Server" in l.name]
    maint_template = chk_templates[3] if len(chk_templates) > 3 else chk_templates[0]

    schedules = []
    sched_data = [
        ("Serveri — kvartalno", "maintenance", "quarterly", server_locs[0].id if server_locs else all_locations[0].id),
        ("Skladište — mjesečno", "cleaning", "monthly", warehouse_locs[0].id if warehouse_locs else all_locations[0].id),
        ("Mrežna oprema — polugodišnje", "inspection", "0 9 1 */6 *", all_locations[0].id),
    ]
    for sname, mtype, recurrence, loc_id in sched_data:
        ms = MaintenanceSchedule(
            id=uuid.uuid7(), tenant_id=tenant_id, name=sname,
            type=mtype, recurrence=recurrence,
            location_id=loc_id, is_active=True,
        )
        schedules.append(ms)
    db.add_all(schedules)
    db.flush()
    logger.info("Phase 15: created %d maintenance schedules", len(schedules))

    logger.info(
        "Dev data seeding complete: %d locations, %d employees, %d assets, "
        "%d identifiers, %d vendors, %d boxes, %d assignments, "
        "%d warranties, %d work orders, %d supplies, %d checklists, %d schedules",
        len(all_locations), len(employees), len(assets),
        len(identifiers), len(vendors), len(boxes), len(assignments),
        len(warranties), len(work_orders), len(supplies),
        len(chk_templates), len(schedules),
    )
