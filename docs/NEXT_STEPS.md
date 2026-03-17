# 🎯 Próximos Pasos - OpenCCB

Después de limpiar Bark, tienes 3 funcionalidades principales listas para usar:

---

## 1️⃣ Question Bank (Sin Audio)

### ¿Qué Hace?
Banco centralizado de preguntas reutilizables para crear evaluaciones.

### Características
- ✅ Crear preguntas de 10 tipos diferentes
- ✅ Importar desde MySQL (sin duplicados)
- ✅ Generar con IA (con verificación de 4 habilidades)
- ✅ Filtrar por tipo, dificultad, skill
- ✅ Tags y organización
- ✅ Vista previa en cards

### Cómo Usar
```
1. Ve a /question-bank en Studio
2. Click "Nueva Pregunta"
3. Completa:
   - Tipo (multiple-choice, true-false, etc.)
   - Texto de la pregunta
   - Opciones (si aplica)
   - Respuesta correcta
   - Explicación
   - Dificultad
   - Tags
4. Guarda
```

### Endpoints Relacionados
```
GET    /question-bank              # Listar preguntas
POST   /question-bank              # Crear pregunta
PUT    /question-bank/{id}         # Actualizar pregunta
DELETE /question-bank/{id}         # Eliminar pregunta
POST   /question-bank/import-mysql # Importar desde MySQL
```

### Archivos Clave
```
web/studio/src/app/question-bank/page.tsx
web/studio/src/components/QuestionBank/
services/cms-service/src/handlers_question_bank.rs
```

---

## 2️⃣ Token Usage Dashboard

### ¿Qué Hace?
Monitoreo en tiempo real del consumo de IA (tokens, costos, usuarios).

### Características
- ✅ Stats en tiempo real
- ✅ Costos estimados en USD
- ✅ Filtrar por rol (student/instructor/admin)
- ✅ Alertas de alto consumo (>1M tokens)
- ✅ Tabla detallada por usuario
- ✅ Tracking de input vs output tokens

### Cómo Usar
```
1. Ve a /admin/token-usage
2. Revisa las 4 stats cards:
   - Total Tokens
   - Requests IA
   - Costo USD
   - Usuarios Activos
3. Filtra por rol si necesitas
4. Ordena por Total Tokens para ver power users
5. Revisa alertas de alto consumo
```

### Endpoints Relacionados
```
GET /admin/token-usage  # Ver uso de tokens
```

### Archivos Clave
```
web/studio/src/app/admin/token-usage/page.tsx
services/cms-service/src/handlers_admin.rs
services/cms-service/migrations/20260316000002_ai_usage_tracking.sql
```

### Límites Sugeridos
```json
{
  "student": {
    "daily_tokens": 50000,
    "monthly_tokens": 1000000
  },
  "instructor": {
    "daily_tokens": 200000,
    "monthly_tokens": 5000000
  },
  "admin": {
    "daily_tokens": 1000000,
    "monthly_tokens": 20000000
  }
}
```

---

## 3️⃣ Importar Preguntas desde MySQL

### ¿Qué Hace?
Trae preguntas del banco de diagnóstico de inglés (sistema legacy) a OpenCCB.

### Características
- ✅ Importación masiva por curso
- ✅ Detección automática de duplicados
- ✅ Mapeo de tipos de pregunta
- ✅ Tracking de origen (imported-mysql)
- ✅ Skills automáticos
- ✅ No reimporta preguntas existentes

### Cómo Usar
```
1. Ve a /question-bank
2. Click "Importar desde MySQL"
3. Selecciona curso de MySQL:
   - YOUNG LEARNERS 1
   - KIDS: BEGINNER 1
   - TEENS 1
   - ADULTS REGULAR
   - etc.
4. Click "Importar Preguntas"
5. Espera confirmación:
   "Imported 45 questions (skipped 12 already imported)"
```

### Endpoints Relacionados
```
GET  /question-bank/mysql-courses  # Listar cursos MySQL
POST /question-bank/import-mysql   # Importar preguntas
```

### Archivos Clave
```
web/studio/src/components/QuestionBank/MySQLImportModal.tsx
services/cms-service/src/handlers_question_bank.rs
```

### Estructura MySQL
```sql
-- Tablas de origen
bancopreguntas (idPregunta, descripcion, idTipoPregunta)
curso (idCursos, NombreCurso)
plandeestudios (idPlanDeEstudios, Nombre)
```

---

## 🚀 Flujo Recomendado

### Paso 1: Importar desde MySQL (5 min)
```
1. Ve a /question-bank
2. Importa preguntas de un curso
3. Verifica que se importaron correctamente
```

### Paso 2: Revisar Token Usage (2 min)
```
1. Ve a /admin/token-usage
2. Revisa el consumo actual
3. Identifica usuarios con alto consumo
```

### Paso 3: Crear Preguntas Manuales (10 min)
```
1. Crea 2-3 preguntas manualmente
2. Prueba diferentes tipos
3. Agrega tags y skills
4. Genera algunas con IA
```

### Paso 4: Verificar Todo (5 min)
```
1. Filtra preguntas por tipo
2. Revisa skills asignados
3. Verifica token usage después de usar IA
```

---

## 📊 Comparativa de Funcionalidades

| Característica | Question Bank | Token Dashboard | MySQL Import |
|---------------|---------------|-----------------|--------------|
| Tiempo | 10 min | 2 min | 5 min |
| Complejidad | Media | Baja | Baja |
| Impacto | Alto | Medio | Alto |
| Dependencias | Ninguna | IA logs | MySQL connection |

---

## 💡 Casos de Uso

### Para Instructores
1. **Question Bank**: Crear preguntas para sus cursos
2. **MySQL Import**: Traer preguntas existentes del sistema legacy
3. **Token Dashboard**: Monitorear su propio uso de IA

### Para Admins
1. **Token Dashboard**: Ver consumo global de IA
2. **Question Bank**: Gestionar banco institucional
3. **MySQL Import**: Migración masiva de contenido

### Para Desarrolladores
1. **Token Dashboard**: Debug de llamadas a IA
2. **Question Bank**: Testing de nuevos tipos de preguntas
3. **MySQL Import**: Migración de datos

---

## 🎯 Métricas de Éxito

### Question Bank
- [ ] 100+ preguntas creadas
- [ ] 5+ tipos de preguntas usados
- [ ] 50% con skills asignados

### Token Dashboard
- [ ] Dashboard accesible
- [ ] Stats en tiempo real
- [ ] Alertas funcionando

### MySQL Import
- [ ] 0 duplicados
- [ ] 100% preguntas importadas
- [ ] Skills asignados correctamente

---

## 📁 Comandos Útiles

### Iniciar Studio
```bash
cd /home/juan/dev/openccb/web/studio
npm run dev
# Acceder: http://localhost:3000
```

### Ver Logs del CMS
```bash
cd /home/juan/dev/openccb
RUST_LOG=debug cargo run -p cms-service
```

### Verificar Conexión MySQL
```bash
cd /home/juan/dev/openccb
node check_mysql.js
```

### Ver Token Usage en DB
```bash
docker-compose exec -T db psql -U user -d openccb_cms -c \
  "SELECT user_id, SUM(tokens_used), SUM(estimated_cost_usd) 
   FROM ai_usage_logs 
   GROUP BY user_id 
   ORDER BY SUM(tokens_used) DESC 
   LIMIT 10;"
```

---

## 🎉 ¿Listo para Comenzar?

Elige una opción y comienza:

```bash
# Opción 1: Question Bank
# Ve a http://localhost:3000/question-bank

# Opción 2: Token Dashboard
# Ve a http://localhost:3000/admin/token-usage

# Opción 3: Importar desde MySQL
# Ve a /question-bank → "Importar desde MySQL"
```

**Recomendación:** Comienza con **MySQL Import** para tener contenido base, luego explora **Question Bank** para crear preguntas nuevas, y finalmente monitorea todo con **Token Dashboard**.

---

**Documentación Relacionada:**
- `docs/QUESTION_BANK_UI.md` - UI del Question Bank
- `docs/TOKEN_USAGE_TRACKING.md` - Tracking de tokens
- `docs/AUDIO_GUIDE_FOR_INSTRUCTORS.md` - Guía de audio (para cuando quieras implementar audio manual)
