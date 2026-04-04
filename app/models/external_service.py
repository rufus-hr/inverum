import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Index, Text, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class ExternalService(Base):
    """
    Integration Engine — Ekran 1.
    Vanjski servisi (Jira, ServiceNow, Zabbix, Slack, Teams, PagerDuty, custom).
    credentials enkriptirani AES-256, key u env, upgrade path → Vault.
    """
    __tablename__ = "external_services"
    __table_args__ = (
        Index("idx_external_services_tenant", "tenant_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    service_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # "jira" | "servicenow" | "zabbix" | "slack" | "teams" | "pagerduty" | "custom"

    base_url: Mapped[str] = mapped_column(String(500), nullable=False)

    auth_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # "api_key" | "bearer" | "basic" | "oauth2" | "hmac"

    credentials: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # AES-256 enkriptirano — {"api_key": "enc:...", "token": "enc:..."}

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_test_success: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<ExternalService {self.name} ({self.service_type})>"


class IntegrationRule(Base):
    """
    Integration Engine — Ekran 2.
    Per servis: što triggerira, što šalje, kako mapira response.
    Jinja2 templating za URL + payload.
    Circuit breaker: 5 failures → open → 30min cooldown.
    """
    __tablename__ = "integration_rules"
    __table_args__ = (
        Index("idx_integration_rules_service", "external_service_id"),
        Index("idx_integration_rules_trigger", "trigger_event"),
        Index("idx_integration_rules_conditions_gin", "conditions",
              postgresql_using="gin",
              postgresql_ops={"conditions": "jsonb_path_ops"}),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    external_service_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("external_services.id"), nullable=False
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)

    trigger_event: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # iz event kataloga — NULL za scheduled (polling)

    direction: Mapped[str] = mapped_column(String(20), nullable=False)
    # "outbound" | "inbound" | "polling"

    schedule: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # cron expression za polling, NULL za event-triggered

    url_template: Mapped[str] = mapped_column(String(1000), nullable=False)
    # Jinja2: "{{base_url}}/rest/api/2/issue"

    payload_template: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Jinja2 JSON template

    response_mapping: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # {"work_order.external_ticket_ref": "response.id"}

    conditions: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # {"changed_fields": ["assigned_user_id"]}

    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    retry_backoff: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # exponential backoff

    circuit_breaker_failures: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    circuit_breaker_opened_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # open → 30min cooldown before retry

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<IntegrationRule {self.name} [{self.direction}] trigger={self.trigger_event}>"


class IntegrationLog(Base):
    """
    Append-only log svakog outbound/inbound/polling poziva.
    """
    __tablename__ = "integration_logs"
    __table_args__ = (
        Index("idx_integration_logs_rule", "integration_rule_id"),
        Index("idx_integration_logs_created", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    integration_rule_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("integration_rules.id"), nullable=False
    )
    event_bus_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("event_bus.id"), nullable=True
    )

    request_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    response_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    def __repr__(self) -> str:
        return f"<IntegrationLog rule:{self.integration_rule_id} status:{self.status_code}>"
