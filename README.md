# Papelería Express - Landing Page

## 📋 Descripción
Landing page profesional para la venta de paquetes de útiles escolares desde preescolar hasta licenciatura. Diseño moderno, responsivo y fácil de navegar.

## 🎯 Características Principales

### 1. **Estructura Completa**
- ✅ Header con navegación sticky
- ✅ Hero section atractivo con animaciones
- ✅ 6 paquetes diferentes por nivel educativo
- ✅ Sección de beneficios
- ✅ Testimonios de clientes
- ✅ Call-to-action prominente
- ✅ Footer completo con información

### 2. **Paquetes Incluidos**
- 👶 **Preescolar** - $15.99
- 📚 **Primaria (1-3)** - $24.99
- 📖 **Primaria (4-6)** - $34.99 ⭐ Más Popular
- 👤 **Secundaria** - $54.99
- 🎓 **Preparatoria** - $74.99
- 🏫 **Licenciatura** - $99.99

### 3. **Diseño Responsivo**
- Optimizado para desktop, tablet y móvil
- Menú hamburguesa en dispositivos pequeños
- Grid adaptativo
- Todas las imágenes y elementos se adaptan

### 4. **Interactividad**
- Animaciones suaves
- Efectos hover en tarjetas
- Scroll smooth
- Menú móvil funcional
- Efecto parallax

### 5. **Colores Atractivos**
- Rojo vibrante (#FF6B6B) - Primario
- Verde turquesa (#4ECDC4) - Secundario
- Amarillo (#FFE66D) - Acento
- Degradados en secciones principales

## 📁 Estructura de Archivos
```
papeleria/
├── index.html      # Estructura HTML
├── styles.css      # Estilos y responsive design
├── script.js       # Interactividad y animaciones
└── README.md       # Este archivo
```

## 🚀 Cómo Usar

### Opción 1: Abrir localmente
1. Extrae los archivos en tu carpeta deseada
2. Abre `index.html` en tu navegador favorito
3. ¡Listo! La página está funcionando

### Opción 2: Con servidor local
```bash
# Usar Python 3
python -m http.server 8000

# O usar Node.js (si tienes instalado)
npx http-server
```

Luego abre: `http://localhost:8000`

## 🎨 Personalización

### Cambiar Colores
En `styles.css`, modifica las variables CSS:
```css
:root {
    --primary-color: #FF6B6B;      /* Color principal */
    --secondary-color: #4ECDC4;    /* Color secundario */
    --accent-color: #FFE66D;       /* Color de acento */
}
```

### Cambiar Textos
En `index.html`:
- Logo: Busca `<span>Papelería Express</span>`
- Precios: Busca `<p class="precio">$XX.XX</p>`
- Secciones: Busca los `<h2>` en cada sección

### Agregar Nuevos Paquetes
Copia este bloque y modifica:
```html
<div class="paquete-card">
    <div class="paquete-header">
        <i class="fas fa-book"></i>
        <h3>Tu Nivel</h3>
    </div>
    <ul class="paquete-items">
        <li><i class="fas fa-check"></i> Producto 1</li>
        <!-- Más productos -->
    </ul>
    <p class="precio">$XX.XX</p>
    <button class="btn btn-secondary">Comprar</button>
</div>
```

## 🔗 Iconos Disponibles
La página usa Font Awesome 6. Algunos iconos útiles:
- `fa-book` - Libros
- `fa-graduation-cap` - Graduación
- `fa-pencil` - Lápiz
- `fa-backpack` - Mochila
- `fa-child` - Niño
- `fa-star` - Estrella
- `fa-check` - Marcador

Explora más en: https://fontawesome.com/icons

## 📱 Puntos de Quiebre Responsivos
- **Desktop**: Desde 1201px
- **Tablet**: 769px - 1200px
- **Móvil**: 480px - 768px
- **Móvil Pequeño**: Menos de 480px

## 🎯 Mejoras Futuras
- [ ] Integrar carrito de compras funcional
- [ ] Conectar con base de datos
- [ ] Agregar sistema de pago
- [ ] Formulario de contacto con email
- [ ] Galería de productos
- [ ] Reseñas de cliente
- [ ] Blog de consejos escolares

## 📝 Notas Importantes
- Todos los precios son de demostración
- Los testimonios son ejemplos
- Se puede conectar a un backend real fácilmente
- La página está optimizada para SEO básico

## 🛠️ Tecnologías Utilizadas
- HTML5
- CSS3 (Variables, Flexbox, Grid)
- JavaScript Vanilla
- Font Awesome Icons
- Fuente: Segoe UI

## 📧 Información de Contacto (Ejemplo)
- 📞 +34 123 456 789
- 📧 info@papeleriaexpress.com
- 📍 Calle Principal 123

---

**Versión**: 1.0
**Última actualización**: 27 de enero de 2026
