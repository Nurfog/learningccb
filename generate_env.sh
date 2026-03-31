#!/bin/bash

# Generate Secure .env for OpenCCB Production
# Este script genera un archivo .env con contraseñas seguras

set -e

echo "===================================================="
echo "        🔐 OpenCCB - Generar .env Seguro"
echo "===================================================="
echo ""

# Verificar que existe .env.example
if [ ! -f ".env.example" ]; then
    echo "❌ ERROR: .env.example no encontrado"
    exit 1
fi

# Generar DB_PASSWORD seguro (32 caracteres)
echo "🔑 Generando DB_PASSWORD segura..."
DB_PASS=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
echo "   ✅ DB_PASSWORD generada: $DB_PASS"

# Generar JWT_SECRET seguro (64 caracteres)
echo "🔑 Generando JWT_SECRET seguro..."
JWT_SEC=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)
echo "   ✅ JWT_SECRET generado: $JWT_SEC"

# Copiar .env.example a .env
echo "📋 Creando .env desde .env.example..."
cp .env.example .env

# Reemplazar valores
sed -i "s/DB_PASSWORD=CHANGE_ME_GENERATE_SECURE_PASSWORD/DB_PASSWORD=$DB_PASS/" .env
sed -i "s/JWT_SECRET=CHANGE_ME_GENERATE_SECURE_SECRET/JWT_SECRET=$JWT_SEC/" .env

# Reemplazar URLs de base de datos
sed -i "s|postgresql://user:CHANGE_ME_GENERATE_SECURE_PASSWORD@db:5432/openccb_cms|postgresql://user:${DB_PASS}@db:5432/openccb_cms|g" .env
sed -i "s|postgresql://user:CHANGE_ME_GENERATE_SECURE_PASSWORD@db:5432/openccb_lms|postgresql://user:${DB_PASS}@db:5432/openccb_lms|g" .env
sed -i "s|postgresql://user:CHANGE_ME_GENERATE_SECURE_PASSWORD@db:5432/openccb_cms|postgresql://user:${DB_PASS}@db:5432/openccb_cms|g" .env

echo ""
echo "✅ .env generado exitosamente"
echo ""
echo "===================================================="
echo "        📋 Credenciales Generadas"
echo "===================================================="
echo ""
echo "DB_PASSWORD: $DB_PASS"
echo "JWT_SECRET: $JWT_SEC"
echo ""
echo "⚠️  IMPORTANTE: Guarda estas credenciales en un lugar seguro"
echo "   No se pueden recuperar si se pierden"
echo ""
echo "📝 Para copiar al portapapeles (Linux):"
echo "   echo '$DB_PASS' | xclip -selection clipboard"
echo "   echo '$JWT_SEC' | xclip -selection clipboard"
echo ""
echo "📝 Para copiar al portapapeles (macOS):"
echo "   echo '$DB_PASS' | pbcopy"
echo "   echo '$JWT_SEC' | pbcopy"
echo ""
echo "===================================================="
