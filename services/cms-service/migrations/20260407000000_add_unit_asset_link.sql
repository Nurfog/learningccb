-- Add unit_number to assets: tracks which syllabus unit a file belongs to within a ZIP
ALTER TABLE assets ADD COLUMN IF NOT EXISTS unit_number INTEGER;

-- Link question_bank RAG chunks to their source audio/video asset
-- This allows test creation (AI + manual) to attach the audio to exercises
ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS source_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL;
ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS unit_number INTEGER;

-- Index for fast lookup by unit
CREATE INDEX IF NOT EXISTS idx_assets_unit_number ON assets(organization_id, sam_plan_id, unit_number);
CREATE INDEX IF NOT EXISTS idx_qb_source_asset ON question_bank(source_asset_id) WHERE source_asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qb_unit_number ON question_bank(organization_id, unit_number) WHERE unit_number IS NOT NULL;
