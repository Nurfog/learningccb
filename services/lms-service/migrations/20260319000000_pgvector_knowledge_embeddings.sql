-- PGVector Embeddings for Knowledge Base (LMS)
-- Enables semantic search for AI tutor chat with RAG

-- Enable pgvector extension (should already be enabled from CMS)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to knowledge_base table
-- Using 768 dimensions for nomic-embed-text model
ALTER TABLE knowledge_base
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Add embedding_updated_at timestamp
ALTER TABLE knowledge_base
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

-- Create index for fast semantic search (IVFFlat for >10k rows)
-- Adjust lists parameter based on expected data size:
-- lists = rows / 1000 for < 1M rows
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embeddings 
ON knowledge_base 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Create index for filtering by embedding status
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding_updated 
ON knowledge_base (embedding_updated_at);

-- Function to search knowledge base by semantic similarity
CREATE OR REPLACE FUNCTION search_knowledge_semantic(
    p_course_id UUID,
    p_query_embedding vector(768),
    p_limit INTEGER DEFAULT 10,
    p_threshold REAL DEFAULT 0.5
)
RETURNS TABLE (
    id UUID,
    course_id UUID,
    lesson_id UUID,
    block_id UUID,
    content_chunk TEXT,
    similarity REAL,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kb.id,
        kb.course_id,
        kb.lesson_id,
        kb.block_id,
        kb.content_chunk,
        1 - (kb.embedding <=> p_query_embedding) AS similarity,
        kb.metadata
    FROM knowledge_base kb
    WHERE kb.course_id = p_course_id
      AND kb.embedding IS NOT NULL
      AND 1 - (kb.embedding <=> p_query_embedding) >= p_threshold
    ORDER BY kb.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to search knowledge base across all courses (for admin/global search)
CREATE OR REPLACE FUNCTION search_knowledge_global(
    p_query_embedding vector(768),
    p_limit INTEGER DEFAULT 20,
    p_threshold REAL DEFAULT 0.6
)
RETURNS TABLE (
    id UUID,
    course_id UUID,
    course_name VARCHAR,
    lesson_id UUID,
    lesson_title VARCHAR,
    content_chunk TEXT,
    similarity REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kb.id,
        kb.course_id,
        c.name AS course_name,
        kb.lesson_id,
        l.title AS lesson_title,
        kb.content_chunk,
        1 - (kb.embedding <=> p_query_embedding) AS similarity
    FROM knowledge_base kb
    LEFT JOIN courses c ON c.id = kb.course_id
    LEFT JOIN lessons l ON l.id = kb.lesson_id
    WHERE kb.embedding IS NOT NULL
      AND 1 - (kb.embedding <=> p_query_embedding) >= p_threshold
    ORDER BY kb.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get contextual chunks for a specific lesson
-- Combines semantic search with exact lesson matching
CREATE OR REPLACE FUNCTION get_lesson_context(
    p_lesson_id UUID,
    p_query_embedding vector(768),
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    content_chunk TEXT,
    similarity REAL,
    is_exact_lesson BOOLEAN,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kb.id,
        kb.content_chunk,
        1 - (kb.embedding <=> p_query_embedding) AS similarity,
        (kb.lesson_id = p_lesson_id) AS is_exact_lesson,
        kb.metadata
    FROM knowledge_base kb
    WHERE kb.embedding IS NOT NULL
      AND (kb.lesson_id = p_lesson_id OR 1 - (kb.embedding <=> p_query_embedding) >= 0.6)
    ORDER BY 
        (kb.lesson_id = p_lesson_id) DESC,
        kb.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Comments
COMMENT ON COLUMN knowledge_base.embedding IS 'Semantic embedding vector for RAG search (nomic-embed-text, 384 dimensions)';
COMMENT ON COLUMN knowledge_base.embedding_updated_at IS 'Timestamp when embedding was last generated';
COMMENT ON FUNCTION search_knowledge_semantic IS 'Search knowledge base by semantic similarity within a course';
COMMENT ON FUNCTION search_knowledge_global IS 'Search knowledge base across all courses (global admin search)';
COMMENT ON FUNCTION get_lesson_context IS 'Get contextual chunks for a lesson, prioritizing exact lesson match';
