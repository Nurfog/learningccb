-- Migration: Add audio responses table for speaking practice
-- Allows students to submit audio recordings and teachers to evaluate them

-- Table to store student audio responses
CREATE TABLE IF NOT EXISTS audio_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL,
    course_id UUID NOT NULL,
    lesson_id UUID NOT NULL,
    block_id UUID NOT NULL,           -- ID del bloque audio-response dentro de la lección
    prompt TEXT NOT NULL,              -- La pregunta/instrucción original
    transcript TEXT,                   -- Transcripción del audio (generada por Whisper)
    audio_url TEXT,                    -- URL o path del archivo de audio almacenado
    audio_data BYTEA,                  -- Audio almacenado en base64 (opcional, para archivos pequeños)
    
    -- Evaluación de IA
    ai_score INTEGER,                  -- Puntaje de IA (0-100)
    ai_found_keywords TEXT[],          -- Keywords encontradas por la IA
    ai_feedback TEXT,                  -- Feedback de la IA
    ai_evaluated_at TIMESTAMPTZ,       -- Cuándo fue evaluado por IA
    
    -- Evaluación del profesor
    teacher_score INTEGER,             -- Puntaje del profesor (0-100)
    teacher_feedback TEXT,             -- Feedback del profesor
    teacher_evaluated_at TIMESTAMPTZ,  -- Cuándo fue evaluado por el profesor
    teacher_evaluated_by UUID,         -- ID del profesor que evaluó
    
    -- Estado y metadatos
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'ai_evaluated', 'teacher_evaluated', 'both_evaluated'
    attempt_number INTEGER NOT NULL DEFAULT 1,     -- Número de intento (permite reintentos)
    duration_seconds INTEGER,          -- Duración de la grabación en segundos
    metadata JSONB,                    -- Metadatos adicionales (calidad de audio, etc.)
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Foreign keys
    CONSTRAINT fk_audio_response_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_audio_response_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_audio_response_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    CONSTRAINT fk_audio_response_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
    CONSTRAINT fk_audio_response_teacher FOREIGN KEY (teacher_evaluated_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT chk_ai_score CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 100)),
    CONSTRAINT chk_teacher_score CHECK (teacher_score IS NULL OR (teacher_score >= 0 AND teacher_score <= 100)),
    CONSTRAINT chk_attempt_number CHECK (attempt_number >= 1)
);

-- Indexes for performance
CREATE INDEX idx_audio_responses_user_id ON audio_responses(user_id);
CREATE INDEX idx_audio_responses_course_id ON audio_responses(course_id);
CREATE INDEX idx_audio_responses_lesson_id ON audio_responses(lesson_id);
CREATE INDEX idx_audio_responses_block_id ON audio_responses(block_id);
CREATE INDEX idx_audio_responses_organization_id ON audio_responses(organization_id);
CREATE INDEX idx_audio_responses_status ON audio_responses(status);
CREATE INDEX idx_audio_responses_created_at ON audio_responses(created_at DESC);
CREATE INDEX idx_audio_responses_teacher_evaluated ON audio_responses(teacher_evaluated_at) WHERE teacher_evaluated_at IS NOT NULL;

-- Composite index for common queries
CREATE INDEX idx_audio_responses_user_lesson_block ON audio_responses(user_id, lesson_id, block_id);

-- Add comment
COMMENT ON TABLE audio_responses IS 'Almacena las respuestas de audio de los estudiantes para ejercicios de speaking practice';
COMMENT ON COLUMN audio_responses.status IS 'pending: sin evaluar, ai_evaluated: solo IA, teacher_evaluated: solo profesor, both_evaluated: ambos';

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_audio_responses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audio_responses_updated_at
    BEFORE UPDATE ON audio_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_audio_responses_updated_at();

-- View para profesores: respuestas pendientes de evaluación
CREATE VIEW v_pending_audio_responses AS
SELECT 
    ar.id,
    ar.user_id,
    u.full_name AS student_name,
    u.email AS student_email,
    ar.course_id,
    c.title AS course_title,
    ar.lesson_id,
    l.title AS lesson_title,
    ar.block_id,
    ar.prompt,
    ar.transcript,
    ar.ai_score,
    ar.ai_feedback,
    ar.status,
    ar.created_at,
    ar.attempt_number
FROM audio_responses ar
JOIN users u ON ar.user_id = u.id
JOIN courses c ON ar.course_id = c.id
JOIN lessons l ON ar.lesson_id = l.id
WHERE ar.teacher_evaluated_at IS NULL
ORDER BY ar.created_at DESC;

-- View para estadísticas de evaluación
CREATE VIEW v_audio_response_stats AS
SELECT 
    organization_id,
    course_id,
    lesson_id,
    COUNT(*) AS total_responses,
    COUNT(*) FILTER (WHERE ai_score IS NOT NULL) AS ai_evaluated,
    COUNT(*) FILTER (WHERE teacher_score IS NOT NULL) AS teacher_evaluated,
    COUNT(*) FILTER (WHERE status = 'both_evaluated') AS fully_evaluated,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending,
    AVG(ai_score) FILTER (WHERE ai_score IS NOT NULL) AS avg_ai_score,
    AVG(teacher_score) FILTER (WHERE teacher_score IS NOT NULL) AS avg_teacher_score
FROM audio_responses
GROUP BY organization_id, course_id, lesson_id;
