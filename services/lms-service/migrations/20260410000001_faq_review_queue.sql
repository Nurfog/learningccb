-- FAQ moderation workflow based on student AI chats

CREATE TABLE IF NOT EXISTS faq_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    source VARCHAR(50) NOT NULL DEFAULT 'human-reviewed',
    created_by UUID,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faq_entries_org_published
    ON faq_entries (organization_id, is_published, created_at DESC);

CREATE TABLE IF NOT EXISTS faq_review_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    source_ai_usage_log_id UUID UNIQUE,
    user_id UUID NOT NULL,
    lesson_id UUID,
    session_id UUID,
    question_text TEXT NOT NULL,
    ai_response TEXT,
    rag_context_found BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reviewer_id UUID,
    reviewer_note TEXT,
    human_answer TEXT,
    faq_entry_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    CONSTRAINT chk_faq_review_status CHECK (status IN ('pending', 'answered', 'published', 'dismissed')),
    CONSTRAINT fk_faq_review_faq_entry FOREIGN KEY (faq_entry_id) REFERENCES faq_entries(id)
);

CREATE INDEX IF NOT EXISTS idx_faq_review_org_status
    ON faq_review_queue (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_faq_review_source_log
    ON faq_review_queue (source_ai_usage_log_id);
