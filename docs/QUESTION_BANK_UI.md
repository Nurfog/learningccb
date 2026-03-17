# Question Bank UI - Documentación

## Vista General

El Banco de Preguntas es una interfaz completa en Studio para gestionar preguntas reutilizables con soporte para audio generado por IA.

## Acceso

```
http://localhost:3000/question-bank
```

## Componentes

### 1. Página Principal (`/question-bank/page.tsx`)

**Características:**
- Lista todas las preguntas del banco
- Filtros por tipo, dificultad, origen, audio
- Búsqueda por texto
- Estadísticas rápidas (total, importadas, con audio, IA)
- Accesos rápidos para crear e importar

**Estadísticas mostradas:**
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Total        │ MySQL        │ Con Audio    │ IA           │
│    150       │     45       │     32       │     18       │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

### 2. QuestionBankCard (`QuestionBankCard.tsx`)

Tarjeta individual de pregunta que muestra:
- Tipo de pregunta (badge)
- Dificultad (color-coded)
- Texto de la pregunta (truncado)
- Opciones preview (primeras 3)
- Estado del audio
- Origen (MySQL, IA, Manual)
- Uso (veces utilizada)
- Acciones: Editar, Eliminar, Audio

**Badges de tipo:**
- 🟦 Opción Múltiple
- 🟩 Verdadero/Falso
- 🟨 Respuesta Corta
- 🟪 Ensayo
- 🟧 Emparejamiento
- 🔵 Ordenar
- 🟫 Completar
- 🟣 Respuesta Audio
- 🔴 Hotspot
- ⬛ Código

**Badges de dificultad:**
- 🟢 Fácil (easy)
- 🟡 Media (medium)
- 🔴 Difícil (hard)

**Badges de origen:**
- 🌐 MySQL - Importado desde sistema legacy
- ✨ IA - Generado por Inteligencia Artificial
- Manual - Creado manualmente

### 3. QuestionBankEditor (`QuestionBankEditor.tsx`)

Modal para crear/editar preguntas con:

**Campos:**
- Tipo de pregunta (10 tipos soportados)
- Dificultad (easy/medium/hard)
- Texto de la pregunta (required)
- Opciones (para multiple-choice/true-false)
- Respuesta correcta (selector radial)
- Explicación/feedback
- Puntos
- Etiquetas (tags)
- Checkbox "Generar audio automáticamente"

**Características especiales:**
- Botón "Generar con IA" para opciones y explicación
- Agregar/remover opciones dinámicamente
- Tags con auto-complete
- Validación en tiempo real

### 4. MySQLImportModal (`MySQLImportModal.tsx`)

Modal para importar preguntas desde MySQL:

**Flujo:**
1. Selecciona curso de MySQL (carga dinámica)
2. Click en "Importar Preguntas"
3. Importa todas las preguntas activas del curso
4. Muestra cantidad importada
5. Redirige a la lista actualizada

**Información mostrada:**
- Lista de cursos disponibles (NombreCurso + NombrePlan)
- Explicación de qué se importará
- Progreso de importación
- Resultado (éxito/error)

### 5. AudioGeneratorModal (`AudioGeneratorModal.tsx`)

Modal para generar audio con Bark TTS:

**Configuración:**
- Vista previa del texto de la pregunta
- Texto personalizable (opcional)
- Selector de voz (6 opciones: 3 inglés, 3 español)
- Control de velocidad (0.5x - 2.0x)

**Voces disponibles:**
```
Inglés:
- v2/en_speaker_0 (English Speaker 0)
- v2/en_speaker_1 (English Speaker 1) ← default
- v2/en_speaker_6 (English Speaker 6)

Español:
- v2/es_speaker_0 (Spanish Speaker 0)
- v2/es_speaker_1 (Spanish Speaker 1)
- v2/es_speaker_3 (Spanish Speaker 3)
```

**Estados:**
- ⏳ Generando... (polling cada 1s, max 30s)
- ✅ Audio generado (con preview play/pause)
- ❌ Error (mensaje descriptivo)

**Características:**
- Polling automático para verificar estado
- Reproductor de audio integrado
- Botón Play/Pause
- Indicador visual de estado

## Flujos de Usuario

### Crear Pregunta Manualmente

```
1. Click "Nueva Pregunta"
2. Seleccionar tipo de pregunta
3. Completar texto de pregunta
4. Agregar opciones (si aplica)
5. Marcar respuesta correcta
6. Agregar explicación (opcional)
7. Configurar puntos y dificultad
8. Agregar etiquetas
9. ☑️ Marcar "Generar audio automáticamente"
10. Click "Guardar Pregunta"
```

### Importar desde MySQL

```
1. Click "Importar desde MySQL"
2. Seleccionar curso del dropdown
3. Click "Importar Preguntas"
4. Esperar confirmación (ej: "Se importaron 45 preguntas")
5. Las preguntas aparecen en la lista con badge 🌐 MySQL
```

### Generar Audio para Pregunta

```
1. Click ícono 🔊 en pregunta (si no tiene audio)
2. (Opcional) Personalizar texto para audio
3. Seleccionar voz
4. Ajustar velocidad
5. Click "Generar Audio"
6. Esperar generación (5-30 segundos)
7. Click "Reproducir" para preview
8. Click "Cerrar" cuando esté listo
```

### Filtrar Preguntas

```
1. Click "Filtros"
2. Seleccionar tipo de pregunta
3. Seleccionar dificultad
4. Seleccionar origen
5. Filtrar por audio (con/sin)
6. Results se actualizan automáticamente
```

### Buscar Preguntas

```
1. Escribir en barra de búsqueda
2. Presionar Enter
3. Results filtran por texto en question_text
```

## Integración con Test Templates

Las preguntas del banco se pueden usar en:
- Plantillas de pruebas (Test Templates)
- Lecciones tipo quiz directamente
- Ejercicios de práctica

**Próximamente:**
- Selector de preguntas desde banco al crear plantilla
- Bulk selection para agregar múltiples preguntas
- Vista previa de pregunta con audio

## API Endpoints Utilizados

```typescript
// Listar preguntas
GET /question-bank?question_type=multiple-choice&difficulty=medium&has_audio=true

// Crear pregunta
POST /question-bank
{
  "question_text": "What is...?",
  "question_type": "multiple-choice",
  "options": ["A", "B", "C", "D"],
  "correct_answer": 0,
  "explanation": "Because...",
  "points": 1,
  "difficulty": "medium",
  "tags": ["grammar", "past-tense"],
  "generate_audio": true
}

// Actualizar pregunta
PUT /question-bank/{id}

// Eliminar pregunta
DELETE /question-bank/{id}

// Importar desde MySQL
POST /question-bank/import-mysql
{
  "mysql_course_id": 30,
  "import_all": true
}

// Generar audio
POST /question-bank/{id}/generate-audio
{
  "text": "What color is the sky?",
  "voice": "v2/en_speaker_1",
  "speed": 1.0
}

// Listar cursos MySQL
GET /question-bank/mysql-courses
```

## Estilos y UX

**Tema:**
- Soporte completo dark mode
- Colores consistentes con el resto de Studio
- Animaciones suaves (hover, transitions)

**Responsive:**
- Grid adaptable (1/2/3 columnas)
- Modal con scroll interno
- Touch-friendly en móviles

**Accesibilidad:**
- Labels en todos los inputs
- Focus visible
- ARIA attributes
- Keyboard navigation

## Próximas Mejoras

- [ ] Bulk audio generation (múltiples preguntas)
- [ ] Exportar preguntas a CSV/JSON
- [ ] Importar desde CSV
- [ ] Vista previa de pregunta completa en card
- [ ] Historial de ediciones
- [ ] Comentarios/notas en preguntas
- [ ] Compartir preguntas entre organizaciones
- [ ] Analytics de uso por pregunta
- [ ] AI-powered tagging automático
- [ ] Detección de preguntas duplicadas

## Troubleshooting

**Error: "No se pudo cargar los cursos de MySQL"**
- Verificar que `MYSQL_DATABASE_URL` esté configurado en `.env`
- Verificar conectividad al servidor MySQL

**Error: "Error al generar audio"**
- Verificar que Bark TTS esté corriendo en t-800
- Verificar que `BARK_API_URL` esté configurado
- Revisar logs de Bark: `ssh juan@t-800 && journalctl -u bark-tts -f`

**Audio no se reproduce**
- Verificar formato de audio (WAV soportado)
- Verificar permisos del navegador
- Probar en otro navegador

## Referencias

- [Question Bank Backend](../../services/cms-service/src/handlers_question_bank.rs)
- [Bark TTS Guide](../../docs/BARK_TTS_GUIDE.md)
- [Test Templates UI](./TestTemplates/)
