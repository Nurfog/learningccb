# OpenCCB - Resumen de Configuración y Despliegue
## Fecha: 26 de Marzo de 2026

---

## 📋 Resumen del Proyecto

**OpenCCB** es una plataforma LMS/CMS de código abierto desplegada en **AWS EC2** con nginx-proxy para SSL automático.

**Servidor AWS:**
- **Host**: `ec2-18-224-137-67.us-east-2.compute.amazonaws.com`
- **Usuario**: `ubuntu`
- **SSH Key**: `ubuntu.pem`
- **Región**: us-east-2 (Ohio)

---

## 🔧 Configuración Actual

### Dominios
- `studio.norteamericano.com` - CMS/Admin
- `learning.norteamericano.com` - LMS/Estudiantes

### Arquitectura
```
┌─────────────────────────────────────────────────────┐
│                    AWS EC2                          │
│                                                     │
│  ┌─────────────┐    ┌──────────────────────────┐   │
│  │   nginx     │───▶│   Studio + CMS           │   │
│  │   proxy     │    │   (Next.js + Rust)       │   │
│  │  :80, :443  │    │   :3000, :3001           │   │
│  └──────┬──────┘    └──────────┬───────────────┘   │
│         │                      │                   │
│         │    ┌─────────────────┘                   │
│         │    │                                     │
│         ▼    ▼                                     │
│  ┌─────────────┐    ┌──────────────────────────┐   │
│  │   acme      │    │   Experience + LMS       │   │
│  │  companion  │    │   (Next.js + Rust)       │   │
│  │  (Let's     │    │   :3003, :3002           │   │
│  │   Encrypt)  │    └──────────┬───────────────┘   │
│  └─────────────┘               │                   │
│                                │                   │
│                     ┌──────────▼───────────────┐   │
│                     │   PostgreSQL + PGVector  │   │
│                     │   :5432                  │   │
│                     └──────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 Comandos de Despliegue

### Desde tu máquina local:

```bash
# Ejecutar deploy
./deploy.sh
```

El script preguntará:
1. Nombre del administrador
2. Email del administrador
3. Contraseña (oculta)
4. Nombre de la organización
5. ¿Usar SSL? [y/N]
   - **y**: Usará HTTPS (con o sin staging)
   - **N**: Usará HTTP (recomendado para staging)
6. ¿Usar STAGING? [y/N] (solo si elegiste SSL)
   - **y**: Certificados de prueba (sin rate limits)
   - **N**: Certificados reales (con rate limits)

### Conexión al servidor:

```bash
ssh -i "ubuntu.pem" ubuntu@ec2-18-224-137-67.us-east-2.compute.amazonaws.com
cd /var/www/openccb
```

---

## ⚠️ Problemas Conocidos y Soluciones

### 1. Login Pegado / Error de Conexión API

**Problema**: El botón de login se queda procesando infinitamente.

**Causa**: Las URLs de la API incluyen el puerto `:3001` incorrectamente.

**Solución Aplicada**:
- Actualizado `web/studio/src/lib/api.ts` para hardcodear las URLs de producción
- El código ahora detecta el hostname y usa la URL sin puerto

**Comandos para Solucionar**:
```bash
# Conectarse al servidor
ssh -i "ubuntu.pem" ubuntu@ec2-18-224-137-67.us-east-2.compute.amazonaws.com
cd /var/www/openccb

# Detener todo
sudo docker compose down

# Eliminar imágenes cacheadas
sudo docker rmi openccb-studio 2>/dev/null || true
sudo docker images | grep openccb | awk '{print $3}' | xargs sudo docker rmi -f 2>/dev/null || true

# Limpiar caché de Docker
sudo docker builder prune -af
sudo docker system prune -af

# Reconstruir DESDE CERO (CRÍTICO usar --no-cache)
sudo docker compose build --no-cache studio

# Iniciar todo
sudo docker compose up -d

# Esperar 1 minuto
sleep 60

# Verificar
sudo docker compose ps
docker logs openccb-studio --tail 20
```

**Verificación en el Navegador**:
1. Abrir ventana de incógnito (Ctrl+Shift+N)
2. Ir a `http://studio.norteamericano.com`
3. Abrir consola (F12) → Pestaña Network
4. Intentar loguearse
5. Verificar que la URL sea: `http://studio.norteamericano.com/auth/login` (SIN puerto)

### 2. Rate Limit de Let's Encrypt

**Problema**: Se alcanzó el límite de 5 certificados por semana.

**Solución Temporal**:
- Usar HTTP en lugar de HTTPS
- O usar Let's Encrypt Staging (certificados de prueba)

**Fecha de Reinicio**: 2026-03-27 04:21:42 UTC

---

## 📁 Archivos Modificados

### 1. `deploy.sh`
- ✅ Pregunta datos del administrador
- ✅ Pregunta sobre SSL y Staging
- ✅ Actualiza docker-compose.yml según elección (HTTP/HTTPS)
- ✅ Reconstruye contenedores con `--no-cache`
- ✅ Verifica variables de entorno en los contenedores
- ✅ Muestra URLs correctas según protocolo elegido

### 2. `docker-compose.yml`
- ✅ URLs en HTTP por defecto
- ✅ Ambos argumentos de build para studio:
  - `NEXT_PUBLIC_CMS_API_URL: http://studio.norteamericano.com`
  - `NEXT_PUBLIC_LMS_API_URL: http://learning.norteamericano.com`
- ✅ Variables de entorno correctas

### 3. `web/studio/Dockerfile`
- ✅ Agrega `ARG NEXT_PUBLIC_LMS_API_URL`
- ✅ Agrega `ENV NEXT_PUBLIC_LMS_API_URL`

### 4. `web/studio/src/lib/api.ts`
- ✅ Corrige función `getApiBaseUrl` para producción
- ✅ Hardcodea URLs para `studio.norteamericano.com` y `learning.norteamericano.com`
- ✅ Elimina el puerto de las URLs en producción

---

## 🔐 Credenciales (Ejemplo)

**Usuario Administrador**:
- Email: `admin@norteamericano.com`
- Contraseña: `Admin123!` (o la que se haya configurado)

**Base de Datos** (en `/var/www/openccb/.env`):
```
DB_PASSWORD=<generada_aleatoriamente>
JWT_SECRET=<generada_aleatoriamente>
```

---

## 📊 Comandos Útiles

### Ver estado de servicios
```bash
sudo docker compose ps
```

### Ver logs
```bash
# Todos los servicios
sudo docker compose logs -f

# Servicio específico
docker logs openccb-studio --tail 50
docker logs openccb-experience --tail 50
docker logs acme-companion --tail 50
```

### Verificar variables de entorno
```bash
# Studio
sudo docker exec openccb-studio env | grep NEXT_PUBLIC

# Experience
sudo docker exec openccb-experience env | grep NEXT_PUBLIC

# Debería mostrar:
# NEXT_PUBLIC_CMS_API_URL=http://studio.norteamericano.com
# NEXT_PUBLIC_LMS_API_URL=http://learning.norteamericano.com
```

### Reconstruir contenedores
```bash
# Todo
sudo docker compose build --no-cache
sudo docker compose up -d

# Solo studio
sudo docker compose build --no-cache studio
sudo docker compose up -d studio
```

### Limpiar caché de Docker
```bash
# Limpiar builder
sudo docker builder prune -af

# Limpiar sistema
sudo docker system prune -af
```

### Verificar certificados SSL
```bash
docker logs acme-companion --tail 50
```

---

## 🎯 Próximos Pasos

### 1. Reconstruir Studio con --no-cache
```bash
ssh -i "ubuntu.pem" ubuntu@ec2-18-224-137-67.us-east-2.compute.amazonaws.com
cd /var/www/openccb

sudo docker compose down
sudo docker rmi openccb-studio 2>/dev/null || true
sudo docker builder prune -af
sudo docker compose build --no-cache studio
sudo docker compose up -d
sleep 60
sudo docker compose ps
```

### 2. Probar Login
- Abrir ventana de incógnito
- Ir a `http://studio.norteamericano.com`
- Ver consola (F12) → Network
- Verificar URL: `http://studio.norteamericano.com/auth/login`
- Intentar loguearse

### 3. Verificar Funcionalidades
- [ ] Login de administrador
- [ ] Creación de cursos
- [ ] Subida de archivos
- [ ] Integración con LMS
- [ ] Certificados SSL generados

### 4. Cambiar a HTTPS (Después del Rate Limit)
```bash
# Después del 2026-03-27
./deploy.sh
# Responder "y" a "¿Usar SSL?"
# Responder "n" a "¿Usar STAGING?"
```

---

## 🔧 Solución de Problemas Comunes

### Login se queda procesando
```bash
# Verificar URL en consola del navegador
# Debe ser: http://studio.norteamericano.com/auth/login
# NO debe tener :3001

# Si tiene puerto, reconstruir con --no-cache
sudo docker compose build --no-cache studio
sudo docker compose up -d
```

### Error 502 Bad Gateway
```bash
# Verificar que los servicios están corriendo
sudo docker compose ps

# Ver logs
docker logs openccb-studio --tail 50
docker logs nginx-proxy --tail 50

# Reiniciar
sudo docker compose restart
```

### Variables NEXT_PUBLIC faltantes
```bash
# Ver docker-compose.yml
cat docker-compose.yml | grep -A 10 "studio:"

# Verificar en contenedor
sudo docker exec openccb-studio env | grep NEXT_PUBLIC

# Reconstruir
sudo docker compose build --no-cache studio
```

### Certificados SSL no se generan
```bash
# Ver logs
docker logs acme-companion --tail 100

# Verificar DNS
dig studio.norteamericano.com
dig learning.norteamericano.com

# Verificar puertos
sudo netstat -tlnp | grep :80
```

---

## 📝 Notas Importantes

1. **HTTP vs HTTPS**: Actualmente se usa HTTP porque:
   - Los certificados de staging no son válidos para producción
   - Las llamadas API entre dominios requieren HTTP o certificados válidos

2. **Rate Limit**: Let's Encrypt permite 5 certificados por semana por dominio. El límite se reinicia el 2026-03-27.

3. **--no-cache es CRÍTICO**: Siempre usar `--no-cache` al reconstruir Studio para que los cambios en el código se apliquen. Docker usa caché por defecto.

4. **Ventana de Incógnito**: Después de reconstruir, siempre probar en ventana de incógnito para evitar caché del navegador.

5. **URLs Hardcodeadas**: El código ahora tiene las URLs de producción hardcodeadas para `studio.norteamericano.com` y `learning.norteamericano.com`. Esto evita problemas con variables de entorno.

---

## 📞 Contacto y Soporte

**Documentación**:
- `DESPLIEGUE.md` - Instrucciones de despliegue
- `README.md` - Documentación general
- `docker-compose.yml` - Configuración de servicios

**Archivos de Configuración**:
- `/var/www/openccb/.env` - Variables de entorno
- `/var/www/openccb/docker-compose.yml` - Servicios Docker
- `web/studio/Dockerfile` - Build de Studio
- `web/studio/src/lib/api.ts` - Configuración de APIs
- `deploy.sh` - Script de despliegue

---

**Última Actualización**: 26 de Marzo de 2026  
**Estado**: ✅ Solución aplicada - Pendiente reconstruir con --no-cache y probar login
