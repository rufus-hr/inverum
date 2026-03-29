#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "Starting Docker services..."
docker compose -f docker/docker-compose.yml up -d

echo "Activating virtualenv..."
source venv/bin/activate

echo "Running migrations..."
alembic upgrade head

echo "Starting API..."
uvicorn app.main:app --reload
