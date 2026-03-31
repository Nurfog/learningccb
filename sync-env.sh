#!/bin/bash

# Sync .env.production to .env for local development
# This allows you to use the same configuration locally

set -e

echo "===================================================="
echo "        🔄 Sync .env.production to .env"
echo "===================================================="
echo ""

# Verificar que existe .env.production
if [ ! -f ".env.production" ]; then
    echo "❌ ERROR: .env.production no encontrado"
    echo ""
    echo "Ejecuta ./deploy.sh primero para descargarlo del servidor"
    exit 1
fi

# Hacer backup del .env actual si existe
if [ -f ".env" ]; then
    echo "📦 Creando backup de .env actual..."
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo "   ✅ Backup creado"
fi

# Copiar .env.production a .env
echo "📋 Copiando .env.production a .env..."
cp .env.production .env
echo "   ✅ .env actualizado"

echo ""
echo "===================================================="
echo "        ✅ Sync Completado"
echo "===================================================="
echo ""
echo "⚠️  IMPORTANTE: Las URLs de base de datos apuntan al servidor remoto"
echo "   Para desarrollo local, cambia 'db' por 'localhost' y ajusta el puerto"
echo ""
echo "Ejemplo para desarrollo local:"
echo "   CMS_DATABASE_URL=postgresql://user:password@localhost:5433/openccb_cms"
echo "   LMS_DATABASE_URL=postgresql://user:password@localhost:5433/openccb_lms"
echo ""
echo "📋 Para usar esta configuración en el servidor:"
echo "   1. Ejecuta: ./deploy.sh"
echo "   2. El script subirá el .env.production automáticamente"
echo ""
