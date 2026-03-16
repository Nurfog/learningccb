-- Add course level and type enums
CREATE TYPE course_level AS ENUM (
    'beginner',
    'beginner_1',
    'beginner_2',
    'intermediate',
    'intermediate_1',
    'intermediate_2',
    'advanced',
    'advanced_1',
    'advanced_2'
);

CREATE TYPE course_type AS ENUM (
    'intensive',
    'regular'
);

-- Add level and course_type to courses table
ALTER TABLE courses 
    ADD COLUMN level course_level,
    ADD COLUMN course_type course_type;

-- Add test type enum for assessment templates
CREATE TYPE test_type AS ENUM (
    'CA',   -- Continuous Assessment
    'MWT',  -- Midterm Written Test
    'MOT',  -- Midterm Oral Test
    'FOT',  -- Final Oral Test
    'FWT'   -- Final Written Test
);

-- Test Templates table
-- Stores reusable test/quiz templates that can be applied to courses based on level and type
CREATE TABLE test_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    level course_level NOT NULL,
    course_type course_type NOT NULL,
    test_type test_type NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    passing_score INTEGER NOT NULL DEFAULT 70, -- 0-100 percentage
    total_points INTEGER NOT NULL DEFAULT 100,
    instructions TEXT,
    template_data JSONB NOT NULL, -- Complete test structure with sections and questions
    tags TEXT[], -- For easier searching and categorization
    is_active BOOLEAN NOT NULL DEFAULT true,
    usage_count INTEGER NOT NULL DEFAULT 0, -- Track how many times template has been used
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT test_templates_passing_score_range CHECK (passing_score >= 0 AND passing_score <= 100)
);

-- Index for filtering templates by level, type, and test type
CREATE INDEX idx_test_templates_filters ON test_templates(organization_id, level, course_type, test_type, is_active);

-- Index for searching templates by name
CREATE INDEX idx_test_templates_name ON test_templates USING gin(to_tsvector('english', name));

-- Index for tags (array)
CREATE INDEX idx_test_templates_tags ON test_templates USING GIN(tags);

-- Test Template Sections table
-- Optional: Allows organizing questions into sections (e.g., "Reading Comprehension", "Grammar", "Listening")
CREATE TABLE test_template_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES test_templates(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    section_order INTEGER NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 0,
    instructions TEXT,
    section_data JSONB, -- Section-specific configuration (e.g., time limit, question count)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(template_id, section_order)
);

CREATE INDEX idx_test_template_sections_template ON test_template_sections(template_id, section_order);

-- Test Template Questions table
-- Stores individual questions for each template
CREATE TABLE test_template_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES test_templates(id) ON DELETE CASCADE,
    section_id UUID REFERENCES test_template_sections(id) ON DELETE SET NULL,
    question_order INTEGER NOT NULL DEFAULT 0,
    question_type VARCHAR(50) NOT NULL, -- "multiple-choice", "true-false", "short-answer", "essay", "matching", "ordering"
    question_text TEXT NOT NULL,
    options JSONB, -- Array of options for multiple choice/select questions
    correct_answer JSONB, -- Can be index, array of indices, or text depending on question type
    explanation TEXT, -- Optional explanation shown after answering
    points INTEGER NOT NULL DEFAULT 1,
    metadata JSONB, -- Additional question metadata (e.g., difficulty, tags, media references)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT test_template_questions_points_positive CHECK (points > 0)
);

CREATE INDEX idx_test_template_questions_template ON test_template_questions(template_id, section_id, question_order);
CREATE INDEX idx_test_template_questions_type ON test_template_questions(question_type);

-- Trigger to update updated_at timestamp for test_templates
CREATE OR REPLACE FUNCTION update_test_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_test_templates_updated_at
    BEFORE UPDATE ON test_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_test_templates_updated_at();

-- Function to get templates filtered by course level and type
CREATE OR REPLACE FUNCTION get_test_templates_by_filters(
    p_organization_id UUID,
    p_level course_level DEFAULT NULL,
    p_course_type course_type DEFAULT NULL,
    p_test_type test_type DEFAULT NULL,
    p_search_query TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    organization_id UUID,
    name VARCHAR,
    description TEXT,
    level course_level,
    course_type course_type,
    test_type test_type,
    duration_minutes INTEGER,
    passing_score INTEGER,
    total_points INTEGER,
    instructions TEXT,
    template_data JSONB,
    tags TEXT[],
    is_active BOOLEAN,
    usage_count INTEGER,
    created_by UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tt.id,
        tt.organization_id,
        tt.name,
        tt.description,
        tt.level,
        tt.course_type,
        tt.test_type,
        tt.duration_minutes,
        tt.passing_score,
        tt.total_points,
        tt.instructions,
        tt.template_data,
        tt.tags,
        tt.is_active,
        tt.usage_count,
        tt.created_by,
        tt.created_at,
        tt.updated_at
    FROM test_templates tt
    WHERE tt.organization_id = p_organization_id
      AND tt.is_active = true
      AND (p_level IS NULL OR tt.level = p_level)
      AND (p_course_type IS NULL OR tt.course_type = p_course_type)
      AND (p_test_type IS NULL OR tt.test_type = p_test_type)
      AND (p_search_query IS NULL OR tt.name ILIKE '%' || p_search_query || '%');
END;
$$ LANGUAGE plpgsql;

-- Function to increment usage count when a template is applied
CREATE OR REPLACE FUNCTION increment_template_usage(p_template_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE test_templates
    SET usage_count = usage_count + 1
    WHERE id = p_template_id;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE test_templates IS 'Reusable test/quiz templates organized by course level, type, and assessment type';
COMMENT ON COLUMN test_templates.level IS 'Course level this template is designed for (beginner, intermediate, advanced)';
COMMENT ON COLUMN test_templates.course_type IS 'Type of course (intensive or regular)';
COMMENT ON COLUMN test_templates.test_type IS 'Assessment type (CA, MWT, MOT, FOT, FWT)';
COMMENT ON COLUMN test_templates.template_data IS 'Complete test structure including sections, timing, and question references';
COMMENT ON COLUMN test_templates.usage_count IS 'Number of times this template has been applied to courses';

COMMENT ON TABLE test_template_sections IS 'Optional sections within a test template (e.g., Reading, Grammar, Listening)';
COMMENT ON COLUMN test_template_sections.section_data IS 'Section-specific configuration like time limits or special instructions';

COMMENT ON TABLE test_template_questions IS 'Individual questions belonging to test templates';
COMMENT ON COLUMN test_template_questions.question_type IS 'Type of question: multiple-choice, true-false, short-answer, essay, matching, ordering';
COMMENT ON COLUMN test_template_questions.options IS 'JSON array of answer options for multiple choice questions';
COMMENT ON COLUMN test_template_questions.correct_answer IS 'Correct answer(s) - format depends on question type';
COMMENT ON COLUMN test_template_questions.metadata IS 'Additional metadata like difficulty level, tags, or media references';
