-- PGVector Embeddings Integration
-- Enables semantic search for question bank and RAG generation

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to question_bank table
-- Using 768 dimensions for nomic-embed-text model
ALTER TABLE question_bank
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Add embedding_updated_at timestamp
ALTER TABLE question_bank
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

-- Create index for fast semantic search (IVFFlat for >10k rows)
CREATE INDEX IF NOT EXISTS idx_question_embeddings 
ON question_bank 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Create index for filtering by embedding status
CREATE INDEX IF NOT EXISTS idx_question_embedding_updated 
ON question_bank (embedding_updated_at);

-- Function to calculate cosine similarity between two embeddings
CREATE OR REPLACE FUNCTION question_similarity(
    q1_id UUID,
    q2_id UUID
)
RETURNS REAL AS $$
BEGIN
    RETURN (
        SELECT qb1.embedding <=> qb2.embedding
        FROM question_bank qb1, question_bank qb2
        WHERE qb1.id = q1_id AND qb2.id = q2_id
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to find similar questions (for duplicate detection)
CREATE OR REPLACE FUNCTION find_similar_questions(
    p_question_id UUID,
    p_threshold REAL DEFAULT 0.85,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    question_text TEXT,
    similarity REAL,
    question_type question_bank_type
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        qb.id,
        qb.question_text,
        1 - (qb.embedding <=> (SELECT embedding FROM question_bank WHERE id = p_question_id)) AS similarity,
        qb.question_type
    FROM question_bank qb
    WHERE qb.id != p_question_id
      AND qb.organization_id = (SELECT organization_id FROM question_bank WHERE id = p_question_id)
      AND qb.embedding IS NOT NULL
    ORDER BY qb.embedding <=> (SELECT embedding FROM question_bank WHERE id = p_question_id)
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to search questions by semantic similarity
CREATE OR REPLACE FUNCTION search_questions_semantic(
    p_organization_id UUID,
    p_query_embedding vector(768),
    p_limit INTEGER DEFAULT 20,
    p_threshold DOUBLE PRECISION DEFAULT 0.5
)
RETURNS TABLE (
    id UUID,
    question_text TEXT,
    question_type question_bank_type,
    similarity DOUBLE PRECISION,
    tags TEXT[],
    difficulty VARCHAR,
    points INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        qb.id,
        qb.question_text,
        qb.question_type,
        (1 - (qb.embedding <=> p_query_embedding))::DOUBLE PRECISION AS similarity,
        qb.tags,
        qb.difficulty,
        qb.points
    FROM question_bank qb
    WHERE qb.organization_id = p_organization_id
      AND qb.embedding IS NOT NULL
      AND (1 - (qb.embedding <=> p_query_embedding))::DOUBLE PRECISION >= p_threshold
    ORDER BY qb.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get diverse questions covering multiple topics
-- Uses Maximal Marginal Relevance (MMR) to balance relevance and diversity
CREATE OR REPLACE FUNCTION get_diverse_questions(
    p_organization_id UUID,
    p_query_embedding vector(768),
    p_limit INTEGER DEFAULT 10,
    p_lambda DOUBLE PRECISION DEFAULT 0.7 -- 0 = max diversity, 1 = max relevance
)
RETURNS TABLE (
    id UUID,
    question_text TEXT,
    question_type question_bank_type,
    similarity DOUBLE PRECISION
) AS $$
DECLARE
    selected_ids UUID[] := ARRAY[]::UUID[];
    candidate_id UUID;
    best_score REAL;
    current_score REAL;
    diversity_score REAL;
    relevance_score REAL;
BEGIN
    -- Simple MMR implementation: iteratively select questions
    -- that are relevant but dissimilar to already selected ones
    FOR i IN 1..p_limit LOOP
        SELECT qb.id INTO candidate_id
        FROM question_bank qb
        WHERE qb.organization_id = p_organization_id
          AND qb.id != ALL(selected_ids)
          AND qb.embedding IS NOT NULL
        ORDER BY 
            (1 - (qb.embedding <=> p_query_embedding)) * p_lambda - 
            (COALESCE((
                SELECT MAX(1 - (qb.embedding <=> qb2.embedding))
                FROM unnest(selected_ids) AS sid
                JOIN question_bank qb2 ON qb2.id = sid
            ), 0)) * (1 - p_lambda)
        DESC
        LIMIT 1;
        
        EXIT WHEN candidate_id IS NULL;
        
        selected_ids := array_append(selected_ids, candidate_id);
    END LOOP;
    
    RETURN QUERY
    SELECT 
        qb.id,
        qb.question_text,
        qb.question_type,
        1 - (qb.embedding <=> p_query_embedding) AS similarity
    FROM question_bank qb
    WHERE qb.id = ANY(selected_ids)
    ORDER BY similarity DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Comments
COMMENT ON COLUMN question_bank.embedding IS 'Semantic embedding vector for similarity search (nomic-embed-text, 384 dimensions)';
COMMENT ON COLUMN question_bank.embedding_updated_at IS 'Timestamp when embedding was last generated';
COMMENT ON FUNCTION question_similarity IS 'Calculate cosine similarity between two questions';
COMMENT ON FUNCTION find_similar_questions IS 'Find questions similar to a given question (for duplicate detection)';
COMMENT ON FUNCTION search_questions_semantic IS 'Search questions by semantic similarity using embedding vector';
COMMENT ON FUNCTION get_diverse_questions IS 'Get diverse questions using Maximal Marginal Relevance (MMR)';
