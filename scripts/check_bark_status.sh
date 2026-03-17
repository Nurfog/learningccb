#!/bin/bash
# Check and start Bark TTS service on t-800

echo "=== Checking Bark TTS Status on t-800 ==="
echo ""

# Check if systemd service exists
if systemctl list-unit-files | grep -q bark-tts; then
    echo "✅ Bark systemd service found"
    
    # Check service status
    echo ""
    echo "Service Status:"
    sudo systemctl status bark-tts --no-pager
    
    # If not running, try to start
    if ! systemctl is-active --quiet bark-tts; then
        echo ""
        echo "⚠️  Service is not running. Attempting to start..."
        sudo systemctl start bark-tts
        
        sleep 5
        
        if systemctl is-active --quiet bark-tts; then
            echo "✅ Service started successfully!"
        else
            echo "❌ Failed to start service. Checking logs..."
            echo ""
            echo "Recent logs:"
            sudo journalctl -u bark-tts -n 20 --no-pager
        fi
    else
        echo "✅ Service is running"
    fi
else
    echo "❌ Bark systemd service not found"
    echo ""
    echo "The installation may not have completed successfully."
    echo "Check if Bark is installed manually:"
    echo ""
    echo "  ls -la /opt/bark/bark/"
    echo "  ps aux | grep uvicorn"
    echo ""
    echo "To install manually, run:"
    echo "  ssh juan@t-800"
    echo "  sudo /tmp/install_bark_tts.sh  (if script exists)"
    echo ""
fi

# Test API if service is running
if systemctl is-active --quiet bark-tts; then
    echo ""
    echo "=== Testing Bark API ==="
    
    # Health check
    echo "Health endpoint:"
    curl -s http://localhost:8443/health | head -5
    
    echo ""
    echo ""
    echo "Voices endpoint:"
    curl -s http://localhost:8443/api/voices | head -10
    
    echo ""
    echo ""
    echo "=== API is accessible ==="
    echo "You can now generate audio with:"
    echo "  curl 'http://localhost:8443/api/generate?text=Hello%20World&voice=v2/en_speaker_1' -o test.wav"
fi
