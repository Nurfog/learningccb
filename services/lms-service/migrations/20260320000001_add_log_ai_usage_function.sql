-- AI Usage Tracking: Add log_ai_usage function
-- Required for chat with tutor and other AI features

-- Create ai_usage_logs table if not exists
CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    tokens_used INTEGER NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    model VARCHAR(100) NOT NULL,
    request_type VARCHAR(50) NOT NULL,
    request_metadata JSONB,
    estimated_cost_usd NUMERIC(10, 6),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    prompt TEXT,
    response TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_org_id ON ai_usage_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_endpoint ON ai_usage_logs(endpoint);

-- Create log_ai_usage function
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

COMMENT ON COLUMN ai_usage_logs.prompt IS 'The actual prompt sent to the AI model';
COMMENT ON COLUMN ai_usage_logs.response IS 'The AI model response content';
