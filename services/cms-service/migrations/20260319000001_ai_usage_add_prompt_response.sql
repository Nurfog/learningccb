-- AI Usage Logs: Add prompt and response columns
-- First, add columns if they don't exist

-- Add prompt column
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_usage_logs' AND column_name = 'prompt'
    ) THEN
        ALTER TABLE ai_usage_logs ADD COLUMN prompt TEXT;
    END IF;
END $$;

-- Add response column
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_usage_logs' AND column_name = 'response'
    ) THEN
        ALTER TABLE ai_usage_logs ADD COLUMN response TEXT;
    END IF;
END $$;

-- Update log_ai_usage function to include prompt and response
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
