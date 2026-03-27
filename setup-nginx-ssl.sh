#!/bin/bash

# OpenCCB SSL Configuration Script
# Copia archivos de configuración para nginx con SSL
# Dominios: studio.norteamericano.com y learning.norteamericano.com
# NOTA: Asume que nginx ya está instalado en el servidor remoto

set -e

echo "===================================================="
echo "        🔒 OpenCCB SSL Configuration"
echo "===================================================="
echo ""

# Configuración
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
CERTBOT_PATH="/etc/letsencrypt"

echo "📋 Configuración:"
echo "   NGINX_SITES_AVAILABLE: $NGINX_SITES_AVAILABLE"
echo "   NGINX_SITES_ENABLED: $NGINX_SITES_ENABLED"
echo "   CERTBOT_PATH: $CERTBOT_PATH"
echo ""

# Verificar que nginx está instalado
if ! command -v nginx &> /dev/null; then
    echo "❌ ERROR: nginx no está instalado"
    exit 1
fi

echo "✅ nginx verificado: $(nginx -v 2>&1)"
echo ""

# Crear directorios si no existen
echo "📁 Verificando directorios..."
sudo mkdir -p "$NGINX_SITES_AVAILABLE"
sudo mkdir -p "$NGINX_SITES_ENABLED"
sudo mkdir -p /var/www/certbot
echo "   ✅ Directorios verificados"
echo ""

# ========================================
# Crear configuración de nginx para Studio (HTTP primero)
# ========================================
echo "📝 Creando configuración HTTP para studio.norteamericano.com..."

sudo tee /etc/nginx/sites-available/studio.norteamericano.com > /dev/null << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name studio.norteamericano.com;

    # ACME challenge para Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Todo el tráfico va al root para validación
    location / {
        return 200 "OpenCCB Studio - SSL Pending";
        add_header Content-Type text/plain;
    }
}
EOF

echo "   ✅ Configuración HTTP de studio creada"

# ========================================
# Crear configuración de nginx para Learning (HTTP primero)
# ========================================
echo "📝 Creando configuración HTTP para learning.norteamericano.com..."

sudo tee /etc/nginx/sites-available/learning.norteamericano.com > /dev/null << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name learning.norteamericano.com;

    # ACME challenge para Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Todo el tráfico va al root para validación
    location / {
        return 200 "OpenCCB Experience - SSL Pending";
        add_header Content-Type text/plain;
    }
}
EOF

echo "   ✅ Configuración HTTP de learning creada"

# ========================================
# Habilitar sitios
# ========================================
echo "🔗 Habilitando sitios..."

# Eliminar default si existe
sudo rm -f "$NGINX_SITES_ENABLED/default" 2>/dev/null || true

# Crear enlaces simbólicos
sudo ln -sf "$NGINX_SITES_AVAILABLE/studio.norteamericano.com" "$NGINX_SITES_ENABLED/studio.norteamericano.com"
sudo ln -sf "$NGINX_SITES_AVAILABLE/learning.norteamericano.com" "$NGINX_SITES_ENABLED/learning.norteamericano.com"

echo "   ✅ Sitios habilitados"
echo ""

# ========================================
# Verificar configuración de nginx
# ========================================
echo "🔍 Verificando configuración de nginx..."
if sudo nginx -t; then
    echo "   ✅ Configuración de nginx es válida"
    sudo systemctl reload nginx
    echo "   ✅ nginx recargado"
else
    echo "   ❌ ERROR: Configuración de nginx inválida"
    exit 1
fi
echo ""

# ========================================
# Crear script de instalación de certificados
# ========================================
echo "📝 Creando script de instalación de certificados..."

sudo tee /usr/local/bin/install-ssl-certs.sh > /dev/null << 'EOF'
#!/bin/bash

# Script para instalar certificados SSL con Let's Encrypt
# Ejecutar después de que el DNS esté propagado

set -e

echo "===================================================="
echo "        🔒 Instalación de Certificados SSL"
echo "===================================================="
echo ""

NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"

# Verificar certbot
if ! command -v certbot &> /dev/null; then
    echo "❌ certbot no está instalado"
    echo "   Instalando certbot..."
    sudo apt-get update
    sudo apt-get install -y certbot
fi

echo "✅ certbot verificado: $(certbot --version)"
echo ""

# Crear directorio para challenges
sudo mkdir -p /var/www/certbot

# Obtener certificados para studio
echo "📜 Obteniendo certificado para studio.norteamericano.com..."
sudo certbot certonly --webroot \
    -w /var/www/certbot \
    -d studio.norteamericano.com \
    --email admin@norteamericano.com \
    --agree-tos \
    --non-interactive \
    --force-renewal

echo "   ✅ Certificado de studio obtenido"
echo ""

# Obtener certificados para learning
echo "📜 Obteniendo certificado para learning.norteamericano.com..."
sudo certbot certonly --webroot \
    -w /var/www/certbot \
    -d learning.norteamericano.com \
    --email admin@norteamericano.com \
    --agree-tos \
    --non-interactive \
    --force-renewal

echo "   ✅ Certificado de learning obtenido"
echo ""

# ========================================
# Actualizar configuraciones de nginx con SSL
# ========================================
echo "📝 Actualizando configuraciones de nginx con SSL..."

# Studio con SSL
sudo tee /etc/nginx/sites-available/studio.norteamericano.com > /dev/null << 'NGINX_EOF'
server {
    listen 80;
    listen [::]:80;
    server_name studio.norteamericano.com;

    # ACME challenge para Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirigir HTTP a HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name studio.norteamericano.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/studio.norteamericano.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/studio.norteamericano.com/privkey.pem;

    # SSL optimizado
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Proxy a OpenCCB Studio (puerto 3000)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }

    # ACME challenge para renovación
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
}
NGINX_EOF

echo "   ✅ Configuración de studio actualizada con SSL"

# Learning con SSL
sudo tee /etc/nginx/sites-available/learning.norteamericano.com > /dev/null << 'NGINX_EOF'
server {
    listen 80;
    listen [::]:80;
    server_name learning.norteamericano.com;

    # ACME challenge para Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirigir HTTP a HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name learning.norteamericano.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/learning.norteamericano.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/learning.norteamericano.com/privkey.pem;

    # SSL optimizado
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Proxy a OpenCCB Experience (puerto 3003)
    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }

    # ACME challenge para renovación
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
}
NGINX_EOF

echo "   ✅ Configuración de learning actualizada con SSL"
echo ""

# Verificar que los certificados existen
if [ -f "/etc/letsencrypt/live/studio.norteamericano.com/fullchain.pem" ] && \
   [ -f "/etc/letsencrypt/live/learning.norteamericano.com/fullchain.pem" ]; then
    echo "✅ Certificados instalados exitosamente"
    echo ""
    
    # Verificar y recargar nginx
    echo "🔄 Verificando configuración de nginx..."
    if sudo nginx -t; then
        echo "   ✅ Configuración válida"
        echo "🔄 Recargando nginx..."
        sudo systemctl reload nginx
        echo "   ✅ nginx recargado"
    else
        echo "   ❌ ERROR: Configuración inválida"
        exit 1
    fi
    echo ""
    
    echo "===================================================="
    echo "        ✅ SSL Configurado Exitosamente"
    echo "===================================================="
    echo ""
    echo "🌐 URLs:"
    echo "   https://studio.norteamericano.com"
    echo "   https://learning.norteamericano.com"
    echo ""
    echo "📋 Los certificados se renovarán automáticamente"
    echo "   Renovación automática: certbot renew"
    echo ""
else
    echo "❌ ERROR: Los certificados no se instalaron correctamente"
    exit 1
fi
EOF

sudo chmod +x /usr/local/bin/install-ssl-certs.sh
echo "   ✅ Script de instalación creado: /usr/local/bin/install-ssl-certs.sh"
echo ""

# ========================================
# Crear script de renovación automática
# ========================================
echo "📝 Configurando renovación automática..."

sudo tee /etc/cron.daily/certbot-renewal > /dev/null << 'EOF'
#!/bin/bash
# Renovación automática de certificados SSL
/usr/local/bin/install-ssl-certs.sh --quiet 2>&1 | logger -t certbot-renewal
EOF

sudo chmod +x /etc/cron.daily/certbot-renewal
echo "   ✅ Renovación automática configurada (cron diario)"
echo ""

# ========================================
# Resumen
# ========================================
echo "===================================================="
echo "        ✅ Configuración SSL Completada"
echo "===================================================="
echo ""
echo "📋 Archivos creados:"
echo "   - /etc/nginx/sites-available/studio.norteamericano.com"
echo "   - /etc/nginx/sites-available/learning.norteamericano.com"
echo "   - /usr/local/bin/install-ssl-certs.sh"
echo "   - /etc/cron.daily/certbot-renewal"
echo ""
echo "🔍 Verificación de DNS:"
echo "   studio.norteamericano.com → $(dig +short studio.norteamericano.com | head -1)"
echo "   learning.norteamericano.com → $(dig +short learning.norteamericano.com | head -1)"
echo ""
echo "📝 Próximos pasos:"
echo "   1. Verifica que el DNS esté propagado (5-10 minutos)"
echo "   2. Ejecuta: sudo /usr/local/bin/install-ssl-certs.sh"
echo "   3. Inicia OpenCCB: docker-compose up -d"
echo ""
echo "🔒 Después de instalar certificados:"
echo "   https://studio.norteamericano.com"
echo "   https://learning.norteamericano.com"
echo ""
