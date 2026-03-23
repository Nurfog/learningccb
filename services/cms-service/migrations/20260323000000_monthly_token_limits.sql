-- Monthly Token Limits per User
-- Allows setting and enforcing monthly AI token usage limits

-- Add monthly token limit column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS monthly_token_limit INTEGER DEFAULT 100000,
ADD COLUMN IF NOT EXISTS token_limit_reset_day INTEGER DEFAULT 1; -- Day of month to reset (1-28)

COMMENT ON COLUMN users.monthly_token_limit IS 'Maximum AI tokens user can consume per month (0 = unlimited)';
COMMENT ON COLUMN users.token_limit_reset_day IS 'Day of month when token counter resets (1-28, to avoid month-end issues)';

-- Create view for current month usage per user
CREATE OR REPLACE VIEW ai_usage_monthly AS
SELECT 
    au.user_id,
    au.organization_id,
    DATE_TRUNC('month', au.created_at + (u.token_limit_reset_day - 1) * INTERVAL '1 day') AS usage_month,
    COUNT(*) AS total_requests,
    SUM(au.tokens_used) AS total_tokens,
    SUM(au.input_tokens) AS input_tokens,
    SUM(au.output_tokens) AS output_tokens,
    SUM(au.estimated_cost_usd) AS total_cost_usd
FROM ai_usage_logs au
JOIN users u ON au.user_id = u.id
WHERE au.created_at >= DATE_TRUNC('month', NOW() + (u.token_limit_reset_day - 1) * INTERVAL '1 day') - (u.token_limit_reset_day - 1) * INTERVAL '1 day'
GROUP BY au.user_id, au.organization_id, usage_month;

COMMENT ON VIEW ai_usage_monthly IS 'Current month AI usage per user with custom reset day';

-- Function to check if user has exceeded token limit
CREATE OR REPLACE FUNCTION check_token_limit(
    p_user_id UUID,
    p_additional_tokens INTEGER DEFAULT 0
)
RETURNS TABLE (
    has_available_tokens BOOLEAN,
    monthly_limit INTEGER,
    used_tokens BIGINT,
    remaining_tokens BIGINT,
    reset_date TIMESTAMPTZ
) AS $$
DECLARE
    v_limit INTEGER;
    v_reset_day INTEGER;
    v_used BIGINT;
    v_month_start TIMESTAMPTZ;
    v_next_reset TIMESTAMPTZ;
BEGIN
    -- Get user's limit settings
    SELECT monthly_token_limit, token_limit_reset_day
    INTO v_limit, v_reset_day
    FROM users
    WHERE id = p_user_id;
    
    -- Default values if not set
    v_limit := COALESCE(v_limit, 100000);
    v_reset_day := COALESCE(v_reset_day, 1);
    
    -- If limit is 0, unlimited
    IF v_limit = 0 THEN
        RETURN QUERY SELECT 
            TRUE,
            v_limit,
            0::BIGINT,
            0::BIGINT,
            NOW() + INTERVAL '1 month';
        RETURN;
    END IF;
    
    -- Calculate current month start based on reset day
    v_month_start := DATE_TRUNC('month', NOW() + (v_reset_day - 1) * INTERVAL '1 day') 
                     - (v_reset_day - 1) * INTERVAL '1 day';
    
    -- Calculate next reset date
    v_next_reset := v_month_start + INTERVAL '1 month';
    
    -- Get current usage
    SELECT COALESCE(SUM(tokens_used), 0)
    INTO v_used
    FROM ai_usage_logs
    WHERE user_id = p_user_id
      AND created_at >= v_month_start;
    
    -- Return results
    RETURN QUERY SELECT
        (v_used + p_additional_tokens) < v_limit,
        v_limit,
        v_used,
        (v_limit - v_used)::BIGINT,
        v_next_reset;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_token_limit IS 'Check if user has available tokens for current period';

-- Function to get usage statistics for a user
CREATE OR REPLACE FUNCTION get_user_usage_stats(
    p_user_id UUID,
    p_months INTEGER DEFAULT 3
)
RETURNS TABLE (
    month_start DATE,
    total_requests BIGINT,
    total_tokens BIGINT,
    input_tokens BIGINT,
    output_tokens BIGINT,
    total_cost_usd NUMERIC,
    monthly_limit INTEGER,
    percentage_used NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE_TRUNC('month', au.created_at)::DATE AS month_start,
        COUNT(*) AS total_requests,
        SUM(au.tokens_used) AS total_tokens,
        SUM(au.input_tokens) AS input_tokens,
        SUM(au.output_tokens) AS output_tokens,
        SUM(au.estimated_cost_usd) AS total_cost_usd,
        u.monthly_token_limit,
        CASE 
            WHEN u.monthly_token_limit = 0 THEN 0
            ELSE (SUM(au.tokens_used)::NUMERIC / u.monthly_token_limit * 100)::NUMERIC(5,2)
        END AS percentage_used
    FROM ai_usage_logs au
    JOIN users u ON au.user_id = u.id
    WHERE au.user_id = p_user_id
      AND au.created_at >= NOW() - (p_months || ' months')::INTERVAL
    GROUP BY DATE_TRUNC('month', au.created_at), u.monthly_token_limit
    ORDER BY month_start DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_usage_stats IS 'Get AI usage statistics for user over last N months';

-- Add index for faster monthly queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_month 
ON ai_usage_logs(user_id, created_at);
