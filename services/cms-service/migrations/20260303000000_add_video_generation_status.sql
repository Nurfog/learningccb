-- Add video_generation_status and video_generation_error to lessons table
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS video_generation_status VARCHAR(20) DEFAULT 'idle';
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS video_generation_error TEXT;
