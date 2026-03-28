#!/bin/bash

# OpenCCB Unified Deployment Script
# Despliegue automático en AWS EC2 con SSL (Let's Encrypt)
# Servidor: ec2-18-224-137-67.us-east-2.compute.amazonaws.com
# Dominios: studio.norteamericano.com, learning.norteamericano.com

set -e

echo "===================================================="
echo "        🚀 OpenCCB Deployment Tool"
echo "===================================================="
echo ""

# ============================================================================
# CONFIGURACIÓN
# ============================================================================
PEM_PATH="ubuntu.pem"
REMOTE_USER="ubuntu"
REMOTE_HOST="ec2-18-224-137-67.us-east-2.compute.amazonaws.com"
REMOTE_PATH="/var/www/openccb"
# Cambiar a "false" para usar Let's Encrypt production (solo después de rate limits)
LETSENCRYPT_STAGING="true"
# Repositorio de Git
GIT_REPO="https://github.com/Nurfog/learningccb.git"
# ============================================================================

# Si PEM_PATH es relativo, convertirlo a absoluto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$PEM_PATH" != /* ]]; then
    PEM_PATH="$SCRIPT_DIR/$PEM_PATH"
fi

# Verificar que existe el archivo PEM
if [ ! -f "$PEM_PATH" ]; then
    echo "❌ ERROR: No se encontró el archivo $PEM_PATH"
    echo ""
    echo "Verifica la ruta de la llave SSH"
    exit 1
fi

echo "✅ Configuración cargada exitosamente"
echo ""
echo "📋 Configuración de despliegue:"
echo "   👤 Usuario: $REMOTE_USER"
echo "   🖥️  Host: $REMOTE_HOST"
echo "   📁 Destino: $REMOTE_PATH"
echo "   🔑 SSH Key: $PEM_PATH"
echo ""

# Preguntar si continuar
read -p "¿Desea continuar con el despliegue? [y/N]: " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "❌ Despliegue cancelado"
    exit 0
fi

echo ""
echo "📦 Preparando archivos para producción..."

# Crear directorio temporal
PROD_DIR="./.deploy-temp-$$"
mkdir -p "$PROD_DIR"

# Asegurar limpieza al finalizar
cleanup() {
    rm -rf "$PROD_DIR"
}
trap cleanup EXIT

# Copiar archivos esenciales
echo "   📋 Copiando archivos esenciales..."
cp -r docker-compose.yml "$PROD_DIR/" 2>/dev/null || echo "   ⚠️  docker-compose.yml no existe"
# NO copiar .env local - tiene configuraciones incorrectas para producción
echo "   ℹ️  .env local NO se copia - se generará uno correcto en el servidor"
cp -r .env.example "$PROD_DIR/" 2>/dev/null || true

# NO copiar ubuntu.pem - solo se usa localmente para SSH
echo "   ℹ️  ubuntu.pem NO se copia - solo para SSH local"

# Copiar servicios excluyendo target/ y node_modules/
echo "   - Copiando services/..."
mkdir -p "$PROD_DIR/services"
find services -type f \
    ! -path "*/target/*" \
    ! -path "*/node_modules/*" \
    -exec cp --parents {} "$PROD_DIR/" \; 2>/dev/null || true

# Copiar shared excluyendo target/ y node_modules/
echo "   - Copiando shared/..."
mkdir -p "$PROD_DIR/shared"
find shared -type f \
    ! -path "*/target/*" \
    ! -path "*/node_modules/*" \
    -exec cp --parents {} "$PROD_DIR/" \; 2>/dev/null || true

# Copiar web excluyendo .next/ y node_modules/
echo "   - Copiando web/..."
mkdir -p "$PROD_DIR/web"
find web -type f \
    ! -path "*/.next/*" \
    ! -path "*/node_modules/*" \
    -exec cp --parents {} "$PROD_DIR/" \; 2>/dev/null || true

# Copiar archivos root
cp -r Cargo.toml "$PROD_DIR/" 2>/dev/null || true
cp -r Cargo.lock "$PROD_DIR/" 2>/dev/null || true

# Copiar configuración de nginx
mkdir -p "$PROD_DIR/nginx"
if [ -f "nginx/proxy.conf" ]; then
    cp nginx/proxy.conf "$PROD_DIR/nginx/"
fi

echo "   ✅ Archivos esenciales copiados"

# Contar archivos
FILE_COUNT=$(find "$PROD_DIR" -type f | wc -l)
TOTAL_SIZE=$(du -sh "$PROD_DIR" | cut -f1)
echo "   ✅ $FILE_COUNT archivos listos ($TOTAL_SIZE)"
echo ""

# Verificar rsync
RSYNC_PATH=$(which rsync 2>/dev/null || echo "")
if [ -z "$RSYNC_PATH" ]; then
    echo "📦 Instalando rsync..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update -qq && sudo apt-get install -y rsync
    else
        echo "❌ Instala rsync manualmente: sudo apt-get install rsync"
        exit 1
    fi
    RSYNC_PATH=$(which rsync 2>/dev/null || echo "")
fi
echo "✅ rsync encontrado en: $RSYNC_PATH"
echo ""

# Sincronizar con servidor remoto
echo "🌐 Sincronizando con servidor remoto..."

# Verificar conectividad SSH
if ! ssh -i "$PEM_PATH" -o ConnectTimeout=10 -o BatchMode=yes "$REMOTE_USER@$REMOTE_HOST" "echo 'SSH OK'" &> /dev/null; then
    echo "   ❌ ERROR: No se pudo conectar vía SSH"
    echo "   Verifica:"
    echo "   1. Que el archivo $PEM_PATH existe"
    echo "   2. Que los permisos son correctos - chmod 400 $PEM_PATH"
    echo "   3. Que el host $REMOTE_HOST es accesible"
    exit 1
fi
echo "   ✅ SSH conectado exitosamente"
echo ""

# Crear directorio remoto
echo "   📁 Creando directorio remoto..."
ssh -i "$PEM_PATH" "$REMOTE_USER@$REMOTE_HOST" "sudo mkdir -p $REMOTE_PATH && sudo chown $REMOTE_USER:$REMOTE_USER $REMOTE_PATH"

# Sincronizar archivos
echo "   📤 Subiendo archivos con rsync..."
rsync -avz -e "ssh -i $PEM_PATH" \
    --progress \
    --rsync-path="sudo rsync" \
    --exclude 'node_modules' \
    --exclude 'target' \
    --exclude '.next' \
    --exclude '.git' \
    --exclude '.qwen' \
    "$PROD_DIR/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH"

if [ $? -ne 0 ]; then
    echo "   ❌ ERROR: rsync falló"
    exit 1
fi

rm -rf "$PROD_DIR"
echo ""
echo "✅ Archivos sincronizados exitosamente!"
echo ""

# ============================================================================
# SCRIPT REMOTO PARA GESTIÓN DE CONTENEDORES
# ============================================================================
echo "🔧 Ejecutando gestión de contenedores en remoto..."
echo ""

# ============================================================================
# PREGUNTAR DATOS DEL ADMINISTRADOR (LOCAL)
# ============================================================================
echo ""
echo "========================================"
echo "   Configuración del Administrador"
echo "========================================"
echo ""

# Preguntar datos del administrador
read -p "Nombre completo del administrador [Administrador]: " ADMIN_NAME
ADMIN_NAME=${ADMIN_NAME:-Administrador}

read -p "Email del administrador [admin@norteamericano.com]: " ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@norteamericano.com}

read -sp "Contraseña del administrador [Admin123!]: " ADMIN_PASS
echo ""
ADMIN_PASS=${ADMIN_PASS:-Admin123!}

read -p "Nombre de la organización [Norteamericano]: " ORG_NAME
ORG_NAME=${ORG_NAME:-Norteamericano}

echo ""
echo "========================================"
echo "   Configuración de Base de Datos"
echo "========================================"
echo ""
echo "¿Qué deseas hacer con la base de datos?"
echo "  1) Mantener datos existentes (recomendado para actualizaciones)"
echo "  2) Reiniciar base de datos (BORRAR todos los datos)"
echo ""
read -p "Opción [1/2]: " DB_OPTION
DB_OPTION=${DB_OPTION:-1}

if [[ "$DB_OPTION" =~ ^[2]$ ]]; then
    RESET_DATABASE="true"
    echo ""
    echo "⚠️  ADVERTENCIA: Se borrarán TODOS los datos de la base de datos"
    read -p "¿Estás seguro de continuar? [y/N]: " CONFIRM_RESET
    if [[ ! "$CONFIRM_RESET" =~ ^[Yy]$ ]]; then
        echo "❌ Operación cancelada - manteniendo base de datos"
        RESET_DATABASE="false"
    else
        echo "✅ Base de datos será reiniciada"
    fi
else
    RESET_DATABASE="false"
    echo "✅ Se mantendrán los datos existentes"
fi

echo ""
echo "----------------------------------------"
echo "Configuración SSL"
echo "----------------------------------------"
echo ""
echo "¿Deseas usar SSL con Let's Encrypt?"
echo "  - SI: Usará HTTPS (recomendado para producción)"
echo "  - NO: Usará HTTP (recomendado para pruebas o si hay rate limits)"
echo ""
read -p "¿Usar SSL? [y/N]: " USE_SSL
USE_SSL=${USE_SSL:-N}

if [[ "$USE_SSL" =~ ^[Yy]$ ]]; then
    echo ""
    echo "----------------------------------------"
    echo "Configuración de Certificados SSL"
    echo "----------------------------------------"
    echo ""
    echo "¿Ya tienes certificados SSL funcionando?"
    echo "  - SI: Preservar certificados existentes (recomendado)"
    echo "  - NO: Generar nuevos certificados"
    echo ""
    read -p "¿Preservar certificados? [y/N]: " PRESERVE_CERTS
    PRESERVE_CERTS=${PRESERVE_CERTS:-Y}
    
    if [[ "$PRESERVE_CERTS" =~ ^[Yy]$ ]]; then
        PRESERVE_SSL_CERTS="true"
        echo "✅ Se preservarán los certificados SSL existentes"
    else
        PRESERVE_SSL_CERTS="false"
        echo ""
        echo "¿Usar servidor de STAGING (certificados de prueba)?"
        echo "  - SI: Sin rate limits, pero el navegador muestra advertencias"
        echo "  - NO: Certificados reales, pero con rate limits (5 por semana)"
        echo ""
        read -p "¿Usar STAGING? [y/N]: " USE_STAGING
        USE_STAGING=${USE_STAGING:-Y}

        if [[ "$USE_STAGING" =~ ^[Yy]$ ]]; then
            LETSENCRYPT_STAGING="true"
            PROTOCOL="http"
            echo ""
            echo "✅ Configuración: STAGING (HTTP por ahora)"
            echo "   Los certificados de staging no son válidos para producción"
            echo "   Las llamadas API usarán HTTP para evitar errores de SSL"
        else
            LETSENCRYPT_STAGING="false"
            PROTOCOL="https"
            echo ""
            echo "✅ Configuración: PRODUCTION (HTTPS)"
            echo "   Se usarán certificados reales de Let's Encrypt"
        fi
    fi
else
    LETSENCRYPT_STAGING="false"
    PROTOCOL="http"
    PRESERVE_SSL_CERTS="false"
    echo ""
    echo "✅ Configuración: HTTP (sin SSL)"
fi

echo ""
echo "========================================"
echo "   Resumen de Configuración"
echo "========================================"
echo ""
echo "   Nombre: $ADMIN_NAME"
echo "   Email: $ADMIN_EMAIL"
echo "   Organización: $ORG_NAME"
echo "   Protocolo: $PROTOCOL"
echo "   SSL Staging: $LETSENCRYPT_STAGING"
echo "   Preservar SSL: $PRESERVE_SSL_CERTS"
echo "   Reiniciar DB: $RESET_DATABASE"
echo ""

# Crear script remoto en un archivo temporal
cat > /tmp/remote-deploy.sh << REMOTE_SCRIPT_CONTENT
set -e

# Variables pasadas desde el script local
LETSENCRYPT_STAGING=$LETSENCRYPT_STAGING
RESET_DATABASE=$RESET_DATABASE
PRESERVE_SSL_CERTS=$PRESERVE_SSL_CERTS
PROTOCOL=$PROTOCOL

cd /var/www/openccb

echo "========================================"
echo "   OpenCCB Remote Deployment"
echo "========================================"
echo ""
echo "Configuración:"
echo "  LETSENCRYPT_STAGING: \$LETSENCRYPT_STAGING"
echo "  RESET_DATABASE: \$RESET_DATABASE"
echo "  PRESERVE_SSL_CERTS: \$PRESERVE_SSL_CERTS"
echo "  PROTOCOL: \$PROTOCOL"
echo ""

# ========================================
# GENERAR .ENV CORRECTO PARA PRODUCCION
# ========================================
echo "Generando configuracion .env para produccion..."

if [ ! -f ".env" ]; then
    echo "   Creando .env desde .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
    else
        touch .env
    fi
fi

# Generar DB_PASSWORD seguro
if ! grep -q "^DB_PASSWORD=" .env || grep -q "CHANGE_ME" .env || grep -q "^DB_PASSWORD=password$" .env; then
    echo "   Generando DB_PASSWORD segura..."
    DB_PASS=$(openssl rand -base64 32 | tr -dc "a-zA-Z0-9" | head -c 32)
    if grep -q "^DB_PASSWORD=" .env; then
        sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=$DB_PASS/" .env
    else
        echo "DB_PASSWORD=$DB_PASS" >> .env
    fi
fi

# Generar JWT_SECRET seguro
if ! grep -q "^JWT_SECRET=" .env || grep -q "CHANGE_ME" .env || grep -q "secret.*2025" .env || grep -q "^JWT_SECRET=supersecret" .env; then
    echo "   Generando JWT_SECRET seguro..."
    JWT_SEC=$(openssl rand -base64 48 | tr -dc "a-zA-Z0-9" | head -c 64)
    if grep -q "^JWT_SECRET=" .env; then
        sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SEC/" .env
    else
        echo "JWT_SECRET=$JWT_SEC" >> .env
    fi
fi

# CORREGIR DATABASE_URL para produccion - db:5432
echo "   Configurando DATABASE_URL para Docker..."
DB_PASS=$(grep "^DB_PASSWORD=" .env | cut -d"=" -f2)

sed -i "/^CMS_DATABASE_URL=/d" .env 2>/dev/null || true
sed -i "/^LMS_DATABASE_URL=/d" .env 2>/dev/null || true
sed -i "/^DATABASE_URL=/d" .env 2>/dev/null || true

echo "CMS_DATABASE_URL=postgresql://user:${DB_PASS}@db:5432/openccb_cms" >> .env
echo "LMS_DATABASE_URL=postgresql://user:${DB_PASS}@db:5432/openccb_lms" >> .env
echo "DATABASE_URL=postgresql://user:${DB_PASS}@db:5432/openccb_cms" >> .env

# Configurar Let's Encrypt - staging o production
echo "   Configurando Let's Encrypt..."
if [ "$PRESERVE_SSL_CERTS" = "true" ]; then
    echo "   Preservando configuración SSL existente"
    # No modificar LETSENCRYPT_STAGING - mantener el valor existente
    if ! grep -q "^LETSENCRYPT_STAGING=" .env; then
        echo "LETSENCRYPT_STAGING=false" >> .env
    fi
else
    if [ "$LETSENCRYPT_STAGING" = "true" ]; then
        # Remover valor existente si existe
        sed -i "/^LETSENCRYPT_STAGING=/d" .env 2>/dev/null || true
        echo "LETSENCRYPT_STAGING=true" >> .env
        echo "   Usando STAGING - certificados de prueba"
    else
        # Remover valor existente si existe
        sed -i "/^LETSENCRYPT_STAGING=/d" .env 2>/dev/null || true
        echo "LETSENCRYPT_STAGING=false" >> .env
        echo "   Usando PRODUCTION - certificados reales"
    fi
fi

# Configurar URLs de la API para el frontend
echo "   Configurando URLs de la API para el frontend..."
if [ "$PROTOCOL" = "https" ]; then
    CMS_URL="https://studio.norteamericano.com"
    LMS_URL="https://learning.norteamericano.com"
else
    CMS_URL="http://studio.norteamericano.com"
    LMS_URL="http://learning.norteamericano.com"
fi

# Remover valores existentes
sed -i "/^NEXT_PUBLIC_CMS_API_URL=/d" .env 2>/dev/null || true
sed -i "/^NEXT_PUBLIC_LMS_API_URL=/d" .env 2>/dev/null || true

# Agregar URLs correctas (sin puertos - nginx proxy maneja el routing)
echo "NEXT_PUBLIC_CMS_API_URL=$CMS_URL" >> .env
echo "NEXT_PUBLIC_LMS_API_URL=$LMS_URL" >> .env
echo "   URLs configuradas:"
echo "     CMS: $CMS_URL"
echo "     LMS: $LMS_URL"
echo ""
REMOTE_SCRIPT_CONTENT

# Ahora agregamos la sección de Docker con las variables correctas
cat >> /tmp/remote-deploy.sh << REMOTE_SCRIPT_CONTENT

# ========================================
# ACTUALIZAR DOCKER-COMPOSE.YML SEGUN SSL
# ========================================
echo "Configurando docker-compose.yml para $PROTOCOL..."

# Reemplazar las URLs en docker-compose.yml
if [ "$PROTOCOL" = "https" ]; then
    sed -i 's|NEXT_PUBLIC_CMS_API_URL: http://|NEXT_PUBLIC_CMS_API_URL: https://|g' docker-compose.yml
    sed -i 's|NEXT_PUBLIC_LMS_API_URL: http://|NEXT_PUBLIC_LMS_API_URL: https://|g' docker-compose.yml
    echo "   ✅ URLs actualizadas a HTTPS"
else
    sed -i 's|NEXT_PUBLIC_CMS_API_URL: https://|NEXT_PUBLIC_CMS_API_URL: http://|g' docker-compose.yml
    sed -i 's|NEXT_PUBLIC_LMS_API_URL: https://|NEXT_PUBLIC_LMS_API_URL: http://|g' docker-compose.yml
    echo "   ✅ URLs actualizadas a HTTP"
fi

# Verificar configuración
echo ""
echo "Configuración de URLs en docker-compose.yml:"
grep "NEXT_PUBLIC_" docker-compose.yml | head -10
echo ""

# Verificar que los argumentos de build estén presentes
echo "Verificando argumentos de build..."
if grep -q "NEXT_PUBLIC_CMS_API_URL:" docker-compose.yml && grep -q "NEXT_PUBLIC_LMS_API_URL:" docker-compose.yml; then
    echo "   ✅ Ambos argumentos de build están presentes"
else
    echo "   ⚠️  Faltan argumentos de build, agregando..."
    # Agregar argumentos si faltan
    if ! grep -q "NEXT_PUBLIC_LMS_API_URL:" docker-compose.yml; then
        sed -i '/NEXT_PUBLIC_CMS_API_URL:/a\        NEXT_PUBLIC_LMS_API_URL: http://learning.norteamericano.com' docker-compose.yml
    fi
fi
echo ""

REMOTE_SCRIPT_CONTENT

# Ahora agregamos la sección de Docker con las variables correctas
cat >> /tmp/remote-deploy.sh << 'REMOTE_SCRIPT_CONTENT'

# ========================================
# VERIFICAR E INSTALAR DOCKER
# ========================================
echo "Verificando requerimientos del sistema..."

command_exists() {
    command -v "$1" &> /dev/null
}

# Docker
echo "Verificando Docker..."
if ! command_exists docker; then
    echo "   Docker no esta instalado, instalando..."
    curl -fsSL https://get.docker.com | sudo sh
    echo "   Docker instalado"
fi

# Verificar permisos de Docker
if docker ps &> /dev/null 2>&1; then
    DOCKER_CMD="docker"
elif sudo docker ps &> /dev/null 2>&1; then
    DOCKER_CMD="sudo docker"
    sudo usermod -aG docker $(whoami) 2>/dev/null || true
else
    echo "   ERROR: No se puede acceder a Docker"
    exit 1
fi

echo "   Usando: $DOCKER_CMD"

# Docker Compose
if ! $DOCKER_CMD compose version &> /dev/null 2>&1; then
    echo "   Instalando Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" \
        -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    sudo mkdir -p /usr/lib/docker/cli-plugins
    sudo ln -sf /usr/local/bin/docker-compose /usr/lib/docker/cli-plugins/docker-compose 2>/dev/null || true
    echo "   Docker Compose instalado"
fi

echo ""

# Funcion para ejecutar docker compose
run_docker_compose() {
    $DOCKER_CMD compose -f docker-compose.yml "$@"
}

# ========================================
# INICIAR SERVICIOS
# ========================================
echo "Iniciando servicios OpenCCB..."

# Detener contenedores existentes
echo "Deteniendo contenedores existentes..."
run_docker_compose down || true

# Eliminar contenedores antiguos para forzar reconstrucción
echo "Eliminando contenedores antiguos..."
$DOCKER_CMD rm openccb-studio 2>/dev/null || true
$DOCKER_CMD rm openccb-experience 2>/dev/null || true

# ========================================
# GESTIÓN DE BASE DE DATOS
# ========================================
if [ "$RESET_DATABASE" = "true" ]; then
    echo ""
    echo "⚠️  REINICIANDO BASE DE DATOS ⚠️"
    echo ""
    
    # Detener contenedores de nginx y ssl también para limpiar volúmenes
    echo "Deteniendo todos los contenedores..."
    run_docker_compose down
    
    # Eliminar volúmenes de base de datos
    echo "Eliminando volúmenes de base de datos..."
    $DOCKER_CMD volume rm openccb_postgres_data 2>/dev/null || true
    
    # Reiniciar contenedores
    echo "Reiniciando contenedores..."
    run_docker_compose up -d db
    
    echo "Esperando a que la base de datos este lista..."
    sleep 10
    
    # Crear bases de datos desde cero
    echo "Creando bases de datos..."
    $DOCKER_CMD exec openccb-db psql -U user -d postgres -c "DROP DATABASE IF EXISTS openccb_cms;" 2>/dev/null || true
    $DOCKER_CMD exec openccb-db psql -U user -d postgres -c "DROP DATABASE IF EXISTS openccb_lms;" 2>/dev/null || true
    $DOCKER_CMD exec openccb-db psql -U user -d postgres -c "CREATE DATABASE openccb_cms;" 2>/dev/null || echo "   Error al crear openccb_cms"
    $DOCKER_CMD exec openccb-db psql -U user -d postgres -c "CREATE DATABASE openccb_lms;" 2>/dev/null || echo "   Error al crear openccb_lms"
    
    echo "✅ Base de datos reiniciada correctamente"
else
    echo ""
    echo "✅ Manteniendo base de datos existente"
    echo ""
    
    # Iniciar base de datos
    echo "Iniciando base de datos..."
    run_docker_compose up -d db
    echo "Esperando a que la base de datos este lista..."
    sleep 10
    
    # Verificar si las bases de datos existen, si no, crearlas
    echo "Verificando bases de datos..."
    $DOCKER_CMD exec openccb-db psql -U user -d postgres -c "CREATE DATABASE openccb_cms;" 2>/dev/null || echo "   openccb_cms ya existe"
    $DOCKER_CMD exec openccb-db psql -U user -d postgres -c "CREATE DATABASE openccb_lms;" 2>/dev/null || echo "   openccb_lms ya existe"
fi

# ========================================
# GESTIÓN DE CERTIFICADOS SSL
# ========================================
if [ "$PRESERVE_SSL_CERTS" = "true" ]; then
    echo ""
    echo "✅ Preservando certificados SSL existentes"
    echo "   Iniciando nginx-proxy y acme-companion sin regenerar certificados..."
    
    # Iniciar nginx-proxy y acme-companion (los certificados ya existen)
    run_docker_compose up -d nginx-proxy acme-companion
    echo "Esperando a que nginx-proxy este listo..."
    sleep 10
else
    echo ""
    echo "Iniciando nginx-proxy y acme-companion para SSL..."
    
    # Iniciar nginx-proxy y acme-companion
    run_docker_compose up -d nginx-proxy acme-companion
    echo "Esperando a que nginx-proxy este listo..."
    sleep 10
    
    if [ "$LETSENCRYPT_STAGING" = "false" ]; then
        echo "   Generando certificados SSL de producción..."
    else
        echo "   Generando certificados SSL de staging..."
    fi
fi

# Limpiar caché de builder
echo "Limpiando caché de Docker builder..."
$DOCKER_CMD builder prune -f 2>/dev/null || true

# Reconstruir con las URLs correctas (sin cache para asegurar que tome los cambios)
echo "Reconstruyendo contenedores con las URLs configuradas..."
run_docker_compose build --no-cache studio experience

# Iniciar servicios
echo "Iniciando servicios OpenCCB..."
run_docker_compose up -d studio experience

echo ""
echo "Esperando a que los servicios esten listos..."
sleep 15

# ========================================
# VERIFICAR VARIABLES DE ENTORNO
# ========================================
echo ""
echo "Verificando variables de entorno en los contenedores..."
echo ""

# Verificar .env
echo "Variables en .env:"
grep "NEXT_PUBLIC_" .env 2>/dev/null || echo "   No se encontraron variables NEXT_PUBLIC"
echo ""

# Verificar en los contenedores
echo "Studio:"
$DOCKER_CMD exec openccb-studio env | grep NEXT_PUBLIC || echo "   No se pudo verificar"
echo ""
echo "Experience:"
$DOCKER_CMD exec openccb-experience env | grep NEXT_PUBLIC || echo "   No se pudo verificar"
echo ""

# Verificar que las URLs no tengan puertos
echo "Verificando que las URLs no tengan puertos..."
CMS_ENV=$(grep "NEXT_PUBLIC_CMS_API_URL" .env 2>/dev/null | cut -d"=" -f2)
LMS_ENV=$(grep "NEXT_PUBLIC_LMS_API_URL" .env 2>/dev/null | cut -d"=" -f2)

if echo "$CMS_ENV" | grep -q ":[0-9]"; then
    echo "   ⚠️  ADVERTENCIA: CMS_API_URL tiene puerto ($CMS_ENV)"
    echo "      Esto causará errores CORS. Debe ser solo el dominio."
else
    echo "   ✅ CMS_API_URL correcta: $CMS_ENV"
fi

if echo "$LMS_ENV" | grep -q ":[0-9]"; then
    echo "   ⚠️  ADVERTENCIA: LMS_API_URL tiene puerto ($LMS_ENV)"
    echo "      Esto causará errores CORS. Debe ser solo el dominio."
else
    echo "   ✅ LMS_API_URL correcta: $LMS_ENV"
fi
echo ""

# ========================================
# VERIFICAR ESTADO
# ========================================
echo ""
echo "Estado de contenedores:"
run_docker_compose ps

echo ""
echo "Verificando logs de errores..."
CMS_ERRORS=$(run_docker_compose logs studio 2>&1 | grep -i "error" | tail -5 || true)
LMS_ERRORS=$(run_docker_compose logs experience 2>&1 | grep -i "error" | tail -5 || true)

if [ -n "$CMS_ERRORS" ]; then
    echo "Errores en Studio:"
    echo "$CMS_ERRORS"
fi

if [ -n "$LMS_ERRORS" ]; then
    echo "Errores en Experience:"
    echo "$LMS_ERRORS"
fi

if [ -z "$CMS_ERRORS" ] && [ -z "$LMS_ERRORS" ]; then
    echo "No se detectaron errores criticos"
fi

echo ""

# ========================================
# CREAR USUARIO ADMINISTRADOR
# ========================================
echo "========================================"
echo "   Creando Usuario Administrador"
echo "========================================"
echo ""

echo "Esperando a que el API CMS este listo..."
sleep 10

# Intentar crear el usuario via API
echo "Creando usuario administrador..."

CMS_INTERNAL_URL="http://openccb-studio:3001"

# Crear payload JSON
cat > /tmp/admin_payload.json << EOF
{
  "email": "$ADMIN_EMAIL",
  "password": "$ADMIN_PASS",
  "full_name": "$ADMIN_NAME",
  "organization_name": "$ORG_NAME",
  "role": "admin"
}
EOF

# Copiar payload al servidor
scp -i "$PEM_PATH" /tmp/admin_payload.json "$REMOTE_USER@$REMOTE_HOST:/tmp/admin_payload.json" 2>/dev/null || true

# Intentar crear usuario via SSH
ssh -i "$PEM_PATH" "$REMOTE_USER@$REMOTE_HOST" "
    CMS_URL='$PROTOCOL://openccb-studio:3001'
    if [ -f /tmp/admin_payload.json ]; then
        RESPONSE=\$(curl -s -X POST \"\$CMS_URL/auth/register\" -H 'Content-Type: application/json' -d @/tmp/admin_payload.json 2>/dev/null || echo 'error')
        if echo \"\$RESPONSE\" | grep -qi 'token\\|user\\|success'; then
            echo 'Usuario creado via API'
        else
            echo 'Intentando via base de datos...'
            DOCKER_CMD=\$(docker ps &>/dev/null && echo 'docker' || echo 'sudo docker')
            \$DOCKER_CMD exec openccb-db psql -U user -d openccb_cms -c \"
                CREATE EXTENSION IF NOT EXISTS pgcrypto;
                SELECT * FROM fn_register_user(
                    '$ADMIN_EMAIL',
                    crypt('$ADMIN_PASS', gen_salt('bf', 12)),
                    '$ADMIN_NAME',
                    'admin',
                    '$ORG_NAME'
                );
            \" 2>/dev/null && echo 'Usuario creado' || echo 'No se pudo crear'
        fi
        rm -f /tmp/admin_payload.json
    fi
" 2>/dev/null || echo "No se pudo crear el usuario administrador"

rm -f /tmp/admin_payload.json

echo ""
echo "========================================"
echo "   CREDENCIALES DE ACCESO"
echo "========================================"
echo ""
echo "URLs de acceso:"
echo "   Studio - CMS:     $PROTOCOL://studio.norteamericano.com"
echo "   Experience - LMS: $PROTOCOL://learning.norteamericano.com"
echo ""
echo "Usuario Administrador:"
echo "   Email: $ADMIN_EMAIL"
echo "   Contraseña: $ADMIN_PASS"
echo ""
echo "Organizacion: $ORG_NAME"
echo ""

if [ "$PRESERVE_SSL_CERTS" = "true" ]; then
    echo "✅ Certificados SSL existentes preservados"
    echo "   Los certificados ya están activos y funcionando"
elif [ "$LETSENCRYPT_STAGING" = "true" ]; then
    echo "⚠️  Usando Let's Encrypt STAGING"
    echo "   Los certificados son de prueba - el navegador mostrara advertencias"
    echo "   Las APIs usan HTTP para evitar errores de SSL"
    echo "   Certificados se generaran en ~1 hora"
elif [ "$USE_SSL" = "y" ] || [ "$USE_SSL" = "Y" ]; then
    echo "✅ Usando Let's Encrypt PRODUCTION"
    echo "   Certificados reales se generaran en 2-5 minutos"
else
    echo "✅ Usando HTTP (sin SSL)"
fi

echo ""
echo "Credenciales de Base de Datos - GUARDAR EN LUGAR SEGURO:"
echo "   DB_PASSWORD: $(grep "^DB_PASSWORD=" .env | cut -d"=" -f2)"
echo "   JWT_SECRET: $(grep "^JWT_SECRET=" .env | cut -d"=" -f2)"
echo ""
echo "Comandos utiles:"
echo "   sudo docker compose ps"
echo "   docker logs acme-companion --tail 50"
echo "   docker logs openccb-studio --tail 20"
echo "   sudo docker compose restart"
echo ""

# Verificación de conectividad con Ollama
echo ""
echo "========================================"
echo "   Verificando Conectividad IA"
echo "========================================"
echo ""
echo "Probando conexión con Ollama (t-800.norteamericano.cl:11434)..."

OLLAMA_TEST=$(ssh -i "$PEM_PATH" "$REMOTE_USER@$REMOTE_HOST" "curl -s --connect-timeout 5 http://t-800.norteamericano.cl:11434/api/tags 2>&1 | head -1" 2>/dev/null)

if [ -n "$OLLAMA_TEST" ] && echo "$OLLAMA_TEST" | grep -q "models"; then
    echo "✅ Ollama accesible desde AWS EC2"
    echo "   Modelos disponibles:"
    ssh -i "$PEM_PATH" "$REMOTE_USER@$REMOTE_HOST" "curl -s http://t-800.norteamericano.cl:11434/api/tags 2>&1 | grep -o '\"name\":\"[^\"]*\"' | head -5" || true
else
    echo "⚠️  Ollama NO es accesible desde AWS EC2"
    echo ""
    echo "Posibles causas:"
    echo "   1. Firewall WAN In del UniFi bloquea el puerto 11434"
    echo "   2. Port forwarding no configurado en el router"
    echo "   3. Firewall de Ubuntu en t-800 bloquea conexiones"
    echo "   4. Ollama no está escuchando en 0.0.0.0"
    echo ""
    echo "Para verificar manualmente:"
    echo "   ssh -i \"$PEM_PATH\" $REMOTE_USER@$REMOTE_HOST"
    echo "   curl -v http://t-800.norteamericano.cl:11434/api/tags"
    echo ""
    echo "Configuración requerida en UniFi USG Pro 4:"
    echo "   1. Port Forwarding: 11434 -> 192.168.0.5:11434"
    echo "   2. Firewall WAN In Rule: Accept TCP 11434 from Any"
    echo ""
    echo "Ver documentación: CONFIGURACION_RED.md"
fi
echo ""
REMOTE_SCRIPT_CONTENT

# Copiar script al servidor
scp -i "$PEM_PATH" /tmp/remote-deploy.sh "$REMOTE_USER@$REMOTE_HOST:/tmp/openccb-remote.sh"

# Ejecutar script remoto
ssh -i "$PEM_PATH" "$REMOTE_USER@$REMOTE_HOST" "bash /tmp/openccb-remote.sh"
SCRIPT_EXIT=$?

# Limpiar archivo temporal
rm -f /tmp/remote-deploy.sh
ssh -i "$PEM_PATH" "$REMOTE_USER@$REMOTE_HOST" "rm -f /tmp/openccb-remote.sh"

echo ""

if [ $SCRIPT_EXIT -eq 0 ]; then
    echo "===================================================="
    echo "        Despliegue Completado Exitosamente"
    echo "===================================================="
    echo ""
    echo "Accede a tu plataforma:"
    echo "   Studio - CMS:     $PROTOCOL://studio.norteamericano.com"
    echo "   Experience - LMS: $PROTOCOL://learning.norteamericano.com"
    echo ""
    echo "Conectate para administrar:"
    echo "   ssh -i \"$PEM_PATH\" $REMOTE_USER@$REMOTE_HOST"
    echo "   cd $REMOTE_PATH"
    echo ""
    echo "Para actualizar en el futuro:"
    echo "   Ejecuta: ./deploy.sh"
    echo ""
else
    echo "===================================================="
    echo "        Despliegue Completado con Errores"
    echo "===================================================="
    echo ""
    echo "Error al ejecutar script remoto - codigo: $SCRIPT_EXIT"
    echo ""
    echo "Verifica manualmente:"
    echo "   ssh -i \"$PEM_PATH\" $REMOTE_USER@$REMOTE_HOST"
    echo "   cd $REMOTE_PATH"
    echo "   sudo docker compose ps"
    echo "   sudo docker compose logs"
    echo ""
fi

exit $SCRIPT_EXIT
