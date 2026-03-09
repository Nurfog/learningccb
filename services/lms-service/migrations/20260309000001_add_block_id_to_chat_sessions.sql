-- Migration: Add block_id to chat_sessions to link sessions to specific Role-Playing blocks
ALTER TABLE chat_sessions ADD COLUMN block_id UUID;
CREATE INDEX idx_chat_sessions_block_id ON chat_sessions(block_id);
