# Debugging: Audio Recording Issue

## Problema Reportado
El ejercicio de captura de audio no se activa (no inicia la grabación).

## Soluciones Implementadas

### 1. Mejoras en el Componente AudioResponsePlayer

**Archivos modificados:**
- `web/experience/src/components/blocks/AudioResponsePlayer.tsx`

**Cambios realizados:**
1. ✅ Verificación de compatibilidad del navegador
2. ✅ Verificación de contexto seguro (HTTPS/localhost)
3. ✅ Logging detallado para debugging
4. ✅ Manejo mejorado de errores con mensajes específicos
5. ✅ Configuración optimizada de audio (eco cancellation, noise suppression)
6. ✅ Soporte para múltiples formatos de audio

### 2. Mensajes de Error Específicos

El sistema ahora muestra mensajes diferentes según el error:

| Error | Mensaje |
|-------|---------|
| Navegador no compatible | "Your browser does not support audio recording..." |
| Requiere HTTPS | "Audio recording requires HTTPS..." |
| Permiso denegado | "Please allow microphone access..." |
| Micrófono no encontrado | "No microphone found..." |
| Micrófono en uso | "Microphone is already in use..." |

---

## Pasos para Diagnosticar

### 1. Abrir Consola del Navegador

1. Ve a una lección con ejercicio de audio
2. Presiona `F12` o clic derecho → "Inspeccionar"
3. Ve a la pestaña "Console"

### 2. Verificar Mensajes de Log

Cuando hagas clic en "Start Recording", deberías ver:

```
[AudioResponse] Requesting microphone access...
[AudioResponse] Microphone access granted
[AudioResponse] Recording started
[AudioResponse] Speech recognition started
[AudioResponse] Data available, chunk size: XXXX
```

### 3. Verificar Errores

Si hay un error, verás algo como:

```
[AudioResponse] Error accessing microphone: NotAllowedError
```

---

## Verificación de Compatibilidad

### Navegadores Soportados

✅ **Chrome/Chromium** (v60+)
✅ **Firefox** (v53+)
✅ **Edge** (v79+)
✅ **Safari** (v14.1+)

❌ **Internet Explorer** - No soportado

### Verificar en tu Navegador

```javascript
// En la consola del navegador
console.log('MediaDevices:', !!navigator.mediaDevices);
console.log('getUserMedia:', !!navigator.mediaDevices?.getUserMedia);
console.log('MediaRecorder:', !!window.MediaRecorder);
console.log('Secure Context:', window.isSecureContext);
console.log('Protocol:', window.location.protocol);
```

---

## Problemas Comunes y Soluciones

### Problema 1: "Could not access microphone"

**Causa:** El usuario denegó el permiso del micrófono.

**Solución:**
1. Haz clic en el ícono de candado en la barra de URL
2. Permite el acceso al micrófono
3. Recarga la página

### Problema 2: "No microphone found"

**Causa:** No hay micrófono conectado o configurado.

**Solución:**
1. Conecta un micrófono o usa el integrado
2. Verifica en Configuración del Sistema → Sonido
3. Recarga la página

### Problema 3: "Microphone is already in use"

**Causa:** Otra aplicación está usando el micrófono.

**Solución:**
1. Cierra otras aplicaciones (Zoom, Teams, etc.)
2. Cierra otras pestañas del navegador que usen el micrófono
3. Intenta de nuevo

### Problema 4: "HTTPS Required"

**Causa:** El navegador bloquea el micrófono en HTTP.

**Solución:**
1. Usa HTTPS en producción
2. Para desarrollo local, usa `localhost` (funciona sin HTTPS)
3. O usa `ngrok` para crear un túnel HTTPS

### Problema 5: "Browser Not Supported"

**Causa:** El navegador no soporta la API MediaRecorder.

**Solución:**
1. Usa Chrome, Firefox, Edge o Safari actualizado
2. No uses Internet Explorer

---

## Comandos de Debugging

### En la consola del navegador:

```javascript
// Verificar permisos
navigator.permissions.query({name: 'microphone'}).then(result => {
    console.log('Mic permission:', result.state);
});

// Probar acceso al micrófono
navigator.mediaDevices.getUserMedia({audio: true})
    .then(() => console.log('✓ Mic access OK'))
    .catch(err => console.error('✗ Mic access failed:', err));

// Verificar formatos soportados
console.log('WebM supported:', MediaRecorder.isTypeSupported('audio/webm'));
console.log('WebM+Opus supported:', MediaRecorder.isTypeSupported('audio/webm;codecs=opus'));
```

### En la consola del servidor (Docker):

```bash
# Ver logs de Experience
docker logs openccb-experience-1 --tail 100

# Buscar errores específicos
docker logs openccb-experience-1 --tail 100 | grep -i "audio\|error"
```

---

## Estructura del Ejercicio de Audio

### Configuración Típica

```json
{
  "type": "audio-response",
  "prompt": "Describe your daily routine in English",
  "keywords": ["wake up", "breakfast", "work", "sleep"],
  "timeLimit": 60,
  "isGraded": true
}
```

### Flujo de Grabación

1. Usuario hace clic en "Start Recording"
2. Sistema solicita permiso de micrófono
3. Inicia grabación de audio (formato WebM)
4. Speech recognition transcribe en tiempo real
5. Usuario hace clic en "Stop Recording"
6. Audio se envía al servidor para evaluación
7. IA analiza pronunciación y keywords
8. Se muestra feedback con puntaje

---

## Checklist de Verificación

- [ ] El botón "Start Recording" aparece
- [ ] Al hacer clic, el navegador solicita permiso de micrófono
- [ ] El permiso es concedido
- [ ] El temporizador comienza a contar
- [ ] El ícono de grabación parpadea en rojo
- [ ] La transcripción aparece en tiempo real
- [ ] El botón "Stop Recording" funciona
- [ ] El audio se puede reproducir después de grabar
- [ ] El botón "Submit Response" aparece
- [ ] La evaluación se muestra después de enviar

---

## Reportar el Problema

Por favor proporciona:

1. **¿Qué navegador estás usando?** (Chrome, Firefox, etc.)
2. **¿Qué versión?** (ayuda → acerca de)
3. **¿Estás en localhost o producción?**
4. **¿Qué mensajes de error ves en la consola?**
5. **¿El navegador solicita permiso de micrófono?**
6. **¿Captura de pantalla de la consola (F12)?**

---

## Configuración para Desarrollo

### ngrok (HTTPS tunnel para desarrollo)

```bash
# Instalar ngrok
npm install -g ngrok

# Crear túnel HTTPS
ngrok http 3003
```

Esto te dará una URL HTTPS temporal para probar el micrófono.

---

**Fecha**: 2026-03-23
**Versión**: OpenCCB 0.2.0
**Componente**: AudioResponsePlayer
