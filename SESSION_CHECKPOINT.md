# Inverum — Session Checkpoint

> **Datum:** 2026-06-08  
> **Model:** deepseek-v4-pro  
> **Trajanje:** Faze 1, 2, i 3 kompletirane. Dashboard caching dodan. `dev.sh` gotov.

---

## 1. Infrastruktura

| Servis | Adresa | Pristup |
|--------|--------|---------|
| PostgreSQL | 192.168.22.91:5432 | `ssh root@192.168.22.91` → `PGPASSWORD=devpassword psql -h localhost -U inverum -d inverumdb` |
| Valkey | 192.168.22.92:6379 | `ssh root@192.168.22.92` → `docker ps`, `docker logs` |
| MinIO | 192.168.22.92:9000 | isti VM kao Valkey |

**Credentials:** sve `devpassword`, korisnik `inverum`.  
**SSH:** sshkey je već postavljen, root pristup na oba VM-a.

---

## 2. Backend (`cadastre-am/`)

### Pokretanje
```bash
cd /home/ivan/projects/cadastre-am
./dev.sh start        # migracije + backend :8000 + celery worker + celery beat + frontend :3000
./dev.sh stop         # zaustavi sve
./dev.sh restart      # svježi kod
./dev.sh status       # što je živo
```

### Ključni fajlovi
| Fajl | Opis |
|------|------|
| `app/main.py` | FastAPI app, 37+ routera, lifespan (seeds, self-test) |
| `app/core/config.py` | Pydantic Settings iz `.env` |
| `app/core/database.py` | SQLAlchemy engine + session |
| `app/core/security.py` | JWT (HS256, access 15min, refresh 7d) |
| `app/core/audit_listener.py` | SQLAlchemy event listeneri za audit |
| `app/routers/dashboard.py` | `GET /api/v1/dashboard/stats` — cache-first (Valkey → DB fallback) |
| `app/tasks/dashboard_stats.py` | Celery task — računa stats svake 2 min, sprema u Valkey (TTL 600s) |
| `app/celery_app.py` | Celery konfiguracija + beat schedule |
| `dev.sh` | Dev environment manager |

### Auth
- Login: `POST /api/v1/auth/login` (tenant_slug, provider, provider_id, password)
- Seedani korisnik: **admin / admin / tenant: dev**
- JWT bearer token u headeru

### Dashboard arhitektura
```
Celery Beat (svake 2 min)
  └→ compute_dashboard_stats()
       └→ Valkey SETEX dashboard:stats:{tenant_id} (TTL 600s)

API: GET /dashboard/stats
  ├→ Valkey GET (instant, <5ms)
  └→ DB fallback (samo ako cache miss)
```

---

## 3. Frontend (`inverum-frontend/`)

### Stack
- React 19, TypeScript, Tailwind CSS v4, Vite
- Zustand (auth, theme, tenant config, view filters)
- `react-router-dom` v7 — prave rute, lazy loading

### Ključni fajlovi
| Fajl | Opis |
|------|------|
| `src/main.tsx` | Entry point — BrowserRouter + ErrorBoundary + ThemeProvider |
| `src/App.tsx` | **29 linija** — auth hydration + AppProvider + routes |
| `src/routes.tsx` | 14 lazy-loaded ruta + AuthGuard |
| `src/contexts/AppContext.tsx` | Globalni state (tenantName, locTree, assetCategories, terminal) |
| `src/layouts/AppLayout.tsx` | Sidebar + Header + Outlet + TerminalPanel |
| `src/hooks/useApi.ts` | `useApiQuery<T>` + `useApiMutation<TInput, TOutput>` |
| `src/hooks/useAssetFilters.ts` | Filter state + `applyFilters()` + `getAvailableCustomFields()` |
| `src/hooks/useAssetSelection.ts` | Multi-select logika |
| `src/types/api.ts` | Backend response tipovi (CursorPagedResponse, AssetResponse, ...) |
| `src/views/AssetsView.tsx` | **~160 linija** — orkestrator (bio 1583 linija) |
| `src/components/assets/*.tsx` | 8 komponenti: AssetTable, AssetTableRow, AssetFilters, AssetDetailPanel, AssetEditForm, AssetColumnChooser, AssetDragOverlay, AssetEmptyState |

### Rute
```
/login              → Login
/dashboard          → Dashboard (API: /dashboard/stats + /assets)
/assets             → AssetsView (API: /assets/?limit=200)
/import             → ImportWizard (API: /imports/upload → map → validate → confirm)
/locations          → LocationsView (API: /locations/?limit=200)
/employees          → EmployeesView
/boxes              → BoxesDashboard
/storage-units      → StorageUnitDashboard
/supply             → SupplyDashboard
/work-orders        → WorkOrdersView
/checklists         → ChecklistsView
/vendors            → VendorsView
/settings           → SettingsLanding
/settings/tenant    → TenantSettings
/settings/org/:id   → TenantSettings (org mode)
```

### Integracija s API-jem
| Stranica | Status | Endpoint |
|----------|--------|----------|
| Login | ✅ stvarni API | `/auth/login` |
| Dashboard | ✅ stvarni API | `/dashboard/stats` + `/assets` |
| Assets | ✅ stvarni API | `/assets/` (list + edit) |
| Locations | ✅ stvarni API | `/locations/` |
| Import | ✅ stvarni API | `/imports/upload` → map → validate → confirm |

### `.env`
```
VITE_API_URL=http://localhost:8000/api/v1
VITE_TENANT_SLUG=dev
```

---

## 4. Što je napravljeno danas

### Faza 1: Temelji
- [x] React Router — 14 ruta, lazy loading, AuthGuard
- [x] `useApiQuery` + `useApiMutation` hookovi
- [x] Type alignment — `types/api.ts` s 25+ backend tipova

### Faza 2: Refactor monolita
- [x] `App.tsx`: 511 → 29 linija
- [x] `AssetsView.tsx`: 1583 → ~160 linija (8 ekstrahiranih komponenti + 3 hooka)

### Faza 3: Core integracija
- [x] Dashboard → `GET /dashboard/stats` (novi backend endpoint)
- [x] Assets CRUD → `useApiQuery` + `useApiMutation`
- [x] Locations → `useApiQuery`
- [x] Import → upload/map/validate/confirm kroz API
- [x] Dashboard stats Celery caching (Valkey, svake 2 min)

### DevOps
- [x] `dev.sh` — start/stop/restart/status
- [x] `.env` konfiguracija za vanjske VM-ove
- [x] Git repoi inicijalizirani, commitani, pushani

---

## 5. Git stanje

### Backend (`cadastre-am`)
```
[main] Dodan GET /api/v1/dashboard/stats endpoint
[main] Dashboard stats: Celery task + Valkey cache
[main] dev.sh: pojednostavljen dev environment manager
```

### Frontend (`inverum-frontend`)
```
[main] Faza 1+2: React Router, API hookovi, type alignment, refactor
[main] Faza 3: Core integracija — Dashboard, Assets, Locations, Import
```

---

## 6. Sljedeći koraci (za sutra)

1. **Pokrenuti i testirati**: `./dev.sh start` → login admin/admin/dev → provjeriti Dashboard, Assets, Locations, Import
2. **Seed podaci**: `SEED_COMPLEXITY=full` za realistic seed (50+ asseta)
3. **Preostali frontend**: Work Orders, Checklists, Vendors, Employees, Boxes, Supply, Storage Units → spojiti na API
4. **Testovi**: barem smoketest za auth flow i dashboard endpoint
5. **CSS animacija**: `animate-slide-in-right` u `AssetDetailPanel` nije definiran u Tailwindu — dodati u `index.css`

---

## 7. Brze naredbe

```bash
# Pokreni sve
cd /home/ivan/projects/cadastre-am && ./dev.sh start

# Provjeri stanje
./dev.sh status

# Direktno u bazu
ssh root@192.168.22.91 "PGPASSWORD=devpassword psql -h localhost -U inverum -d inverumdb"

# Valkey docker logovi
ssh root@192.168.22.92 "docker logs valkey --tail 50"

# Test health endpointa
curl http://localhost:8000/health/live

# Test dashboarda
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/dashboard/stats
```
