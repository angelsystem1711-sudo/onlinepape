# Papelería Backend (mínimo)

Servidor Node.js + Express para almacenar productos y subir imágenes.

Requisitos:
- Node.js 16+
- npm

Instalación:
1. cd server
2. npm install
3. cp .env.example .env (editar si se requiere)
4. npm run dev  # o npm start

Endpoints:
- POST /api/auth/login  (body: { email, password }) => { token }
- GET /api/products
- POST /api/products  (protected, multipart/form-data: foto)
- PUT /api/products/:id (protected)
- DELETE /api/products/:id (protected)

Notas:
- Archivos subidos se guardan en la carpeta `uploads/` y se sirven en `/uploads/...`
- Cambia las credenciales por defecto mediante variables de entorno
