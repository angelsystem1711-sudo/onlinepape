const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const DB_FILE = path.join(__dirname, 'papeleria.db');
let db;

function initDb() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(DB_FILE, (err) => {
            if (err) return reject(err);
            db.serialize(() => {
                db.run(`CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE,
                    password TEXT
                )`);

                db.run(`CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nombre TEXT,
                    precio REAL,
                    stock INTEGER,
                    categoria TEXT,
                    descripcion TEXT,
                    foto TEXT,
                    promo TEXT
                )`);

                resolve();
            });
        });
    });
}

function getDb() {
    return db;
}

async function createDefaultAdmin() {
    return new Promise((resolve, reject) => {
        const email = process.env.ADMIN_EMAIL || 'admin@local';
        const password = process.env.ADMIN_PASSWORD || 'admin123';
        db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
            if (err) return reject(err);
            if (row) return resolve(false);
            const hashed = await bcrypt.hash(password, 10);
            db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashed], (err2) => {
                if (err2) return reject(err2);
                console.log('Admin creado:', email);
                resolve(true);
            });
        });
    });
}

module.exports = { initDb, getDb, createDefaultAdmin };
