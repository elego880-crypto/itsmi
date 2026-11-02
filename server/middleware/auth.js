const jwt = require('jsonwebtoken');
const { db } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'itsmi_dev_secret_change_in_prod';
const JWT_EXPIRES = '15m';
const REFRESH_EXPIRES_DAYS = 30;

function signAccess(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

async function signRefresh(userId) {
  const token = require('crypto').randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 86400000).toISOString();
  await db.run('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)', [userId, token, expiresAt]);
  return token;
}

function verifyAccess(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  const payload = verifyAccess(header.slice(7));
  if (!payload) return res.status(401).json({ error: 'Токен истёк или недействителен' });

  try {
    const user = await db.get('SELECT * FROM users WHERE id = $1', [payload.sub]);
    if (!user) return res.status(403).json({ error: 'Доступ запрещён' });
    if (user.banned) return res.status(403).json({ error: 'Доступ запрещён', banned: true });

    req.user = user;
    await db.run('UPDATE users SET last_seen = NOW() WHERE id = $1', [user.id]);
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

async function requireAdmin(req, res, next) {
  await requireAuth(req, res, async () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Только для администратора' });
    next();
  });
}

module.exports = { signAccess, signRefresh, verifyAccess, requireAuth, requireAdmin };
