#!/bin/bash
# Deploy Bark TTS to t-800 server
# Usage: ./deploy_to_t800.sh

set -e

T800_HOST="t-800"
T800_USER="juan"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================="
echo "  Deploying Bark TTS to t-800"
echo "=========================================="
echo ""

# Check if SSH key exists
if [ ! -f ~/.ssh/id_rsa.pub ]; then
    echo "SSH key not found. Generating one..."
    ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N "" -C "openccb_bark_deployment"
    echo ""
    echo "Now copy your SSH key to t-800:"
    echo "  ssh-copy-id ${T800_USER}@${T800_HOST}"
    echo ""
    read -p "Press Enter after copying the key..."
fi

# Copy installation script to t-800
echo "Copying installation script to t-800..."
scp "${SCRIPT_DIR}/install_bark_tts.sh" ${T800_USER}@${T800_HOST}:/tmp/install_bark_tts.sh

# Execute installation on t-800 with pseudo-terminal
echo ""
echo "Connecting to t-800 and installing Bark TTS..."
echo "This may take 10-15 minutes depending on internet speed..."
echo "You'll be prompted for your password..."
echo ""

ssh -t ${T800_USER}@${T800_HOST} << 'ENDSSH'
    echo "Connected to t-800"
    echo "Hostname: $(hostname)"
    echo "Memory: $(free -h | grep Mem | awk '{print $2}')"
    echo "Disk: $(df -h / | tail -1 | awk '{print $4}') available"
    echo ""
    
    # Install jq if not present
    if ! command -v jq &> /dev/null; then
        echo "Installing jq..."
        sudo apt-get update && sudo apt-get install -y jq
    fi
    
    # Make script executable and run
    chmod +x /tmp/install_bark_tts.sh
    echo "Running Bark installation..."
    sudo /tmp/install_bark_tts.sh
    
    # Clean up
    rm /tmp/install_bark_tts.sh
    
    # Wait for service to be ready
    echo ""
    echo "Waiting for Bark API to be ready..."
    sleep 10
    
    # Test the API
    echo "Testing Bark API..."
    if curl -s http://localhost:8443/health | jq . > /dev/null 2>&1; then
        echo "✅ Bark API is running!"
        curl -s http://localhost:8443/health | jq .
    else
        echo "⚠️  API may still be starting up..."
        echo "Check status with: sudo systemctl status bark-tts"
        echo "View logs with: sudo journalctl -u bark-tts -f"
    fi
    
    echo ""
    echo "Bark TTS installation complete on t-800!"
ENDSSH

echo ""
echo "=========================================="
echo "  Deployment Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Add BARK_API_URL to your .env file:"
echo "   BARK_API_URL=http://t-800:8443"
echo ""
echo "2. Test the API:"
echo "   curl 'http://t-800:8443/api/generate?text=Hello%20World&voice=v2/en_speaker_1' -o test.wav"
echo ""
echo "3. Generate audio for questions in OpenCCB:"
echo "   POST /question-bank/{id}/generate-audio"
echo ""
