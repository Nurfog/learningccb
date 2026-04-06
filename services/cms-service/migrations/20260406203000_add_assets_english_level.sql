ALTER TABLE assets
ADD COLUMN IF NOT EXISTS english_level TEXT;

CREATE INDEX IF NOT EXISTS idx_assets_org_english_level
ON assets (organization_id, english_level);
