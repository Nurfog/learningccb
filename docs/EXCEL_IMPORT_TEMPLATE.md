# 📊 Plantilla para Importar Preguntas desde Excel

## 📁 Estructura del Archivo Excel

### Columnas Requeridas

| Columna | Nombre | Descripción | Ejemplo |
|---------|--------|-------------|---------|
| A | question_text | Texto de la pregunta | What color is the sky? |
| B | question_type | Tipo de pregunta | multiple-choice |
| C | options | Opciones (JSON o comma-separated) | ["Blue","Green","Red","Yellow"] |
| D | correct_answer | Respuesta correcta (índice o JSON) | 0 |
| E | explanation | Explicación (opcional) | The sky appears blue due to Rayleigh scattering |
| F | difficulty | Dificultad | easy |
| G | tags | Tags (comma-separated) | science,colors,nature |

### Tipos de Pregunta Válidos

```
multiple-choice
true-false
short-answer
essay
matching
ordering
fill-in-the-blanks
```

### Ejemplo de Archivo Excel

| question_text | question_type | options | correct_answer | explanation | difficulty | tags |
|---------------|---------------|---------|----------------|-------------|------------|------|
| What color is the sky? | multiple-choice | ["Blue","Green","Red","Yellow"] | 0 | The sky appears blue due to Rayleigh scattering | easy | science,colors |
| The sun rises in the east. | true-false | ["Verdadero","Falso"] | 0 | The sun always rises in the east | easy | geography |
| What is the past tense of "go"? | short-answer | | went | Go is an irregular verb | medium | grammar,verbs |
| Complete: She ___ to school | fill-in-the-blanks | ["go","goes","going","went"] | 1 | Third person singular present | medium | grammar |

## 📤 Cómo Importar

### Paso 1: Preparar Archivo Excel

1. Abre Excel o Google Sheets
2. Crea las columnas como se muestra arriba
3. Completa con tus preguntas
4. Guarda como `.xlsx`

### Paso 2: Subir a OpenCCB

1. Ve a `/question-bank`
2. Click en **"Importar desde Excel"**
3. Selecciona tu archivo `.xlsx`
4. Click en **"Importar"**

### Paso 3: Verificar

1. Revisa el resultado:
   - ✅ Importadas: X preguntas
   - ⚠️ Saltadas: Y preguntas (datos inválidos)
   - ❌ Errores: Z errores

2. Ve al Banco de Preguntas
3. Filtra por source: `imported-csv`

## 💡 Consejos

### Opciones Válidas

**Formato JSON (recomendado):**
```
["Opción A","Opción B","Opción C","Opción D"]
```

**Formato comma-separated:**
```
Opción A, Opción B, Opción C, Opción D
```

### Respuesta Correcta

**Como índice (recomendado para multiple-choice):**
```
0  ← Primera opción
1  ← Segunda opción
2  ← Tercera opción
```

**Como array (para multiple-select):**
```
[0, 2]  ← Primera y tercera opción
```

### Tags

**Separados por comas:**
```
science,colors,nature
grammar,verbs,past-tense
```

## ⚠️ Errores Comunes

### ❌ Columnas en otro idioma
```
texto_pregunta  ← Incorrecto
question_text   ← Correcto
```

### ❌ Tipo de pregunta inválido
```
opcion-multiple  ← Incorrecto
multiple-choice  ← Correcto
```

### ❌ Formato de opciones incorrecto
```
Opción A; Opción B; Opción C  ← Incorrecto (punto y coma)
["A","B","C"]                  ← Correcto (JSON)
```

### ❌ Respuesta correcta fuera de rango
```
5  ← Incorrecto (solo hay 4 opciones: 0-3)
0  ← Correcto
```

## 📊 Métricas de Importación

| Métrica | Descripción |
|---------|-------------|
| Importadas | Preguntas guardadas exitosamente |
| Saltadas | Filas sin question_text o con datos inválidos |
| Errores | Problemas de base de datos |

## 🎯 Flujo Recomendado

1. **Crear plantilla** con 5-10 preguntas de prueba
2. **Importar** y verificar que todo funcione
3. **Revisar** preguntas importadas en el banco
4. **Crear** archivo completo con todas las preguntas
5. **Importar** masivamente
6. **Editar** preguntas si es necesario

---

**Plantilla Descargable:** `question_bank_template.xlsx`
