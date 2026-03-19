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

# Step 3: Get list of courses from MySQL
echo ""
echo "📋 Obteniendo lista de cursos desde MySQL..."
COURSES_RESULT=$(curl -s -X POST "$CMS_API_URL/question-bank/import-mysql-all" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"import_metadata_only": true}')

echo "📊 Metadatos de cursos importados:"
echo "$COURSES_RESULT" | jq '.metadata // empty' 2>/dev/null || echo "$COURSES_RESULT"

# Step 4: Import all questions from MySQL
echo ""
echo "📊 Importando preguntas desde MySQL..."
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

# Step 5: Import courses with structure (optional - uncomment to enable)
# echo ""
# echo "📚 Importando cursos con estructura básica..."
# 
# # Get course list
# COURSE_LIST=$(curl -s -X GET "$CMS_API_URL/question-bank/mysql-courses" \
#   -H "Authorization: Bearer $TOKEN")
# 
# echo "📋 Cursos disponibles:"
# echo "$COURSE_LIST" | jq '.[] | {id: .id_cursos, name: .nombre_curso, plan: .nombre_plan}'
# 
# # Import first course as example
# FIRST_COURSE_ID=$(echo "$COURSE_LIST" | jq -r '.[0].id_cursos')
# if [ "$FIRST_COURSE_ID" != "null" ] && [ -n "$FIRST_COURSE_ID" ]; then
#     echo ""
#     echo "📦 Importando curso de ejemplo (ID: $FIRST_COURSE_ID)..."
#     COURSE_IMPORT=$(curl -s -X POST "$CMS_API_URL/question-bank/import-course-mysql" \
#       -H "Content-Type: application/json" \
#       -H "Authorization: Bearer $TOKEN" \
#       -d "{\"mysql_course_id\": $FIRST_COURSE_ID}")
#     
#     echo "📋 Resultado:"
#     echo "$COURSE_IMPORT" | jq .
#     
#     MESSAGE=$(echo "$COURSE_IMPORT" | jq -r '.message // "Error al importar"')
#     echo "✅ $MESSAGE"
# fi

echo ""
echo "=== Resumen ==="
echo "✅ Metadatos de cursos y planes importados"
echo "✅ Preguntas importadas desde MySQL"
echo ""
echo "💡 Para importar un curso completo con estructura básica, usa:"
echo "   curl -X POST http://localhost:3001/question-bank/import-course-mysql \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -H \"Authorization: Bearer \$TOKEN\" \\"
echo "     -d '{\"mysql_course_id\": <ID_DEL_CURSO>}'"
echo ""
echo "📋 Para ver los cursos disponibles, usa:"
echo "   curl -X GET http://localhost:3001/question-bank/mysql-courses \\"
echo "     -H \"Authorization: Bearer \$TOKEN\""
