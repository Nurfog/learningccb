ALTER TABLE assets
ADD COLUMN IF NOT EXISTS sam_plan_id INTEGER,
ADD COLUMN IF NOT EXISTS sam_course_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_assets_org_sam_plan_course
ON assets (organization_id, sam_plan_id, sam_course_id);