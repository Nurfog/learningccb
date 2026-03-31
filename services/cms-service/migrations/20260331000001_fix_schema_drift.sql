-- Hotfix migration: align CMS schema/functions with current application code

-- 1) Grading categories must support optional tipo_nota_id used by handlers
ALTER TABLE IF EXISTS public.grading_categories
    ADD COLUMN IF NOT EXISTS tipo_nota_id INTEGER;

-- 2) Course instructors must include organization_id used by shared model
ALTER TABLE IF EXISTS public.course_instructors
    ADD COLUMN IF NOT EXISTS organization_id UUID;

UPDATE public.course_instructors ci
SET organization_id = c.organization_id
FROM public.courses c
WHERE ci.course_id = c.id
  AND ci.organization_id IS NULL;

ALTER TABLE IF EXISTS public.course_instructors
    ALTER COLUMN organization_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_course_instructors_organization'
      AND conrelid = 'public.course_instructors'::regclass
  ) THEN
    ALTER TABLE public.course_instructors
      ADD CONSTRAINT fk_course_instructors_organization
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END$$;

-- 3) Remove ambiguous fn_update_course overloads and keep one canonical signature
DROP FUNCTION IF EXISTS public.fn_update_course(uuid, uuid, character varying, text, integer, character varying, timestamp with time zone, timestamp with time zone, character varying);
DROP FUNCTION IF EXISTS public.fn_update_course(uuid, uuid, text, text, integer, text, timestamp with time zone, timestamp with time zone, text, double precision, text);
DROP FUNCTION IF EXISTS public.fn_update_course(uuid, uuid, character varying, text, integer, character varying, timestamp with time zone, timestamp with time zone, character varying, double precision, character varying, jsonb, text, character varying);
DROP FUNCTION IF EXISTS public.fn_update_course(uuid, uuid, character varying, text, integer, character varying, timestamp with time zone, timestamp with time zone, character varying, double precision, character varying, jsonb, text);

CREATE OR REPLACE FUNCTION public.fn_update_course(
    p_id UUID,
    p_organization_id UUID,
    p_title TEXT,
    p_description TEXT,
    p_passing_percentage INTEGER,
    p_pacing_mode TEXT,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_certificate_template TEXT,
    p_price DOUBLE PRECISION,
    p_currency TEXT,
    p_marketing_metadata JSONB,
    p_course_image_url TEXT
) RETURNS SETOF public.courses AS $$
BEGIN
    RETURN QUERY
    UPDATE public.courses
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
