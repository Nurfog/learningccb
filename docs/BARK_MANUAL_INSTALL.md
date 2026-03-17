# Instalación Manual de Bark TTS en t-800

## Opción A: Instalación Automática (Recomendada)

```bash
# 1. Copiar script a t-800
scp scripts/install_bark_tts.sh juan@t-800:/tmp/install_bark_tts.sh

# 2. Conectarse a t-800
ssh juan@t-800

# 3. Ejecutar instalación
chmod +x /tmp/install_bark_tts.sh
sudo /tmp/install_bark_tts.sh

# 4. Verificar instalación
curl http://localhost:8000/health
```

## Opción B: Instalación Paso a Paso

```bash
# Conectarse a t-800
ssh juan@t-800
# Contraseña: apoca11

# Actualizar sistema
sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-venv git ffmpeg curl

# Crear directorio
sudo mkdir -p /opt/bark
sudo chown juan:juan /opt/bark
cd /opt/bark

# Clonar Bark
git clone https://github.com/suno-ai/bark.git
cd bark

# Crear entorno virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install --upgrade pip
pip install -e .
pip install fastapi uvicorn[standard] python-multipart numpy scipy

# Crear archivo de API
cat > bark_api.py << 'PYEOF'
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from bark import SAMPLE_RATE, generate_audio, preload_models
from scipy.io.wavfile import write as write_wav
import numpy as np
import io

app = FastAPI(title="Bark TTS API", version="1.0.0")

print("Preloading Bark models...")
preload_models()
print("Models loaded!")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "bark-tts"}

@app.get("/api/voices")
async def list_voices():
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
    text: str = Query(..., min_length=1, max_length=500),
    voice: str = Query(default="v2/en_speaker_1"),
    speed: float = Query(default=1.0, ge=0.5, le=2.0),
    output_format: str = Query(default="wav", regex="^(mp3|wav|ogg)$")
):
    try:
        audio_array = generate_audio(text, history_prompt=voice)
        
        if speed != 1.0:
            new_length = int(len(audio_array) / speed)
            audio_array = audio_array[:new_length]
        
        audio_buffer = io.BytesIO()
        write_wav(audio_buffer, SAMPLE_RATE, audio_array)
        audio_buffer.seek(0)
        
        return StreamingResponse(
            audio_buffer,
            media_type="audio/wav",
            headers={"Content-Disposition": f"attachment; filename=speech.wav"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
PYEOF

# Crear servicio systemd
cat > /tmp/bark-tts.service << EOF
[Unit]
Description=Bark TTS API Server
After=network.target

[Service]
Type=simple
User=juan
Group=juan
WorkingDirectory=/opt/bark/bark
Environment="PATH=/opt/bark/bark/venv/bin"
ExecStart=/opt/bark/bark/venv/bin/uvicorn bark_api:app --host 0.0.0.0 --port 8000 --workers 1
Restart=always
RestartSec=10
MemoryMax=4G
MemoryHigh=3G
CPUQuota=80%

[Install]
WantedBy=multi-user.target
EOF

sudo mv /tmp/bark-tts.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable bark-tts
sudo systemctl start bark-tts

# Verificar
sudo systemctl status bark-tts
curl http://localhost:8000/health
```

## Prueba de Funcionamiento

```bash
# Test básico
curl "http://localhost:8000/api/generate?text=Hello%20World&voice=v2/en_speaker_1" -o test.wav

# Test desde OpenCCB
curl http://t-800:8000/health

# Ver logs
sudo journalctl -u bark-tts -f
```

## Configuración en OpenCCB

Agregar a `.env`:
```bash
BARK_API_URL=http://t-800:8000
# O para producción:
# BARK_API_URL=http://t-800.norteamericano.cl:8000
```

## Solución de Problemas

### Error: "Out of Memory"
```bash
# Reducir límite de memoria en systemd
sudo systemctl edit bark-tts
# Agregar:
# [Service]
# MemoryMax=2G
```

### Error: "Model not found"
```bash
# Reinstalar modelos
cd /opt/bark/bark
source venv/bin/activate
python -c "from bark import preload_models; preload_models()"
```

### Servicio no inicia
```bash
# Ver logs
sudo journalctl -u bark-tts -n 50

# Reiniciar
sudo systemctl restart bark-tts
```

## URLs de Acceso

- **Health**: http://t-800:8000/health
- **Voices**: http://t-800:8000/api/voices
- **Generate**: http://t-800:8000/api/generate?text=Hello&voice=v2/en_speaker_1

## Producción (t-800.norteamericano.cl)

Para producción, asegurar que:
1. El puerto 8000 esté abierto en el firewall
2. El dominio t-800.norteamericano.cl apunte a la IP correcta
3. Usar BARK_API_URL=http://t-800.norteamericano.cl:8000
