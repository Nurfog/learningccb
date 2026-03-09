-- Migration: Sync content_blocks to lessons table (LMS)
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS content_blocks JSONB DEFAULT NULL;
