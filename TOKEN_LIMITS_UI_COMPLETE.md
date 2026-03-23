# Token Limits - Implementación Completa

## ✅ Estado: COMPLETADO

**Fecha**: 2026-03-23  
**Versión**: OpenCCB 0.2.2

---

## 📊 Resumen de la Implementación

### Phase 1: Database + API ✅
- [x] Migración de base de datos
- [x] Funciones SQL (check_token_limit, get_user_usage_stats)
- [x] API Endpoints para gestión de límites
- [x] Módulo common::token_limits

### Phase 2: UI Dashboard + User Management ✅
- [x] Token Usage Dashboard mejorado
- [x] User Management con columna de límites
- [x] Admin Dashboard con card de AI Token Usage
- [x] Edición de límites en tiempo real
- [x] Alertas visuales de uso

### Phase 3: Enforce Automático ⏳ (Pendiente)
- [ ] Agregar check en handlers de IA (CMS + LMS)
- [ ] Sistema de alertas por email/notificación
- [ ] Trigger SQL para notificaciones automáticas

---

## 🎯 Dónde Encontrar Cada Feature

### 1. Token Usage Dashboard
**URL**: `http://localhost:3000/admin/token-usage`

**Features**:
- ✅ Ver uso de tokens por usuario
- ✅ Ver límite mensual configurado
- ✅ Ver porcentaje usado con barra de progreso
- ✅ Editar límites (clic en ícono ✏️)
- ✅ Alertas de usuarios >80% y >100%
- ✅ Ordenar por % usado, tokens, requests, costo
- ✅ Filtrar por rol

**Columnas**:
| Usuario | Rol | Límite Mensual | % Usado | Total Tokens | Requests | Costo USD |
|---------|-----|----------------|---------|--------------|----------|-----------|

---

### 2. User Management
**URL**: `http://localhost:3000/admin/users`

**Features**:
- ✅ Ver límite de tokens por usuario
- ✅ Ver porcentaje usado con badge de color
- ✅ Barra de progreso miniatura

**Columnas Nuevas**:
- Token Limit: Muestra % usado y límite mensual

---

### 3. Admin Dashboard
**URL**: `http://localhost:3000/admin`

**Features**:
- ✅ Card "AI Token Usage" con resumen
- ✅ Total tokens (formato compacto: 1.2M)
- ✅ Total requests
- ✅ Costo estimado en USD
- ✅ Link a Token Usage Dashboard

---

## 🎨 UI/UX Features

### Sistema de Colores

| Porcentaje | Color | Badge | Barra |
|------------|-------|-------|-------|
| 0-49% | Verde | bg-green-50 | bg-green-600 |
| 50-79% | Azul | bg-blue-50 | bg-blue-600 |
| 80-89% | Amarillo | bg-yellow-50 | bg-yellow-600 |
| 90-99% | Naranja | bg-orange-50 | bg-orange-600 |
| 100%+ | Rojo | bg-red-50 | bg-red-600 |

### Alertas

**Amarilla**: Usuarios con ≥80% de uso
```
⚠️ Usuarios cerca del límite
X usuario(s) han usado ≥80% de su límite mensual.
```

**Roja**: Usuarios con ≥100% de uso
```
⚠️ Límite excedido
X usuario(s) han excedido su límite mensual.
```

---

## 🔧 Cómo Usar

### 1. Ver Uso de Tokens

1. Navega a `/admin/token-usage`
2. Verás tabla con todos los usuarios
3. Ordena por "% Usado" para ver quienes están cerca del límite

### 2. Editar Límite de Usuario

1. En `/admin/token-usage` o `/admin/users`
2. Busca el usuario en la tabla
3. Haz clic en el ícono ✏️ junto al límite
4. Ingresa nuevo límite (0 = ilimitado)
5. Haz clic en ✓ para guardar

### 3. Configuración Masiva (SQL)

```sql
-- Estudiantes: 50K tokens/mes
UPDATE users 
SET monthly_token_limit = 50000, token_limit_reset_day = 1
WHERE role = 'student';

-- Instructores: 200K tokens/mes
UPDATE users 
SET monthly_token_limit = 200000, token_limit_reset_day = 1
WHERE role = 'instructor';

-- Admins: Ilimitado
UPDATE users 
SET monthly_token_limit = 0
WHERE role = 'admin';
```

---

## 📊 Métricas y Queries Útiles

### Ver Usuarios por Porcentaje de Uso

```sql
SELECT 
    u.email,
    u.role,
    u.monthly_token_limit,
    SUM(au.tokens_used) as used_tokens,
    ROUND((SUM(au.tokens_used)::NUMERIC / 
        CASE WHEN u.monthly_token_limit = 0 THEN 1 
             ELSE u.monthly_token_limit END * 100), 2) as percentage
FROM users u
LEFT JOIN ai_usage_logs au ON u.id = au.user_id
    AND au.created_at >= DATE_TRUNC('month', NOW())
WHERE u.monthly_token_limit IS NOT NULL
GROUP BY u.id
ORDER BY percentage DESC;
```

### Ver Uso por Día

```sql
SELECT 
    DATE(created_at) as date,
    COUNT(*) as requests,
    SUM(tokens_used) as total_tokens,
    SUM(estimated_cost_usd) as cost_usd
FROM ai_usage_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## 🚀 Próximos Pasos (Opcional)

### 1. Enforce Automático en Handlers de IA

Agregar en cada handler que usa IA:

```rust
// Check token limit before proceeding (estimate X tokens)
if let Err(_) = common::token_limits::check_ai_token_limit(&pool, claims.sub, 2000).await {
    return Err(StatusCode::TOO_MANY_REQUESTS);
}
```

**Handlers a actualizar**:
- `generate_quiz` (2000 tokens)
- `generate_course` (5000 tokens)
- `generate_hotspots` (2000 tokens)
- `generate_role_play` (2500 tokens)
- `summarize_lesson` (1500 tokens)
- `chat_with_tutor` (LMS, 1000 tokens)
- `evaluate_audio` (LMS, 1500 tokens)

### 2. Sistema de Alertas Automáticas

```sql
CREATE TRIGGER token_limit_alert
AFTER INSERT ON ai_usage_logs
FOR EACH ROW
EXECUTE FUNCTION check_token_limit_alert();
```

### 3. Notificaciones por Email

- Email al alcanzar 80%
- Email al alcanzar 90%
- Email al alcanzar 100%

---

## 📁 Archivos Modificados

### Backend
- `shared/common/src/token_limits.rs` (NUEVO)
- `shared/common/src/lib.rs`
- `services/cms-service/src/handlers_admin.rs`
- `services/cms-service/src/main.rs`
- `services/cms-service/migrations/20260323000000_monthly_token_limits.sql` (NUEVO)

### Frontend
- `web/studio/src/app/admin/token-usage/page.tsx`
- `web/studio/src/app/admin/users/page.tsx`
- `web/studio/src/app/admin/page.tsx`

### Documentación
- `TOKEN_LIMITS_GUIDE.md` (NUEVO)
- `TOKEN_LIMITS_STATUS.md` (NUEVO)
- `TOKEN_LIMITS_UI_COMPLETE.md` (ESTE ARCHIVO)

---

## 🎓 Ejemplo de Uso Real

### Escenario: Universidad con 1000 estudiantes

**Configuración Inicial**:
```sql
-- Límites por rol
UPDATE users SET monthly_token_limit = 50000 WHERE role = 'student';     -- 50K
UPDATE users SET monthly_token_limit = 200000 WHERE role = 'instructor'; -- 200K
UPDATE users SET monthly_token_limit = 0 WHERE role = 'admin';           -- Unlimited
```

**Monitoreo Semanal**:
1. Revisar `/admin/token-usage`
2. Ordenar por "% Usado"
3. Identificar estudiantes con >80%
4. Ajustar límites si es necesario

**Ajuste de Límites**:
```sql
-- Aumentar límite para estudiantes avanzados
UPDATE users 
SET monthly_token_limit = 100000
WHERE role = 'student' AND gpa > 3.5;
```

---

## ✅ Checklist de Testing

- [ ] Navegar a `/admin/token-usage`
- [ ] Ver tabla con usuarios y límites
- [ ] Editar límite de un usuario (✏️)
- [ ] Ver alerta amarilla (>80%)
- [ ] Ver alerta roja (>100%)
- [ ] Navegar a `/admin/users`
- [ ] Ver columna Token Limit
- [ ] Navegar a `/admin`
- [ ] Ver card AI Token Usage
- [ ] Ver link a Token Usage Dashboard
- [ ] Probar en mobile (responsive)
- [ ] Probar en dark mode

---

## 📞 Soporte

**Documentación Completa**: `TOKEN_LIMITS_GUIDE.md`  
**Estado**: `TOKEN_LIMITS_STATUS.md`  
**Issues**: Reportar en GitHub

---

**Implementado por**: Equipo de Desarrollo OpenCCB  
**Fecha**: 2026-03-23  
**Versión**: 0.2.2
