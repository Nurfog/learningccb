# Importación de Cursos desde MySQL

## Descripción

OpenCCB ahora soporta la importación completa de cursos desde una base de datos MySQL externa. Esta funcionalidad permite:

1. **Importar metadatos** de cursos y planes de estudio
2. **Importar preguntas** del banco de preguntas MySQL
3. **Crear cursos completos** con estructura básica (módulos y lecciones)

## Endpoints Implementados

### 1. Importar Metadatos (Cursos y Planes)

```bash
POST /question-bank/import-mysql-all
Content-Type: application/json
Authorization: Bearer <TOKEN>

{
  "import_metadata_only": true
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Metadatos importados exitosamente",
  "metadata": {
    "study_plans_imported": 5,
    "courses_imported": 20,
    "courses": [
      {
        "id_cursos": 1,
        "nombre_curso": "Inglés Básico",
        "nombre_plan": "Plan Regular",
        "duracion": 40,
        "nivel_curso": 2
      }
    ]
  }
}
```

### 2. Ver Cursos Disponibles

```bash
GET /question-bank/mysql-courses
Authorization: Bearer <TOKEN>
```

**Respuesta:**
```json
[
  {
    "id_cursos": 1,
    "nombre_curso": "Inglés Básico",
    "nombre_plan": "Plan Regular",
    "duracion": 40,
    "nivel_curso": 2
  },
  {
    "id_cursos": 2,
    "nombre_curso": "Inglés Intermedio",
    "nombre_plan": "Plan Intensivo",
    "duracion": 80,
    "nivel_curso": 6
  }
]
```

### 3. Importar Curso Completo con Estructura

```bash
POST /question-bank/import-course-mysql
Content-Type: application/json
Authorization: Bearer <TOKEN>

{
  "mysql_course_id": 1,
  "title": "Opcional: Título personalizado",
  "description": "Opcional: Descripción del curso",
  "pacing_mode": "self_paced"
}
```

**Respuesta:**
```json
{
  "course_id": "uuid-del-curso",
  "course_title": "Inglés Básico (Plan Regular)",
  "mysql_course_id": 1,
  "modules_created": 4,
  "lessons_created": 20,
  "message": "Curso 'Inglés Básico (Plan Regular)' importado exitosamente con 4 módulos y 20 lecciones"
}
```

## Estructura del Curso Importado

Al importar un curso desde MySQL, se crea automáticamente una estructura básica basada en la duración del curso:

### Cursos Regulares (40 horas)
- **4 módulos** con 5 lecciones cada uno (20 lecciones total)
  - Módulo 1: Introducción y Fundamentos
  - Módulo 2: Gramática Básica
  - Módulo 3: Vocabulario Esencial
  - Módulo 4: Práctica Integradora

### Cursos Intensivos (80 horas)
- **8 módulos** con 4-6 lecciones cada uno (46 lecciones total)
  - Módulo 1-2: Fundamentos Básicos y Gramática Esencial
  - Módulo 3-4: Vocabulario Intermedio y Comprensión Auditiva
  - Módulo 5-6: Expresión Oral y Lectura/Escritura
  - Módulo 7-8: Práctica Avanzada y Proyecto Final

### Tipos de Lecciones
Las lecciones se crean rotando entre diferentes tipos de contenido:
1. **video** - Contenido de video
2. **document** - Documentos de lectura (PDF, DOCX)
3. **interactive** - Actividades interactivas
4. **quiz** - Evaluaciones (cada 4ta lección es graded)

## Scripts de Importación

### Script Completo (Recomendado)

```bash
./scripts/import_courses_mysql.sh
```

Este script:
1. Obtiene el token de autenticación
2. Importa todos los metadatos de cursos y planes
3. Muestra la lista de cursos disponibles
4. Permite importar un curso específico o todos

### Script Manual (Paso a Paso)

```bash
# 1. Obtener token
TOKEN=$(curl -s -X POST "http://localhost:3001/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@norteamericano.cl","password":"Admin123!"}' \
  | jq -r '.token')

# 2. Importar metadatos
curl -X POST "http://localhost:3001/question-bank/import-mysql-all" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"import_metadata_only": true}'

# 3. Ver cursos disponibles
curl -X GET "http://localhost:3001/question-bank/mysql-courses" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 4. Importar un curso específico
curl -X POST "http://localhost:3001/question-bank/import-course-mysql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"mysql_course_id": 1}'
```

## Configuración Requerida

### Variables de Entorno

Asegúrate de configurar las siguientes variables en tu `.env`:

```bash
# Conexión a MySQL externa
MYSQL_DATABASE_URL=mysql://usuario:contraseña@host:3306/base_de_datos

# Credenciales de admin para importación
EMAIL="admin@norteamericano.cl"
PASSWORD="Admin123!"
```

### Estructura de la Base de Datos MySQL

La base de datos MySQL debe tener las siguientes tablas:

```sql
-- Planes de estudio
plandeestudios (
  idPlanDeEstudios INT PRIMARY KEY,
  Nombre VARCHAR(255),
  Activo BOOLEAN
)

-- Cursos
curso (
  idCursos INT PRIMARY KEY,
  idPlanDeEstudios INT,
  NombreCurso VARCHAR(255),
  NivelCurso INT,
  Duracion INT,
  Activo BOOLEAN,
  FOREIGN KEY (idPlanDeEstudios) REFERENCES plandeestudios(idPlanDeEstudios)
)

-- Banco de preguntas (opcional)
bancopreguntas (
  idPregunta INT PRIMARY KEY,
  idCursos INT,
  idPlanDeEstudios INT,
  idTipoPregunta INT,
  descripcion TEXT,
  activo BOOLEAN,
  FOREIGN KEY (idCursos) REFERENCES curso(idCursos)
)

-- Respuestas (opcional)
bancorespuestas (
  idRespuesta INT PRIMARY KEY,
  idPregunta INT,
  descripcion TEXT,
  resultado INT,
  activo BOOLEAN,
  FOREIGN KEY (idPregunta) REFERENCES bancopreguntas(idPregunta)
)
```

## Flujo de Importación Recomendado

1. **Primera vez:**
   ```bash
   ./scripts/import_courses_mysql.sh
   ```
   - Selecciona "all" para importar todos los cursos

2. **Actualizaciones posteriores:**
   ```bash
   # Solo importar nuevos cursos
   ./scripts/import_courses_mysql.sh
   # Selecciona los cursos específicos que faltan
   ```

3. **Importar solo preguntas:**
   ```bash
   ./scripts/import_mysql.sh
   ```

## Solución de Problemas

### Error: "MYSQL_DATABASE_URL not configured"
**Solución:** Agrega la variable `MYSQL_DATABASE_URL` en tu `.env`

### Error: "Course with ID X not found in MySQL"
**Solución:** Verifica que el curso exista en la base de datos MySQL y que `Activo = 1`

### Error: "Failed to connect to MySQL"
**Solución:** 
- Verifica que la conexión a MySQL esté disponible
- Comprueba las credenciales en `MYSQL_DATABASE_URL`
- Asegúrate de que el firewall permita la conexión

### Los cursos importados no tienen contenido
**Solución:** Esto es esperado. Los cursos se importan con una estructura básica (módulos y lecciones vacías). Debes completar el contenido de cada lección desde el Studio.

## Notas Importantes

1. **Los cursos importados no sobrescriben existentes** - Cada importación crea un nuevo curso
2. **El campo `imported_mysql_course_id`** se usa para rastrear el origen del curso
3. **Las preguntas del banco de preguntas** se importan por separado con `import_mysql.sh`
4. **La estructura generada es básica** - Debes personalizar el contenido de las lecciones

## Ejemplo de Uso con curl

```bash
# Login
RESPONSE=$(curl -s -X POST "http://localhost:3001/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@norteamericano.cl","password":"Admin123!"}')

TOKEN=$(echo $RESPONSE | jq -r '.token')

# Importar curso ID 5
curl -X POST "http://localhost:3001/question-bank/import-course-mysql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "mysql_course_id": 5,
    "title": "Curso Personalizado",
    "description": "Descripción personalizada del curso",
    "pacing_mode": "instructor_led"
  }' | jq .
```

## Próximas Mejoras

- [ ] Importación de contenido específico desde MySQL (si existe)
- [ ] Mapeo de prerrequisitos entre cursos
- [ ] Importación de usuarios inscritos
- [ ] Sincronización automática de cambios en MySQL
