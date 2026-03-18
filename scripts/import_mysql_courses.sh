#!/bin/bash

# Import MySQL courses and plans into PostgreSQL

CMS_API_URL="http://localhost:3001"
EMAIL="admin@norteamericano.cl"
PASSWORD="Admin123!"

echo "📥 Importando cursos y planes desde MySQL..."

# Step 1: Login to get JWT token
echo "🔑 Obteniendo token de autenticación..."
TOKEN=$(curl -s -X POST "$CMS_API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "❌ Error: No se pudo obtener el token."
    exit 1
fi

echo "✅ Token obtenido: ${TOKEN:0:20}..."

# Step 2: Import courses and plans from MySQL
echo "📊 Importando cursos y planes desde MySQL..."
RESULT=$(curl -s -X POST "$CMS_API_URL/question-bank/import-mysql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"import_all": true}')

echo "📋 Resultado:"
echo "$RESULT" | jq .

# Check result
COUNT=$(echo "$RESULT" | jq 'length')
if [ "$COUNT" != "null" ] && [ "$COUNT" -gt 0 ]; then
    echo "✅ Importación completada: $COUNT preguntas importadas"
else
    echo "⚠️  No se importaron preguntas"
fi

# Verify courses and plans
echo ""
echo "📊 Verificando datos importados..."
docker compose exec -T db psql -U user -d openccb_cms -c "SELECT COUNT(*) as planes FROM mysql_study_plans;" 2>/dev/null
docker compose exec -T db psql -U user -d openccb_cms -c "SELECT COUNT(*) as cursos FROM mysql_courses;" 2>/dev/null
