-- Add SAM integration fields to users table
-- This allows tracking students imported from the SAM system

-- Add SAM student ID column (nullable for non-SAM users)
ALTER TABLE users 
ADD COLUMN sam_student_id VARCHAR(50),
ADD COLUMN is_sam_student BOOLEAN DEFAULT FALSE,
ADD COLUMN sam_verified_at TIMESTAMPTZ;

-- Create index for faster SAM lookups
CREATE INDEX IF NOT EXISTS idx_users_sam_student_id ON users(sam_student_id);
CREATE INDEX IF NOT EXISTS idx_users_is_sam_student ON users(is_sam_student);

-- Create table to track SAM course assignments (cached from sige_sam_v3.detalle_contrato)
CREATE TABLE IF NOT EXISTS sam_course_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sam_student_id VARCHAR(50) NOT NULL,
    sam_contrato_id VARCHAR(50),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sam_student_id, course_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_sam_assignments_student ON sam_course_assignments(sam_student_id);
CREATE INDEX IF NOT EXISTS idx_sam_assignments_course ON sam_course_assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_sam_assignments_active ON sam_course_assignments(is_active);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_sam_assignment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sam_assignment_updated_at
    BEFORE UPDATE ON sam_course_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_sam_assignment_updated_at();

-- Comment describing the integration
COMMENT ON TABLE sam_course_assignments IS 'Cache of course assignments from sige_sam_v3.detalle_contrato. Links SAM students to OpenCCB courses.';
COMMENT ON COLUMN users.sam_student_id IS 'Student ID from sige_sam_v3.alumnos (nombre column)';
COMMENT ON COLUMN users.is_sam_student IS 'True if this user was imported/managed by SAM system';
