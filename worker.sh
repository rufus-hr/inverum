#!/bin/bash
set -e

cd "$(dirname "$0")"

source venv/bin/activate

celery -A app.celery_app worker \
    -Q inverum-worker-imports,inverum-worker-default \
    --loglevel=info
