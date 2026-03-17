# Bark TTS Integration Guide

## Overview

OpenCCB now integrates with **Suno AI's Bark** text-to-speech system for generating audio versions of questions. This allows students to listen to questions instead of just reading them, improving accessibility and supporting different learning styles.

## Architecture

```
┌─────────────────┐     HTTP      ┌─────────────────┐
│   OpenCCB CMS   │ ────────────> │   Bark TTS API  │
│  (PostgreSQL)   │ <──────────── │   (Server t-800)│
│                 │    Audio      │                 │
└─────────────────┘               └─────────────────┘
```

## Deployment to t-800 Server

### Prerequisites

- SSH access to t-800 server
- At least 8GB RAM recommended (Bark loads large models)
- 10GB free disk space
- Python 3.8+
- GPU optional (CUDA support for faster generation)

### Quick Deploy

```bash
# From your local machine
cd /home/juan/dev/openccb
./scripts/deploy_to_t800.sh
```

This will:
1. SSH into t-800
2. Install Python dependencies
3. Clone Bark repository
4. Set up systemd service
5. Start the API server

### Manual Deploy

```bash
# SSH into t-800
ssh juan@t-800

# Run installation script
wget https://raw.githubusercontent.com/suno-ai/bark/main/scripts/install.sh
sudo bash install.sh
```

## API Endpoints

Once deployed, Bark API is available at `http://t-800:8000`

### Health Check
```bash
curl http://t-800:8000/health
```

### List Available Voices
```bash
curl http://t-800:8000/api/voices
```

### Generate Speech
```bash
# Basic usage
curl "http://t-800:8000/api/generate?text=What%20color%20is%20the%20sky%3F" \
  -o question.wav

# With specific voice and speed
curl "http://t-800:8000/api/generate?text=Hello%20World&voice=v2/en_speaker_6&speed=1.2" \
  -o greeting.wav

# Spanish voice
curl "http://t-800:8000/api/generate?text=Hola%20mundo&voice=v2/es_speaker_0" \
  -o saludo.wav
```

## Available Voices

### English Voices
- `v2/en_speaker_0` through `v2/en_speaker_9`

### Spanish Voices
- `v2/es_speaker_0` through `v2/es_speaker_9`

## Integration with OpenCCB

### Generate Audio for a Question

```bash
# Via API
curl -X POST "http://localhost:3001/question-bank/{question_id}/generate-audio" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "What color is the sky?",
    "voice": "v2/en_speaker_1",
    "speed": 1.0
  }'
```

### Automatic Audio Generation

When creating a question:

```json
POST /question-bank
{
  "question_text": "What is the capital of France?",
  "question_type": "multiple-choice",
  "options": ["Paris", "London", "Berlin", "Madrid"],
  "correct_answer": 0,
  "explanation": "Paris is the capital of France.",
  "generate_audio": true  // Triggers async audio generation
}
```

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Bark TTS API URL
BARK_API_URL=http://t-800:8000

# Optional: Default voice for audio generation
BARK_DEFAULT_VOICE=v2/en_speaker_1

# Optional: Default speed
BARK_DEFAULT_SPEED=1.0
```

## Performance Optimization

### Model Preloading

Bark preloads models on startup (takes ~30 seconds). The systemd service handles this automatically.

### Memory Management

The systemd service includes memory limits:
```ini
MemoryMax=4G
MemoryHigh=3G
```

Adjust based on your server's capacity.

### Batch Generation

For importing many questions:

```bash
# Generate audio for multiple questions
curl "http://t-800:8000/api/generate/batch?texts=Question%201&texts=Question%202&voice=v2/en_speaker_1"
```

## Troubleshooting

### Service Not Starting

```bash
# Check status
sudo systemctl status bark-tts

# View logs
sudo journalctl -u bark-tts -f

# Restart service
sudo systemctl restart bark-tts
```

### Out of Memory

If Bark crashes due to memory:
1. Reduce `MemoryMax` in systemd service
2. Use smaller models: `suno/bark-small`
3. Process questions one at a time

### Slow Generation

- GPU acceleration: Install CUDA-enabled PyTorch
- Reduce audio quality settings
- Use shorter text segments

## Testing

```bash
# Test English voice
curl "http://t-800:8000/api/generate?text=The%20quick%20brown%20fox&voice=v2/en_speaker_1" | play -

# Test Spanish voice
curl "http://t-800:8000/api/generate?text=El%20rápido%20zorro%20marrón&voice=v2/es_speaker_0" | play -
```

## Security Notes

- Bark API runs on internal network only
- No authentication required (assumes trusted network)
- Rate limiting handled by OpenCCB
- Audio files stored in `uploads/audio/` directory

## Future Enhancements

- [ ] Add authentication to Bark API
- [ ] Support for custom voice cloning
- [ ] Audio preprocessing (noise reduction, normalization)
- [ ] Caching layer for repeated requests
- [ ] WebSocket support for streaming audio

## References

- [Bark GitHub](https://github.com/suno-ai/bark)
- [Bark Hugging Face](https://huggingface.co/suno/bark)
- [OpenCCB Question Bank Documentation](../docs/question-bank.md)
