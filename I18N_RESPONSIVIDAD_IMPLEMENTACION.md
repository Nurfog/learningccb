# Implementación de Internacionalización (i18n) y Responsividad

## Resumen de la Implementación

**Fecha**: 20 de Marzo, 2026  
**Estado**: ✅ Completado

---

## 🌍 Internacionalización (i18n)

### Características Implementadas

1. **Detección Automática de Idioma**
   - Detección del idioma del navegador al primer ingreso
   - Soporte para múltiples idiomas del navegador (`navigator.languages`)
   - Fallback a español si el idioma no está soportado

2. **Idiomas Soportados**
   - 🇪🇸 Español (es)
   - 🇬🇧 Inglés (en)
   - 🇵🇹 Portugués (pt)

3. **Selector Manual de Idioma**
   - Disponible en AppHeader (Experience) y Navbar (Studio)
   - Persistencia en localStorage
   - Cambio instantáneo sin recargar la página

4. **Configuración de Idioma por Curso**
   - **Modo Automático**: Detecta el idioma del usuario
   - **Modo Fijo**: Usa siempre el idioma configurado en el curso
   - Ideal para cursos de idiomas (ej: curso de inglés siempre en inglés)

---

## 📱 Responsividad (Mobile-First)

### Breakpoints Utilizados

```
Mobile:  < 640px   (default)
sm:      ≥ 640px
md:      ≥ 768px
lg:      ≥ 1024px
xl:      ≥ 1280px
2xl:     ≥ 1536px
```

### Componentes Responsivos

#### AppHeader (Experience)

**Mobile (< 768px):**
- Logo compacto
- Íconos de notificación y tema
- Botón de menú hamburguesa
- Sidebar deslizante con navegación completa

**Desktop (≥ 768px):**
- Logo completo
- Navegación horizontal visible
- Selector de idioma visible
- Perfil de usuario visible

#### Navbar (Studio)

**Mobile (< 768px):**
- Logo compacto
- Dropdowns colapsados
- Menú hamburguesa
- Sidebar deslizante

**Desktop (≥ 768px):**
- Logo completo
- Dropdowns visibles
- Información de usuario visible

---

## 🗂️ Archivos de Traducción

### Experience (web/experience/src/lib/locales/)

**Archivos:**
- `es.json` - Español (completo)
- `en.json` - Inglés (completo)
- `pt.json` - Portugués (completo)

**Categorías:**
- `common` - Textos comunes (loading, error, save, cancel)
- `nav` - Navegación (catalog, profile, signOut)
- `course` - Cursos (modules, lessons, progress)
- `lesson` - Lecciones (summary, transcription, complete)
- `auth` - Autenticación (login, register, password)
- `dashboard` - Dashboard (welcome, stats)
- `profile` - Perfil (edit, avatar, settings)
- `gamification` - Gamificación (level, xp, badges)
- `grading` - Calificaciones (grade, score, feedback)
- `quiz` - Cuestionarios (start, submit, attempts)
- `forum` - Foros (discussions, threads, replies)
- `payments` - Pagos (purchase, payment method)
- `accessibility` - Accesibilidad (contrast, text size)
- `language` - Idiomas (select, course, interface)
- `errors` - Errores (notFound, unauthorized)
- `dates` - Fechas (today, yesterday, daysAgo)

### Studio (web/studio/src/lib/locales/)

**Archivos:**
- `es.json` - Español (completo - administración)
- `en.json` - Inglés (básico - pendiente completar)
- `pt.json` - Portugués (básico - pendiente completar)

**Categorías Adicionales:**
- `course` - Gestión de cursos (create, edit, modules, lessons)
- `content` - Tipos de contenido (video, audio, quiz, code)
- `ai` - Funciones de IA (generate, model, tokens)
- `grading` - Sistema de calificación (categories, weights)
- `students` - Estudiantes (enrollments, progress)
- `analytics` - Analíticas (overview, retention)
- `settings` - Configuración (branding, integrations)
- `user` - Usuario (profile, preferences)
- `validation` - Validación de formularios

---

## 🗄️ Base de Datos

### Migración: Course Language Configuration

**Archivo:** `services/cms-service/migrations/20260320000002_add_course_language_config.sql`

**Campos Agregados a `courses`:**

```sql
language_setting VARCHAR(20) DEFAULT 'auto'
  - 'auto': Detectar idioma del usuario
  - 'fixed': Usar idioma fijo

fixed_language VARCHAR(5) DEFAULT NULL
  - 'es': Español
  - 'en': Inglés
  - 'pt': Portugués
  - NULL: Cuando language_setting es 'auto'
```

**Constraints:**
```sql
chk_language_setting: language_setting IN ('auto', 'fixed')
chk_fixed_language: fixed_language IS NULL OR fixed_language IN ('es', 'en', 'pt')
```

**Índice:**
```sql
idx_courses_language: (language_setting, fixed_language)
```

---

## 🔌 Backend API

### LMS Service (Port 3002)

**Endpoint: Course Language Config**

```http
GET /courses/{id}/language-config
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "language_setting": "auto",
  "fixed_language": null
}
```

**Ejemplos de Uso:**

```javascript
// Curso en modo automático (usa idioma del usuario)
{
  "language_setting": "auto",
  "fixed_language": null
}

// Curso de inglés (siempre en inglés)
{
  "language_setting": "fixed",
  "fixed_language": "en"
}

// Curso de español (siempre en español)
{
  "language_setting": "fixed",
  "fixed_language": "es"
}
```

---

## ⚙️ Contextos y Hooks

### I18nContext (Experience y Studio)

**Funciones:**
```typescript
interface I18nContextType {
    language: string;
    setLanguage: (lang: string) => void;
    t: (path: string) => string;
    detectBrowserLanguage: () => string;
}
```

**Uso:**
```typescript
import { useTranslation } from '@/context/I18nContext';

function MyComponent() {
    const { language, setLanguage, t } = useTranslation();
    
    return (
        <div>
            <h1>{t('dashboard.welcome')}</h1>
            <select 
                value={language} 
                onChange={(e) => setLanguage(e.target.value)}
            >
                <option value="es">ES</option>
                <option value="en">EN</option>
                <option value="pt">PT</option>
            </select>
        </div>
    );
}
```

### useCourseLanguage Hook (Experience)

**Hook para idioma por curso:**

```typescript
import { useCourseLanguage } from '@/hooks/useCourseLanguage';

function CoursePage({ courseId }) {
    const { 
        courseLanguage, 
        isFixedLanguage, 
        isLoading 
    } = useCourseLanguage(courseId);
    
    if (isLoading) return <Loading />;
    
    return (
        <div>
            <p>Idioma del curso: {courseLanguage}</p>
            {isFixedLanguage() && (
                <p>Este curso usa idioma fijo</p>
            )}
        </div>
    );
}
```

**Funciones:**
- `courseLanguage`: Idioma actual del curso
- `isFixedLanguage()`: Boolean - ¿el curso tiene idioma fijo?
- `isLoading`: Boolean - ¿cargando configuración?
- `refreshConfig()`: Recargar configuración

### useCourseLanguageSwitcher Hook (Experience)

**Hook para cambiar idioma (solo si es permitido):**

```typescript
import { useCourseLanguageSwitcher } from '@/hooks/useCourseLanguage';

function LanguageSelector({ courseId }) {
    const { 
        currentLanguage, 
        canChangeLanguage, 
        changeLanguage,
        isFixed 
    } = useCourseLanguageSwitcher(courseId);
    
    return (
        <select 
            value={currentLanguage}
            onChange={(e) => changeLanguage(e.target.value)}
            disabled={!canChangeLanguage}
        >
            <option value="es">Español</option>
            <option value="en">English</option>
            <option value="pt">Português</option>
        </select>
    );
}
```

---

## 📋 Guía de Responsividad

**Archivo:** `RESPONSIVIDAD_GUIA.md`

### Principios Mobile-First

1. **Diseñar primero para móvil**
2. **Mejorar progresivamente para pantallas más grandes**
3. **Usar clases responsivas de Tailwind**

### Patrones Comunes

#### Grid de Cursos

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {courses.map(course => (
    <CourseCard key={course.id} course={course} />
  ))}
</div>
```

#### Tablas Responsivas

```tsx
<div className="overflow-x-auto">
  <table className="min-w-full">
    {/* Tabla completa */}
  </table>
</div>
```

#### Tipografía Fluida

```tsx
<h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold">
  Título Responsivo
</h1>
```

#### Espaciado Responsivo

```tsx
<div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
  {/* Contenido */}
</div>
```

---

## 🧪 Pruebas

### Checklist de Responsividad

- [ ] Navegación funciona en mobile
- [ ] Menús desplegables accesibles
- [ ] Formularios usables en pantallas pequeñas
- [ ] Tablas con scroll horizontal
- [ ] Imágenes se escalan correctamente
- [ ] Texto legible sin zoom
- [ ] Botones táctiles (mínimo 44x44px)
- [ ] Sin overflow horizontal no intencional

### Dispositivos de Prueba (Chrome DevTools)

- iPhone SE (375x667)
- iPhone 12 Pro (390x844)
- iPad Air (820x1180)
- iPad Pro (1024x1366)
- Desktop (1920x1080)

---

## 🚀 Comandos Útiles

### Ver Logs de i18n

```bash
# Experience
docker logs openccb-experience-1 | grep -i "language\|i18n"

# Studio
docker logs openccb-studio-1 | grep -i "language\|i18n"
```

### Probar Detección de Idioma

```javascript
// Console del navegador
console.log(navigator.languages);
console.log(navigator.language);
localStorage.removeItem('experience_language');
location.reload();
```

### Ver Configuración de Curso

```bash
# SQL
SELECT id, title, language_setting, fixed_language 
FROM courses 
WHERE id = '{course-id}';
```

---

## 📝 Tareas Futuras (Opcionales)

1. **Completar traducciones de Studio**
   - Agregar claves faltantes en `en.json` y `pt.json`

2. **Agregar más idiomas**
   - Francés (fr)
   - Alemán (de)
   - Italiano (it)

3. **Traducción de contenido de cursos**
   - Sistema de traducción de lecciones
   - Contenido multi-idioma por lección

4. **Mejoras de accesibilidad**
   - Aumentar contraste
   - Texto de mayor tamaño
   - Navegación por teclado

5. **Optimización de rendimiento**
   - Lazy loading de traducciones
   - Code splitting por idioma

---

## 📞 Referencias

- [Documentación de i18n](https://nextjs.org/docs/app/building-your-application/routing/internationalization)
- [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [MDN Internationalization](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Internationalization)

---

**Implementado por**: Equipo de Desarrollo OpenCCB  
**Versión**: 1.0  
**Última actualización**: 2026-03-20
