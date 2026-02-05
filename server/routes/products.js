const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../db');
const { verifyJwt } = require('../middleware/auth');

const UPLOADS_DIR = process.env.UPLOADS_DIR || 'uploads';
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname.replace(/\s+/g,'_'))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', (req, res) => {
    const db = getDb();
    db.all('SELECT * FROM products ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error DB' });
        res.json(rows);
    });
});

router.post('/', verifyJwt, upload.single('foto'), (req, res) => {
    const { nombre, precio, stock, categoria, descripcion, promo } = req.body;
    let fotoPath = '';
    if (req.file) fotoPath = `/uploads/${req.file.filename}`;
    const db = getDb();
    db.run('INSERT INTO products (nombre, precio, stock, categoria, descripcion, foto, promo) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [nombre, precio || 0, stock || 0, categoria || '', descripcion || '', fotoPath, promo || ''], function (err) {
            if (err) return res.status(500).json({ error: 'Error guardando producto' });
            db.get('SELECT * FROM products WHERE id = ?', [this.lastID], (err2, row) => {
                if (err2) return res.status(500).json({ error: 'Error DB' });
                res.json(row);
            });
        });
});

router.put('/:id', verifyJwt, upload.single('foto'), (req, res) => {
    const { id } = req.params;
    const { nombre, precio, stock, categoria, descripcion, promo } = req.body;
    let fotoPath;
    if (req.file) fotoPath = `/uploads/${req.file.filename}`;
    const db = getDb();
    db.get('SELECT * FROM products WHERE id = ?', [id], (err, existing) => {
        if (err || !existing) return res.status(404).json({ error: 'No encontrado' });
        const updatedFoto = fotoPath || existing.foto;
        db.run('UPDATE products SET nombre=?, precio=?, stock=?, categoria=?, descripcion=?, foto=?, promo=? WHERE id=?',
            [nombre || existing.nombre, precio || existing.precio, stock || existing.stock, categoria || existing.categoria, descripcion || existing.descripcion, updatedFoto, promo || existing.promo, id], (err2) => {
                if (err2) return res.status(500).json({ error: 'Error actualizando' });
                db.get('SELECT * FROM products WHERE id = ?', [id], (err3, row) => {
                    if (err3) return res.status(500).json({ error: 'Error DB' });
                    res.json(row);
                });
            });
    });
});

router.delete('/:id', verifyJwt, (req, res) => {
    const { id } = req.params;
    const db = getDb();
    db.run('DELETE FROM products WHERE id = ?', [id], function (err) {
        if (err) return res.status(500).json({ error: 'Error eliminando' });
        res.json({ ok: true });
    });
});

module.exports = router;
