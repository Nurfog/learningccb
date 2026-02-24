-- Fix 1: Add missing `progress` column to enrollments
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS progress FLOAT4 NOT NULL DEFAULT 0;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Fix 2: Update fn_get_retention_data to match what the Rust handler queries
-- Drop all existing overloads
DROP FUNCTION IF EXISTS fn_get_retention_data(uuid);
DROP FUNCTION IF EXISTS fn_get_retention_data(uuid, uuid);

-- Recreate with consistent signature matching the Rust query_as struct
CREATE OR REPLACE FUNCTION fn_get_retention_data(p_course_id uuid, p_organization_id uuid DEFAULT NULL)
RETURNS TABLE(
    lesson_id uuid,
    lesson_title varchar,
    student_count bigint,
    completion_rate float4
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.id AS lesson_id,
        l.title::varchar AS lesson_title,
        COUNT(DISTINCT e.user_id)::bigint AS student_count,
        COALESCE(AVG(e.progress), 0)::float4 AS completion_rate
    FROM lessons l
    JOIN modules m ON l.module_id = m.id
    LEFT JOIN enrollments e ON e.course_id = m.course_id
    WHERE m.course_id = p_course_id
    GROUP BY l.id, l.title
    ORDER BY l.position;
END;
$$ LANGUAGE plpgsql;
