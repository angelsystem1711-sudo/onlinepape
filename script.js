// Menu Toggle Mobile
const menuToggle = document.getElementById('menuToggle');
const nav = document.querySelector('.nav');

if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        nav.classList.toggle('active');
    });
}

// Cerrar menú al hacer click en un enlace
document.querySelectorAll('.nav a').forEach(link => {
    link.addEventListener('click', () => {
        nav.classList.remove('active');
    });
});

// Estado global inicial
let productos = []; // ahora cargados desde IndexedDB cuando sea posible
let carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
let categoriaActual = 'Todos';
const WHATSAPP_NUMBER = '+527291541450'; // Ajusta si necesitas otro número

// ------- IndexedDB Helpers (almacenamiento más grande, ideal para imágenes) -------
function idbSupported() {
    return !!(window.indexedDB);
}

function openIDB() {
    return new Promise((resolve, reject) => {
        if (!idbSupported()) return reject(new Error('IndexedDB no soportado'));
        const req = indexedDB.open('PapeleriaDB', 1);
        req.onupgradeneeded = function(e) {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('productos')) {
                db.createObjectStore('productos', { keyPath: 'id' });
            }
        };
        req.onsuccess = function(e) { resolve(e.target.result); };
        req.onerror = function(e) { reject(e.target.error); };
    });
}

async function getProductosFromIDB() {
    try {
        const db = await openIDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('productos', 'readonly');
            const store = tx.objectStore('productos');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.warn('getProductosFromIDB falló:', e);
        return [];
    }
}

async function saveProductosToIDB(items) {
    if (!idbSupported()) throw new Error('IndexedDB no soportado');
    const db = await openIDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('productos', 'readwrite');
        const store = tx.objectStore('productos');
        // Limpiamos y guardamos todo (simple migración en lote)
        const clearReq = store.clear();
        clearReq.onsuccess = () => {
            let pending = items.length;
            if (pending === 0) return resolve();
            items.forEach(item => {
                const r = store.put(item);
                r.onsuccess = () => { if (--pending === 0) resolve(); };
                r.onerror = () => { if (--pending === 0) resolve(); };
            });
        };
        clearReq.onerror = () => reject(clearReq.error);
    });
}

// Función auxiliar para intentar migrar desde localStorage a IDB
async function migrateLocalStorageProductosToIDB() {
    try {
        const local = JSON.parse(localStorage.getItem('productos') || '[]');
        if (local && local.length > 0 && idbSupported()) {
            await saveProductosToIDB(local);
            // opcional: eliminar localStorage para evitar duplicados y ahorrar espacio
            try { localStorage.removeItem('productos'); } catch (e) { /* ignore */ }
            productos = local;
            return true;
        }
    } catch (e) { console.warn('Migración falló:', e); }
    return false;
}

// -------------------------------------------------------------------------------

// Utilidad para convertir archivo a base64 (subida de imágenes)
function archivoABase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = err => reject(err);
        reader.readAsDataURL(file);
    });
}

// Comprime la imagen usando canvas antes de guardarla en localStorage para reducir tamaño en móviles
async function compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            let w = img.width;
            let h = img.height;
            if (w > maxWidth) {
                h = Math.round(h * maxWidth / w);
                w = maxWidth;
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob((blob) => {
                if (!blob) { URL.revokeObjectURL(url); return reject(new Error('Error compressing image')); }
                const reader = new FileReader();
                reader.onload = () => { URL.revokeObjectURL(url); resolve(reader.result); };
                reader.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
                reader.readAsDataURL(blob);
            }, 'image/jpeg', quality);
        };
        img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
        img.src = url;
    });
} 

// Guardar productos y refrescar vistas
async function guardarProductos() {
    // Intentar guardar en IndexedDB (más tolerante con imágenes grandes)
    if (idbSupported()) {
        try {
            await saveProductosToIDB(productos);
        } catch (e) {
            console.error('Error saving productos to IndexedDB:', e);
            // intentar fallback a localStorage
            try {
                localStorage.setItem('productos', JSON.stringify(productos));
            } catch (err) {
                console.error('Error saving productos to localStorage (fallback):', err);
                alert('No se pudieron guardar los productos: espacio insuficiente en el almacenamiento. Intenta usar imágenes más pequeñas o reducir la calidad.');
                return;
            }
        }
    } else {
        // Si no hay IndexedDB, usar localStorage
        try {
            localStorage.setItem('productos', JSON.stringify(productos));
        } catch (e) {
            console.error('Error saving productos to localStorage:', e);
            alert('No se pudieron guardar los productos: espacio insuficiente en el almacenamiento. Intenta usar imágenes más pequeñas o reducir la calidad.');
            return;
        }
    }

    mostrarProductosAdmin();
    mostrarPaquetesEnPagina();
    mostrarProductosEnCatalogo();
    applyLabelToggles();
} 

// Cargar productos (usa IndexedDB si está disponible, migra desde localStorage si es necesario)
async function cargarProductos() {
    // Intentar desde IndexedDB
    if (idbSupported()) {
        try {
            const idbItems = await getProductosFromIDB();
            if (idbItems && idbItems.length > 0) {
                productos = idbItems;
                mostrarProductosEnCatalogo();
                actualizarBadgeCarrito();
                return;
            }
            // Si IDB está vacío, intentar migrar desde localStorage
            const migrated = await migrateLocalStorageProductosToIDB();
            if (migrated) {
                mostrarProductosEnCatalogo();
                actualizarBadgeCarrito();
                return;
            }
        } catch (e) {
            console.warn('Error leyendo desde IndexedDB:', e);
            // continuamos al fallback
        }
    }

    // Fallback a localStorage (o si IDB no disponible)
    productos = JSON.parse(localStorage.getItem('productos') || '[]');
    if (productos.length === 0) {
        productos = [
            { id: Date.now()+1, nombre: 'Lápiz HB', precio: 0.5, stock: 100, categoria: 'Lápices', descripcion: 'Lápiz de grafito', foto: 'https://via.placeholder.com/300x250?text=Lápiz+HB', promo: '' },
            { id: Date.now()+2, nombre: 'Cuaderno A4', precio: 2.5, stock: 50, categoria: 'Cuadernos', descripcion: 'Cuaderno rayado 100 hojas', foto: 'https://via.placeholder.com/300x250?text=Cuaderno+A4', promo: '' }
        ];
        await guardarProductos();
    } else {
        mostrarProductosEnCatalogo();
    }

    actualizarBadgeCarrito();
}

// Mostrar productos en catálogo y en lista principal
function mostrarProductosEnCatalogo() {
    const lista = document.getElementById('productos-lista');
    const grid = document.getElementById('catalogoProductos');
    const html = productos.map(prod => `
        <div class="producto-card">
            <img src="${prod.foto}" alt="${prod.nombre}" class="producto-imagen" onerror="this.src='https://via.placeholder.com/300x250?text=${encodeURIComponent(prod.nombre)}'">
            <div class="producto-info">
                ${(prod.promo && prod.promo.trim()) ? `<span class='badge badge-promo'>${prod.promo}</span>` : ''}
                <h3 class="producto-nombre">${prod.nombre}</h3>
                <span class="producto-categoria">${prod.categoria}</span>
                <p class="producto-descripcion">${prod.descripcion}</p>
                <div class="producto-footer">
                    <span class="producto-precio">$${prod.precio.toFixed(2)}</span>
                    <span class="producto-stock ${prod.stock <= 5 ? 'bajo' : ''} ${prod.stock === 0 ? 'agotado' : ''}">
                        Stock: ${prod.stock}
                    </span>
                </div>
                <button class="btn-comprar-producto" onclick="agregarAlCarrito(${prod.id})" ${prod.stock === 0 ? 'disabled' : ''}>
                    <i class="fas fa-shopping-cart"></i> ${prod.stock === 0 ? 'Agotado' : 'Agregar'}
                </button>
            </div>
        </div>
    `).join('');
    if (lista) lista.innerHTML = html;
    if (grid) grid.innerHTML = html;
}

// Función para scroll suave a secciones
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

// Animación de contadores para números
const animateCounters = () => {
    const counters = document.querySelectorAll('.counter');
    counters.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-target'));
        const increment = target / 50;
        let current = 0;
        
        const updateCount = () => {
            current += increment;
            if (current < target) {
                counter.innerText = Math.ceil(current);
                setTimeout(updateCount, 50);
            } else {
                counter.innerText = target;
            }
        };
        updateCount();
    });
};

// Agregar efectos de hover a las tarjetas
document.querySelectorAll('.paquete-card').forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.transition = 'all 0.3s ease';
    });
});

// Efecto de scroll para revelación de elementos
const revealOnScroll = () => {
    const elements = document.querySelectorAll('.paquete-card, .beneficio-item, .testimonio-card');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });
    
    elements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'all 0.6s ease';
        observer.observe(el);
    });
};

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Quitar cualquier HTML residual del panel admin del DOM para "borrarlo" en tiempo de ejecución
    document.querySelectorAll('.modal-admin-login, .admin-panel').forEach(el => el.remove());

    revealOnScroll();
    await cargarProductos();
    // mostrarProductosAdmin();  // Eliminado - admin no existe
    cargarPromosPaquetes();
    // Manejar formulario de promociones de paquetes
    const formPromoPaquetes = document.getElementById('formPromoPaquetes');
    if (formPromoPaquetes) {
        formPromoPaquetes.addEventListener('submit', function(e) {
            e.preventDefault();
            const promos = {
                preescolar: document.getElementById('promoPreescolar').value.trim(),
                primaria13: document.getElementById('promoPrimaria13').value.trim(),
                primaria46: document.getElementById('promoPrimaria46').value.trim(),
                secundaria: document.getElementById('promoSecundaria').value.trim(),
                prepa: document.getElementById('promoPrepa').value.trim(),
                licenciatura: document.getElementById('promoLicenciatura').value.trim()
            };
            localStorage.setItem('promosPaquetes', JSON.stringify(promos));
            mostrarPromosPaquetes();
            alert('Promociones de paquetes guardadas');
        });
    }
    mostrarPromosPaquetes();
    // Paquetes personalizados
    // cargarPaquetesAdmin(); // Eliminado - ya no hay panel admin
    const formPaqueteAdmin = document.getElementById('formPaqueteAdmin');
    if (formPaqueteAdmin) {
        formPaqueteAdmin.addEventListener('submit', function(e) {
            e.preventDefault();
            const nombre = document.getElementById('paqueteNombre').value.trim();
            const precio = parseFloat(document.getElementById('paquetePrecio').value);
            const items = document.getElementById('paqueteItems').value.trim().split('\n').map(x => x.trim()).filter(x => x);
            const promo = document.getElementById('paquetePromo').value.trim();
            if (!nombre || !precio || items.length === 0) {
                alert('Completa todos los campos');
                return;
            }
            let paquetes = JSON.parse(localStorage.getItem('paquetesPersonalizados') || '[]');
            // Si hay un paquete en edición, actualiza, si no, agrega nuevo
            const editId = formPaqueteAdmin.getAttribute('data-edit-id');
            if (editId) {
                paquetes = paquetes.map(p => p.id == editId ? { id: p.id, nombre, precio, items, promo } : p);
                formPaqueteAdmin.removeAttribute('data-edit-id');
            } else {
                paquetes.push({ id: Date.now(), nombre, precio, items, promo });
            }
            localStorage.setItem('paquetesPersonalizados', JSON.stringify(paquetes));
            formPaqueteAdmin.reset();
            // cargarPaquetesAdmin(); // Eliminado
            mostrarPaquetesEnPagina();
            alert('Paquete guardado');
        });
    }
    mostrarPaquetesEnPagina();

    // Manejar formulario de contacto (envía por WhatsApp al número configurado)
    const formContacto = document.getElementById('formContacto');
    if (formContacto) {
        formContacto.addEventListener('submit', function(e) {
            e.preventDefault();
            const nombre = document.getElementById('contactNombre').value.trim();
            const email = document.getElementById('contactEmail').value.trim();
            const mensajeUser = document.getElementById('contactMensaje').value.trim();
            if (!nombre || !email || !mensajeUser) {
                alert('Completa todos los campos para enviar tu mensaje');
                return;
            }
            const mensaje = `📩 *CONTACTO WEB*\n\nNombre: ${nombre}\nCorreo: ${email}\nMensaje: ${mensajeUser}`;
            const url = `https://wa.me/${WHATSAPP_NUMBER.replace('+','')}?text=${encodeURIComponent(mensaje)}`;
            window.open(url, '_blank');
            formContacto.reset();
            mostrarNotificacion('Mensaje enviado (se abrirá WhatsApp)');
        });
    }
});

// Mostrar y gestionar paquetes en admin
function cargarPaquetesAdmin() {
    const lista = document.getElementById('adminPaquetesList');
    if (!lista) return;
    let paquetes = JSON.parse(localStorage.getItem('paquetesPersonalizados') || '[]');
    if (paquetes.length === 0) {
        lista.innerHTML = '<p style="text-align:center;color:#95A5A6;padding:20px;">No hay paquetes personalizados</p>';
        return;
    }
    lista.innerHTML = paquetes.map(p => `
        <div class='admin-paquete-item'>
            <div><b>${p.nombre}</b> <span style='color:#888;'>$${p.precio.toFixed(2)}</span></div>
            <div style='font-size:0.95em;color:#666;'>${p.items.join(', ')}</div>
            ${p.promo ? `<span class='badge badge-promo'>${p.promo}</span>` : ''}
            <div style='margin-top:6px;'>
                <button onclick='editarPaqueteAdmin(${p.id})' class='btn btn-secondary' style='margin-right:8px;'>Editar</button>
                <button onclick='eliminarPaqueteAdmin(${p.id})' class='btn btn-eliminar-prod'>Eliminar</button>
            </div>
        </div>
    `).join('');
}

// Editar paquete
window.editarPaqueteAdmin = function(id) {
    let paquetes = JSON.parse(localStorage.getItem('paquetesPersonalizados') || '[]');
    const p = paquetes.find(x => x.id == id);
    if (!p) return;
    document.getElementById('paqueteNombre').value = p.nombre;
    document.getElementById('paquetePrecio').value = p.precio;
    document.getElementById('paqueteItems').value = p.items.join('\n');
    document.getElementById('paquetePromo').value = p.promo || '';
    document.getElementById('formPaqueteAdmin').setAttribute('data-edit-id', p.id);
}

// Eliminar paquete
window.eliminarPaqueteAdmin = function(id) {
    if (!confirm('¿Eliminar este paquete?')) return;
    let paquetes = JSON.parse(localStorage.getItem('paquetesPersonalizados') || '[]');
    paquetes = paquetes.filter(x => x.id != id);
    localStorage.setItem('paquetesPersonalizados', JSON.stringify(paquetes));
    cargarPaquetesAdmin();
    mostrarPaquetesEnPagina();
}

// Mostrar paquetes personalizados en la sección principal
function mostrarPaquetesEnPagina() {
    const grid = document.querySelector('.paquetes-grid');
    if (!grid) return;
    // Mantener los paquetes fijos originales
    const fijos = Array.from(grid.children).filter(x => !x.classList.contains('paquete-personalizado'));
    // Eliminar los personalizados previos
    Array.from(grid.children).forEach(x => { if (x.classList.contains('paquete-personalizado')) x.remove(); });
    let paquetes = JSON.parse(localStorage.getItem('paquetesPersonalizados') || '[]');
    paquetes.forEach(p => {
        const div = document.createElement('div');
        div.className = 'paquete-card paquete-personalizado';
        div.innerHTML = `
            <div class='paquete-header'><i class='fas fa-gift'></i><h3>${p.nombre}</h3></div>
            ${p.promo ? `<span class='badge badge-promo'>${p.promo}</span>` : ''}
            <ul class='paquete-items'>${p.items.map(i => `<li><i class='fas fa-check'></i> ${i}</li>`).join('')}</ul>
            <p class='precio'>$${p.precio.toFixed(2)}</p>
            <button class='btn btn-secondary' onclick="agregarPaqueteAlCarrito('${p.nombre.replace(/'/g, "\'")}', ${p.precio}, '${p.items.map(i => i.replace(/'/g, "\'")).join('|')}')">Comprar</button>
        `;
        grid.appendChild(div);
    });
}

// Cargar promociones de paquetes en inputs
function cargarPromosPaquetes() {
    const promos = JSON.parse(localStorage.getItem('promosPaquetes') || '{}');
    if (document.getElementById('promoPreescolar')) document.getElementById('promoPreescolar').value = promos.preescolar || '';
    if (document.getElementById('promoPrimaria13')) document.getElementById('promoPrimaria13').value = promos.primaria13 || '';
    if (document.getElementById('promoPrimaria46')) document.getElementById('promoPrimaria46').value = promos.primaria46 || '';
    if (document.getElementById('promoSecundaria')) document.getElementById('promoSecundaria').value = promos.secundaria || '';
    if (document.getElementById('promoPrepa')) document.getElementById('promoPrepa').value = promos.prepa || '';
    if (document.getElementById('promoLicenciatura')) document.getElementById('promoLicenciatura').value = promos.licenciatura || '';
}

// Mostrar promociones de paquetes en badges
function mostrarPromosPaquetes() {
    const promos = JSON.parse(localStorage.getItem('promosPaquetes') || '{}');
    const map = [
        { id: 'promo-paquete-preescolar', val: promos.preescolar },
        { id: 'promo-paquete-primaria13', val: promos.primaria13 },
        { id: 'promo-paquete-primaria46', val: promos.primaria46 },
        { id: 'promo-paquete-secundaria', val: promos.secundaria },
        { id: 'promo-paquete-prepa', val: promos.prepa },
        { id: 'promo-paquete-licenciatura', val: promos.licenciatura }
    ];

    map.forEach(m => {
        const el = document.getElementById(m.id);
        if (!el) return;
        if (m.val && m.val.trim()) {
            el.textContent = m.val;
            el.style.display = 'inline-block';
        } else {
            el.style.display = 'none';
        }
    });
    applyLabelToggles();
}

// Agregar producto al carrito
function agregarAlCarrito(id) {
    const producto = productos.find(p => p.id === id);
    if (!producto || producto.stock === 0) return;

    const itemCarrito = carrito.find(item => item.id === id);
    
    if (itemCarrito) {
        if (itemCarrito.cantidad < producto.stock) {
            itemCarrito.cantidad++;
        } else {
            alert('No hay más stock disponible');
            return;
        }
    } else {
        carrito.push({
            id: producto.id,
            nombre: producto.nombre,
            precio: producto.precio,
            cantidad: 1,
            foto: producto.foto,
            stock: producto.stock
        });
    }
    
    guardarCarrito();
    mostrarNotificacion(`✓ ${producto.nombre} agregado al carrito`);
}

// Agregar paquete al carrito (desde botones de paquetes)
function agregarPaqueteAlCarrito(nombre, precio, itemsStr) {
    const items = itemsStr && typeof itemsStr === 'string' ? itemsStr.split('|').map(s => s.trim()).filter(s => s) : [];
    const id = `paquete-${nombre.replace(/\s+/g, '-').toLowerCase()}`;
    const itemExistente = carrito.find(i => i.id === id);
    if (itemExistente) {
        itemExistente.cantidad++;
    } else {
        carrito.push({
            id,
            nombre: `${nombre} (Paquete)` ,
            precio: parseFloat(precio) || 0,
            cantidad: 1,
            foto: `https://via.placeholder.com/120x90?text=${encodeURIComponent(nombre)}`,
            stock: 9999,
            items
        });
    }
    guardarCarrito();
    mostrarNotificacion(`✓ ${nombre} agregado al carrito`);
}

// Guardar carrito en localStorage
function guardarCarrito() {
    try {
        localStorage.setItem('carrito', JSON.stringify(carrito));
    } catch (e) {
        console.error('Error saving carrito to localStorage:', e);
        alert('No se pudo guardar el carrito en el almacenamiento local. Intenta vaciarlo o usar imágenes más pequeñas.');
        return;
    }
    actualizarBadgeCarrito();
    mostrarCarritoItems();
} 

// Actualizar badge del carrito
function actualizarBadgeCarrito() {
    const badge = document.getElementById('carritoBadge');
    if (badge) {
        const total = carrito.reduce((sum, item) => sum + item.cantidad, 0);
        badge.textContent = total;
    }
}

// Mostrar notificación
function mostrarNotificacion(mensaje) {
    const notif = document.createElement('div');
    notif.className = 'notificacion';
    notif.textContent = mensaje;
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.classList.add('mostrar');
    }, 10);
    
    setTimeout(() => {
        notif.classList.remove('mostrar');
        setTimeout(() => notif.remove(), 300);
    }, 2000);
}

// Formulario para agregar producto
const formAgregarProducto = document.getElementById('formAgregarProducto');
if (formAgregarProducto) {
    formAgregarProducto.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nombre = document.getElementById('prodNombre').value.trim();
        const precio = parseFloat(document.getElementById('prodPrecio').value);
        const stock = parseInt(document.getElementById('prodStock').value);
        const categoria = document.getElementById('prodCategoria').value;
        const descripcion = document.getElementById('prodDescripcion').value.trim();
        const promo = document.getElementById('prodPromo').value.trim();
        const fotoInput = document.getElementById('prodFoto');

        if (nombre && !isNaN(precio) && !isNaN(stock) && categoria && fotoInput.files.length > 0) {
            try {
                const file = fotoInput.files[0];
                const compressedDataUrl = await compressImage(file, 800, 0.7);
                const fotoBlob = base64ToBlob(compressedDataUrl);

                if (isRemoteAuthenticated()) {
                    // subir al servidor
                    const fd = new FormData();
                    fd.append('nombre', nombre);
                    fd.append('precio', precio);
                    fd.append('stock', stock);
                    fd.append('categoria', categoria);
                    fd.append('descripcion', descripcion || '');
                    fd.append('promo', promo || '');
                    fd.append('foto', fotoBlob, file.name || 'photo.jpg');

                    try {
                        const row = await submitProductToServer(fd);
                        const serverUrl = localStorage.getItem('papeleria_server_url') || '';
                        const prod = {
                            id: Date.now(),
                            serverId: row.id,
                            nombre: row.nombre,
                            precio: parseFloat(row.precio),
                            stock: parseInt(row.stock),
                            categoria: row.categoria,
                            descripcion: row.descripcion || '',
                            foto: row.foto ? (serverUrl.replace(/\/$/, '') + row.foto) : '',
                            promo: row.promo || ''
                        };
                        productos.push(prod);
                        await guardarProductos();
                        formAgregarProducto.reset();
                        alert('✓ Producto agregado en el servidor');
                    } catch (err) {
                        console.error('Error subiendo al servidor:', err);
                        alert('Error al subir el producto al servidor. ' + (err.message || ''));
                    }

                } else {
                    // comportamiento local (base64)
                    const nuevoProducto = {
                        id: Date.now(),
                        nombre,
                        precio,
                        stock,
                        categoria,
                        descripcion: descripcion || 'Sin descripción',
                        foto: compressedDataUrl,
                        promo
                    };
                    productos.push(nuevoProducto);
                    await guardarProductos();
                    formAgregarProducto.reset();
                    alert('✓ Producto agregado exitosamente');
                }

            } catch (error) {
                console.error('Error al agregar producto:', error);
                alert('Error al procesar o guardar la imagen. Intenta con una imagen más pequeña o desde otro dispositivo.');
            }
        } else {
            alert('Por favor completa todos los campos y selecciona una imagen');
        }
    });
}

// Mostrar productos en panel admin
function mostrarProductosAdmin() {
    const adminProductosList = document.getElementById('adminProductosList');
    if (!adminProductosList) return;
    
    if (productos.length === 0) {
        adminProductosList.innerHTML = '<p style="text-align: center; color: #95A5A6; padding: 20px;">No hay productos agregados</p>';
        return;
    }

    adminProductosList.innerHTML = productos.map(prod => `
        <div class="admin-producto-item ${prod.stock === 0 ? 'agotado' : ''}">
            <div class="admin-producto-info">
                <div class="admin-producto-nombre">${prod.nombre}</div>
                <div class="admin-producto-detalles">
                    $${prod.precio.toFixed(2)} • Stock: ${prod.stock} • ${prod.categoria}
                </div>
            </div>
            <div class="admin-producto-acciones">
                <button class="btn btn-secondary" onclick="abrirEditarProducto(${prod.id})" style="margin-right:8px;"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-eliminar-prod" onclick="eliminarProducto(${prod.id})">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        </div>
    `).join('');
}

// Eliminar producto
async function eliminarProducto(id) {
    if (confirm('¿Estás seguro de que deseas eliminar este producto?')) {
        productos = productos.filter(p => p.id !== id);
        await guardarProductos();
        alert('✓ Producto eliminado');
    }
}



// Cerrar panel admin al hacer clic fuera
document.addEventListener('click', (e) => {
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel && e.target === adminPanel) {
        adminPanel.classList.remove('open');
    }
});



// ============================================
// VISTA COMPLETA DE PRODUCTOS
// ============================================

// Abrir vista completa de productos
function abrirVistaCompleta() {
    const modal = document.getElementById('modalVistaCompleta');
    if (modal) {
        modal.style.display = 'flex';
        filtrarPorCategoria('Todos');
    }
}

// Cerrar vista completa
function cerrarVistaCompleta() {
    const modal = document.getElementById('modalVistaCompleta');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Cerrar modal al hacer clic fuera
document.addEventListener('click', (e) => {
    const modal = document.getElementById('modalVistaCompleta');
    if (modal && e.target === modal) {
        cerrarVistaCompleta();
    }
});

// Modal: Copias e Impresiones
function abrirModalCopias() {
    const modal = document.getElementById('modalCopias');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function cerrarModalCopias() {
    const modal = document.getElementById('modalCopias');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Cerrar modal de copias al hacer clic fuera
document.addEventListener('click', (e) => {
    const modal = document.getElementById('modalCopias');
    if (modal && e.target === modal) {
        cerrarModalCopias();
    }
});

// Filtrar productos por categoría
function filtrarPorCategoria(categoria) {
    categoriaActual = categoria;
    
    // Actualizar botones activos
    document.querySelectorAll('.filtro-btn').forEach(btn => {
        btn.classList.remove('activo');
    });
    
    // Encontrar y activar el botón de la categoría
    Array.from(document.querySelectorAll('.filtro-btn')).forEach(btn => {
        if (btn.textContent.trim() === categoria) {
            btn.classList.add('activo');
        }
    });

    // Filtrar productos
    const productosFiltrados = categoria === 'Todos' 
        ? productos 
        : productos.filter(p => p.categoria === categoria);

    mostrarProductosModal(productosFiltrados);
}

// Mostrar productos en la vista modal
function mostrarProductosModal(productosList) {
    const productosFiltrados = document.getElementById('productosFiltrados');
    if (!productosFiltrados) return;
    
    if (productosList.length === 0) {
        productosFiltrados.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #95A5A6;">No hay productos en esta categoría</p>';
        return;
    }

    productosFiltrados.innerHTML = productosList.map(prod => `
        <div class="producto-modal-card">
            <img src="${prod.foto}" alt="${prod.nombre}" class="producto-modal-imagen" onerror="this.src='https://via.placeholder.com/220x180?text=${encodeURIComponent(prod.nombre)}'">
            <div class="producto-modal-info">
                ${(prod.promo && prod.promo.trim()) ? `<span class='badge badge-promo'>${prod.promo}</span>` : ''}
                <div class="producto-modal-nombre">${prod.nombre}</div>
                <span class="producto-modal-categoria">${prod.categoria}</span>
                <div class="producto-modal-precio">$${prod.precio.toFixed(2)}</div>
                <div class="producto-modal-stock ${prod.stock <= 5 ? 'bajo' : ''} ${prod.stock === 0 ? 'agotado' : ''}">
                    Stock: ${prod.stock}
                </div>
                <div class="producto-modal-acciones">
                    <button class="btn-info-modal" onclick="agregarAlCarrito(${prod.id})">➕ Agregar</button>
                </div>
            </div>
        </div>
    `).join('');
}

// Abrir modal para editar producto
function abrirEditarProducto(id) {
    const producto = productos.find(p => p.id === id);
    if (!producto) return;

    const modalHTML = `
        <div class="modal-editar-producto" id="modalEditarProducto" onclick="if(event.target === this) cerrarEditarProducto()">
            <div class="modal-editar-contenido">
                <h3>Editar: ${producto.nombre}</h3>
                <form id="formEditarProducto">
                    <div class="form-group">
                        <label for="editNombre">Nombre</label>
                        <input type="text" id="editNombre" value="${producto.nombre}" required>
                    </div>
                    <div class="form-group">
                        <label for="editPrecio">Precio ($)</label>
                        <input type="number" id="editPrecio" value="${producto.precio}" step="0.01" required>
                    </div>
                    <div class="form-group">
                        <label for="editStock">Stock</label>
                        <input type="number" id="editStock" value="${producto.stock}" min="0" required>
                    </div>
                    <div class="form-group">
                        <label for="editCategoria">Categoría</label>
                        <select id="editCategoria" required>
                            <option value="Lápices" ${producto.categoria === 'Lápices' ? 'selected' : ''}>Lápices</option>
                            <option value="Cuadernos" ${producto.categoria === 'Cuadernos' ? 'selected' : ''}>Cuadernos</option>
                            <option value="Colores" ${producto.categoria === 'Colores' ? 'selected' : ''}>Colores</option>
                            <option value="Otros" ${producto.categoria === 'Otros' ? 'selected' : ''}>Otros</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="editDescripcion">Descripción</label>
                        <textarea id="editDescripcion" required>${producto.descripcion}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="editPromo">Etiqueta de Promoción/Descuento</label>
                        <input type="text" id="editPromo" value="${producto.promo ? producto.promo : ''}" placeholder="Ej: ¡20% OFF! o vacío si no aplica">
                    </div>
                    <div class="form-group">
                        <label for="editFoto">Foto del Producto</label>
                        <div class="preview-foto-edit">
                            <img id="previewFoto" src="${producto.foto}" alt="Preview" style="max-width: 100%; max-height: 200px; border-radius: 8px;">
                        </div>
                        <input type="file" id="editFoto" accept="image/*">
                        <small>Soporta: JPG, PNG, GIF (máx 5MB)</small>
                    </div>
                    <div class="modal-editar-botones">
                        <button type="submit" class="btn btn-primary">Guardar Cambios</button>
                        <button type="button" class="btn btn-secondary" onclick="cerrarEditarProducto()">Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('editFoto').addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            const preview = document.getElementById('previewFoto');
            preview.src = await archivoABase64(e.target.files[0]);
        }
    });

    document.getElementById('formEditarProducto').addEventListener('submit', async (e) => {
        e.preventDefault();
        await guardarCambiosProducto(id);
    });
}

// Cerrar modal de edición
function cerrarEditarProducto() {
    const modal = document.getElementById('modalEditarProducto');
    if (modal) modal.remove();
}

// Guardar cambios del producto
async function guardarCambiosProducto(id) {
    const producto = productos.find(p => p.id === id);
    if (!producto) return;

    const fotoInput = document.getElementById('editFoto');
    let fotoNueva = producto.foto;

    if (fotoInput.files.length > 0) {
        try {
            fotoNueva = await compressImage(fotoInput.files[0], 800, 0.7);
        } catch (error) {
            console.error('Error al procesar imagen de edición:', error);
            alert('Error al procesar la imagen. Por favor intenta de nuevo con otra imagen.');
            return;
        }
    }

    producto.nombre = document.getElementById('editNombre').value;
    producto.precio = parseFloat(document.getElementById('editPrecio').value);
    producto.stock = parseInt(document.getElementById('editStock').value);
    producto.categoria = document.getElementById('editCategoria').value;
    producto.descripcion = document.getElementById('editDescripcion').value;
    producto.foto = fotoNueva;
    producto.promo = document.getElementById('editPromo').value.trim();

    // Si está autenticado y el producto tiene serverId, actualizar en el servidor
    if (isRemoteAuthenticated() && producto.serverId) {
        try {
            const fd = new FormData();
            fd.append('nombre', producto.nombre);
            fd.append('precio', producto.precio);
            fd.append('stock', producto.stock);
            fd.append('categoria', producto.categoria);
            fd.append('descripcion', producto.descripcion || '');
            fd.append('promo', producto.promo || '');
            if (fotoInput.files.length > 0) {
                const compressed = await compressImage(fotoInput.files[0], 800, 0.7);
                const blob = base64ToBlob(compressed);
                fd.append('foto', blob, fotoInput.files[0].name || 'photo.jpg');
            }
            const updated = await submitProductUpdateToServer(producto.serverId, fd);
            const serverUrl = localStorage.getItem('papeleria_server_url') || '';
            producto.foto = updated.foto ? (serverUrl.replace(/\/$/, '') + updated.foto) : producto.foto;
        } catch (err) {
            console.error('Error actualizando producto en servidor:', err);
            mostrarNotificacion('Error sincronizando con el servidor (se guardó localmente)');
        }
    }

    await guardarProductos();
    cerrarEditarProducto();
    filtrarPorCategoria(categoriaActual);
    alert('✓ Producto actualizado exitosamente');
}

// ============================================
// CARRITO DE COMPRAS
// ============================================

// Abrir carrito
function abrirCarrito() {
    const modal = document.getElementById('modalCarrito');
    if (modal) {
        modal.style.display = 'flex';
        mostrarCarritoItems();
    }
}

// Cerrar carrito
function cerrarCarrito() {
    const modal = document.getElementById('modalCarrito');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Cerrar carrito al hacer clic fuera
document.addEventListener('click', (e) => {
    const modal = document.getElementById('modalCarrito');
    if (modal && e.target === modal) {
        cerrarCarrito();
    }
});

// Mostrar items del carrito
function mostrarCarritoItems() {
    const carritoItems = document.getElementById('carritoItems');
    const carritoTotal = document.getElementById('carritoTotal');
    if (!carritoItems) return;

    if (carrito.length === 0) {
        carritoItems.innerHTML = '<p style="text-align: center; color: #95A5A6; padding: 40px;">Tu carrito está vacío</p>';
        if (carritoTotal) carritoTotal.textContent = '$0.00';
        return;
    }

    let total = 0;
    carritoItems.innerHTML = carrito.map(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        const idLiteral = JSON.stringify(item.id);
        return `
            <div class="carrito-item">
                <img src="${item.foto}" alt="${item.nombre}" class="carrito-item-foto" onerror="this.src='https://via.placeholder.com/80x80'">
                <div class="carrito-item-info">
                    <h4>${item.nombre}</h4>
                    <p class="carrito-item-precio">$${item.precio.toFixed(2)}</p>
                    ${item.items && item.items.length ? `<p class="carrito-item-list">${item.items.map(it => '• ' + it).join('<br>')}</p>` : ''}
                </div>
                <div class="carrito-item-cantidad">
                    <button onclick="modificarCantidad(${idLiteral}, -1)" class="btn-cantidad">−</button>
                    <input type="number" value="${item.cantidad}" min="1" max="${item.stock}" onchange="cambiarCantidad(${idLiteral}, this.value)" class="cantidad-input">
                    <button onclick="modificarCantidad(${idLiteral}, 1)" class="btn-cantidad">+</button>
                </div>
                <div class="carrito-item-subtotal">
                    <p>$${subtotal.toFixed(2)}</p>
                    <button class="btn-eliminar-carrito" onclick="eliminarDelCarrito(${idLiteral})"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');

    if (carritoTotal) carritoTotal.textContent = `$${total.toFixed(2)}`;
}

// Modificar cantidad de item
function modificarCantidad(id, cambio) {
    const item = carrito.find(i => i.id === id);
    if (!item) return;

    item.cantidad += cambio;
    if (item.cantidad < 1) item.cantidad = 1;
    if (item.cantidad > item.stock) item.cantidad = item.stock;

    guardarCarrito();
}

// Cambiar cantidad directamente
function cambiarCantidad(id, nuevaCantidad) {
    const item = carrito.find(i => i.id === id);
    if (!item) return;

    let cantidad = parseInt(nuevaCantidad);
    if (cantidad < 1) cantidad = 1;
    if (cantidad > item.stock) cantidad = item.stock;
    
    item.cantidad = cantidad;
    guardarCarrito();
}

// Eliminar item del carrito
function eliminarDelCarrito(id) {
    carrito = carrito.filter(item => item.id !== id);
    guardarCarrito();
}

// Vaciar carrito
function vaciarCarrito() {
    if (carrito.length === 0) {
        alert('El carrito ya está vacío');
        return;
    }
    
    if (confirm('¿Estás seguro de que deseas vaciar todo el carrito?')) {
        carrito = [];
        guardarCarrito();
        mostrarCarritoItems();
    }
}

// Enviar pedido por WhatsApp
function enviarPorWhatsApp() {
    if (carrito.length === 0) {
        alert('Tu carrito está vacío. Agrega productos antes de enviar un pedido.');
        return;
    }

    let mensaje = '🛒 *NUEVO PEDIDO*\n\n';
    let total = 0;

    carrito.forEach((item, index) => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        mensaje += `${index + 1}. *${item.nombre}*\n   Cantidad: ${item.cantidad}\n   Precio unitario: $${item.precio.toFixed(2)}\n`;
        if (item.items && item.items.length) {
            mensaje += `   Contenido:\n   - ${item.items.join('\n   - ')}\n`;
        }
        mensaje += `   Subtotal: $${subtotal.toFixed(2)}\n\n`;
    });

    mensaje += `━━━━━━━━━━━━━━━━━\n*Total: $${total.toFixed(2)}*\n━━━━━━━━━━━━━━━━━\n\n¿Cuándo te gustaría recibir tu pedido?`;

    const urlWhatsApp = `https://wa.me/${WHATSAPP_NUMBER.replace('+', '')}?text=${encodeURIComponent(mensaje)}`;
    window.open(urlWhatsApp, '_blank');
}


// ======================
// Panel de Administración (oculto)
// - Abre con Ctrl+Shift+A
// ======================

const MAX_ADMIN_ATTEMPTS = 3;
const ADMIN_ATTEMPTS_KEY = 'adminAttemptsLeft';
let adminAttemptsLeft = parseInt(sessionStorage.getItem(ADMIN_ATTEMPTS_KEY) || MAX_ADMIN_ATTEMPTS);

// Toggle con atajo de teclado
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        toggleAdminPanel();
    }
});

function toggleAdminPanel() {
    const modal = document.getElementById('admin-panel');
    if (!modal) return;
    // Si ya está abierto, ciérralo
    if (modal.classList.contains('open')) {
        modal.classList.remove('open');
        return;
    }

    const storedHash = localStorage.getItem('adminPasswordHash');

    // Si hay contraseña, pedirla siempre antes de abrir (no se mantiene sesión)
    if (storedHash) {
        openAdminPasswordModal();
        return;
    }

    modal.classList.add('open');
    mostrarProductosAdmin();
    cargarPaquetesAdmin();
    cargarPromosPaquetes();
    loadAdminSettings();
} 

function cerrarAdminPanel() {
    const modal = document.getElementById('admin-panel');
    if (!modal) return;
    modal.classList.remove('open');
}

// Manejo de pestañas
document.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('tab-btn')) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const tab = e.target.getAttribute('data-tab');
        document.querySelectorAll('.admin-tab-panel').forEach(p => p.style.display = 'none');
        const show = document.getElementById('tab-' + tab);
        if (show) show.style.display = 'block';
    }
});

// Cargar / Guardar settings de etiquetas
function loadAdminSettings() {
    const s = JSON.parse(localStorage.getItem('adminSettings') || '{}');
    const proporcion = document.getElementById('toggleProporcion');
    const descuento = document.getElementById('toggleDescuento');
    if (proporcion) proporcion.checked = !!s.mostrarProporcion;
    if (descuento) descuento.checked = !!s.mostrarDescuento;

    // listeners (se añaden cada vez que se abre para asegurar que estén activos)
    if (proporcion) proporcion.addEventListener('change', saveAdminSettings);
    if (descuento) descuento.addEventListener('change', saveAdminSettings);

    applyLabelToggles();
}

function saveAdminSettings() {
    const s = {
        mostrarProporcion: !!(document.getElementById('toggleProporcion') && document.getElementById('toggleProporcion').checked),
        mostrarDescuento: !!(document.getElementById('toggleDescuento') && document.getElementById('toggleDescuento').checked)
    };
    localStorage.setItem('adminSettings', JSON.stringify(s));
    applyLabelToggles();
}

// Aplica las reglas de visibilidad de etiquetas (proporción = % , descuento = texto tipo "OFF"/"Descuento")
function applyLabelToggles() {
    const s = JSON.parse(localStorage.getItem('adminSettings') || '{}');
    const mostrarProporcion = !!s.mostrarProporcion;
    const mostrarDescuento = !!s.mostrarDescuento;

    document.querySelectorAll('.badge.badge-promo').forEach(el => {
        const text = (el.textContent || '').trim();
        const isProporcion = /%/.test(text);
        const isDescuento = /off|descuento/i.test(text);
        let visible = true;
        if (isProporcion && !mostrarProporcion) visible = false;
        if (!isProporcion && isDescuento && !mostrarDescuento) visible = false;
        if (!isProporcion && !isDescuento) visible = (mostrarProporcion || mostrarDescuento);
        el.style.display = visible ? 'inline-block' : 'none';
    });
}

// Cuando la página carga, aseguramos que las etiquetas respeten la configuración guardada
document.addEventListener('DOMContentLoaded', () => {
    applyLabelToggles();

    // Botones / inputs del modal de contraseña admin
    const btnSubmit = document.getElementById('btnAdminPwdSubmit');
    const btnCancel = document.getElementById('btnAdminPwdCancel');
    const inputPwd = document.getElementById('adminPasswordInput');
    if (btnSubmit) btnSubmit.addEventListener('click', handleAdminPwdSubmit);
    if (btnCancel) btnCancel.addEventListener('click', closeAdminPasswordModal);
    if (inputPwd) inputPwd.addEventListener('keyup', (e) => { if (e.key === 'Enter') handleAdminPwdSubmit(); });

    // Botones para establecer / eliminar contraseña (en pestaña Etiquetas)
    const btnSave = document.getElementById('btnSaveAdminPwd');
    const btnRemove = document.getElementById('btnRemoveAdminPwd');
    if (btnSave) btnSave.addEventListener('click', handleSaveAdminPwd);
    if (btnRemove) btnRemove.addEventListener('click', handleRemoveAdminPwd);

    updateAdminPwdState();

    // No se crea una contraseña por defecto para evitar exponer credenciales al compartir el sitio.
    // Si no hay contraseña, el panel permanecerá sin protección hasta que se establezca una desde la UI.
    if (!localStorage.getItem('adminPasswordHash')) {
        updateAdminPwdState();
    }

    // Inicializar contador de intentos (en sessionStorage, se reinicia al cerrar pestaña)
    if (!sessionStorage.getItem(ADMIN_ATTEMPTS_KEY)) {
        sessionStorage.setItem(ADMIN_ATTEMPTS_KEY, adminAttemptsLeft);
    } else {
        adminAttemptsLeft = parseInt(sessionStorage.getItem(ADMIN_ATTEMPTS_KEY) || MAX_ADMIN_ATTEMPTS);
    }

    const attemptsLeftEl = document.getElementById('adminAttemptsLeft');
    const attemptsMsgEl = document.getElementById('adminAttemptsMessage');
    const attemptsInfoP = document.getElementById('adminAttemptsInfo');
    const btnResetAttempts = document.getElementById('btnResetAttempts');

    function updateAdminAttemptsUI() {
        if (attemptsLeftEl) attemptsLeftEl.textContent = adminAttemptsLeft;
        if (adminAttemptsLeft <= 0) {
            if (attemptsMsgEl) attemptsMsgEl.textContent = 'Intentos agotados';
            if (attemptsInfoP) attemptsInfoP.style.color = '#E74C3C';
            if (btnResetAttempts) btnResetAttempts.style.display = 'inline-block';
            const input = document.getElementById('adminPasswordInput');
            const submit = document.getElementById('btnAdminPwdSubmit');
            if (input) input.disabled = true;
            if (submit) submit.disabled = true;
        } else {
            if (attemptsMsgEl) attemptsMsgEl.textContent = '';
            if (attemptsInfoP) attemptsInfoP.style.color = '';
            if (btnResetAttempts) btnResetAttempts.style.display = 'none';
            const input = document.getElementById('adminPasswordInput');
            const submit = document.getElementById('btnAdminPwdSubmit');
            if (input) input.disabled = false;
            if (submit) submit.disabled = false;
        }
    }

    if (btnResetAttempts) {
        btnResetAttempts.addEventListener('click', (e) => {
            e.preventDefault();
            adminAttemptsLeft = MAX_ADMIN_ATTEMPTS;
            sessionStorage.setItem(ADMIN_ATTEMPTS_KEY, adminAttemptsLeft);
            updateAdminAttemptsUI();
            alert('Intentos reiniciados.');
        });
    }

    updateAdminAttemptsUI();
});

// Hash SHA-256 de la contraseña
async function hashPassword(password) {
    const enc = new TextEncoder();
    const data = enc.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyAdminPassword(password) {
    const stored = localStorage.getItem('adminPasswordHash');
    if (!stored) return false;
    const h = await hashPassword(password);
    return h === stored;
}

function openAdminPasswordModal() {
    const m = document.getElementById('adminPasswordModal');
    if (!m) return;
    adminAttemptsLeft = parseInt(sessionStorage.getItem(ADMIN_ATTEMPTS_KEY) || MAX_ADMIN_ATTEMPTS);
    const input = document.getElementById('adminPasswordInput');
    const submit = document.getElementById('btnAdminPwdSubmit');
    const attemptsLeftEl = document.getElementById('adminAttemptsLeft');
    const attemptsMsgEl = document.getElementById('adminAttemptsMessage');
    const attemptsInfoP = document.getElementById('adminAttemptsInfo');
    const resetBtn = document.getElementById('btnResetAttempts');

    if (attemptsLeftEl) attemptsLeftEl.textContent = adminAttemptsLeft;
    if (adminAttemptsLeft <= 0) {
        if (input) input.disabled = true;
        if (submit) submit.disabled = true;
        if (attemptsMsgEl) attemptsMsgEl.textContent = 'Intentos agotados';
        if (attemptsInfoP) attemptsInfoP.style.color = '#E74C3C';
        if (resetBtn) resetBtn.style.display = 'inline-block';
    } else {
        if (input) { input.value = ''; input.disabled = false; setTimeout(() => input.focus(), 50); }
        if (submit) submit.disabled = false;
        if (attemptsMsgEl) attemptsMsgEl.textContent = '';
        if (attemptsInfoP) attemptsInfoP.style.color = '';
        if (resetBtn) resetBtn.style.display = 'none';
    }

    m.classList.add('open');
} 

function closeAdminPasswordModal() {
    const m = document.getElementById('adminPasswordModal');
    if (!m) return;
    m.classList.remove('open');
}

async function handleAdminPwdSubmit() {
    const input = document.getElementById('adminPasswordInput');
    const submit = document.getElementById('btnAdminPwdSubmit');
    const attemptsEl = document.getElementById('adminAttemptsLeft');
    if (!input) return;
    const val = input.value || '';
    if (!val) { alert('Ingresa la contraseña'); return; }
    const ok = await verifyAdminPassword(val);
    if (ok) {
        // Reset intentos al ingresar correctamente
        adminAttemptsLeft = MAX_ADMIN_ATTEMPTS;
        sessionStorage.setItem(ADMIN_ATTEMPTS_KEY, adminAttemptsLeft);
        if (attemptsEl) attemptsEl.textContent = adminAttemptsLeft;
        closeAdminPasswordModal();
        const modal = document.getElementById('admin-panel');
        if (modal) {
            modal.classList.add('open');
            mostrarProductosAdmin();
            cargarPaquetesAdmin();
            cargarPromosPaquetes();
            loadAdminSettings();
        }
    } else {
        adminAttemptsLeft = Math.max(0, (parseInt(sessionStorage.getItem(ADMIN_ATTEMPTS_KEY) || MAX_ADMIN_ATTEMPTS) - 1));
        sessionStorage.setItem(ADMIN_ATTEMPTS_KEY, adminAttemptsLeft);
        if (attemptsEl) attemptsEl.textContent = adminAttemptsLeft;
        if (adminAttemptsLeft <= 0) {
            if (input) input.disabled = true;
            if (submit) submit.disabled = true;
            const attemptsInfo = document.getElementById('adminAttemptsInfo');
            if (attemptsInfo) attemptsInfo.style.color = '#E74C3C';
            const resetBtn = document.getElementById('btnResetAttempts');
            if (resetBtn) resetBtn.style.display = 'inline-block';
            alert('Contraseña incorrecta. Se han agotado los intentos. Reinicia los intentos para volver a intentar.');
        } else {
            alert('Contraseña incorrecta. Intentos restantes: ' + adminAttemptsLeft);
        }
    }
} 

async function handleSaveAdminPwd(e) {
    e.preventDefault && e.preventDefault();
    const current = document.getElementById('adminCurrentPwd') ? document.getElementById('adminCurrentPwd').value : '';
    const nueva = document.getElementById('adminNewPwd') ? document.getElementById('adminNewPwd').value : '';
    const confirm = document.getElementById('adminConfirmPwd') ? document.getElementById('adminConfirmPwd').value : '';

    if (!nueva) { alert('Ingresa una nueva contraseña'); return; }
    if (nueva !== confirm) { alert('Las contraseñas no coinciden'); return; }

    const existe = !!localStorage.getItem('adminPasswordHash');
    if (existe) {
        // verificar la actual
        if (!current) { alert('Ingresa la contraseña actual'); return; }
        const ok = await verifyAdminPassword(current);
        if (!ok) { alert('Contraseña actual incorrecta'); return; }
    }

    const h = await hashPassword(nueva);
    localStorage.setItem('adminPasswordHash', h);
    updateAdminPwdState();
    // Reiniciar intentos cuando se cambia la contraseña
    adminAttemptsLeft = MAX_ADMIN_ATTEMPTS;
    sessionStorage.setItem(ADMIN_ATTEMPTS_KEY, adminAttemptsLeft);
    const attemptsLeftEl = document.getElementById('adminAttemptsLeft'); if (attemptsLeftEl) attemptsLeftEl.textContent = adminAttemptsLeft;
    // limpiar campos
    ['adminCurrentPwd','adminNewPwd','adminConfirmPwd'].forEach(id => { const el=document.getElementById(id); if (el) el.value=''; });
    alert('✓ Contraseña guardada. El panel ahora está protegido.');
}

async function handleRemoveAdminPwd(e) {
    e.preventDefault && e.preventDefault();
    const existe = !!localStorage.getItem('adminPasswordHash');
    if (!existe) { alert('No hay contraseña establecida'); return; }
    const current = document.getElementById('adminCurrentPwd') ? document.getElementById('adminCurrentPwd').value : '';
    if (!current) { alert('Ingresa la contraseña actual para eliminarla'); return; }
    const ok = await verifyAdminPassword(current);
    if (!ok) { alert('Contraseña actual incorrecta'); return; }

    localStorage.removeItem('adminPasswordHash');
    updateAdminPwdState();
    // Reiniciar intentos cuando se elimina la contraseña
    adminAttemptsLeft = MAX_ADMIN_ATTEMPTS;
    sessionStorage.setItem(ADMIN_ATTEMPTS_KEY, adminAttemptsLeft);
    const attemptsLeftEl = document.getElementById('adminAttemptsLeft'); if (attemptsLeftEl) attemptsLeftEl.textContent = adminAttemptsLeft;
    ['adminCurrentPwd','adminNewPwd','adminConfirmPwd'].forEach(id => { const el=document.getElementById(id); if (el) el.value=''; });
    alert('✓ Contraseña eliminada. El panel ya no está protegido.');
}

function updateAdminPwdState() {
    const stateEl = document.getElementById('adminPwdState');
    if (!stateEl) return;
    const exists = !!localStorage.getItem('adminPasswordHash');
    stateEl.textContent = exists ? 'Protegido' : 'Sin contraseña';
}

// ------------------ Integración con servidor remoto ------------------
function isRemoteAuthenticated() {
    return !!localStorage.getItem('papeleria_token');
}

function updateServerStatusUI() {
    const statusText = document.getElementById('serverStatusText');
    const logoutBtn = document.getElementById('btnServerLogout');
    const loginBtn = document.getElementById('btnServerLogin');
    if (!statusText) return;
    const token = localStorage.getItem('papeleria_token');
    const url = localStorage.getItem('papeleria_server_url');
    if (token && url) {
        statusText.textContent = 'Conectado (' + url + ')';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
        if (loginBtn) loginBtn.style.display = 'none';
    } else {
        statusText.textContent = 'Desconectado';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (loginBtn) loginBtn.style.display = 'inline-block';
    }
}

async function remoteLogin(e) {
    e && e.preventDefault && e.preventDefault();
    const url = document.getElementById('serverUrl').value.trim();
    const email = document.getElementById('serverEmail').value.trim();
    const password = document.getElementById('serverPassword').value;
    if (!url || !email || !password) { alert('Proporciona URL, email y contraseña'); return; }
    try {
        const res = await fetch((url.replace(/\/$/, '') + '/api/auth/login'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!res.ok) {
            const j = await res.json().catch(()=>({}));
            alert('Error al autenticar: ' + (j.error || res.statusText));
            return;
        }
        const j = await res.json();
        localStorage.setItem('papeleria_token', j.token);
        localStorage.setItem('papeleria_server_url', url.replace(/\/$/, ''));
        updateServerStatusUI();
        mostrarNotificacion('Conectado al servidor');
    } catch (err) {
        console.error('Login remoto falló:', err);
        alert('No se pudo conectar al servidor. Revisa la URL y la conexión.');
    }
}

function remoteLogout() {
    localStorage.removeItem('papeleria_token');
    localStorage.removeItem('papeleria_server_url');
    updateServerStatusUI();
    mostrarNotificacion('Desconectado del servidor');
}

function base64ToBlob(dataURL) {
    const parts = dataURL.split(',');
    const m = parts[0].match(/:(.*?);/);
    const mime = m ? m[1] : 'image/jpeg';
    const binary = atob(parts[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    return new Blob([array], { type: mime });
}

async function submitProductToServer(formData) {
    const token = localStorage.getItem('papeleria_token');
    const url = localStorage.getItem('papeleria_server_url');
    if (!token || !url) throw new Error('No conectado al servidor');
    const res = await fetch(url + '/api/products', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: formData });
    if (!res.ok) throw new Error('Error guardando producto en servidor');
    return await res.json();
}

async function submitProductUpdateToServer(id, formData) {
    const token = localStorage.getItem('papeleria_token');
    const url = localStorage.getItem('papeleria_server_url');
    if (!token || !url) throw new Error('No conectado al servidor');
    const res = await fetch(url + '/api/products/' + id, { method: 'PUT', headers: { Authorization: 'Bearer ' + token }, body: formData });
    if (!res.ok) throw new Error('Error actualizando producto en servidor');
    return await res.json();
}

async function migrateProductsToServer() {
    if (!isRemoteAuthenticated()) { alert('Conéctate al servidor primero'); return; }
    if (!confirm('¿Migrar todos los productos locales al servidor? Esto intentará subir imágenes si están en base64.')) return;
    const total = productos.length;
    let success = 0;
    for (let i = 0; i < productos.length; i++) {
        const p = productos[i];
        try {
            const fd = new FormData();
            fd.append('nombre', p.nombre);
            fd.append('precio', p.precio || 0);
            fd.append('stock', p.stock || 0);
            fd.append('categoria', p.categoria || '');
            fd.append('descripcion', p.descripcion || '');
            fd.append('promo', p.promo || '');
            if (p.foto && p.foto.startsWith('data:')) {
                const b = base64ToBlob(p.foto);
                fd.append('foto', b, (p.nombre||'photo') + '.jpg');
            }
            const row = await submitProductToServer(fd);
            // marcar como migrado y actualizar foto a URL completa
            p.serverId = row.id;
            const serverUrl = localStorage.getItem('papeleria_server_url') || '';
            p.foto = row.foto ? (serverUrl.replace(/\/$/, '') + row.foto) : p.foto;
            success++;
            mostrarNotificacion(`✓ Migrado: ${p.nombre}`);
        } catch (err) {
            console.error('Error migrando producto', p.nombre, err);
            mostrarNotificacion(`✗ Error: ${p.nombre}`);
        }
    }
    await guardarProductos();
    alert(`Migración finalizada. Migrados: ${success}/${total}`);
}

// ---------------------------------------------------------------------




