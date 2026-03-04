-- Migration: Add Course Marketing Metadata and Image Generation fields

-- 1. Add columns to courses table
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS marketing_metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS course_image_url TEXT,
ADD COLUMN IF NOT EXISTS generation_status VARCHAR(20) DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS generation_progress INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS generation_error TEXT;

-- 2. Update fn_create_course to handle initial marketing_metadata
CREATE OR REPLACE FUNCTION fn_create_course(
    p_organization_id UUID,
    p_instructor_id UUID,
    p_title VARCHAR(255),
    p_pacing_mode VARCHAR(50) DEFAULT 'self_paced'
) RETURNS SETOF courses AS $$
BEGIN
    RETURN QUERY
    INSERT INTO courses (organization_id, instructor_id, title, pacing_mode, marketing_metadata)
    VALUES (p_organization_id, p_instructor_id, p_title, p_pacing_mode, '{}')
    RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- 3. Update fn_update_course to include marketing fields
CREATE OR REPLACE FUNCTION fn_update_course(
    p_id UUID,
    p_organization_id UUID,
    p_title VARCHAR(255),
    p_description TEXT,
    p_passing_percentage INTEGER,
    p_pacing_mode VARCHAR(50),
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_certificate_template VARCHAR(255) DEFAULT NULL,
    p_price DOUBLE PRECISION DEFAULT 0.0,
    p_currency VARCHAR(10) DEFAULT 'USD',
    p_marketing_metadata JSONB DEFAULT NULL,
    p_course_image_url TEXT DEFAULT NULL
) RETURNS SETOF courses AS $$
BEGIN
    RETURN QUERY
    UPDATE courses 
    SET title = COALESCE(p_title, title),
        description = COALESCE(p_description, description),
        passing_percentage = COALESCE(p_passing_percentage, passing_percentage),
        pacing_mode = COALESCE(p_pacing_mode, pacing_mode),
        start_date = p_start_date,
        end_date = p_end_date,
        certificate_template = COALESCE(p_certificate_template, certificate_template),
        price = COALESCE(p_price, price),
        currency = COALESCE(p_currency, currency),
        marketing_metadata = COALESCE(p_marketing_metadata, marketing_metadata),
        course_image_url = COALESCE(p_course_image_url, course_image_url),
        updated_at = NOW()
    WHERE id = p_id AND organization_id = p_organization_id
    RETURNING *;
END;
$$ LANGUAGE plpgsql;
