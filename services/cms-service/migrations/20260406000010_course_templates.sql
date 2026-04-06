-- Course templates for reusable course blueprints
CREATE TABLE IF NOT EXISTS course_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    template_data JSONB NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_templates_org_created
    ON course_templates (organization_id, created_at DESC);
