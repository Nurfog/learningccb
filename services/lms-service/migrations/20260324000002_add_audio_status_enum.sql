-- Migration: Add audio_response_status ENUM type
-- This migration creates the ENUM type for audio response status

DO $$ BEGIN
    CREATE TYPE audio_response_status AS ENUM ('pending', 'ai_evaluated', 'teacher_evaluated', 'both_evaluated');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
