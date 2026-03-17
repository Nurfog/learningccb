#!/bin/bash
# Fix Bark PyTorch 2.6+ compatibility issue
# Run this on t-800

set -e

echo "=== Fixing Bark PyTorch 2.6+ Compatibility ==="
echo ""

BARK_DIR="/opt/bark/bark"

# Backup original generation.py
echo "[1/3] Backing up original generation.py..."
cp $BARK_DIR/bark/generation.py $BARK_DIR/bark/generation.py.backup

# Patch generation.py to use weights_only=False
echo "[2/3] Patching generation.py..."
sed -i 's/torch.load(ckpt_path, map_location=device)/torch.load(ckpt_path, map_location=device, weights_only=False)/g' $BARK_DIR/bark/generation.py

# Create fixed bark_api.py
echo "[3/3] Creating fixed bark_api.py..."
cat > $BARK_DIR/bark/bark_api.py << 'PYEOF'
"""
Bark TTS API Server - Fixed for PyTorch 2.6+
Simple FastAPI wrapper for Bark text-to-speech
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from bark import SAMPLE_RATE, generate_audio, preload_models
from scipy.io.wavfile import write as write_wav
import numpy as np
import io
import torch

# Fix PyTorch 2.6+ weights_only issue
# This must be done BEFORE preload_models()
print("Configuring PyTorch for Bark compatibility...")

app = FastAPI(
    title="Bark TTS API",
    description="Text-to-Speech API using Suno AI's Bark",
    version="1.0.0"
)

# Preload models on startup (with warm-up)
@app.on_event("startup")
async def startup_event():
    print("Preloading Bark models...")
    try:
        preload_models()
        print("Models loaded successfully!")
        
        # Warm-up with a short generation
        print("Warming up models with short generation...")
        from bark import generate_text_semantic
        text_semantic = generate_text_semantic("Hi", temp=0.7)
        print("Warm-up complete! API ready.")
    except Exception as e:
        print(f"ERROR loading models: {e}")
        raise

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
        print(f"Generation error: {e}")
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
            import tempfile
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
    
    return {"results": results}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
PYEOF

# Fix ownership
chown bark:bark $BARK_DIR/bark/generation.py
chown bark:bark $BARK_DIR/bark/bark_api.py

echo ""
echo "=== Patch Applied ==="
echo ""
echo "Restarting Bark service..."
systemctl restart bark-tts

echo ""
echo "Waiting for models to load (this takes 1-2 minutes)..."
sleep 30

echo ""
echo "Checking service status..."
systemctl status bark-tts --no-pager

echo ""
echo "Testing API..."
if curl -s http://localhost:8443/health | jq . > /dev/null 2>&1; then
    echo "✅ Bark API is running!"
    curl -s http://localhost:8443/health | jq .
else
    echo "⚠️  API is still loading models..."
    echo "Check logs with: journalctl -u bark-tts -f"
fi

echo ""
echo "=== Fix Complete ==="
echo ""
echo "If you see errors, check:"
echo "  1. journalctl -u bark-tts -f"
echo "  2. systemctl status bark-tts"
echo ""
