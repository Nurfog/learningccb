# PGVector Embeddings Implementation Guide

## Overview

OpenCCB now includes **semantic search capabilities** using PostgreSQL's `pgvector` extension and Ollama's embedding models. This enables:

1. **Semantic question search** - Find similar questions in the question bank
2. **Improved RAG for question generation** - Generate questions based on semantic similarity
3. **Enhanced AI tutor chat** - Better context retrieval from knowledge base

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│   User Query    │────▶│   Ollama     │────▶│  Embedding      │
│   (text)        │     │  (embeddings)│     │  Vector (384)   │
└─────────────────┘     └──────────────┘     └────────┬────────┘
                                                      │
                                                      ▼
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Search Results │◀────│  PostgreSQL  │◀────│  pgvector       │
│  (similar items)│     │  + pgvector  │     │  cosine search  │
└─────────────────┘     └──────────────┘     └─────────────────┘
```

## Installation

### 1. Update Docker Compose

Change the database image to include pgvector:

```yaml
# docker-compose.yml
services:
  db:
    image: pgvector/pgvector:pg16  # Was: postgres:16-alpine
```

### 2. Pull Embedding Model

```bash
docker pull ollama/ollama:latest
docker exec -it ollama ollama pull nomic-embed-text
```

### 3. Run Migrations

```bash
# CMS migrations (question_bank embeddings)
DATABASE_URL=postgresql://user:password@localhost:5433/openccb_cms \
  sqlx migrate run --source services/cms-service/migrations

# LMS migrations (knowledge_base embeddings)
DATABASE_URL=postgresql://user:password@localhost:5433/openccb_lms \
  sqlx migrate run --source services/lms-service/migrations
```

### 4. Generate Embeddings

After migration, generate embeddings for existing data:

```bash
# Generate question embeddings
curl -X POST http://localhost:3001/question-bank/embeddings/generate \
  -H "Authorization: Bearer YOUR_TOKEN"

# Generate knowledge base embeddings
curl -X POST http://localhost:3002/knowledge-base/embeddings/generate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## API Endpoints

### CMS (Port 3001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/question-bank/embeddings/generate` | Generate embeddings for all questions without them |
| POST | `/question-bank/{id}/embedding/regenerate` | Regenerate embedding for a specific question |
| GET | `/question-bank/semantic-search?query=...` | Search questions by semantic similarity |
| GET | `/question-bank/similar/{id}?threshold=0.85` | Find questions similar to a given question |

### LMS (Port 3002)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/knowledge-base/embeddings/generate` | Generate embeddings for knowledge base entries |
| POST | `/knowledge-base/{id}/embedding/regenerate` | Regenerate embedding for a specific entry |
| GET | `/knowledge-base/semantic-search?query=...` | Search knowledge base semantically |

## Configuration

### Environment Variables

```bash
# .env
LOCAL_OLLAMA_URL=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text
```

### Supported Embedding Models

| Model | Dimensions | Speed | Quality | Recommended |
|-------|------------|-------|---------|-------------|
| `nomic-embed-text` | 768 | Fast | Good | ✅ Default |
| `mxbai-embed-large` | 1024 | Medium | Better | For higher accuracy |
| `all-minilm` | 384 | Very Fast | Good | For resource-constrained |

Pull models with:
```bash
ollama pull nomic-embed-text
ollama pull mxbai-embed-large
ollama pull all-minilm
```

## Usage Examples

### 1. Semantic Question Search

```bash
curl -G "http://localhost:3001/question-bank/semantic-search" \
  -d "query=questions about past tense verbs" \
  -d "limit=10" \
  -d "threshold=0.6" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
[
  {
    "id": "uuid-here",
    "question_text": "Choose the correct past tense of 'to go'",
    "question_type": "multiple-choice",
    "similarity": 0.87,
    "tags": ["grammar", "past-tense"],
    "difficulty": "medium",
    "points": 1
  }
]
```

### 2. Find Duplicate Questions

```bash
curl -G "http://localhost:3001/question-bank/similar/{question-id}" \
  -d "threshold=0.95" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. RAG Question Generation (Enhanced)

```bash
curl -X POST "http://localhost:3001/test-templates/generate-with-rag" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "topic": "present perfect tense",
    "num_questions": 5
  }'
```

This now uses **semantic search** to find relevant questions from the bank, not just keyword matching.

## Performance Considerations

### Index Tuning

The migrations create IVFFlat indexes optimized for >10k rows. For larger datasets:

```sql
-- For 100k+ rows, increase lists parameter
DROP INDEX IF EXISTS idx_question_embeddings;
CREATE INDEX idx_question_embeddings 
ON question_bank 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 1000);  -- Default: 100
```

### Embedding Generation Speed

- ~50ms per embedding with Ollama (local)
- Batch generation: 100 questions ≈ 5 seconds
- Recommended: Generate embeddings in background during off-peak hours

### Query Performance

| Operation | Without Index | With IVFFlat |
|-----------|---------------|--------------|
| Similarity search (10k rows) | ~500ms | ~20ms |
| Similarity search (100k rows) | ~5s | ~50ms |

## Hybrid Search Strategy

The implementation uses a **hybrid approach**:

1. **First**: Try semantic search with embeddings (most accurate)
2. **Fallback**: Full-text search with tsvector (if embeddings unavailable)

This ensures the system works even if:
- Ollama is temporarily unavailable
- Embeddings haven't been generated yet
- You want to minimize latency for simple queries

## Database Schema

### Question Bank (CMS)

```sql
ALTER TABLE question_bank
ADD COLUMN embedding vector(384),
ADD COLUMN embedding_updated_at TIMESTAMPTZ;

CREATE INDEX idx_question_embeddings 
ON question_bank 
USING ivfflat (embedding vector_cosine_ops);
```

### Knowledge Base (LMS)

```sql
ALTER TABLE knowledge_base
ADD COLUMN embedding vector(384),
ADD COLUMN embedding_updated_at TIMESTAMPTZ;

CREATE INDEX idx_knowledge_base_embeddings 
ON knowledge_base 
USING ivfflat (embedding vector_cosine_ops);
```

## Troubleshooting

### "extension 'vector' does not exist"

Make sure you're using the pgvector Docker image:
```bash
docker-compose pull db
docker-compose down
docker-compose up -d db
```

### Slow semantic search

1. Check if index exists:
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'question_bank';
```

2. Verify index is being used:
```sql
EXPLAIN ANALYZE SELECT * FROM question_bank 
ORDER BY embedding <=> '[...]'::vector LIMIT 10;
```

### Embeddings not generating

1. Check Ollama is running:
```bash
curl http://localhost:11434/api/tags
```

2. Verify model is available:
```bash
ollama list | grep nomic-embed
```

3. Check logs for errors:
```bash
docker logs openccb-studio-1 | grep -i embedding
```

## Future Enhancements

Potential improvements:

1. **Multi-vector search** - Combine title, question, and explanation embeddings
2. **Cross-lingual embeddings** - Support Spanish/English/Portuguese semantic search
3. **Query rewriting** - Use LLM to improve search queries before embedding
4. **Caching** - Cache common query embeddings for faster response
5. **Analytics** - Track which questions are most similar/related

## References

- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [Ollama Embeddings API](https://github.com/ollama/ollama/blob/main/docs/api.md#generate-embeddings)
- [Nomic Embed Text Model](https://ollama.com/library/nomic-embed-text)
