-- Add language configuration to courses table
-- Allows setting course language to 'auto' (detect from user) or fixed language

ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS language_setting VARCHAR(20) DEFAULT 'auto'::VARCHAR,
ADD COLUMN IF NOT EXISTS fixed_language VARCHAR(5) DEFAULT NULL;

-- Add comment explaining the fields
COMMENT ON COLUMN courses.language_setting IS 'Language mode: "auto" (detect from user browser) or "fixed" (use fixed_language)';
COMMENT ON COLUMN courses.fixed_language IS 'Fixed language code (es, en, pt) when language_setting is "fixed". NULL when language_setting is "auto".';

-- Add check constraint for valid language codes
ALTER TABLE courses 
ADD CONSTRAINT chk_language_setting CHECK (
    language_setting IN ('auto', 'fixed')
);

ALTER TABLE courses 
ADD CONSTRAINT chk_fixed_language CHECK (
    fixed_language IS NULL OR fixed_language IN ('es', 'en', 'pt')
);

-- Create index for filtering courses by language
CREATE INDEX IF NOT EXISTS idx_courses_language ON courses(language_setting, fixed_language);
