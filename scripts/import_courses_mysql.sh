#!/bin/bash

# Import complete courses from MySQL with basic structure (modules and lessons)

CMS_API_URL="http://localhost:3001"
EMAIL="admin@norteamericano.cl"
PASSWORD="Admin123!"

echo "📚 Importación de Cursos desde MySQL"
echo "======================================"
echo ""

# Step 1: Login to get JWT token
echo "🔑 Obteniendo token de autenticación..."
TOKEN=$(curl -s -X POST "$CMS_API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "❌ Error: No se pudo obtener el token. Verifica las credenciales."
    echo "   Credenciales usadas: $EMAIL / $PASSWORD"
    exit 1
fi

echo "✅ Token obtenido: ${TOKEN:0:30}..."
echo ""

# Step 2: Import metadata first (courses and plans)
echo "📋 Importando metadatos de cursos y planes..."
METADATA_RESULT=$(curl -s -X POST "$CMS_API_URL/question-bank/import-mysql-all" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"import_metadata_only": true}')

echo "📊 Resultado:"
echo "$METADATA_RESULT" | jq '.metadata' 2>/dev/null || echo "$METADATA_RESULT"

STUDY_PLANS=$(echo "$METADATA_RESULT" | jq -r '.metadata.study_plans_imported // 0')
COURSES=$(echo "$METADATA_RESULT" | jq -r '.metadata.courses_imported // 0')

echo ""
echo "✅ Metadatos importados:"
echo "   - Planes de estudio: $STUDY_PLANS"
echo "   - Cursos: $COURSES"
echo ""

# Step 3: Show available courses
echo "📚 Cursos disponibles para importar:"
echo "-------------------------------------"
COURSE_LIST=$(curl -s -X GET "$CMS_API_URL/question-bank/mysql-courses" \
  -H "Authorization: Bearer $TOKEN")

echo "$COURSE_LIST" | jq -r '.[] | "   ID: \(.id_cursos) | \(.nombre_curso) | Plan: \(.nombre_plan) | Duración: \(.duracion)h"'

echo ""

# Step 4: Ask user which course to import
read -p "Ingresa el ID del curso a importar (o 'all' para importar todos, o 'q' para salir): " COURSE_ID

if [ "$COURSE_ID" = "q" ]; then
    echo "👋 Operación cancelada"
    exit 0
fi

if [ "$COURSE_ID" = "all" ]; then
    echo ""
    echo "📦 Importando TODOS los cursos..."
    
    # Get all course IDs
    COURSE_IDS=$(echo "$COURSE_LIST" | jq -r '.[].id_cursos')
    
    TOTAL=0
    SUCCESS=0
    FAILED=0
    
    for CID in $COURSE_IDS; do
        TOTAL=$((TOTAL + 1))
        echo ""
        echo "📦 Importando curso $CID ($TOTAL/$COURSES)..."
        
        RESULT=$(curl -s -X POST "$CMS_API_URL/question-bank/import-course-mysql" \
          -H "Content-Type: application/json" \
          -H "Authorization: Bearer $TOKEN" \
          -d "{\"mysql_course_id\": $CID}")
        
        if echo "$RESULT" | jq -e '.course_id' > /dev/null 2>&1; then
            MESSAGE=$(echo "$RESULT" | jq -r '.message')
            echo "✅ $MESSAGE"
            SUCCESS=$((SUCCESS + 1))
        else
            ERROR=$(echo "$RESULT" | jq -r '.error // "Error desconocido"')
            echo "❌ Error al importar curso $CID: $ERROR"
            FAILED=$((FAILED + 1))
        fi
    done
    
    echo ""
    echo "=== Resumen ==="
    echo "✅ Cursos importados exitosamente: $SUCCESS"
    echo "❌ Cursos fallidos: $FAILED"
    echo "📊 Total procesados: $TOTAL"
    
else
    # Import single course
    echo ""
    echo "📦 Importando curso ID: $COURSE_ID..."
    
    RESULT=$(curl -s -X POST "$CMS_API_URL/question-bank/import-course-mysql" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "{\"mysql_course_id\": $COURSE_ID}")
    
    echo "📋 Resultado:"
    echo "$RESULT" | jq .
    
    if echo "$RESULT" | jq -e '.course_id' > /dev/null 2>&1; then
        COURSE_TITLE=$(echo "$RESULT" | jq -r '.course_title')
        MODULES=$(echo "$RESULT" | jq -r '.modules_created')
        LESSONS=$(echo "$RESULT" | jq -r '.lessons_created')
        
        echo ""
        echo "✅ ¡Curso importado exitosamente!"
        echo "   - Título: $COURSE_TITLE"
        echo "   - Módulos creados: $MODULES"
        echo "   - Lecciones creadas: $LESSONS"
        echo ""
        echo "💡 Puedes ver el curso en: http://localhost:3000/courses"
    else
        ERROR=$(echo "$RESULT" | jq -r '.error // .message // "Error desconocido"')
        echo ""
        echo "❌ Error al importar el curso: $ERROR"
        exit 1
    fi
fi

echo ""
echo "=== Comandos Útiles ==="
echo ""
echo "📋 Ver cursos disponibles:"
echo "   curl -X GET http://localhost:3001/question-bank/mysql-courses \\"
echo "     -H \"Authorization: Bearer \$TOKEN\""
echo ""
echo "📦 Importar un curso específico:"
echo "   curl -X POST http://localhost:3001/question-bank/import-course-mysql \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -H \"Authorization: Bearer \$TOKEN\" \\"
echo "     -d '{\"mysql_course_id\": <ID>}'"
echo ""
