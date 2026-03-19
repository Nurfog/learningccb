-- AI Usage Logs: Add prompt and response fields for detailed tracking
-- This allows storing the actual prompts and responses for debugging and analytics

-- Add new columns to ai_usage_logs
ALTER TABLE ai_usage_logs 
    ADD COLUMN IF NOT EXISTS prompt TEXT,
    ADD COLUMN IF NOT EXISTS response TEXT;

-- Update log_ai_usage function to accept prompt and response
CREATE OR REPLACE FUNCTION log_ai_usage(
    p_user_id UUID,
    p_org_id UUID,
    p_tokens INTEGER,
    p_input_tokens INTEGER,
    p_output_tokens INTEGER,
    p_endpoint VARCHAR,
    p_model VARCHAR,
    p_request_type VARCHAR,
    p_metadata JSONB,
    p_prompt TEXT DEFAULT NULL,
    p_response TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
    v_cost NUMERIC(10, 6);
BEGIN
    -- Calculate estimated cost (OpenAI-like pricing)
    v_cost := (p_input_tokens::NUMERIC * 0.000001) + (p_output_tokens::NUMERIC * 0.000003);

    INSERT INTO ai_usage_logs (
        user_id, organization_id, tokens_used, input_tokens, output_tokens,
        endpoint, model, request_type, request_metadata, estimated_cost_usd,
        prompt, response
    )
    VALUES (
        p_user_id, p_org_id, p_tokens, p_input_tokens, p_output_tokens,
        p_endpoint, p_model, p_request_type, p_metadata, v_cost,
        p_prompt, p_response
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Add indexes for text search (optional, can be enabled if needed for analytics)
-- CREATE INDEX idx_ai_usage_prompt ON ai_usage_logs USING gin (to_tsvector('spanish', prompt));
-- CREATE INDEX idx_ai_usage_response ON ai_usage_logs USING gin (to_tsvector('spanish', response));

COMMENT ON COLUMN ai_usage_logs.prompt IS 'The actual prompt sent to the AI model';
COMMENT ON COLUMN ai_usage_logs.response IS 'The AI model response content';
