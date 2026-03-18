#!/bin/bash

# Import MySQL courses and question bank into PostgreSQL

CMS_API_URL="http://localhost:3001"
EMAIL="admin@norteamericano.cl"
PASSWORD="Admin123!"

echo "📥 Importando cursos y planes desde MySQL..."

# Step 1: Register admin user (in case it doesn't exist after DB reset)
echo "📝 Registrando usuario admin..."
REGISTER_RESULT=$(curl -s -X POST "$CMS_API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"full_name\":\"Administrador\"}")

echo "Registro: $REGISTER_RESULT"

# Step 2: Login to get JWT token
echo "🔑 Obteniendo token de autenticación..."
TOKEN=$(curl -s -X POST "$CMS_API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "❌ Error: No se pudo obtener el token. Verifica las credenciales."
    exit 1
fi

echo "✅ Token obtenido: ${TOKEN:0:20}..."

# Step 2: Import all from MySQL
echo "📊 Importando cursos, planes y preguntas desde MySQL..."
RESULT=$(curl -s -X POST "$CMS_API_URL/question-bank/import-mysql-all" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN")

echo "📋 Resultado:"
echo "$RESULT" | jq .

# Check if import was successful
IMPORTED=$(echo "$RESULT" | jq -r '.imported // 0')
if [ "$IMPORTED" != "null" ] && [ "$IMPORTED" -gt 0 ]; then
    echo "✅ Importación completada: $IMPORTED preguntas importadas"
else
    echo "⚠️  Revisa el resultado para más detalles"
fi
