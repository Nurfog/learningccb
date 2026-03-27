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
6. ¿Usar STAGING? [y/N] (solo si elegiste SSL)

### Conexión al servidor:

```bash
ssh -i "ubuntu.pem" ubuntu@ec2-18-224-137-67.us-east-2.compute.amazonaws.com
cd /var/www/openccb
```

---

## ⚠️ Problemas Conocidos (Para Resolver)

### 1. Variables NEXT_PUBLIC en Studio

**Problema**: El contenedor `openccb-studio` no está recibiendo ambas variables `NEXT_PUBLIC`:
- ✅ `NEXT_PUBLIC_LMS_API_URL=http://learning.norteamericano.com`
- ❌ `NEXT_PUBLIC_CMS_API_URL` - **FALTA**

**Solución Aplicada**:
1. Actualizado `web/studio/Dockerfile` para aceptar ambos ARG
2. Actualizado `docker-compose.yml` para pasar ambos argumentos
3. Actualizado `deploy.sh` para verificar y reconstruir con `--no-cache`

**Comandos para Verificar**:
```bash
# En el servidor
sudo docker exec openccb-studio env | grep NEXT_PUBLIC

# Debería mostrar:
# NEXT_PUBLIC_CMS_API_URL=http://studio.norteamericano.com
# NEXT_PUBLIC_LMS_API_URL=http://learning.norteamericano.com
```

**Si persiste el problema**:
```bash
# Reconstruir manualmente
cd /var/www/openccb
sudo docker compose down
sudo docker rmi openccb-studio 2>/dev/null || true
sudo docker builder prune -f
sudo docker compose build --no-cache studio
sudo docker compose up -d studio
sudo docker exec openccb-studio env | grep NEXT_PUBLIC
```

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
- ✅ Actualiza docker-compose.yml según elección
- ✅ Reconstruye contenedores con `--no-cache`
- ✅ Verifica variables de entorno

### 2. `docker-compose.yml`
- ✅ URLs en HTTP por defecto
- ✅ Ambos argumentos de build para studio
- ✅ Variables de entorno correctas

### 3. `web/studio/Dockerfile`
- ✅ Agrega `ARG NEXT_PUBLIC_LMS_API_URL`
- ✅ Agrega `ENV NEXT_PUBLIC_LMS_API_URL`

### 4. `web/studio/src/lib/api.ts`
- ✅ Corrige función `getApiBaseUrl` para priorizar variable de entorno

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

### Verificar certificados SSL
```bash
docker logs acme-companion --tail 50
```

---

## 🎯 Próximos Pasos (Para Continuar Mañana)

### 1. Verificar Variables NEXT_PUBLIC
```bash
ssh -i "ubuntu.pem" ubuntu@ec2-18-224-137-67.us-east-2.compute.amazonaws.com
cd /var/www/openccb

# Verificar
sudo docker exec openccb-studio env | grep NEXT_PUBLIC

# Si falta CMS_API_URL, reconstruir:
sudo docker compose down
sudo docker rmi openccb-studio 2>/dev/null || true
sudo docker builder prune -f
sudo docker compose build --no-cache studio
sudo docker compose up -d studio
```

### 2. Probar Login
- Acceder a `http://studio.norteamericano.com`
- Intentar loguearse con las credenciales del admin
- Verificar que no haya errores de conexión

### 3. Cambiar a HTTPS (Después del Rate Limit)
```bash
# Después del 2026-03-27
./deploy.sh
# Responder "y" a "¿Usar SSL?"
# Responder "n" a "¿Usar STAGING?"
```

### 4. Verificar Funcionalidades
- [ ] Login de administrador
- [ ] Creación de cursos
- [ ] Subida de archivos
- [ ] Integración con LMS
- [ ] Certificados SSL generados

---

## 📝 Notas Importantes

1. **HTTP vs HTTPS**: Actualmente se usa HTTP porque los certificados de staging no son válidos para las llamadas API entre dominios.

2. **Rate Limit**: Let's Encrypt permite 5 certificados por semana por dominio. El límite se reinicia el 2026-03-27.

3. **Variables de Entorno**: Es crítico que ambos `NEXT_PUBLIC_*` estén presentes en el contenedor de Studio para que las llamadas API funcionen correctamente.

4. **Reconstrucción**: Siempre usar `--no-cache` al reconstruir para asegurar que los cambios en las variables de entorno se apliquen.

---

## 🔧 Solución de Problemas Comunes

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

# Verificar argumentos
sudo docker compose config | grep NEXT_PUBLIC

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

## 📞 Contacto y Soporte

**Documentación**:
- `DESPLIEGUE.md` - Instrucciones de despliegue
- `README.md` - Documentación general
- `docker-compose.yml` - Configuración de servicios

**Archivos de Configuración**:
- `/var/www/openccb/.env` - Variables de entorno
- `/var/www/openccb/docker-compose.yml` - Servicios Docker
- `web/studio/Dockerfile` - Build de Studio
- `deploy.sh` - Script de despliegue

---

**Última Actualización**: 26 de Marzo de 2026
**Estado**: Pendiente verificar variables NEXT_PUBLIC en Studio
