# Configuración de Modelos de IA - OpenCCB

## Visión General

OpenCCB utiliza una arquitectura de **múltiples modelos especializados** para optimizar el rendimiento y la calidad de las respuestas según el tipo de tarea.

## Modelos Disponibles

| Modelo | Tamaño | Uso Principal | Características |
|--------|--------|---------------|-----------------|
| `llama3.2:3b` | 2.0 GB | Chat, Tutor, Q&A | Rápido, eficiente, ideal para conversación en tiempo real |
| `qwen3.5:9b` | 6.6 GB | Razonamiento complejo | Mejor para análisis, feedback detallado, generación de quizzes |
| `gpt-oss:latest` | 13 GB | Tareas avanzadas | Modelo más capaz para generación de cursos, análisis predictivo |
| `nomic-embed-text` | 274 MB | Embeddings | Optimizado para búsqueda semántica (768 dimensiones) |

## Configuración por Defecto

### Variables de Entorno (.env)

```bash
# Modelo para chat conversacional (tutor, Q&A, discusión)
LOCAL_LLM_MODEL=llama3.2:3b

# Modelo para razonamiento complejo (quizzes, feedback, análisis)
LOCAL_LLM_MODEL_COMPLEX=qwen3.5:9b

# Modelo para tareas avanzadas (generación de cursos, analytics)
LOCAL_LLM_MODEL_ADVANCED=gpt-oss:latest

# Modelo para embeddings (búsqueda semántica)
EMBEDDING_MODEL=nomic-embed-text
```

## Asignación de Modelos por Feature

### 🎓 Experiencia del Estudiante (LMS)

| Feature | Modelo | Razón |
|---------|--------|-------|
| Chat con Tutor | `llama3.2:3b` | Respuestas rápidas, conversación fluida |
| Feedback de Audio | `qwen3.5:9b` | Análisis detallado de pronunciación y contenido |
| Recomendaciones | `qwen3.5:9b` | Evaluación compleja del desempeño |
| Búsqueda Semántica | `nomic-embed-text` | Embeddings optimizados para PGVector |
| Transcripción de Video | `whisper-large-v3` | Precisión en transcripción |

### 📚 Gestión de Cursos (CMS)

| Feature | Modelo | Razón |
|---------|--------|-------|
| Generación de Cursos | `gpt-oss:latest` | Estructura compleja, coherencia curricular |
| Generación de Quizzes | `qwen3.5:9b` | Preguntas pedagógicamente sólidas |
| Análisis de Dropout | `qwen3.5:9b` | Detección de patrones complejos |
| Chat con Lección | `llama3.2:3b` | Respuestas contextuales rápidas |

## Parámetros por Modelo

### llama3.2:3b (Chat)
```rust
temperature: 0.7      // Balance creatividad/precisión
max_tokens: 1024      // Respuestas concisas
top_p: 0.9           // Muestreo nuclear
```

### qwen3.5:9b (Complejo)
```rust
temperature: 0.5      // Más enfocado, menos aleatorio
max_tokens: 2048      // Respuestas detalladas
top_p: 0.8           // Más determinista
```

### gpt-oss:latest (Avanzado)
```rust
temperature: 0.6      // Balance para análisis
max_tokens: 4096      // Contenido extenso
top_p: 0.85          // Balance creatividad/coherencia
```

## Selección Automática de Modelos

El sistema selecciona automáticamente el modelo según la tarea:

```rust
use common::ai::{ModelType, get_model_for_task};

// Por tipo
let model = ModelType::Chat.get_model();        // llama3.2:3b
let model = ModelType::Complex.get_model();     // qwen3.5:9b
let model = ModelType::Advanced.get_model();    // gpt-oss:latest

// Por tarea (auto-detección)
let model = get_model_for_task("chat");         // llama3.2:3b
let model = get_model_for_task("quiz");         // qwen3.5:9b
let model = get_model_for_task("course");       // gpt-oss:latest
```

## Optimización de Rendimiento

### Tiempos de Respuesta Esperados

| Modelo | Tokens/s | Uso de VRAM | Latencia T1T |
|--------|----------|-------------|--------------|
| llama3.2:3b | ~50 tok/s | 2.5 GB | ~200ms |
| qwen3.5:9b | ~25 tok/s | 7 GB | ~500ms |
| gpt-oss:latest | ~15 tok/s | 14 GB | ~800ms |

### Recomendaciones

1. **Chat en tiempo real**: Usar siempre `llama3.2:3b`
2. **Procesamiento por lotes**: Usar `qwen3.5:9b` o `gpt-oss:latest`
3. **Embeddings**: `nomic-embed-text` es el más eficiente
4. **Memoria limitada**: Priorizar `llama3.2:3b`, descargar otros modelos si es necesario

## Comandos Útiles

```bash
# Listar modelos instalados
ollama list

# Instalar un modelo
ollama pull llama3.2:3b
ollama pull qwen3.5:9b
ollama pull gpt-oss:latest

# Eliminar un modelo
ollama rm nombre-modelo

# Probar un modelo
ollama run llama3.2:3b "Hola, ¿cómo estás?"

# Ver información del sistema
ollama ps
```

## Configuración en Producción

Para producción con múltiples usuarios concurrentes:

1. **Aumentar memoria VRAM**: Mínimo 16GB recomendado
2. **Usar CUDA**: Acelerar con GPU NVIDIA
3. **Rate limiting**: Configurar límites por usuario
4. **Cache de embeddings**: Reutilizar embeddings generados
5. **Batch processing**: Agrupar solicitudes de embeddings

## Troubleshooting

### Error: "model not found"
```bash
# Verificar modelos instalados
ollama list

# Instalar modelo faltante
ollama pull <nombre-modelo>

# Reiniciar servicio Ollama
sudo systemctl restart ollama
```

### Error: "out of memory"
```bash
# Verificar uso de memoria
ollama ps

# Descargar modelos no utilizados
ollama rm gpt-oss:latest  # Si no se usa frecuentemente
```

### Error: "request timeout"
```bash
# Aumentar timeout en .env
REQUEST_TIMEOUT=120

# Usar modelo más rápido
LOCAL_LLM_MODEL=llama3.2:3b
```

## Métricas de Uso

Para monitorear el uso de IA:

```sql
-- Ver uso por modelo
SELECT model, COUNT(*) as requests, SUM(tokens_used) as total_tokens
FROM ai_usage_logs
GROUP BY model
ORDER BY total_tokens DESC;

-- Ver uso por endpoint
SELECT endpoint, model, AVG(tokens_used) as avg_tokens
FROM ai_usage_logs
GROUP BY endpoint, model;
```

## Actualización de Modelos

Para actualizar a versiones más recientes:

```bash
# Forzar actualización
ollama pull --force llama3.2:3b

# Ver cambios en el modelo
ollama show llama3.2:3b --modelfile
```

---

**Última actualización**: 2026-03-20
**Versión**: 1.0
