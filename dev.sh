#!/bin/bash
# =============================================================================
# dev.sh — Inverum development environment manager
#
# Usage:
#   ./dev.sh start      Pokreni backend, worker, beat, frontend
#   ./dev.sh stop       Zaustavi sve
#   ./dev.sh restart    Stop + start (svježi kod)
#   ./dev.sh status     Prikaži što je živo
#   ./dev.sh logs       Prati logove
#
# Infrastruktura (postgres, valkey, minio) se očekuje na vanjskim VM-ovima.
# Ako su nedostupni, skripta će ponuditi lokalni docker compose.
# =============================================================================

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$ROOT/../inverum-frontend"
COMPOSE_FILE="$ROOT/docker/docker-compose.yml"
VENV="$ROOT/venv"
PID_DIR="$ROOT/.pids"
ENV_FILE="$ROOT/.env"

mkdir -p "$PID_DIR"

# ── Boje ────────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; }
step()  { echo -e "\n${GREEN}── $* ──${NC}"; }

# ── PID helpers ──────────────────────────────────────────────────────────────────
save_pid() { echo "$2" > "$PID_DIR/$1.pid"; }
read_pid() { cat "$PID_DIR/$1.pid" 2>/dev/null || true; }
kill_pid() {
    local name="$1" pid
    pid=$(read_pid "$name")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
        wait "$pid" 2>/dev/null || true
        ok "Stopped $name (pid $pid)"
    fi
    rm -f "$PID_DIR/$name.pid"
}

# ── Učitaj .env ──────────────────────────────────────────────────────────────────
load_env() {
    if [ -f "$ENV_FILE" ]; then
        set -a; source "$ENV_FILE"; set +a
    else
        err ".env nije pronađen. Kopiraj .env.example → .env i popuni."
        exit 1
    fi
}

# ── Provjera infrastrukture ──────────────────────────────────────────────────────
check_postgres() {
    if pg_isready -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -t 3 2>/dev/null; then
        return 0
    fi
    return 1
}

check_valkey() {
    # Izvuci host i port iz VALKEY_URL
    local host port
    host=$(echo "$VALKEY_URL" | sed -n 's|.*://.*@\([^:/]*\).*|\1|p')
    port=$(echo "$VALKEY_URL" | sed -n 's|.*:\([0-9]*\).*|\1|p')
    port=${port:-6379}
    if valkey-cli -h "$host" -p "$port" -a "$VALKEY_PASSWORD" --no-auth-warning ping 2>/dev/null | grep -q PONG; then
        return 0
    fi
    return 1
}

infra_check() {
    step "Infrastruktura — provjera"
    local pg_ok=false vk_ok=false

    load_env

    if check_postgres; then
        pg_ok=true
        ok "PostgreSQL dostupan na $DATABASE_HOST:$DATABASE_PORT"
    else
        warn "PostgreSQL NIJE dostupan na $DATABASE_HOST:$DATABASE_PORT"
    fi

    if check_valkey; then
        vk_ok=true
        ok "Valkey dostupan"
    else
        warn "Valkey NIJE dostupan"
    fi

    if $pg_ok && $vk_ok; then
        ok "Infrastruktura spremna"
        return 0
    fi

    echo ""
    warn "Infrastruktura nije potpuno dostupna."
    echo ""
    echo "  Opcije:"
    echo "    1. Pokreni lokalni docker compose (./dev.sh docker-up)"
    echo "    2. Provjeri .env i VPN konekciju na vanjske VM-ove"
    echo "    3. Nastavi bez infrastrukture (backend neće raditi)"
    echo ""
    return 1
}

docker_up() {
    step "Docker services (lokalni fallback)"
    info "Starting postgres, valkey, minio..."
    docker compose -f "$COMPOSE_FILE" up -d postgres valkey minio

    info "Waiting for postgres..."
    until docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U inverum -d inverumdb 2>/dev/null; do
        sleep 1
    done
    ok "postgres ready"

    info "Waiting for valkey..."
    until docker compose -f "$COMPOSE_FILE" exec -T valkey valkey-cli -a devpassword ping 2>/dev/null | grep -q PONG; do
        sleep 1
    done
    ok "valkey ready"

    ok "Docker services up"
}

# ── Backend ────────────────────────────────────────────────────────────────────────
backend_start() {
    step "Backend"
    source "$VENV/bin/activate"

    info "Running migrations..."
    alembic upgrade head

    info "Starting uvicorn on :8000..."
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
    save_pid "uvicorn" $!
    ok "Backend started (pid $!) → http://localhost:8000"
}

worker_start() {
    step "Celery Worker"
    source "$VENV/bin/activate"

    info "Starting Celery worker..."
    celery -A app.celery_app worker \
        -Q inverum-worker-default,inverum-worker-imports \
        --loglevel=info --concurrency=2 &
    save_pid "celery-worker" $!
    ok "Celery worker started (pid $!)"
}

beat_start() {
    step "Celery Beat"
    source "$VENV/bin/activate"

    info "Starting Celery beat (dashboard stats every 2 min)..."
    celery -A app.celery_app beat --loglevel=info &
    save_pid "celery-beat" $!
    ok "Celery beat started (pid $!)"
}

# ── Frontend ───────────────────────────────────────────────────────────────────────
frontend_start() {
    step "Frontend"
    cd "$FRONTEND"

    info "Installing deps (if needed)..."
    npm install --silent 2>/dev/null || true

    info "Starting Vite on :3000..."
    npm run dev &
    save_pid "vite" $!
    cd "$ROOT"
    ok "Frontend started (pid $!) → http://localhost:3000"
}

# ── Stop ───────────────────────────────────────────────────────────────────────────
stop_all() {
    step "Stopping all app processes"

    kill_pid "vite"
    kill_pid "celery-beat"
    kill_pid "celery-worker"
    kill_pid "uvicorn"

    # Clean orphans
    pkill -f "uvicorn app.main" 2>/dev/null || true
    pkill -f "celery.*worker" 2>/dev/null || true
    pkill -f "celery.*beat" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true

    ok "All app processes stopped"
}

# ── Status ─────────────────────────────────────────────────────────────────────────
show_status() {
    load_env 2>/dev/null || true

    echo ""
    echo "  ┌─────────────────────────────────────────────────────┐"
    echo "  │                    INVERUM DEV                      │"
    echo "  ├──────────┬──────────────────────────────────────────┤"

    for svc in uvicorn celery-worker celery-beat vite; do
        pid=$(read_pid "$svc")
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            printf "  │ %-8s │ ${GREEN}● running${NC} (pid %-6s)              │\n" "$svc" "$pid"
        else
            printf "  │ %-8s │ ${RED}○ stopped${NC}                              │\n" "$svc"
        fi
    done

    # Infrastructure
    echo "  ├──────────┼──────────────────────────────────────────┤"
    if check_postgres 2>/dev/null; then
        printf "  │ %-8s │ ${GREEN}●${NC} %-40s │\n" "postgres" "$DATABASE_HOST:$DATABASE_PORT"
    else
        printf "  │ %-8s │ ${RED}○${NC} %-40s │\n" "postgres" "unreachable"
    fi
    if check_valkey 2>/dev/null; then
        printf "  │ %-8s │ ${GREEN}●${NC} %-40s │\n" "valkey" "connected"
    else
        printf "  │ %-8s │ ${RED}○${NC} %-40s │\n" "valkey" "unreachable"
    fi

    echo "  └──────────┴──────────────────────────────────────────┘"
    echo ""
}

# ── Logs ───────────────────────────────────────────────────────────────────────────
show_logs() {
    info "Pratim docker logove (Ctrl+C za prekid)..."
    docker compose -f "$COMPOSE_FILE" logs -f --tail=20 2>/dev/null &
    wait
}

# ── Main ───────────────────────────────────────────────────────────────────────────
case "${1:-start}" in
    start)
        echo ""
        echo "  ╔══════════════════════════════════════════════════╗"
        echo "  ║           INVERUM — Pokretanje okruženja         ║"
        echo "  ╚══════════════════════════════════════════════════╝"
        echo ""

        if ! infra_check; then
            echo ""
            warn "Nastavljam bez infrastrukture — backend može pasti."
            echo ""
        fi

        backend_start
        worker_start
        beat_start
        frontend_start

        sleep 2
        show_status

        echo ""
        ok "Sve spremno!"
        echo ""
        echo "  Frontend : http://localhost:3000"
        echo "  Backend  : http://localhost:8000"
        echo "  API Docs : http://localhost:8000/docs"
        echo ""
        echo "  Login: admin / admin / tenant: dev"
        echo ""
        echo "  ./dev.sh stop       — zaustavi"
        echo "  ./dev.sh restart    — restart sa svježim kodom"
        echo "  ./dev.sh status     — status"
        echo ""
        ;;

    stop)
        stop_all
        echo ""
        ok "Sve zaustavljeno."
        echo ""
        ;;

    restart)
        echo ""
        echo "  ╔══════════════════════════════════════════════════╗"
        echo "  ║           INVERUM — Restart (svježi kod)         ║"
        echo "  ╚══════════════════════════════════════════════════╝"
        echo ""

        stop_all
        sleep 1

        backend_start
        worker_start
        beat_start
        frontend_start

        sleep 2
        show_status

        echo ""
        ok "Restart gotov."
        echo ""
        ;;

    docker-up)
        docker_up
        ;;

    status)
        show_status
        ;;

    logs)
        show_logs
        ;;

    *)
        echo "Usage: $0 {start|stop|restart|docker-up|status|logs}"
        exit 1
        ;;
esac
