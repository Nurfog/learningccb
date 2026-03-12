#!/bin/bash
# Script para generar un JWT_SECRET seguro para OpenCCB
# Este script genera una cadena aleatoria criptográficamente segura

set -e

echo "🔐 Generando JWT_SECRET seguro para OpenCCB..."
echo ""

# Generar una cadena aleatoria de 32 bytes (256 bits) en base64
JWT_SECRET=$(openssl rand -base64 32)

echo "✅ JWT_SECRET generado exitosamente:"
echo ""
echo "JWT_SECRET=$JWT_SECRET"
echo ""

# Preguntar si quiere actualizar el archivo .env
if [ -f ".env" ]; then
    read -p "¿Actualizar archivo .env existente? (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[SsYy]$ ]]; then
        # Crear backup del .env actual
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        echo "📦 Backup creado: .env.backup.*"
        
        # Actualizar o agregar JWT_SECRET en .env
        if grep -q "^JWT_SECRET=" .env; then
            sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
            echo "✅ JWT_SECRET actualizado en .env"
        else
            echo "JWT_SECRET=$JWT_SECRET" >> .env
            echo "✅ JWT_SECRET agregado a .env"
        fi
    fi
else
    echo "💡 No se encontró un archivo .env en el directorio actual."
    echo "   Puedes agregar esta línea a tu archivo .env:"
    echo ""
    echo "   JWT_SECRET=$JWT_SECRET"
fi

echo ""
echo "⚠️  IMPORTANTE: Guarda este valor en un lugar seguro."
echo "   Todos los tokens JWT existentes serán inválidos si cambias esta clave."
echo ""
