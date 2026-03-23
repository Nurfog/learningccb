# Límites de Tokens Mensuales por Usuario

## Visión General

OpenCCB ahora soporta límites de tokens de IA mensuales configurables por usuario, permitiendo controlar el consumo de IA y prevenir usos excesivos.

---

## Características

### Configuración por Usuario

Cada usuario puede tener:
- **Límite mensual personalizado**: Número máximo de tokens que puede consumir por mes
- **Día de reset**: Día del mes cuando se reinicia el contador (1-28)
- **Ilimitado**: Configurando límite en 0

### Valores por Defecto

- **Límite**: 100,000 tokens/mes
- **Día de reset**: 1 (primero del mes)
- **Unlimited**: `monthly_token_limit = 0`

---

## Esquema de Base de Datos

### Tabla `users` (Nuevas Columnas)

```sql
monthly_token_limit INTEGER DEFAULT 100000
  -- Límite mensual de tokens (0 = ilimitado)

token_limit_reset_day INTEGER DEFAULT 1
  -- Día del mes para resetear (1-28)
```

### Vista `ai_usage_monthly`

Muestra el uso actual del mes por usuario:

```sql
SELECT * FROM ai_usage_monthly 
WHERE user_id = '{user-uuid}';
```

**Columnas:**
- `user_id`: UUID del usuario
- `organization_id`: UUID de la organización
- `usage_month`: Mes de uso
- `total_tokens`: Total de tokens consumidos
- `input_tokens`: Tokens de entrada (prompts)
- `output_tokens`: Tokens de salida (respuestas)
- `total_requests`: Número de peticiones a IA
- `total_cost_usd`: Costo estimado en USD

### Funciones SQL

#### `check_token_limit(user_id, additional_tokens)`

Verifica si un usuario tiene tokens disponibles.

```sql
SELECT * FROM check_token_limit(
    'user-uuid'::UUID,
    1000  -- Tokens adicionales a verificar
);
```

**Retorna:**
- `has_available_tokens`: BOOLEAN - ¿Tiene tokens disponibles?
- `monthly_limit`: INTEGER - Límite mensual configurado
- `used_tokens`: BIGINT - Tokens ya usados este mes
- `remaining_tokens`: BIGINT - Tokens restantes
- `reset_date`: TIMESTAMPTZ - Fecha del próximo reset

#### `get_user_usage_stats(user_id, months)`

Obtiene estadísticas históricas de uso.

```sql
SELECT * FROM get_user_usage_stats(
    'user-uuid'::UUID,
    3  -- Últimos 3 meses
);
```

**Retorna:**
- `month_start`: DATE - Inicio del mes
- `total_tokens`: BIGINT - Tokens totales
- `input_tokens`: BIGINT - Tokens de entrada
- `output_tokens`: BIGINT - Tokens de salida
- `total_requests`: BIGINT - Número de peticiones
- `total_cost_usd`: NUMERIC - Costo estimado
- `monthly_limit`: INTEGER - Límite del mes
- `percentage_used`: NUMERIC - Porcentaje usado

---

## API Endpoints

### 1. Establecer Límite Mensual

```http
PUT /api/admin/users/{user_id}/token-limit
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "monthly_token_limit": 50000,
  "token_limit_reset_day": 15
}
```

**Parámetros:**
- `monthly_token_limit` (integer): Límite mensual (0 = ilimitado)
- `token_limit_reset_day` (integer, opcional): Día de reset (1-28, default: 1)

**Respuesta:** `200 OK`

---

### 2. Ver Uso de Tokens de Usuario

```http
GET /api/admin/users/{user_id}/token-usage
Authorization: Bearer {admin_token}
```

**Respuesta:**
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "full_name": "Nombre Usuario",
  "monthly_token_limit": 100000,
  "token_limit_reset_day": 1,
  "used_tokens": 45678,
  "total_requests": 234,
  "total_cost_usd": 0.05,
  "last_used": "2026-03-23T10:30:00Z"
}
```

---

### 3. Verificar Límite Disponible

```http
GET /api/admin/users/{user_id}/token-limit/check
Authorization: Bearer {admin_token}
```

**Respuesta:**
```json
{
  "has_available_tokens": true,
  "monthly_limit": 100000,
  "used_tokens": 45678,
  "remaining_tokens": 54322,
  "reset_date": "2026-04-01T00:00:00Z"
}
```

---

## Ejemplos de Uso

### Ejemplo 1: Establecer Límite de 50K Tokens

```bash
curl -X PUT "http://localhost:3001/api/admin/users/{user-id}/token-limit" \
  -H "Authorization: Bearer {admin-token}" \
  -H "Content-Type: application/json" \
  -d '{
    "monthly_token_limit": 50000,
    "token_limit_reset_day": 1
  }'
```

### Ejemplo 2: Verificar Tokens Disponibles

```bash
curl "http://localhost:3001/api/admin/users/{user-id}/token-limit/check" \
  -H "Authorization: Bearer {admin-token}"
```

### Ejemplo 3: Obtener Uso del Mes

```bash
curl "http://localhost:3001/api/admin/users/{user-id}/token-usage" \
  -H "Authorization: Bearer {admin-token}"
```

### Ejemplo 4: SQL Directo

```sql
-- Ver uso actual de todos los usuarios
SELECT 
    u.email,
    u.full_name,
    u.monthly_token_limit,
    COALESCE(SUM(au.tokens_used), 0) as used_tokens,
    u.monthly_token_limit - COALESCE(SUM(au.tokens_used), 0) as remaining_tokens,
    CASE 
        WHEN u.monthly_token_limit = 0 THEN 'Unlimited'
        ELSE ROUND((COALESCE(SUM(au.tokens_used), 0)::NUMERIC / u.monthly_token_limit * 100)::NUMERIC, 2) || '%'
    END as usage_percentage
FROM users u
LEFT JOIN ai_usage_logs au ON u.id = au.user_id
    AND au.created_at >= DATE_TRUNC('month', NOW())
GROUP BY u.id, u.email, u.full_name, u.monthly_token_limit
ORDER BY used_tokens DESC;
```

---

## Estrategias de Límites

### Por Rol de Usuario

```sql
-- Estudiantes: 50K tokens/mes
UPDATE users SET monthly_token_limit = 50000 WHERE role = 'student';

-- Instructores: 200K tokens/mes
UPDATE users SET monthly_token_limit = 200000 WHERE role = 'instructor';

-- Admins: Ilimitado
UPDATE users SET monthly_token_limit = 0 WHERE role = 'admin';
```

### Por Tipo de Plan

```sql
-- Plan Básico: 25K tokens
UPDATE users SET monthly_token_limit = 25000 WHERE plan = 'basic';

-- Plan Pro: 100K tokens
UPDATE users SET monthly_token_limit = 100000 WHERE plan = 'pro';

-- Plan Enterprise: Ilimitado
UPDATE users SET monthly_token_limit = 0 WHERE plan = 'enterprise';
```

### Reset en Días Diferentes

```sql
-- Reset el día 15 (mitad de mes)
UPDATE users SET token_limit_reset_day = 15 WHERE organization_id = 'org-uuid';
```

---

## Implementación de Enforce

Para hacer cumplir los límites a nivel de API, verifica antes de cada solicitud de IA:

```rust
// Ejemplo en handler de IA
pub async fn chat_with_tutor(...) -> Result<...> {
    // 1. Verificar límite de tokens
    let limit_check: TokenLimitCheck = sqlx::query_as(
        "SELECT * FROM check_token_limit($1, 1000)"  // 1000 tokens estimados
    )
    .bind(claims.sub)
    .fetch_one(&pool)
    .await?;
    
    if !limit_check.has_available_tokens {
        return Err((
            StatusCode::TOO_MANY_REQUESTS,
            format!(
                "Monthly token limit exceeded. Reset date: {}",
                limit_check.reset_date
            )
        ));
    }
    
    // 2. Proceder con solicitud de IA
    // ...
    
    // 3. Loguear uso (ya implementado)
    sqlx::query("SELECT log_ai_usage(...)").execute(&pool).await?;
    
    Ok(response)
}
```

---

## Monitoreo y Alertas

### Dashboard de Uso

```sql
-- Usuarios que han usado > 80% de su límite
SELECT 
    u.email,
    u.full_name,
    u.monthly_token_limit,
    SUM(au.tokens_used) as used_tokens,
    ROUND((SUM(au.tokens_used)::NUMERIC / NULLIF(u.monthly_token_limit, 0) * 100)::NUMERIC, 2) as percentage_used
FROM users u
JOIN ai_usage_logs au ON u.id = au.user_id
WHERE au.created_at >= DATE_TRUNC('month', NOW())
  AND u.monthly_token_limit > 0
GROUP BY u.id, u.email, u.full_name, u.monthly_token_limit
HAVING SUM(au.tokens_used)::NUMERIC / NULLIF(u.monthly_token_limit, 0) > 0.8
ORDER BY percentage_used DESC;
```

### Notificación de Límite Alcanzado

Configura webhooks o emails cuando un usuario alcance el 80%, 90% y 100% de su límite.

---

## Troubleshooting

### Usuario Reporta que No Puede Usar IA

```sql
-- Verificar límite y uso
SELECT * FROM check_token_limit('user-uuid'::UUID, 0);

-- Ver historial de uso
SELECT * FROM get_user_usage_stats('user-uuid'::UUID, 1);

-- Ver logs de errores
SELECT * FROM ai_usage_logs 
WHERE user_id = 'user-uuid' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Resetear Contador de Usuario

```sql
-- Establecer límite ilimitado temporalmente
UPDATE users SET monthly_token_limit = 0 WHERE id = 'user-uuid';

-- O aumentar límite
UPDATE users SET monthly_token_limit = 200000 WHERE id = 'user-uuid';
```

---

## Referencias

- **Migración:** `services/cms-service/migrations/20260323000000_monthly_token_limits.sql`
- **Handlers:** `services/cms-service/src/handlers_admin.rs`
- **Endpoints:** `services/cms-service/src/main.rs`

---

**Fecha:** 2026-03-23  
**Versión:** OpenCCB 0.2.1
