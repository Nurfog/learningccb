#!/bin/bash

# OpenCCB Remote Setup Script
# Ejecutar en el servidor remoto después de deploy.sh

set -e

echo "===================================================="
echo "        🔧 OpenCCB Remote Setup"
echo "===================================================="
echo ""

# ========================================
# 1. Obtener Certificados SSL
# ========================================
echo "📜 Obteniendo certificados SSL..."

# Asegurar que nginx está corriendo en puerto 80
sudo systemctl start nginx || true

# Obtener certificados
sudo certbot certonly --webroot \
    -w /var/www/certbot \
    -d studio.norteamericano.com \
    -d learning.norteamericano.com \
    --email admin@norteamericano.com \
    --agree-tos \
    --non-interactive \
    --force-renewal || {
    echo "⚠️  Error obteniendo certificados. Continuando..."
}

echo "   ✅ Certificados obtenidos"
echo ""

# ========================================
# 2. Configurar HAProxy para OpenCCB
# ========================================
echo "⚙️  Configurando HAProxy para OpenCCB..."

# Backup de configuración actual
sudo cp /etc/haproxy/haproxy.cfg /etc/haproxy/haproxy.cfg.backup.$(date +%Y%m%d_%H%M%S)

# Agregar configuraciones de OpenCCB antes de frontend nginx_or_turn
sudo tee /etc/haproxy/openccb.cfg > /dev/null << 'EOF'
# ========================================
# OpenCCB Frontends (SSL Termination)
# ========================================

# Studio
frontend studio-https
    bind *:443 ssl crt /etc/letsencrypt/live/studio.norteamericano.com/fullchain.pem,/etc/letsencrypt/live/studio.norteamericano.com/privkey.pem ssl-min-ver TLSv1.2 alpn h2,http/1.1
    mode tcp
    option tcplog
    
    acl is_studio hdr(host) -i studio.norteamericano.com
    use_backend studio-http2 if { ssl_fc_alpn h2 } is_studio
    use_backend studio-http if { ssl_fc_alpn http/1.1 } is_studio

backend studio-http2
    mode tcp
    server studio 127.0.0.1:3000 send-proxy check

backend studio-http
    mode tcp
    server studio 127.0.0.1:3000 send-proxy check

# Learning
frontend learning-https
    bind *:443 ssl crt /etc/letsencrypt/live/learning.norteamericano.com/fullchain.pem,/etc/letsencrypt/live/learning.norteamericano.com/privkey.pem ssl-min-ver TLSv1.2 alpn h2,http/1.1
    mode tcp
    option tcplog
    
    acl is_learning hdr(host) -i learning.norteamericano.com
    use_backend learning-http2 if { ssl_fc_alpn h2 } is_learning
    use_backend learning-http if { ssl_fc_alpn http/1.1 } is_learning

backend learning-http2
    mode tcp
    server learning 127.0.0.1:3003 send-proxy check

backend learning-http
    mode tcp
    server learning 127.0.0.1:3003 send-proxy check

EOF

# Insertar configuración de OpenCCB antes de frontend nginx_or_turn
if ! grep -q "OpenCCB Frontends" /etc/haproxy/haproxy.cfg; then
    sudo sed -i '/^frontend nginx_or_turn/r /etc/haproxy/openccb.cfg' /etc/haproxy/haproxy.cfg
    echo "   ✅ Configuración de OpenCCB agregada a HAProxy"
else
    echo "   ℹ️  OpenCCB ya está configurado en HAProxy"
fi

# Verificar configuración
if sudo haproxy -c -f /etc/haproxy/haproxy.cfg; then
    echo "   ✅ Configuración de HAProxy válida"
    sudo systemctl reload haproxy
    echo "   ✅ HAProxy recargado"
else
    echo "   ❌ Error en configuración de HAProxy"
    echo "   Restaurando backup..."
    sudo cp /etc/haproxy/haproxy.cfg.backup.* /etc/haproxy/haproxy.cfg 2>/dev/null || true
    exit 1
fi
echo ""

# ========================================
# 3. Iniciar OpenCCB con Docker
# ========================================
echo "🐳 Iniciando OpenCCB..."

cd /var/www/openccb

# Verificar docker-compose.yml
if [ ! -f "docker-compose.yml" ]; then
    echo "   ❌ docker-compose.yml no encontrado"
    exit 1
fi

# Iniciar servicios
sudo docker compose up -d

# Esperar a que los servicios estén listos
echo "   ⏳ Esperando servicios..."
sleep 10

# Verificar estado
sudo docker compose ps
echo ""

# ========================================
# 4. Verificación Final
# ========================================
echo "===================================================="
echo "        ✅ Configuración Completada"
echo "===================================================="
echo ""
echo "🌐 URLs de acceso:"
echo "   https://studio.norteamericano.com"
echo "   https://learning.norteamericano.com"
echo ""
echo "📋 Verificación:"
echo "   # Ver certificados:"
echo "   sudo certbot certificates"
echo ""
echo "   # Ver HAProxy:"
echo "   sudo systemctl status haproxy"
echo ""
echo "   # Ver OpenCCB:"
echo "   sudo docker compose ps"
echo ""
echo "   # Ver logs:"
echo "   sudo docker compose logs -f"
echo ""
echo "⚠️  Si algo no funciona:"
echo "   1. Verifica que los DNS estén propagados"
echo "   2. Revisa logs: sudo tail -f /var/log/haproxy.log"
echo "   3. Verifica puertos: sudo netstat -tlnp | grep :443"
echo ""
