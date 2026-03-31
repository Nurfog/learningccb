-- Ensure LMS course_instructors schema matches shared model expectations

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
    WHERE conname = 'fk_lms_course_instructors_organization'
      AND conrelid = 'public.course_instructors'::regclass
  ) THEN
    ALTER TABLE public.course_instructors
      ADD CONSTRAINT fk_lms_course_instructors_organization
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END$$;
