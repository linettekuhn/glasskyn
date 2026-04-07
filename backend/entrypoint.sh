#!/bin/bash
set -e  # exit immediately if any command fails

# --- 1: Wait for Postgres ---
echo "Waiting for Postgres at $POSTGRES_HOST:$POSTGRES_PORT..."
until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER"; do
    sleep 1
done
echo "Postgres ready!"

# --- 2: Run Alembic migrations ---
echo "Running Alembic migrations..."
alembic upgrade head

# --- 3: Start FastAPI with hot reload ---
echo "Starting FastAPI dev server..."
exec uvicorn app.main:app --reload --host 0.0.0.0 --port 8000