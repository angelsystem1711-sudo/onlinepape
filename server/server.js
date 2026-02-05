const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb, getDb, createDefaultAdmin } = require('./db');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOADS_DIR || 'uploads')));

// Inicializar DB y crear admin por defecto si hace falta
initDb().then(async () => {
    await createDefaultAdmin();
    console.log('DB inicializada');
}).catch(err => {
    console.error('Error inicializando DB', err);
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

app.get('/', (req, res) => res.json({ ok: true, message: 'Papeleria API' }));

app.listen(PORT, () => console.log(`Server escuchando en http://localhost:${PORT}`));
