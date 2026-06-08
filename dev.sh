#!/bin/bash
# =============================================================================
# dev.sh — Inverum development environment manager
#
# Usage:
#   ./dev.sh start      Pokreni sve (docker, backend, worker, beat, frontend)
#   ./dev.sh stop       Zaustavi sve
#   ./dev.sh restart    Stop + start (svježi kod)
#   ./dev.sh status     Prikaži što je živo
#   ./dev.sh logs       Prati logove backend + worker + frontend
# =============================================================================

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$ROOT/../inverum-frontend"
COMPOSE_FILE="$ROOT/docker/docker-compose.yml"
VENV="$ROOT/venv"
PID_DIR="$ROOT/.pids"

mkdir -p "$PID_DIR"

# ── Boje ────────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# ── Docker ────────────────────────────────────────────────────────────────────────
docker_up() {
    step "Docker services"
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

docker_down() {
    step "Docker services"
    docker compose -f "$COMPOSE_FILE" down 2>/dev/null || true
    ok "Docker services stopped"
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

    info "Starting Celery beat..."
    celery -A app.celery_app beat --loglevel=info &
    save_pid "celery-beat" $!
    ok "Celery beat started (pid $!) — dashboard stats every 2 min"
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
    step "Stopping all services"

    kill_pid "vite"
    kill_pid "celery-beat"
    kill_pid "celery-worker"
    kill_pid "uvicorn"

    # Clean up any orphans
    pkill -f "uvicorn app.main" 2>/dev/null || true
    pkill -f "celery.*worker" 2>/dev/null || true
    pkill -f "celery.*beat" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true

    ok "All processes stopped"
}

# ── Status ─────────────────────────────────────────────────────────────────────────
show_status() {
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

    # Docker
    if docker compose -f "$COMPOSE_FILE" ps --status running 2>/dev/null | grep -q 'Up'; then
        echo "  ├──────────┼──────────────────────────────────────────┤"
        docker compose -f "$COMPOSE_FILE" ps --format 'table {{.Name}}\t{{.Status}}' 2>/dev/null | tail -n +2 | while read line; do
            printf "  │ %-8s │ ${GREEN}●${NC} %-40s │\n" "$(echo "$line" | awk '{print $1}')" "$(echo "$line" | cut -d' ' -f2-)"
        done
    fi

    echo "  └──────────┴──────────────────────────────────────────┘"
    echo ""
}

# ── Logs ───────────────────────────────────────────────────────────────────────────
show_logs() {
    info "Tailing logs (Ctrl+C to stop)..."
    echo ""

    # Tail backend logs if running
    if [ -n "$(read_pid uvicorn)" ] && kill -0 "$(read_pid uvicorn)" 2>/dev/null; then
        warn "Backend logs not persisted — use terminal output"
    fi

    info "Docker logs:"
    docker compose -f "$COMPOSE_FILE" logs -f --tail=20 2>/dev/null &
    wait
}

# ── Main ───────────────────────────────────────────────────────────────────────────
case "${1:-start}" in
    start)
        echo ""
        echo "  ╔══════════════════════════════════════════════════╗"
        echo "  ║           INVERUM — Starting Dev Environment      ║"
        echo "  ╚══════════════════════════════════════════════════╝"
        echo ""

        docker_up
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
        echo "  Za zaustavljanje: ./dev.sh stop"
        echo "  Za restart:       ./dev.sh restart"
        echo "  Za status:        ./dev.sh status"
        echo ""
        ;;

    stop)
        stop_all
        docker_down
        echo ""
        ok "Sve zaustavljeno."
        echo ""
        ;;

    restart)
        echo ""
        echo "  ╔══════════════════════════════════════════════════╗"
        echo "  ║           INVERUM — Restarting (new code)        ║"
        echo "  ╚══════════════════════════════════════════════════╝"
        echo ""

        stop_all
        # Keep docker running — only restart app layer
        sleep 1

        backend_start
        worker_start
        beat_start
        frontend_start

        sleep 2
        show_status

        echo ""
        ok "Restart gotov sa svježim kodom."
        echo ""
        ;;

    status)
        show_status
        ;;

    logs)
        show_logs
        ;;

    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
