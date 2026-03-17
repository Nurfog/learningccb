# 🎯 Navbar - Estructura Final

## 📊 Menú "Cursos" Completo

El dropdown **Cursos** ahora incluye todas las herramientas relacionadas con cursos y evaluaciones:

```
┌──────────────────────────────────┐
│ 📊 Listar Cursos                 │  ← Dashboard principal
│ ──────────────────────────────── │
│ 📚 Librería                      │  ← Activos y recursos
│ ❓ Banco de Preguntas            │  ← Preguntas individuales
│ ──────────────────────────────── │
│ 📝 Plantillas de Pruebas         │  ← Evaluaciones completas
└──────────────────────────────────┘
```

## 🗂️ Organización Lógica

### Nivel 1: Gestión de Cursos
- **Listar Cursos** → Ver todos tus cursos

### Nivel 2: Recursos
- **Librería** → Archivos, videos, documentos
- **Banco de Preguntas** → Preguntas individuales para armar evaluaciones

### Nivel 3: Evaluaciones
- **Plantillas de Pruebas** → Evaluaciones completas listas para aplicar

## 📁 Diferencias Clave

| Item | Qué es | Cuándo usar |
|------|--------|-------------|
| **Banco de Preguntas** | Preguntas sueltas | Crear/editar preguntas individuales |
| **Plantillas de Pruebas** | Evaluaciones completas | Armar pruebas con múltiples preguntas |

### Ejemplo de Flujo

```
1. Banco de Preguntas
   └─→ Creo preguntas individuales
       - "What color is the sky?"
       - "Past tense of 'go'?"
       - "Plural of 'child'?"

2. Plantillas de Pruebas
   └─→ Armo evaluación "Final Exam Beginner 1"
       - Selecciono 10 preguntas del banco
       - Configuro duración: 60 min
       - Configuro puntuación: 70% para aprobar

3. Aplicar Plantilla
   └─→ Asigno la prueba a una lección del curso
```

## 🎨 Estructura Visual

### Dropdown con Separadores
```
┌──────────────────────────────────┐
│ 📊 Listar Cursos                 │
├──────────────────────────────────┤  ← Separador
│ 📚 Librería                      │
│ ❓ Banco de Preguntas            │
├──────────────────────────────────┤  ← Separador
│ 📝 Plantillas de Pruebas         │
└──────────────────────────────────┘
```

## 🔗 URLs

| Item | URL |
|------|-----|
| Listar Cursos | `/` |
| Librería | `/library/assets` |
| Banco de Preguntas | `/question-bank` |
| Plantillas de Pruebas | `/test-templates` |

## 📋 Checklist de Navegación

- [ ] Listar Cursos → Dashboard principal
- [ ] Librería → Gestión de activos
- [ ] Banco de Preguntas → Crear preguntas
- [ ] Plantillas de Pruebas → Armar evaluaciones

## 💡 Flujo Recomendado

### Para Crear una Evaluación

1. **Banco de Preguntas**
   - Crear 20-30 preguntas
   - Asignar skills (reading, listening, speaking, writing)
   - Agregar explicaciones

2. **Plantillas de Pruebas**
   - Click en "Nueva Plantilla"
   - Nombre: "Final Exam - Beginner 1"
   - Tipo: `FWT` (Final Written Test)
   - Duración: 60 minutos
   - Seleccionar 10-15 preguntas del banco

3. **Aplicar a Curso**
   - Click en "Aplicar Plantilla"
   - Seleccionar curso
   - Seleccionar lección
   - Listo! ✅

## 🎯 Métricas de Uso

| Item | Uso Típico |
|------|------------|
| Listar Cursos | Diario |
| Librería | Semanal |
| Banco de Preguntas | Semanal |
| Plantillas de Pruebas | Mensual (al crear evaluaciones) |

---

**Estado:** ✅ Completo y funcional
