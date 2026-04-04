import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.rate_limit import limiter
from app.seeds.run import run_seeds
from app.core.audit_listener import register_listeners

register_listeners()

logger = logging.getLogger(__name__)

from app.routers import auth as auth_router
from app.routers import tenants as tenants_router
from app.routers import reference_data as reference_data_router
from app.routers import legal_entities as legal_entities_router
from app.routers import organizations as organizations_router
from app.routers import location as location_router
from app.routers import manufacturers as manufacturers_router
from app.routers import vendors as vendors_router
from app.routers import vendor_contracts as vendor_contracts_router
from app.routers import employees as employees_router
from app.routers import roles as roles_router
from app.routers import permissions as permissions_router
from app.routers import groups as groups_router
from app.routers import users as users_router
from app.routers import assets as assets_router
from app.routers import warranties as warranties_router
from app.routers import stock_items as stock_items_router
from app.routers import asset_assignments as asset_assignments_router
from app.routers import audit_log as audit_log_router
from app.routers import onboarding as onboarding_router
from app.routers import imports as imports_router
from app.routers import departments as departments_router
from app.routers import checklists as checklists_router
from app.routers import workspaces as workspaces_router
from app.routers import health as health_router
from app.routers import boxes as boxes_router
from app.routers import plans as plans_router
from app.routers import asset_categories as asset_categories_router
from app.routers import work_orders as work_orders_router
from app.routers import components as components_router
from app.routers import consumables as consumables_router
from app.routers import accessories as accessories_router
from app.routers import maintenance_schedules as maintenance_schedules_router
from app.routers import external_services as external_services_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        run_seeds(db)
    except Exception:
        logger.exception("Seed failed during startup.")
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# OTel — no-op when OTEL_ENABLED=false
from app.core.telemetry import setup_telemetry
setup_telemetry(app)

app.include_router(health_router.router)
app.include_router(auth_router.router, prefix="/api/v1")
app.include_router(tenants_router.router, prefix="/api/v1")
app.include_router(reference_data_router.router, prefix="/api/v1")
app.include_router(legal_entities_router.router, prefix="/api/v1")
app.include_router(organizations_router.router, prefix="/api/v1")
app.include_router(location_router.router, prefix="/api/v1")
app.include_router(manufacturers_router.router, prefix="/api/v1")
app.include_router(vendors_router.router, prefix="/api/v1")
app.include_router(vendor_contracts_router.router, prefix="/api/v1")
app.include_router(employees_router.router, prefix="/api/v1")
app.include_router(roles_router.router, prefix="/api/v1")
app.include_router(permissions_router.router, prefix="/api/v1")
app.include_router(groups_router.router, prefix="/api/v1")
app.include_router(users_router.router, prefix="/api/v1")
app.include_router(assets_router.router, prefix="/api/v1")
app.include_router(warranties_router.router, prefix="/api/v1")
app.include_router(stock_items_router.router, prefix="/api/v1")
app.include_router(asset_assignments_router.router, prefix="/api/v1")
app.include_router(audit_log_router.router, prefix="/api/v1")
app.include_router(onboarding_router.router, prefix="/api/v1")
app.include_router(imports_router.router, prefix="/api/v1")
app.include_router(departments_router.router, prefix="/api/v1")
app.include_router(checklists_router.router, prefix="/api/v1")
app.include_router(workspaces_router.router, prefix="/api/v1")
app.include_router(boxes_router.router, prefix="/api/v1")
app.include_router(plans_router.router, prefix="/api/v1")
app.include_router(asset_categories_router.router, prefix="/api/v1")
app.include_router(work_orders_router.router, prefix="/api/v1")
app.include_router(components_router.router, prefix="/api/v1")
app.include_router(consumables_router.router, prefix="/api/v1")
app.include_router(accessories_router.router, prefix="/api/v1")
app.include_router(maintenance_schedules_router.router, prefix="/api/v1")
app.include_router(external_services_router.router, prefix="/api/v1")
