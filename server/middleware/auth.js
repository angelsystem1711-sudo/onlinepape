const jwt = require('jsonwebtoken');const jwt = require('jsonwebtoken');

















module.exports = { verifyJwt };}    }        return res.status(401).json({ error: 'Token inválido' });    } catch (e) {        next();        req.user = payload;        const payload = jwt.verify(token, JWT_SECRET);    try {    const token = auth.split(' ')[1];    if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });    const auth = req.headers.authorization || '';function verifyJwt(req, res, next) {const JWT_SECRET = process.env.JWT_SECRET || 'secretdev';const JWT_SECRET = process.env.JWT_SECRET || 'secretdev';

function verifyJwt(req, res, next) {
    const h = req.headers.authorization || req.headers.Authorization;
    if (!h) return res.status(401).json({ error: 'No autorizado' });
    const parts = h.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Formato inválido' });
    const token = parts[1];
    try {
        const p = jwt.verify(token, JWT_SECRET);
        req.user = p;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Token inválido' });
    }
}

module.exports = { verifyJwt };
