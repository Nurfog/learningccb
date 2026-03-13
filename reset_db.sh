#!/bin/bash

# Script para borrar y resetear las bases de datos de OpenCCB
# Uso: ./scripts/reset_db.sh

set -e

echo "🛑 Deteniendo servicios..."
docker compose stop studio experience

echo "🧹 Borrando bases de datos..."
docker exec openccb-db-1 psql -U user -d openccb -c "DROP DATABASE IF EXISTS openccb_cms;"
docker exec openccb-db-1 psql -U user -d openccb -c "DROP DATABASE IF EXISTS openccb_lms;"

echo "🏗️ Recreando bases de datos..."
docker exec openccb-db-1 psql -U user -d openccb -c "CREATE DATABASE openccb_cms;"
docker exec openccb-db-1 psql -U user -d openccb -c "CREATE DATABASE openccb_lms;"

echo "🚀 Reiniciando servicios..."
docker compose start studio experience

echo "⏳ Esperando que los servicios estén listos..."
sleep 5

echo "🏗️ Ejecutando migraciones..."
CMS_URL=$(grep "CMS_DATABASE_URL=" .env | cut -d'=' -f2-)
LMS_URL=$(grep "LMS_DATABASE_URL=" .env | cut -d'=' -f2-)
DATABASE_URL=$CMS_URL sqlx migrate run --source services/cms-service/migrations
DATABASE_URL=$LMS_URL sqlx migrate run --source services/lms-service/migrations

echo "✅ Base de datos reseteada y migraciones aplicadas exitosamente."
