# 📊 Token Usage Tracking - Implementación Completa

## ✅ Lo Que Se Implementó

### 1. **Base de Datos** ✅
- Tabla `ai_usage_logs` para registrar cada llamada a IA
- Función `log_ai_usage()` para logging fácil
- Vista `ai_usage_daily` para reportes
- Índices para queries rápidos

### 2. **Función count_tokens()** ✅
```rust
fn count_tokens(text: &str) -> i32 {
    // Aproximación: 1 token ≈ 4 caracteres
    let char_count = text.len();
    ((char_count as f64) / 4.0).ceil() as i32
}
```

**Precisión:**
- ✅ Suficiente para estimaciones de costo
- ✅ Rápida (no requiere librerías externas)
- ✅ Funciona para inglés y español

### 3. **Endpoints con Tracking** ✅

#### generate_quiz
```rust
// Calcular tokens
let input_tokens = count_tokens(&system_prompt) + count_tokens(&content_text);
let output_tokens = count_tokens(&response_json.to_string());
let total_tokens = input_tokens + output_tokens;

// Loguear
let _ = sqlx::query("SELECT log_ai_usage($1, $2, $3, $4, $5, $6, $7, $8, $9)")
    .bind(claims.sub)
    .bind(org_ctx.id)
    .bind(total_tokens)
    .bind(input_tokens)
    .bind(output_tokens)
    .bind("/lessons/generate-quiz")
    .bind(&model)
    .bind("quiz-generation")
    .bind(&json!({ "lesson_id": id, "quiz_type": quiz_req.quiz_type }))
    .execute(&pool)
    .await;
```

### 4. **Endpoint Admin** ✅
- `/admin/token-usage` - Ver uso por usuario
- Muestra:
  - Total tokens por usuario
  - Input vs output tokens
  - Número de requests
  - Costo estimado en USD
  - Última actividad

### 5. **UI Dashboard** ✅
- Página `/admin/token-usage`
- Stats cards con:
  - Total tokens
  - Requests IA
  - Costo estimado
  - Usuarios activos
- Tabla filtrable por rol
- Alertas de alto consumo (>1M tokens)

## 📊 Esquema de la Tabla

```sql
CREATE TABLE ai_usage_logs (
    id UUID,
    user_id UUID,
    organization_id UUID,
    tokens_used INTEGER,
    input_tokens INTEGER,
    output_tokens INTEGER,
    endpoint VARCHAR(255),
    model VARCHAR(100),
    request_type VARCHAR(50),
    request_metadata JSONB,
    estimated_cost_usd NUMERIC(10, 6),
    created_at TIMESTAMPTZ
);
```

## 💰 Cálculo de Costos

**Fórmula (OpenAI-like pricing):**
```rust
v_cost := (input_tokens * 0.000001) + (output_tokens * 0.000003);
// $1 por 1M input tokens
// $3 por 1M output tokens
```

**Ejemplos:**

| Endpoint | Input | Output | Total | Costo |
|----------|-------|--------|-------|-------|
| generate_quiz | 500 | 800 | 1,300 | $0.0029 |
| transcribe (1 min) | 0 | 150 | 150 | $0.00045 |
| chat (pregunta) | 200 | 300 | 500 | $0.0011 |

## 🎯 Endpoints a Implementar

Para tracking completo, agregar en:

### 1. **generate_summary_with_ollama**
```rust
// Al final de la función
let input_tokens = count_tokens(&text);
let output_tokens = count_tokens(&summary);
let _ = sqlx::query("SELECT log_ai_usage(...)")
    .bind(...)
    .execute(&pool)
    .await;
```

### 2. **chat con lesson tutor**
```rust
// En handlers.rs, función de chat
let input_tokens = count_tokens(&conversation_history);
let output_tokens = count_tokens(&ai_response);
// Log...
```

### 3. **generate_feedback**
```rust
// Similar a generate_quiz
```

## 📈 Dashboard de Admin

### Stats en Tiempo Real

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Total Tokens │ Requests IA  │ Costo USD    │ Usuarios     │
│   5,234,567  │    1,234     │   $15.67     │     345      │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

### Filtros Disponibles

- Por rol (student/instructor/admin)
- Por fecha (daily view)
- Por endpoint
- Por tipo de request

### Alertas Automáticas

```
⚠️ Usuarios con alto consumo detectado
5 usuario(s) han superado 1M de tokens.
Considere implementar límites de uso.
```

## 🔧 Límites Sugeridos

### Estudiantes
```json
{
  "daily_tokens": 50000,
  "monthly_tokens": 1000000,
  "max_requests_per_day": 100
}
```

### Instructores
```json
{
  "daily_tokens": 200000,
  "monthly_tokens": 5000000,
  "max_requests_per_day": 500
}
```

### Admins
```json
{
  "daily_tokens": 1000000,
  "monthly_tokens": 20000000,
  "max_requests_per_day": 2000
}
```

## 📝 Implementación de Límites (Opcional)

```rust
// Middleware o check antes de llamada a IA
async fn check_token_limit(
    pool: &PgPool,
    user_id: Uuid,
    daily_limit: i32,
) -> Result<(), StatusCode> {
    let today_usage: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(tokens_used), 0) FROM ai_usage_logs 
         WHERE user_id = $1 AND DATE(created_at) = CURRENT_DATE"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    
    if today_usage > daily_limit as i64 {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }
    
    Ok(())
}
```

## 🎯 Métricas Clave

### Por Usuario
- Total tokens (lifetime)
- Tokens hoy
- Requests hoy
- Costo acumulado

### Por Organización
- Total tokens (todos los usuarios)
- Top users
- Costo mensual
- Growth trend

### Por Endpoint
- Most used endpoints
- Average tokens per request
- Error rates

## 📖 Uso del Dashboard

1. **Ver uso general**
   - Ve a `/admin/token-usage`
   - Revisa stats cards

2. **Filtrar por rol**
   - Selecciona "Estudiantes" o "Instructores"
   - Ordena por "Total Tokens"

3. **Identificar power users**
   - Ordena por "Total Tokens"
   - Revisa usuarios > 1M tokens

4. **Monitorear costos**
   - Revisa "Costo USD"
   - Proyecta uso mensual

5. **Detectar anomalías**
   - Alertas automáticas > 1M tokens
   - Picos de uso inusuales

## 🚀 Próximos Pasos

### Corto Plazo
- [ ] Agregar logging en todos los endpoints de IA
- [ ] Implementar límites suaves (warnings)
- [ ] Exportar CSV de usage

### Mediano Plazo
- [ ] Límites duros (block requests)
- [ ] Notificaciones email (80% del límite)
- [ ] Gráficos de tendencia

### Largo Plazo
- [ ] Budget por organización
- [ ] Alertas de costo
- [ ] Integration con sistemas de billing

## 📁 Archivos Modificados

```
services/cms-service/migrations/20260316000002_ai_usage_tracking.sql
services/cms-service/src/handlers.rs
  + count_tokens() function
  + Token logging in generate_quiz
services/cms-service/src/handlers_admin.rs (NUEVO)
  + get_token_usage endpoint
services/cms-service/src/main.rs
  + /admin/token-usage route
shared/common/src/models.rs
  + TokenUsage models
web/studio/src/app/admin/token-usage/page.tsx (NUEVO)
  + Admin dashboard UI
web/studio/src/app/admin/page.tsx
  + Link a Token Usage
```

## ✅ Estado

| Componente | Estado |
|------------|--------|
| DB Schema | ✅ 100% |
| Logging Function | ✅ 100% |
| generate_quiz Tracking | ✅ 100% |
| Admin Endpoint | ✅ 100% |
| Admin Dashboard UI | ✅ 100% |
| Límites | ⏸️ Listo para implementar |
| Otros Endpoints | ⏳ Pendiente agregar |

**Progreso Total: 80%** 🎉
