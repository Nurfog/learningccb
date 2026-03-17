#!/bin/bash
# Manual Bark TTS Installation for t-800
# Run this ONCE on t-800 server

set -e

echo "=========================================="
echo "  Manual Bark TTS Installation"
echo "=========================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "Please run with: sudo ./install_bark_manual.sh"
    exit 1
fi

echo "[1/6] Installing system dependencies..."
apt-get update
apt-get install -y python3 python3-pip python3-venv git ffmpeg curl jq

echo ""
echo "[2/6] Creating bark user..."
if ! id -u bark > /dev/null 2>&1; then
    useradd -r -m -s /bin/bash bark
    echo "User 'bark' created"
else
    echo "User 'bark' already exists"
fi

echo ""
echo "[3/6] Setting up application directory..."
BARK_DIR="/opt/bark"
mkdir -p $BARK_DIR
chown bark:bark $BARK_DIR

echo ""
echo "[4/6] Cloning Bark repository..."
cd $BARK_DIR
su - bark -c "cd $BARK_DIR && git clone https://github.com/suno-ai/bark.git"
chown -R bark:bark $BARK_DIR/bark

echo ""
echo "[5/6] Creating Python virtual environment and installing dependencies..."
cd $BARK_DIR/bark
su - bark -c "cd $BARK_DIR/bark && python3 -m venv venv"
su - bark -c "cd $BARK_DIR/bark && source venv/bin/activate && pip install --upgrade pip"
su - bark -c "cd $BARK_DIR/bark && source venv/bin/activate && pip install -e ."
su - bark -c "cd $BARK_DIR/bark && source venv/bin/activate && pip install fastapi uvicorn[standard] python-multipart numpy scipy"

echo ""
echo "[6/6] Creating systemd service..."
cat > /etc/systemd/system/bark-tts.service << EOF
[Unit]
Description=Bark TTS API Server
After=network.target

[Service]
Type=simple
User=bark
Group=bark
WorkingDirectory=$BARK_DIR/bark
Environment="PATH=$BARK_DIR/bark/venv/bin"
ExecStart=$BARK_DIR/bark/venv/bin/uvicorn bark_api:app --host 0.0.0.0 --port 8443 --workers 1
Restart=always
RestartSec=10

# Memory limits
MemoryMax=4G
MemoryHigh=3G

# CPU limits
CPUQuota=80%

[Install]
WantedBy=multi-user.target
EOF

# Create Bark API wrapper
cat > $BARK_DIR/bark/bark_api.py << 'PYEOF'
"""
Bark TTS API Server
Simple FastAPI wrapper for Bark text-to-speech
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from bark import SAMPLE_RATE, generate_audio, preload_models
from scipy.io.wavfile import write as write_wav
import numpy as np
import io

app = FastAPI(
    title="Bark TTS API",
    description="Text-to-Speech API using Suno AI's Bark",
    version="1.0.0"
)

# Preload models on startup
print("Preloading Bark models...")
preload_models()
print("Models loaded!")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "bark-tts"}

@app.get("/api/voices")
async def list_voices():
    """List available voice presets"""
    return {
        "voices": [
            {"id": "v2/en_speaker_0", "name": "English Speaker 0", "language": "en"},
            {"id": "v2/en_speaker_1", "name": "English Speaker 1", "language": "en"},
            {"id": "v2/en_speaker_6", "name": "English Speaker 6", "language": "en"},
            {"id": "v2/es_speaker_0", "name": "Spanish Speaker 0", "language": "es"},
            {"id": "v2/es_speaker_1", "name": "Spanish Speaker 1", "language": "es"},
            {"id": "v2/es_speaker_3", "name": "Spanish Speaker 3", "language": "es"},
        ]
    }

@app.post("/api/generate")
async def generate_speech(
    text: str = Query(..., min_length=1, max_length=500, description="Text to convert to speech"),
    voice: str = Query(default="v2/en_speaker_1", description="Voice preset to use"),
    speed: float = Query(default=1.0, ge=0.5, le=2.0, description="Speech speed multiplier"),
    output_format: str = Query(default="wav", regex="^(mp3|wav|ogg)$", description="Output audio format")
):
    """Generate speech from text using Bark TTS"""
    try:
        # Generate audio
        audio_array = generate_audio(text, history_prompt=voice)
        
        # Apply speed adjustment if needed
        if speed != 1.0:
            new_length = int(len(audio_array) / speed)
            audio_array = audio_array[:new_length]
        
        # Convert to bytes
        audio_buffer = io.BytesIO()
        write_wav(audio_buffer, SAMPLE_RATE, audio_array)
        audio_buffer.seek(0)
        
        return StreamingResponse(
            audio_buffer,
            media_type="audio/wav",
            headers={
                "Content-Disposition": f"attachment; filename=speech.wav",
                "X-Voice-Used": voice,
                "X-Speed": str(speed),
                "X-Duration-Seconds": str(len(audio_array) / SAMPLE_RATE)
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
PYEOF

chown bark:bark $BARK_DIR/bark/bark_api.py

echo ""
echo "Enabling and starting service..."
systemctl daemon-reload
systemctl enable bark-tts
systemctl start bark-tts

echo ""
echo "=========================================="
echo "  Installation Complete!"
echo "=========================================="
echo ""
echo "Service Status:"
systemctl status bark-tts --no-pager
echo ""
echo "Waiting for Bark to preload models (this takes 1-2 minutes)..."
sleep 30

echo ""
echo "Testing API..."
if curl -s http://localhost:8000/health | jq . > /dev/null 2>&1; then
    echo "✅ Bark API is running!"
    curl -s http://localhost:8000/health | jq .
else
    echo "⚠️  API is starting up, models are loading..."
    echo "Check status with: systemctl status bark-tts"
    echo "View logs with: journalctl -u bark-tts -f"
fi

echo ""
echo "=========================================="
echo "  Next Steps"
echo "=========================================="
echo ""
echo "1. Test the API:"
echo "   curl 'http://localhost:8000/api/generate?text=Hello%20World&voice=v2/en_speaker_1' -o test.wav"
echo ""
echo "2. Check service status anytime:"
echo "   systemctl status bark-tts"
echo ""
echo "3. View logs:"
echo "   journalctl -u bark-tts -f"
echo ""
echo "4. Restart service if needed:"
echo "   systemctl restart bark-tts"
echo ""
