-- Token Limit Alerts System
-- Automatically sends notifications when users approach token limits

-- Table to store alert configuration
CREATE TABLE IF NOT EXISTS token_limit_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    alert_threshold INTEGER NOT NULL DEFAULT 80, -- 80%, 90%, 100%
    alert_sent BOOLEAN DEFAULT FALSE,
    alert_type VARCHAR(50) NOT NULL DEFAULT 'email', -- email, notification, both
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    UNIQUE(user_id, alert_threshold)
);

CREATE INDEX idx_token_alerts_user ON token_limit_alerts(user_id);
CREATE INDEX idx_token_alerts_org ON token_limit_alerts(organization_id);

-- Function to send token limit notification
CREATE OR REPLACE FUNCTION send_token_limit_notification(
    p_user_id UUID,
    p_org_id UUID,
    p_percentage INTEGER,
    p_limit INTEGER,
    p_used BIGINT
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
    v_user_email VARCHAR;
    v_user_name VARCHAR;
    v_message TEXT;
    v_title TEXT;
BEGIN
    -- Get user info
    SELECT email, full_name INTO v_user_email, v_user_name
    FROM users WHERE id = p_user_id;
    
    -- Create title and message based on percentage
    IF p_percentage >= 100 THEN
        v_title := '⚠️ Límite de Tokens IA Excedido';
        v_message := format(
            E'Hola %s,\n\nHas excedido tu límite mensual de tokens de IA (%s tokens).\n\nTokens usados: %s (%s%%)\n\nEl servicio de IA estará disponible hasta el próximo ciclo de facturación.',
            v_user_name,
            CASE WHEN p_limit = 0 THEN 'Ilimitado' ELSE p_limit::TEXT END,
            p_used,
            p_percentage
        );
    ELSIF p_percentage >= 90 THEN
        v_title := '⚡ 90% de Tokens IA Utilizados';
        v_message := format(
            E'Hola %s,\n\nHas utilizado el 90%% de tu límite mensual de tokens de IA.\n\nTokens usados: %s de %s (%s%%)\n\nConsidera reducir el uso de funciones de IA para evitar exceder el límite.',
            v_user_name,
            p_used,
            p_limit,
            p_percentage
        );
    ELSIF p_percentage >= 80 THEN
        v_title := '📊 80% de Tokens IA Utilizados';
        v_message := format(
            E'Hola %s,\n\nHas utilizado el 80%% de tu límite mensual de tokens de IA.\n\nTokens usados: %s de %s (%s%%)\n\nTe recomendamos monitorear tu uso restante.',
            v_user_name,
            p_used,
            p_limit,
            p_percentage
        );
    ELSE
        RETURN NULL;
    END IF;
    
    -- Insert notification
    INSERT INTO notifications (
        organization_id,
        user_id,
        title,
        message,
        notification_type,
        link_url
    ) VALUES (
        p_org_id,
        p_user_id,
        v_title,
        v_message,
        'token_limit_alert',
        '/admin/token-usage'
    ) RETURNING id INTO v_notification_id;
    
    -- Log alert in token_limit_alerts table
    INSERT INTO token_limit_alerts (
        user_id,
        organization_id,
        alert_threshold,
        alert_sent,
        sent_at
    ) VALUES (
        p_user_id,
        p_org_id,
        p_percentage,
        TRUE,
        NOW()
    ) ON CONFLICT (user_id, alert_threshold) DO UPDATE
    SET alert_sent = TRUE,
        sent_at = NOW();
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to check token limits on new AI usage
CREATE OR REPLACE FUNCTION check_token_limit_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_limit INTEGER;
    v_reset_day INTEGER;
    v_used BIGINT;
    v_month_start TIMESTAMPTZ;
    v_percentage INTEGER;
    v_org_id UUID;
BEGIN
    -- Get user's limit settings
    SELECT monthly_token_limit, token_limit_reset_day, organization_id
    INTO v_limit, v_reset_day, v_org_id
    FROM users WHERE id = NEW.user_id;
    
    -- If no limit set or unlimited, skip
    IF v_limit IS NULL OR v_limit = 0 THEN
        RETURN NEW;
    END IF;
    
    -- Calculate month start based on reset day
    v_month_start := DATE_TRUNC('month', NOW() + (v_reset_day - 1) * INTERVAL '1 day')
                     - (v_reset_day - 1) * INTERVAL '1 day';
    
    -- Get current usage including this new record
    SELECT COALESCE(SUM(tokens_used), 0) + NEW.tokens_used
    INTO v_used
    FROM ai_usage_logs
    WHERE user_id = NEW.user_id
      AND created_at >= v_month_start
      AND id != NEW.id; -- Exclude current record to avoid double counting
    
    -- Calculate percentage
    v_percentage := ROUND((v_used::NUMERIC / v_limit * 100));
    
    -- Send notifications at thresholds (only once per threshold per month)
    IF v_percentage >= 100 THEN
        -- Check if alert already sent for 100%
        IF NOT EXISTS (
            SELECT 1 FROM token_limit_alerts
            WHERE user_id = NEW.user_id
              AND alert_threshold = 100
              AND sent_at >= v_month_start
        ) THEN
            PERFORM send_token_limit_notification(
                NEW.user_id, v_org_id, 100, v_limit, v_used
            );
        END IF;
    ELSIF v_percentage >= 90 THEN
        IF NOT EXISTS (
            SELECT 1 FROM token_limit_alerts
            WHERE user_id = NEW.user_id
              AND alert_threshold = 90
              AND sent_at >= v_month_start
        ) THEN
            PERFORM send_token_limit_notification(
                NEW.user_id, v_org_id, 90, v_limit, v_used
            );
        END IF;
    ELSIF v_percentage >= 80 THEN
        IF NOT EXISTS (
            SELECT 1 FROM token_limit_alerts
            WHERE user_id = NEW.user_id
              AND alert_threshold = 80
              AND sent_at >= v_month_start
        ) THEN
            PERFORM send_token_limit_notification(
                NEW.user_id, v_org_id, 80, v_limit, v_used
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on ai_usage_logs
DROP TRIGGER IF EXISTS token_limit_check ON ai_usage_logs;
CREATE TRIGGER token_limit_check
AFTER INSERT ON ai_usage_logs
FOR EACH ROW
EXECUTE FUNCTION check_token_limit_trigger();

COMMENT ON FUNCTION check_token_limit_trigger() IS 'Automatically sends notifications when users reach 80%, 90%, or 100% of their token limit';
COMMENT ON TABLE token_limit_alerts IS 'Tracks when token limit alerts were sent to users';
