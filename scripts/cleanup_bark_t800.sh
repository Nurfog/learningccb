#!/bin/bash
# Bark TTS Cleanup Script for t-800
# This script removes all Bark TTS components from the server

set -e

T800_HOST="t-800"
T800_USER="juan"

echo "=========================================="
echo "  Bark TTS Cleanup for t-800"
echo "=========================================="
echo ""
echo "This script will completely remove Bark TTS from t-800"
echo "Including:"
echo "  - Systemd service"
echo "  - Installation directory (/opt/bark)"
echo "  - User account (bark)"
echo "  - All cached models (~3.6 GB)"
echo ""

read -p "Continue? [y/N]: " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "❌ Cancelled"
    exit 0
fi

echo ""
echo "📤 Copying cleanup script to t-800..."

# Create cleanup script
cat > /tmp/cleanup_bark_remote.sh << 'INNEREOF'
#!/bin/bash
set -e

echo ""
echo "=== Stopping Bark Service ==="
sudo systemctl stop bark-tts 2>/dev/null && echo "✅ Service stopped" || echo "⚠️  Service not running"

echo ""
echo "=== Disabling Bark Service ==="
sudo systemctl disable bark-tts 2>/dev/null && echo "✅ Service disabled" || echo "⚠️  Service not enabled"

echo ""
echo "=== Removing Systemd Service ==="
if [ -f /etc/systemd/system/bark-tts.service ]; then
    sudo rm -f /etc/systemd/system/bark-tts.service
    sudo systemctl daemon-reload
    echo "✅ Systemd service removed"
else
    echo "⚠️  Systemd service not found"
fi

echo ""
echo "=== Removing Installation Directory ==="
if [ -d /opt/bark ]; then
    SIZE=$(du -sh /opt/bark 2>/dev/null | cut -f1)
    echo "📊 Directory size: $SIZE"
    sudo rm -rf /opt/bark
    echo "✅ Directory removed"
else
    echo "⚠️  Directory /opt/bark not found"
fi

echo ""
echo "=== Removing User Account ==="
if id bark &>/dev/null; then
    sudo userdel -r bark 2>/dev/null && echo "✅ User removed" || echo "⚠️  Could not remove user"
else
    echo "⚠️  User 'bark' does not exist"
fi

echo ""
echo "=== Cleaning Python Cache ==="
sudo rm -rf /root/.cache/pip 2>/dev/null || true
echo "✅ Cache cleaned"

echo ""
echo "=========================================="
echo "  Verification"
echo "=========================================="
echo ""

echo "Services:"
if systemctl list-unit-files 2>/dev/null | grep -q bark; then
    echo "❌ Bark services still exist:"
    systemctl list-unit-files 2>/dev/null | grep bark
else
    echo "✅ No Bark services found"
fi

echo ""
echo "Directories:"
if [ -d /opt/bark ]; then
    echo "❌ Directory still exists: /opt/bark"
else
    echo "✅ No Bark directories found"
fi

echo ""
echo "Users:"
if id bark &>/dev/null 2>&1; then
    echo "❌ User 'bark' still exists"
else
    echo "✅ User 'bark' removed"
fi

echo ""
echo "Processes:"
if ps aux | grep -v grep | grep -q "bark_api"; then
    echo "❌ Bark processes still running"
    ps aux | grep -v grep | grep "bark_api"
else
    echo "✅ No Bark processes running"
fi

echo ""
echo "Ports:"
if sudo netstat -tlnp 2>/dev/null | grep -q 8443; then
    echo "❌ Port 8443 still in use"
    sudo netstat -tlnp 2>/dev/null | grep 8443
else
    echo "✅ Port 8443 is free"
fi

echo ""
echo "Disk Space Recovered:"
echo "Previous: $(df -h /opt 2>/dev/null | tail -1 | awk '{print $4}') available"
echo ""

echo "=========================================="
echo "  ✅ Cleanup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Verify disk space: df -h"
echo "  2. Check available ports: sudo netstat -tlnp"
echo "  3. Continue with OpenCCB features"
echo ""
INNEREOF

# Copy to t-800
scp /tmp/cleanup_bark_remote.sh ${T800_USER}@${T800_HOST}:/tmp/cleanup_bark_remote.sh

echo ""
echo "🔌 Connecting to t-800 and running cleanup..."
echo ""

# Execute on t-800
ssh -t ${T800_USER}@${T800_HOST} << 'ENDSSH'
    chmod +x /tmp/cleanup_bark_remote.sh
    sudo /tmp/cleanup_bark_remote.sh
    
    # Clean up temp file
    rm /tmp/cleanup_bark_remote.sh
ENDSSH

echo ""
echo "=========================================="
echo "  Local Cleanup Complete"
echo "=========================================="
echo ""

# Clean up local temp file
rm -f /tmp/cleanup_bark_remote.sh

echo "✅ All Bark TTS components have been removed from t-800"
echo ""
echo "📊 Next Steps - Choose What to Do Next:"
echo ""
echo "  1️⃣  Question Bank (sin audio)"
echo "      - Crear preguntas manualmente"
echo "      - Importar desde MySQL"
echo "      - Generar con IA"
echo "      - Acceder: /question-bank"
echo ""
echo "  2️⃣  Token Usage Dashboard"
echo "      - Ver consumo de IA por usuario"
echo "      - Monitorear costos"
echo "      - Detectar alto consumo"
echo "      - Acceder: /admin/token-usage"
echo ""
echo "  3️⃣  Importar Preguntas desde MySQL"
echo "      - Traer preguntas del sistema legacy"
echo "      - Marcar para no duplicar"
echo "      - Asignar skills automáticamente"
echo ""
echo "💡 Recommended: Try all three!"
echo ""
echo "   cd /home/juan/dev/openccb"
echo "   # Start Studio"
echo "   cd web/studio && npm run dev"
echo ""
