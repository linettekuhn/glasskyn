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

# --- 3: Seed templates ---
echo "Seeding templates..."
python -c "
from app.services.seed import seed_templates
from app.db.session import SessionLocal
db = SessionLocal()
try:
    count = seed_templates(db)
    if count:
        print(f'[seed] Inserted/updated {count} template(s)')
except Exception as e:
    print(f'[seed] Error: {e}')
finally:
    db.close()
"

# --- 4: Start FastAPI with hot reload ---
echo "Starting FastAPI dev server..."
exec uvicorn app.main:app --reload --host 0.0.0.0 --port 8000