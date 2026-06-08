#!/bin/bash
# =============================================================================
# dev.sh — Pokreće backend, celery (worker + beat), frontend
#
# Infrastruktura (postgres, valkey, minio) je na vanjskim VM-ovima i uvijek gore.
# =============================================================================

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$ROOT/../inverum-frontend"
VENV="$ROOT/venv"
PID_DIR="$ROOT/.pids"
mkdir -p "$PID_DIR"

GREEN='\033[0;32m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
info() { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()   { echo -e "${GREEN}[OK]${NC}    $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*"; }

# ── PID helpers ──────────────────────────────────────────────────────────────
save_pid() { echo "$2" > "$PID_DIR/$1.pid"; }
read_pid() { cat "$PID_DIR/$1.pid" 2>/dev/null || true; }
kill_pid() {
    local name="$1" pid
    pid=$(read_pid "$name")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
        wait "$pid" 2>/dev/null || true
        ok "$name stopped (pid $pid)"
    fi
    rm -f "$PID_DIR/$name.pid"
}

# ── Start ─────────────────────────────────────────────────────────────────────
start_all() {
    source "$VENV/bin/activate"

    info "Migrations..."
    alembic upgrade head

    info "Backend :8000..."
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
    save_pid "uvicorn" $!

    info "Celery worker..."
    celery -A app.celery_app worker \
        -Q inverum-worker-default,inverum-worker-imports \
        --loglevel=info --concurrency=2 &
    save_pid "worker" $!

    info "Celery beat..."
    celery -A app.celery_app beat --loglevel=info &
    save_pid "beat" $!

    info "Frontend :3000..."
    cd "$FRONTEND"
    npm install --silent 2>/dev/null || true
    npm run dev &
    save_pid "vite" $!
    cd "$ROOT"

    sleep 2

    echo ""
    ok "Sve gore."
    echo ""
    echo "  Frontend : http://localhost:3000"
    echo "  Backend  : http://localhost:8000"
    echo "  API Docs : http://localhost:8000/docs"
    echo ""
    echo "  Login: admin / admin / tenant: dev"
    echo ""
}

# ── Stop ──────────────────────────────────────────────────────────────────────
stop_all() {
    for svc in vite beat worker uvicorn; do
        kill_pid "$svc"
    done
    pkill -f "uvicorn app.main" 2>/dev/null || true
    pkill -f "celery" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    echo ""
    ok "Sve zaustavljeno."
    echo ""
}

# ── Status ─────────────────────────────────────────────────────────────────────
show_status() {
    echo ""
    for svc in uvicorn worker beat vite; do
        pid=$(read_pid "$svc")
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            printf "  ${GREEN}●${NC} %-10s pid %s\n" "$svc" "$pid"
        else
            printf "  ${RED}○${NC} %-10s stopped\n" "$svc"
        fi
    done
    echo ""
}

# ── Main ───────────────────────────────────────────────────────────────────────
case "${1:-start}" in
    start)   start_all ;;
    stop)    stop_all ;;
    restart) stop_all; sleep 1; start_all ;;
    status)  show_status ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
