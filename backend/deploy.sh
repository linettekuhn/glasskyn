#!/bin/bash
set -e
IMAGE_TAG=$1

echo "Backing up database..."
docker exec -t $(docker compose -f docker-compose.prod.yml ps -q db) pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup_$(date +%F_%H%M).sql

echo "Pulling new image..."
docker pull ghcr.io/linettekuhn/glasskyn-api:$IMAGE_TAG

echo "Running migration..."
docker run --rm --env-file .env.prod --network backend_default ghcr.io/linettekuhn/glasskyn-api:$IMAGE_TAG alembic upgrade head

echo "Restarting backend with new image..."
docker compose -f docker-compose.prod.yml stop api
docker compose -f docker-compose.prod.yml rm -f api
IMAGE_TAG=$IMAGE_TAG docker compose -f docker-compose.prod.yml up -d --no-deps api

echo "Done. Deployed $IMAGE_TAG"