# Debugging: Memory Game Block

## Pasos para Diagnosticar el Problema

### 1. Abrir Consola del Navegador

1. Ve a la lección que quieres editar
2. Presiona `F12` o clic derecho → "Inspeccionar"
3. Ve a la pestaña "Console"

### 2. Agregar Bloque Memory Match

1. Haz clic en el botón "🧩 Logic Game" (Memory Match)
2. **Verifica en consola**: ¿Aparece el log `[MemoryBlock] Render with pairs: [...]`?

### 3. Editar los Pares

1. Escribe texto en "Synapse Alpha" (left)
2. Escribe texto en "Synapse Beta" (right)
3. **Verifica en consola**: ¿Aparecen los logs `[MemoryBlock] Updating pair at index...`?

### 4. Guardar la Lección

1. Haz clic en "Save" o "Guardar"
2. **Verifica en consola**: ¿Hay algún error rojo?

### 5. Recargar la Página

1. Recarga la página (F5)
2. **Verifica**: ¿El bloque Memory Match aparece con los datos que guardaste?

---

## Posibles Problemas y Soluciones

### Problema 1: El bloque no aparece al crear

**Síntoma**: Haces clic en "🧩 Logic Game" pero no pasa nada

**Solución**:
```javascript
// Verifica que el bloque se está agregando
console.log('Blocks after add:', blocks);
```

### Problema 2: Los campos no se actualizan

**Síntoma**: Escribes en los inputs pero el texto no aparece

**Causa probable**: El estado no se está actualizando correctamente

**Verifica en consola**:
```
[MemoryBlock] Updating pair at index 0 : {left: "texto"}
```

### Problema 3: Los datos no se guardan

**Síntoma**: Guardas la lección pero al recargar los pares están vacíos

**Causa probable**: El backend no está procesando correctamente los pares

**Verifica**:
1. En la pestaña Network (F12 → Network)
2. Busca la petición PUT a `/lessons/{id}`
3. Revisa el payload: ¿Los pares tienen los valores que escribiste?

### Problema 4: Error al guardar

**Síntoma**: Aparece alerta "Failed to save activity"

**Verifica en consola**: ¿Hay un error rojo con más detalles?

---

## Comandos de Debugging

### En la consola del navegador:

```javascript
// Verificar bloques actuales
console.log('Current blocks:', blocks);

// Verificar solo bloques memory-match
console.log('Memory blocks:', blocks.filter(b => b.type === 'memory-match'));

// Verificar estructura de un par
console.log('First pair:', blocks.filter(b => b.type === 'memory-match')[0]?.pairs?.[0]);
```

### En la consola del servidor (Docker):

```bash
# Ver logs de Studio
docker logs openccb-studio-1 --tail 100

# Buscar errores específicos
docker logs openccb-studio-1 --tail 100 | grep -i "error\|memory\|block"
```

---

## Estructura Esperada del Bloque

Un bloque Memory Match correctamente formado se ve así:

```json
{
  "id": "uuid-generado",
  "type": "memory-match",
  "title": "Mi Juego de Memoria",
  "pairs": [
    {
      "id": "pair_1234567890_abc123",
      "left": "Término A",
      "right": "Definición A"
    },
    {
      "id": "pair_1234567891_def456",
      "left": "Término B",
      "right": "Definición B"
    }
  ]
}
```

---

## Checklist de Verificación

- [ ] El botón "🧩 Logic Game" aparece en la lista de bloques
- [ ] Al hacer clic, se agrega un bloque a la lección
- [ ] El bloque muestra campos para título y pares
- [ ] Puedo escribir en los campos "Synapse Alpha" y "Synapse Beta"
- [ ] Al escribir, los valores se actualizan en el estado
- [ ] Puedo agregar más pares con el botón "+"
- [ ] Puedo eliminar pares con el botón de basura
- [ ] Al guardar, no aparece ningún error
- [ ] Al recargar, los pares mantienen sus valores

---

## Reportar el Problema

Por favor proporciona:

1. **¿Qué paso del checklist falla?**
2. **Captura de pantalla de la consola** (F12 → Console)
3. **¿Qué ves en la pestaña Network?** (F12 → Network → petición PUT)
4. **¿Los logs `[MemoryBlock]` aparecen en consola?**

---

**Fecha**: 2026-03-23
**Versión**: OpenCCB 0.2.0
