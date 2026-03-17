-- Question Bank: Centralized repository for reusable questions
-- Supports multiple question types, audio generation, and multi-tenant organization

-- Question types supported by the platform
CREATE TYPE question_bank_type AS ENUM (
    'multiple-choice',      -- Multiple choice with single/multiple correct answers
    'true-false',           -- True/False questions
    'short-answer',         -- Short text answer
    'essay',                -- Long form text answer
    'matching',             -- Match pairs
    'ordering',             -- Order items correctly
    'fill-in-the-blanks',   -- Fill in missing words
    'audio-response',       -- Record audio answer
    'hotspot',              -- Click on image area
    'code-lab'              -- Code exercise
);

-- Question Bank table
CREATE TABLE question_bank (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Question content
    question_text TEXT NOT NULL,
    question_type question_bank_type NOT NULL,
    
    -- Answers and options (structure depends on question_type)
    options JSONB,          -- Array of options for multiple-choice/true-false
    correct_answer JSONB,   -- Correct answer(s) - format varies by type
    explanation TEXT,       -- Explanation shown after answering (AI generated or manual)
    
    -- Audio support (Bark TTS)
    audio_url TEXT,         -- URL to generated audio file
    audio_text TEXT,        -- Text used for audio generation (may differ from question_text)
    audio_status VARCHAR(50) DEFAULT 'pending', -- pending, generating, ready, failed
    audio_metadata JSONB,   -- Bark generation parameters
    
    -- Media support
    media_url TEXT,         -- Image/video URL for hotspot or context questions
    media_type VARCHAR(50), -- image, video
    
    -- Metadata
    points INTEGER NOT NULL DEFAULT 1,
    difficulty VARCHAR(20) DEFAULT 'medium', -- easy, medium, hard
    tags TEXT[],            -- For searching and categorization
    skill_assessed VARCHAR(20), -- reading, listening, speaking, writing
    
    -- Source tracking
    source VARCHAR(50) DEFAULT 'manual', -- manual, ai-generated, imported-mysql, imported-csv
    source_metadata JSONB,   -- Original source data (e.g., MySQL question ID)
    imported_mysql_id INTEGER, -- Original MySQL question ID to prevent re-import
    imported_mysql_course_id INTEGER, -- Original MySQL course ID
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0, -- How many times used in templates/courses
    last_used_at TIMESTAMPTZ,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_archived BOOLEAN DEFAULT false,
    
    -- Audit
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT question_bank_points_positive CHECK (points > 0)
);

-- Indexes for performance
CREATE INDEX idx_question_bank_org ON question_bank(organization_id);
CREATE INDEX idx_question_bank_type ON question_bank(question_type);
CREATE INDEX idx_question_bank_difficulty ON question_bank(difficulty);
CREATE INDEX idx_question_bank_tags ON question_bank USING GIN(tags);
CREATE INDEX idx_question_bank_source ON question_bank(source);
CREATE INDEX idx_question_bank_active ON question_bank(is_active) WHERE is_active = true;
CREATE INDEX idx_question_bank_search ON question_bank USING GIN(to_tsvector('english', question_text));

-- Question Bank Categories (optional organization)
CREATE TABLE question_bank_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    parent_id UUID REFERENCES question_bank_categories(id) ON DELETE CASCADE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(organization_id, name)
);

-- Link questions to categories
CREATE TABLE question_bank_question_categories (
    question_id UUID NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES question_bank_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (question_id, category_id)
);

-- Question Bank Usage History (track where questions are used)
CREATE TABLE question_bank_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
    used_in_type VARCHAR(50) NOT NULL, -- template, lesson, quiz
    used_in_id UUID NOT NULL,          -- ID of the template/lesson/quiz
    organization_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_question_bank_usage_question ON question_bank_usage(question_id);
CREATE INDEX idx_question_bank_usage_used_in ON question_bank_usage(used_in_type, used_in_id);

-- Trigger to update updated_at
CREATE TRIGGER trg_question_bank_updated_at
    BEFORE UPDATE ON question_bank
    FOR EACH ROW
    EXECUTE FUNCTION update_test_templates_updated_at(); -- Reuse existing function

-- Function to increment usage count
CREATE OR REPLACE FUNCTION increment_question_usage(p_question_id UUID, p_used_in_type VARCHAR, p_used_in_id UUID, p_org_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Update usage count
    UPDATE question_bank
    SET usage_count = usage_count + 1,
        last_used_at = NOW()
    WHERE id = p_question_id;
    
    -- Log usage
    INSERT INTO question_bank_usage (question_id, used_in_type, used_in_id, organization_id, created_by)
    VALUES (p_question_id, p_used_in_type, p_used_in_id, p_org_id, p_user_id);
END;
$$ LANGUAGE plpgsql;

-- Function to import question from MySQL
CREATE OR REPLACE FUNCTION import_question_from_mysql(
    p_org_id UUID,
    p_user_id UUID,
    p_question_text TEXT,
    p_question_type question_bank_type,
    p_options JSONB,
    p_correct_answer JSONB,
    p_source_metadata JSONB
)
RETURNS UUID AS $$
DECLARE
    v_question_id UUID;
BEGIN
    INSERT INTO question_bank (
        organization_id, created_by, question_text, question_type,
        options, correct_answer, source, source_metadata,
        audio_status, is_active
    )
    VALUES (
        p_org_id, p_user_id, p_question_text, p_question_type,
        p_options, p_correct_answer, 'imported-mysql', p_source_metadata,
        'pending', true
    )
    RETURNING id INTO v_question_id;
    
    RETURN v_question_id;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE question_bank IS 'Centralized repository for reusable questions across the organization';
COMMENT ON COLUMN question_bank.question_type IS 'Type of question: multiple-choice, true-false, short-answer, essay, matching, ordering, fill-in-the-blanks, audio-response, hotspot, code-lab';
COMMENT ON COLUMN question_bank.audio_url IS 'URL to Bark-generated audio file for text-to-speech';
COMMENT ON COLUMN question_bank.audio_status IS 'Status of audio generation: pending, generating, ready, failed';
COMMENT ON COLUMN question_bank.source IS 'Origin: manual (created by user), ai-generated, imported-mysql, imported-csv';
COMMENT ON COLUMN question_bank.source_metadata IS 'Original source data, e.g., {mysql_table: "bancopreguntas", idPregunta: 123, idCursos: 456}';
COMMENT ON TABLE question_bank_usage IS 'Tracks where each question is used (templates, lessons, quizzes)';
