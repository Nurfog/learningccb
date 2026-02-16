-- Create table for student submissions
CREATE TABLE IF NOT EXISTS course_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    content TEXT NOT NULL, -- Could be text or URL
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(user_id, lesson_id)
);

-- Create table for peer reviews
CREATE TABLE IF NOT EXISTS peer_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES course_submissions(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    feedback TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(submission_id, reviewer_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_course_submissions_user_lesson ON course_submissions(user_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_course_submissions_course ON course_submissions(course_id);
CREATE INDEX IF NOT EXISTS idx_peer_reviews_submission ON peer_reviews(submission_id);
CREATE INDEX IF NOT EXISTS idx_peer_reviews_reviewer ON peer_reviews(reviewer_id);
