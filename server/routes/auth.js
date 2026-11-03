const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { signAccess, signRefresh, requireAuth } = require('../middleware/auth');
const xss = require('xss');

router.post('/register', async (req, res) => {
  try {
    let { username, displayName, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Укажи никнейм и пароль' });

    username = String(username).trim();
    displayName = xss(String(displayName || username).trim());

    if (username.length < 5) return res.status(400).json({ error: 'Никнейм минимум 5 символов' });
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ error: 'Никнейм: только латиница, цифры, _' });
    if (password.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });

    const exists = await db.get('SELECT id FROM users WHERE username = $1', [username]);
    if (exists) return res.status(409).json({ error: 'Никнейм уже занят' });

    const hash = await bcrypt.hash(password, 12);
    const result = await db.run(
      'INSERT INTO users (username, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [username, displayName, hash]
    );

    const user = await db.get('SELECT id, username, display_name, bio, avatar_url, verified, role FROM users WHERE id = $1', [result.lastInsertRowid]);

    // Автоподписка на админа
    const adminUsername = process.env.ADMIN_USERNAME || 'Egor';
    const admin = await db.get('SELECT id FROM users WHERE username = $1', [adminUsername]);
    if (admin && admin.id !== result.lastInsertRowid) {
      await db.run('INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [result.lastInsertRowid, admin.id]);
    }

    const access = signAccess(user.id);
    const refresh = await signRefresh(user.id);

    res.status(201).json({ access, refresh, user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Укажи никнейм и пароль' });

    const user = await db.get('SELECT * FROM users WHERE username = $1', [String(username).trim()]);
    if (!user) return res.status(401).json({ error: 'Неверный никнейм или пароль' });
    if (user.banned) return res.status(403).json({ error: 'Аккаунт заблокирован', banned: true });

    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Неверный никнейм или пароль' });

    const access = signAccess(user.id);
    const refresh = await signRefresh(user.id);

    const { password_hash, ...safeUser } = user;
    res.json({ access, refresh, user: safeUser });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Токен обязателен' });

    const row = await db.get('SELECT * FROM refresh_tokens WHERE token = $1', [token]);
    if (!row || new Date(row.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Refresh-токен недействителен' });
    }

    const user = await db.get('SELECT id, banned FROM users WHERE id = $1', [row.user_id]);
    if (!user || user.banned) return res.status(403).json({ error: 'Доступ запрещён', banned: !!user?.banned });

    await db.run('DELETE FROM refresh_tokens WHERE token = $1', [token]);
    const newAccess = signAccess(user.id);
    const newRefresh = await signRefresh(user.id);

    res.json({ access: newAccess, refresh: newRefresh });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  const { token } = req.body;
  if (token) await db.run('DELETE FROM refresh_tokens WHERE token = $1', [token]);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const { password_hash, ...safe } = req.user;
  res.json(safe);
});

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Укажи текущий и новый пароль' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Новый пароль минимум 6 символов' });

  const user = await db.get('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const ok = await bcrypt.compare(String(currentPassword), user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Неверный текущий пароль' });

  const hash = await bcrypt.hash(String(newPassword), 12);
  await db.run('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.id]);
  await db.run('DELETE FROM refresh_tokens WHERE user_id = $1', [user.id]);
  res.json({ ok: true });
});

module.exports = router;
