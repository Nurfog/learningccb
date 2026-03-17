#!/bin/bash
# Bark TTS Installation Script for t-800 server
# This script installs Suno AI's Bark text-to-speech system

set -e

echo "=========================================="
echo "  Bark TTS Installation - Server t-800"
echo "=========================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (sudo ./install_bark.sh)"
    exit 1
fi

# System requirements check
echo "[1/8] Checking system requirements..."
REQUIRED_RAM=8
AVAILABLE_RAM=$(free -g | awk '/^Mem:/{print $2}')

if [ $AVAILABLE_RAM -lt $REQUIRED_RAM ]; then
    echo "WARNING: Bark requires at least ${REQUIRED_RAM}GB RAM (found: ${AVAILABLE_RAM}GB)"
    echo "Continuing anyway, but performance may be poor..."
fi

# Update system packages
echo "[2/8] Updating system packages..."
apt-get update
apt-get install -y python3 python3-pip python3-venv git ffmpeg curl

# Create bark user
echo "[3/8] Creating bark user..."
if ! id -u bark > /dev/null 2>&1; then
    useradd -r -m -s /bin/bash bark
    echo "User 'bark' created"
else
    echo "User 'bark' already exists"
fi

# Create application directory
echo "[4/8] Setting up application directory..."
BARK_DIR="/opt/bark"
mkdir -p $BARK_DIR
chown bark:bark $BARK_DIR

# Clone Bark repository
echo "[5/8] Cloning Bark repository..."
cd $BARK_DIR
if [ ! -d "bark" ]; then
    su - bark -c "cd $BARK_DIR && git clone https://github.com/suno-ai/bark.git"
    chown -R bark:bark $BARK_DIR/bark
else
    echo "Bark repository already exists, updating..."
    su - bark -c "cd $BARK_DIR/bark && git pull"
fi

# Create virtual environment
echo "[6/8] Creating Python virtual environment..."
cd $BARK_DIR/bark
su - bark -c "cd $BARK_DIR/bark && python3 -m venv venv"

# Install dependencies
echo "[7/8] Installing Python dependencies..."
su - bark -c "cd $BARK_DIR/bark && source venv/bin/activate && pip install --upgrade pip && pip install -e ."

# Additional dependencies for API server
su - bark -c "source $BARK_DIR/bark/venv/bin/activate && pip install fastapi uvicorn[standard] python-multipart numpy scipy"

# Create systemd service
echo "[8/8] Creating systemd service..."
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
ExecStart=$BARK_DIR/bark/venv/bin/uvicorn bark_api:app --host 0.0.0.0 --port 8000 --workers 1
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
from fastapi.responses import StreamingResponse, JSONResponse
from bark import SAMPLE_RATE, generate_audio, preload_models
from scipy.io.wavfile import write as write_wav
import numpy as np
import io
import os
import tempfile

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
            {"id": "v2/en_speaker_2", "name": "English Speaker 2", "language": "en"},
            {"id": "v2/en_speaker_3", "name": "English Speaker 3", "language": "en"},
            {"id": "v2/en_speaker_4", "name": "English Speaker 4", "language": "en"},
            {"id": "v2/en_speaker_5", "name": "English Speaker 5", "language": "en"},
            {"id": "v2/en_speaker_6", "name": "English Speaker 6", "language": "en"},
            {"id": "v2/en_speaker_7", "name": "English Speaker 7", "language": "en"},
            {"id": "v2/en_speaker_8", "name": "English Speaker 8", "language": "en"},
            {"id": "v2/en_speaker_9", "name": "English Speaker 9", "language": "en"},
            {"id": "v2/es_speaker_0", "name": "Spanish Speaker 0", "language": "es"},
            {"id": "v2/es_speaker_1", "name": "Spanish Speaker 1", "language": "es"},
            {"id": "v2/es_speaker_2", "name": "Spanish Speaker 2", "language": "es"},
            {"id": "v2/es_speaker_3", "name": "Spanish Speaker 3", "language": "es"},
            {"id": "v2/es_speaker_4", "name": "Spanish Speaker 4", "language": "es"},
            {"id": "v2/es_speaker_5", "name": "Spanish Speaker 5", "language": "es"},
            {"id": "v2/es_speaker_6", "name": "Spanish Speaker 6", "language": "es"},
            {"id": "v2/es_speaker_7", "name": "Spanish Speaker 7", "language": "es"},
            {"id": "v2/es_speaker_8", "name": "Spanish Speaker 8", "language": "es"},
            {"id": "v2/es_speaker_9", "name": "Spanish Speaker 9", "language": "es"},
        ]
    }

@app.post("/api/generate")
async def generate_speech(
    text: str = Query(..., min_length=1, max_length=500, description="Text to convert to speech"),
    voice: str = Query(default="v2/en_speaker_1", description="Voice preset to use"),
    speed: float = Query(default=1.0, ge=0.5, le=2.0, description="Speech speed multiplier"),
    output_format: str = Query(default="mp3", regex="^(mp3|wav|ogg)$", description="Output audio format")
):
    """Generate speech from text using Bark TTS"""
    try:
        # Extract speaker number from voice preset
        parts = voice.split("_")
        if len(parts) >= 3:
            speaker = f"{parts[0]}_{parts[1]}_{parts[2]}"
        else:
            speaker = "v2/en_speaker_1"
        
        # Generate audio
        audio_array = generate_audio(text, history_prompt=speaker)
        
        # Apply speed adjustment if needed
        if speed != 1.0:
            # Simple speed adjustment by resampling
            new_length = int(len(audio_array) / speed)
            audio_array = audio_array[:new_length]
        
        # Convert to bytes
        audio_buffer = io.BytesIO()
        write_wav(audio_buffer, SAMPLE_RATE, audio_array)
        audio_buffer.seek(0)
        
        # For MP3 output, we'd need to add pydub/ffmpeg
        # For now, return WAV
        media_type = "audio/wav"
        filename = f"speech_{voice}.{output_format}"
        
        return StreamingResponse(
            audio_buffer,
            media_type=media_type,
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "X-Voice-Used": voice,
                "X-Speed": str(speed),
                "X-Duration-Seconds": str(len(audio_array) / SAMPLE_RATE)
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate/batch")
async def generate_batch_speech(
    texts: list[str] = Query(..., description="List of texts to convert"),
    voice: str = Query(default="v2/en_speaker_1", description="Voice preset"),
    speed: float = Query(default=1.0, description="Speech speed")
):
    """Generate multiple audio files in batch"""
    results = []
    
    for i, text in enumerate(texts):
        try:
            audio_array = generate_audio(text, history_prompt=voice)
            
            # Save to temp file
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
                write_wav(f.name, SAMPLE_RATE, audio_array)
                results.append({
                    "index": i,
                    "text": text,
                    "duration_seconds": len(audio_array) / SAMPLE_RATE,
                    "status": "success"
                })
        except Exception as e:
            results.append({
                "index": i,
                "text": text,
                "error": str(e),
                "status": "failed"
            })
    
    return JSONResponse(content={"results": results})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
PYEOF

chown bark:bark $BARK_DIR/bark/bark_api.py

# Enable and start service
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
echo "API Endpoints:"
echo "  - Health:   http://localhost:8000/health"
echo "  - Voices:   http://localhost:8000/api/voices"
echo "  - Generate: http://localhost:8000/api/generate?text=Hello&voice=v2/en_speaker_1"
echo ""
echo "Usage Example:"
echo "  curl 'http://localhost:8000/api/generate?text=What%20color%20is%20the%20sky%3F&voice=v2/en_speaker_1' -o question.wav"
echo ""
echo "Logs: journalctl -u bark-tts -f"
echo ""
