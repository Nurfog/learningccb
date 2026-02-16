-- Migration: Create Student Notes Table
-- Description: Allows students to save personal notes for each lesson.

CREATE TABLE IF NOT EXISTS student_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, lesson_id)
);

-- Index for faster retrieval by user
CREATE INDEX IF NOT EXISTS idx_student_notes_user_id ON student_notes(user_id);
-- Index for faster retrieval by lesson (useful if we ever want to see all notes for a lesson as an instructor, though not requested yet)
CREATE INDEX IF NOT EXISTS idx_student_notes_lesson_id ON student_notes(lesson_id);
