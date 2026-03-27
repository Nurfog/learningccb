# OpenCCB - Instrucciones de Despliegue (AWS EC2)

## Resumen

OpenCCB utiliza **nginx-proxy + acme-companion** para SSL automático con Let's Encrypt.

| Componente | Función |
|------------|---------|
| **nginx-proxy** | Reverse proxy que maneja el tráfico HTTP/HTTPS |
| **acme-companion** | Gestiona certificados SSL de Let's Encrypt automáticamente |
| **Studio + CMS** | Administración de cursos (puerto 3000/3001) |
| **Experience + LMS** | Experiencia del estudiante (puerto 3003/3002) |
| **PostgreSQL + PGVector** | Base de datos con búsqueda semántica |

---

## Despliegue Rápido

### Paso 1: Desde tu máquina local

```bash
# Ejecutar el script de despliegue
./deploy.sh
```

Este script hace **TODO** automáticamente:
1. ✅ Copia todos los archivos al servidor
2. ✅ Instala Docker y Docker Compose
3. ✅ Genera credenciales seguras (DB_PASSWORD, JWT_SECRET)
4. ✅ Configura las variables de entorno correctas
5. ✅ Inicia nginx-proxy y acme-companion
6. ✅ Crea las bases de datos
7. ✅ Inicia todos los servicios
8. ✅ Obtiene certificados SSL automáticamente

---

### Paso 2: Verificar estado (opcional)

```bash
# Conectarse al servidor
ssh -i "ubuntu.pem" ubuntu@ec2-18-224-137-67.us-east-2.compute.amazonaws.com
cd /var/www/openccb

# Ver estado de contenedores
sudo docker compose ps

# Ver logs de SSL
docker logs acme-companion --tail 50
```

---

## URLs de Acceso

Después del despliegue (esperar 2-5 minutos para SSL):

```
https://studio.norteamericano.com     (CMS/Admin)
https://learning.norteamericano.com   (LMS/Estudiantes)
```

---

## Requisitos Previos

### 1. Configurar DNS

Antes de ejecutar `deploy.sh`, configura los registros DNS en tu proveedor de dominio:

| Tipo | Nombre | Valor | TTL |
|------|--------|-------|-----|
| A | @ | 18.224.137.67 | 300 |
| A | studio | 18.224.137.67 | 300 |
| A | learning | 18.224.137.67 | 300 |

**Verificación:**
```bash
dig studio.norteamericano.com
dig learning.norteamericano.com
```

### 2. Configurar Security Group de AWS

En la consola de AWS EC2, edita el Security Group de tu instancia:

| Tipo | Protocolo | Puerto | Fuente |
|------|-----------|--------|--------|
| SSH | TCP | 22 | Tu IP |
| HTTP | TCP | 80 | 0.0.0.0/0 |
| HTTPS | TCP | 443 | 0.0.0.0/0 |

### 3. Archivo de llave SSH

Asegúrate de tener `ubuntu.pem` en el directorio del proyecto:
```bash
chmod 400 ubuntu.pem
```

---

## Comandos Útiles

### Ver estado de servicios
```bash
sudo docker compose ps
```

### Ver logs en tiempo real
```bash
sudo docker compose logs -f
```

### Ver logs de un servicio específico
```bash
# Studio (CMS)
docker logs openccb-studio --tail 20

# Experience (LMS)
docker logs openccb-experience --tail 20

# Base de datos
docker logs openccb-db --tail 20

# nginx-proxy
docker logs nginx-proxy --tail 20

# SSL (acme-companion)
docker logs acme-companion --tail 50
```

### Reiniciar servicios
```bash
# Reiniciar todo
sudo docker compose restart

# Reiniciar un servicio específico
sudo docker compose restart studio
```

### Detener servicios
```bash
sudo docker compose down
```

### Reconstruir desde cero
```bash
# ⚠️ Esto elimina todos los datos
sudo docker compose down -v
sudo docker compose up -d --build
```

---

## Solución de Problemas

### Error 502 Bad Gateway

**Causa:** nginx-proxy no puede conectar con los servicios backend.

**Solución:**
```bash
# 1. Verificar que los servicios están corriendo
sudo docker compose ps

# 2. Ver logs de Studio
docker logs openccb-studio --tail 20

# 3. Ver logs de nginx
docker logs nginx-proxy --tail 20

# 4. Reiniciar servicios
sudo docker compose restart
```

### Certificados SSL no se generan

**Síntomas:**
- Error de conexión SSL en el navegador
- `acme-companion` muestra errores de rate limit

**Solución:**
```bash
# 1. Verificar DNS
dig studio.norteamericano.com
dig learning.norteamericano.com

# 2. Verificar que nginx-proxy está corriendo
sudo docker compose ps nginx-proxy

# 3. Ver logs de acme-companion
docker logs acme-companion --tail 100

# 4. Verificar puertos
sudo netstat -tlnp | grep -E ':80|:443'

# 5. Esperar 1 hora (rate limit de Let's Encrypt)
```

### Base de datos no está disponible

```bash
# 1. Verificar estado de la DB
sudo docker compose ps db

# 2. Ver logs de la DB
docker logs openccb-db --tail 20

# 3. Reiniciar DB
sudo docker compose restart db

# 4. Verificar bases de datos
sudo docker exec openccb-db psql -U user -d postgres -c "\l"
```

### Error de conexión SSH

```bash
# Verificar permisos del archivo .pem
chmod 400 ubuntu.pem

# Probar conexión
ssh -i "ubuntu.pem" ubuntu@ec2-18-224-137-67.us-east-2.compute.amazonaws.com
```

---

## Actualización de la Plataforma

### Método recomendado

```bash
# Desde tu máquina local
./deploy.sh
```

El script sincronizará los cambios y reconstruirá los contenedores automáticamente.

---

## Backup y Restauración

### Backup de base de datos

```bash
# Conectarse al servidor
ssh -i "ubuntu.pem" ubuntu@ec2-18-224-137-67.us-east-2.compute.amazonaws.com
cd /var/www/openccb

# Crear backup
sudo docker exec openccb-db pg_dump -U user openccb_cms > backup_cms_$(date +%Y%m%d).sql
sudo docker exec openccb-db pg_dump -U user openccb_lms > backup_lms_$(date +%Y%m%d).sql

# Descargar backup a tu máquina local
scp -i "ubuntu.pem" ubuntu@ec2-18-224-137-67.us-east-2.compute.amazonaws.com:/var/www/openccb/backup_*.sql .
```

### Restaurar base de datos

```bash
# Subir backup al servidor
scp -i "ubuntu.pem" backup_cms_20250101.sql ubuntu@ec2-18-224-137-67.us-east-2.compute.amazonaws.com:/var/www/openccb/

# Conectarse al servidor
ssh -i "ubuntu.pem" ubuntu@ec2-18-224-137-67.us-east-2.compute.amazonaws.com
cd /var/www/openccb

# Restaurar
sudo docker exec -i openccb-db psql -U user -d openccb_cms < backup_cms_20250101.sql
sudo docker exec -i openccb-db psql -U user -d openccb_lms < backup_lms_20250101.sql
```

---

## Seguridad

### Credenciales por Defecto

Después de ejecutar `deploy.sh`, las credenciales se generan automáticamente:

- **DB_PASSWORD**: Contraseña de base de datos (generada aleatoriamente)
- **JWT_SECRET**: Secreto JWT (generado aleatoriamente)

Estas credenciales se guardan en el archivo `.env`. **Guárdalas en un lugar seguro**.

### Usuario Admin Inicial

El primer usuario admin se crea durante la instalación inicial con:
- **Email**: admin@norteamericano.com
- **Contraseña**: La que definas durante la instalación

---

## Arquitectura del Sistema

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
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Notas Importantes

1. **Certificados automáticos**: Se renuevan automáticamente con Let's Encrypt
2. **Puertos usados**:
   - 80: HTTP (redirección a HTTPS, validación Let's Encrypt)
   - 443: HTTPS (tráfico web)
   - 5432: PostgreSQL (interno de Docker)
   - 3000-3003: Internos de los servicios
3. **Volúmenes persistentes**:
   - `postgres_data`: Datos de la base de datos
   - `uploads_data`: Archivos subidos por usuarios
   - `certs`: Certificados SSL
   - `vhost`: Configuración virtual de nginx

---

**Fecha**: Marzo 2026  
**Versión**: OpenCCB 0.3.0  
**Servidor**: AWS EC2 us-east-2  
**Instancia**: ec2-18-224-137-67.us-east-2.compute.amazonaws.com
