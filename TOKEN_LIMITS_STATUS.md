# Token Limits - Estado de Implementación

## ✅ Phase 1: Completado (Database + API)

### Base de Datos
- [x] Columnas `monthly_token_limit` y `token_limit_reset_day` en users
- [x] Vista `ai_usage_monthly`
- [x] Función `check_token_limit()`
- [x] Función `get_user_usage_stats()`

### API Endpoints
- [x] `PUT /admin/users/{user_id}/token-limit`
- [x] `GET /admin/users/{user_id}/token-usage`
- [x] `GET /admin/users/{user_id}/token-limit/check`

### Common Library
- [x] Módulo `token_limits`
- [x] Función `check_ai_token_limit()`

---

## 🔄 Phase 2: En Progreso (Enforce + Dashboard + Alertas)

### 1. Enforce Automático en Handlers de IA
- [ ] `generate_quiz` - 2000 tokens estimados
- [ ] `generate_course` - 5000 tokens estimados
- [ ] `generate_hotspots` - 2000 tokens estimados
- [ ] `generate_role_play` - 2500 tokens estimados
- [ ] `summarize_lesson` - 1500 tokens estimados
- [ ] `chat_with_tutor` (LMS) - 1000 tokens estimados
- [ ] `evaluate_audio` (LMS) - 1500 tokens estimados

**Código a agregar en cada handler:**
```rust
// Check token limit before proceeding (estimate X tokens)
if let Err(_) = common::token_limits::check_ai_token_limit(&pool, claims.sub, 2000).await {
    return Err(StatusCode::TOO_MANY_REQUESTS);
}
```

### 2. Dashboard UI para Admins
- [ ] Página `/admin/token-usage` en Studio
- [ ] Tabla de usuarios con uso de tokens
- [ ] Gráfico de uso por día/semana/mes
- [ ] Input para editar límites por usuario
- [ ] Alertas visuales (>80%, >90%, 100%)

**Componentes necesarios:**
- `TokenUsageDashboard.tsx` - Página principal
- `UserTokenRow.tsx` - Fila de tabla de usuario
- `TokenLimitEditor.tsx` - Editor de límites
- `UsageChart.tsx` - Gráfico de uso

### 3. Sistema de Alertas
- [ ] Trigger en `ai_usage_logs` INSERT
- [ ] Notificaciones al alcanzar 80%, 90%, 100%
- [ ] Email opcional al usuario
- [ ] Registro en tabla `notifications`

**Trigger SQL:**
```sql
CREATE OR REPLACE FUNCTION check_token_limit_alert()
RETURNS TRIGGER AS $$
DECLARE
    v_limit INTEGER;
    v_used BIGINT;
    v_percentage NUMERIC;
BEGIN
    -- Get user limit
    SELECT monthly_token_limit INTO v_limit
    FROM users WHERE id = NEW.user_id;
    
    IF v_limit > 0 THEN
        -- Calculate current usage
        SELECT SUM(tokens_used) INTO v_used
        FROM ai_usage_logs
        WHERE user_id = NEW.user_id
          AND created_at >= DATE_TRUNC('month', NOW());
        
        v_percentage := (v_used::NUMERIC / v_limit * 100);
        
        -- Send notification at thresholds
        IF v_percentage >= 80 AND v_percentage < 90 THEN
            -- Send 80% alert
        ELSIF v_percentage >= 90 AND v_percentage < 100 THEN
            -- Send 90% alert
        ELSIF v_percentage >= 100 THEN
            -- Send 100% alert
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 📊 Métricas de Uso

### Queries Útiles

```sql
-- Usuarios que excedieron 80% de su límite
SELECT 
    u.email,
    u.monthly_token_limit,
    SUM(au.tokens_used) as used,
    ROUND((SUM(au.tokens_used)::NUMERIC / u.monthly_token_limit * 100), 2) as percentage
FROM users u
JOIN ai_usage_logs au ON u.id = au.user_id
WHERE au.created_at >= DATE_TRUNC('month', NOW())
  AND u.monthly_token_limit > 0
GROUP BY u.id
HAVING SUM(au.tokens_used)::NUMERIC / u.monthly_token_limit > 0.8
ORDER BY percentage DESC;

-- Uso por endpoint
SELECT 
    endpoint,
    COUNT(*) as requests,
    SUM(tokens_used) as total_tokens,
    AVG(tokens_used) as avg_tokens
FROM ai_usage_logs
WHERE created_at >= DATE_TRUNC('month', NOW())
GROUP BY endpoint
ORDER BY total_tokens DESC;

-- Top 10 usuarios por uso
SELECT 
    u.email,
    SUM(au.tokens_used) as total_tokens,
    COUNT(*) as requests
FROM users u
JOIN ai_usage_logs au ON u.id = au.user_id
WHERE au.created_at >= DATE_TRUNC('month', NOW())
GROUP BY u.id
ORDER BY total_tokens DESC
LIMIT 10;
```

---

## 🎯 Próximos Pasos

1. **Enforce Automático**: Agregar check en handlers de IA (CMS + LMS)
2. **Dashboard UI**: Crear componentes React para admin
3. **Alertas**: Implementar trigger y notificaciones
4. **Testing**: Verificar que los límites se respetan
5. **Documentación**: Actualizar guías de uso

---

**Fecha**: 2026-03-23
**Estado**: Phase 1 ✅ Completado, Phase 2 🔄 En Progreso
