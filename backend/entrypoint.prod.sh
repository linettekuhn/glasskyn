#!/bin/bash
set -e

echo "Waiting for Postgres..."
until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER"; do
    sleep 1
done
echo "Postgres ready!"

echo "Running Alembic migrations..."
alembic upgrade head

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

echo "Starting FastAPI server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
