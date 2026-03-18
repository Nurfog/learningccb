-- Fix test_templates to use mysql_course_id reference instead of level/course_type strings
-- This ensures data consistency and leverages the imported MySQL course data in PostgreSQL

-- Add mysql_course_id column to test_templates
ALTER TABLE test_templates
    ADD COLUMN mysql_course_id INTEGER REFERENCES mysql_courses(mysql_id) ON DELETE SET NULL,
    ALTER COLUMN level DROP NOT NULL,
    ALTER COLUMN course_type DROP NOT NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_test_templates_mysql_course ON test_templates(mysql_course_id);

-- Add comment for documentation
COMMENT ON COLUMN test_templates.mysql_course_id IS 'Reference to imported MySQL course (mysql_courses.mysql_id). Preferred over level/course_type fields.';

-- Create view for backward compatibility - shows calculated level/course_type from mysql_courses
CREATE OR REPLACE VIEW test_templates_with_course_info AS
SELECT 
    tt.*,
    mc.name AS course_name,
    mc.level_calculated,
    mc.course_type AS calculated_course_type,
    mc.duracion AS course_duration
FROM test_templates tt
LEFT JOIN mysql_courses mc ON tt.mysql_course_id = mc.mysql_id;

-- Function to get template with course info
CREATE OR REPLACE FUNCTION get_test_template_with_course(p_template_id UUID)
RETURNS TABLE (
    id UUID,
    organization_id UUID,
    name VARCHAR,
    description TEXT,
    mysql_course_id INTEGER,
    course_name VARCHAR,
    level course_level,
    level_calculated TEXT,
    course_type course_type,
    calculated_course_type TEXT,
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
        tt.mysql_course_id,
        mc.name,
        tt.level,
        mc.level_calculated,
        tt.course_type,
        mc.course_type,
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
    LEFT JOIN mysql_courses mc ON tt.mysql_course_id = mc.mysql_id
    WHERE tt.id = p_template_id;
END;
$$ LANGUAGE plpgsql;
