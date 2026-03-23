# Guía de Responsividad - OpenCCB

## Principios Mobile-First

### Breakpoints (Tailwind CSS)

```css
/* Mobile: Default (0-639px) */
/* sm: 640px+ */
/* md: 768px+ */
/* lg: 1024px+ */
/* xl: 1280px+ */
/* 2xl: 1536px+ */
```

### Jerarquía de Diseño

1. **Mobile (< 640px)**: Diseño de una sola columna, menú hamburguesa
2. **Tablet (640px - 1024px)**: 2 columnas, navegación visible
3. **Desktop (1024px+)**: Layout completo, todas las características

---

## Componentes Responsivos

### Layout Principal

```tsx
// Mobile-first container
<div className="min-h-screen flex flex-col">
  {/* Header responsivo */}
  <header className="h-16 px-4 md:px-6">
    {/* Logo y navegación */}
  </header>
  
  {/* Contenido principal */}
  <main className="flex-1 px-4 md:px-6 py-4 md:py-8">
    {children}
  </main>
</div>
```

### Navegación

**Mobile:**
- Menú hamburguesa (ícono)
- Sidebar deslizante desde la derecha
- Overlay con backdrop blur
- Items de navegación en columna

**Desktop:**
- Navegación horizontal visible
- Dropdowns al hacer hover/click
- Items en fila con espaciado

### Tarjetas de Cursos

```tsx
// Grid responsivo
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
  {courses.map(course => (
    <CourseCard key={course.id} course={course} />
  ))}
</div>
```

### Tablas de Datos

**Mobile:**
- Scroll horizontal
- O tarjetas apiladas en lugar de tabla

**Desktop:**
- Tabla completa visible

```tsx
<div className="overflow-x-auto">
  <table className="min-w-full">
    {/* tabla */}
  </table>
</div>
```

---

## Tipografía Fluida

```tsx
// Títulos responsivos
<h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold">
  Título
</h1>

// Texto de párrafo
<p className="text-sm md:text-base lg:text-lg">
  Contenido
</p>

// Texto pequeño
<span className="text-xs md:text-sm">
  Metadata
</span>
```

---

## Espaciado Responsivo

```tsx
// Padding responsivo
<div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
  {/* contenido */}
</div>

// Gap responsivo
<div className="flex flex-col md:flex-row gap-4 md:gap-6 lg:gap-8">
  {/* items */}
</div>
```

---

## Componentes Específicos

### AppHeader (Experience)

**Mobile (< 768px):**
- Logo compacto
- Íconos de notificación y tema
- Botón de menú hamburguesa
- Sidebar deslizante con:
  - Navegación completa
  - Selector de idioma
  - Toggle de tema
  - Perfil de usuario
  - Botón de logout

**Desktop (≥ 768px):**
- Logo completo
- Navegación horizontal visible
- Íconos de notificación, idioma, tema
- Perfil de usuario visible
- Botón de logout

### Navbar (Studio)

**Mobile (< 768px):**
- Logo compacto
- Dropdowns colapsados
- Toggle de tema
- Selector de idioma
- Botón de menú hamburguesa
- Sidebar deslizante

**Desktop (≥ 768px):**
- Logo completo
- Dropdowns visibles
- Toggle de tema
- Selector de idioma
- Información de usuario visible

### Reproductor de Lecciones

**Mobile:**
- Video en ancho completo
- Controles simplificados
- Pestañas colapsadas (acordeón)
- Navegación entre lecciones (botones)

**Desktop:**
- Video con tamaño fijo
- Sidebar con navegación de lecciones
- Pestañas visibles
- Panel de transcripción/resumen

---

## Imágenes y Multimedia

```tsx
// Imágenes responsivas
<Image
  src={src}
  alt={alt}
  fill
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
  className="object-cover"
/>

// Video responsivo
<div className="aspect-video w-full">
  <video controls className="w-full h-full">
    {/* sources */}
  </video>
</div>
```

---

## Accesibilidad

### Navegación por Teclado

- Todos los elementos interactivos deben ser focusables
- Orden de tab lógico
- Indicadores de focus visibles

### Screen Readers

- Labels descriptivos en botones e íconos
- `aria-label` en íconos sin texto
- `aria-expanded` en elementos colapsables
- `aria-modal` en diálogos

### Contraste

- Relación de contraste mínima 4.5:1
- Texto grande: 3:1 mínimo

---

## Pruebas de Responsividad

### Dispositivos de Prueba

**Chrome DevTools:**
- iPhone SE (375x667)
- iPhone 12 Pro (390x844)
- iPad Air (820x1180)
- iPad Pro (1024x1366)
- Desktop (1920x1080)

**Herramientas:**
- Chrome DevTools Device Mode
- Firefox Responsive Design Mode
- BrowserStack (dispositivos reales)

### Checklist de Pruebas

- [ ] Navegación funciona en mobile
- [ ] Menús desplegables accesibles
- [ ] Formularios usables en pantallas pequeñas
- [ ] Tablas con scroll horizontal o versión mobile
- [ ] Imágenes se escalan correctamente
- [ ] Texto legible sin zoom
- [ ] Botones táctiles (mínimo 44x44px)
- [ ] Sin overflow horizontal no intencional
- [ ] Layout no se rompe en tamaños extremos

---

## Patrones Comunes

### Mobile: Navegación Inferior

```tsx
<nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t md:hidden">
  <div className="flex justify-around items-center h-16">
    {/* íconos de navegación */}
  </div>
</nav>
```

### Desktop: Sidebar Fija

```tsx
<aside className="hidden md:block w-64 fixed left-0 top-16 bottom-0 overflow-y-auto">
  {/* navegación lateral */}
</aside>
```

### Tablas Responsivas

```tsx
// Opción 1: Scroll horizontal
<div className="overflow-x-auto">
  <table className="min-w-full divide-y divide-gray-200">
    {/* tabla completa */}
  </table>
</div>

// Opción 2: Tarjetas en mobile
<div className="block md:hidden">
  {items.map(item => (
    <Card key={item.id} item={item} />
  ))}
</div>
<div className="hidden md:block">
  <table>
    {/* tabla completa */}
  </table>
</div>
```

---

## Rendimiento

### Lazy Loading

```tsx
// Imágenes
<Image
  src={src}
  alt={alt}
  loading="lazy"
  width={400}
  height={300}
/>

// Componentes pesados
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <p>Cargando...</p>,
  ssr: false,
})
```

### Code Splitting

```tsx
// Carga diferida por ruta
const CourseDetail = dynamic(() => import('@/components/CourseDetail'))
```

---

## Referencias

- [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [MDN Responsive Design](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design)
- [Web.dev Responsive Design](https://web.dev/responsive-web-design-basics/)

---

**Última actualización**: 2026-03-20
**Versión**: 1.0
