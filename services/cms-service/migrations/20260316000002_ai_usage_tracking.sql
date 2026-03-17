-- AI Usage Logs: Track token consumption per user for billing and limits
CREATE TABLE ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Token counts
    tokens_used INTEGER NOT NULL DEFAULT 0,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    
    -- Request metadata
    endpoint VARCHAR(255), -- e.g., "/lessons/generate-quiz"
    model VARCHAR(100),    -- e.g., "llama3.2:3b", "gpt-4o"
    request_type VARCHAR(50), -- "transcription", "quiz-generation", "chat", "summary"
    request_metadata JSONB, -- Additional context about the request
    
    -- Cost estimation (optional, can be calculated later)
    estimated_cost_usd NUMERIC(10, 6),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_ai_usage_user ON ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_org ON ai_usage_logs(organization_id);
CREATE INDEX idx_ai_usage_created ON ai_usage_logs(created_at);
CREATE INDEX idx_ai_usage_endpoint ON ai_usage_logs(endpoint);
CREATE INDEX idx_ai_usage_type ON ai_usage_logs(request_type);

-- Function to log AI usage
CREATE OR REPLACE FUNCTION log_ai_usage(
    p_user_id UUID,
    p_org_id UUID,
    p_tokens INTEGER,
    p_input_tokens INTEGER,
    p_output_tokens INTEGER,
    p_endpoint VARCHAR,
    p_model VARCHAR,
    p_request_type VARCHAR,
    p_metadata JSONB
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
        endpoint, model, request_type, request_metadata, estimated_cost_usd
    )
    VALUES (
        p_user_id, p_org_id, p_tokens, p_input_tokens, p_output_tokens,
        p_endpoint, p_model, p_request_type, p_metadata, v_cost
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Daily aggregation view for reporting
CREATE VIEW ai_usage_daily AS
SELECT 
    DATE(created_at) as usage_date,
    user_id,
    organization_id,
    request_type,
    SUM(tokens_used) as total_tokens,
    SUM(input_tokens) as total_input,
    SUM(output_tokens) as total_output,
    COUNT(*) as request_count,
    SUM(estimated_cost_usd) as total_cost
FROM ai_usage_logs
GROUP BY DATE(created_at), user_id, organization_id, request_type;

-- Comments
COMMENT ON TABLE ai_usage_logs IS 'Tracks AI token usage per user for billing, limits, and analytics';
COMMENT ON COLUMN ai_usage_logs.tokens_used IS 'Total tokens (input + output)';
COMMENT ON COLUMN ai_usage_logs.input_tokens IS 'Tokens in the prompt/request';
COMMENT ON COLUMN ai_usage_logs.output_tokens IS 'Tokens in the AI response';
COMMENT ON COLUMN ai_usage_logs.estimated_cost_usd IS 'Estimated cost based on OpenAI-like pricing';
