const router = require('express').Router();
const { db } = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { broadcast } = require('../ws');

router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await db.all('SELECT id, username, display_name, verified, role, banned, created_at FROM users ORDER BY created_at DESC');
    res.json(users);
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.post('/users/:id/ban', requireAdmin, async (req, res) => {
  try {
    const user = await db.get('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.role === 'admin') return res.status(400).json({ error: 'Нельзя забанить администратора' });
    await db.run('UPDATE users SET banned = 1 WHERE id = $1', [user.id]);
    await db.run('DELETE FROM refresh_tokens WHERE user_id = $1', [user.id]);
    broadcast('user_banned', { userId: user.id, username: user.username });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.post('/users/:id/unban', requireAdmin, async (req, res) => {
  try {
    await db.run('UPDATE users SET banned = 0 WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.post('/users/:id/verify', requireAdmin, async (req, res) => {
  try {
    const user = await db.get('SELECT id, verified FROM users WHERE id = $1', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    const newVal = user.verified ? 0 : 1;
    await db.run('UPDATE users SET verified = $1 WHERE id = $2', [newVal, user.id]);
    res.json({ verified: !!newVal });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.delete('/posts/:id', requireAdmin, async (req, res) => {
  try {
    await db.run('UPDATE posts SET deleted = 1 WHERE id = $1', [req.params.id]);
    broadcast('delete_post', { id: parseInt(req.params.id) });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.get('/channels', requireAdmin, async (req, res) => {
  try {
    const channels = await db.all(`
      SELECT ch.*, u.username as owner_username
      FROM channels ch JOIN users u ON u.id = ch.owner_id
      ORDER BY ch.created_at DESC
    `);
    res.json(channels);
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.post('/channels/:id/ban', requireAdmin, async (req, res) => {
  try {
    const channel = await db.get('SELECT id FROM channels WHERE id = $1', [req.params.id]);
    if (!channel) return res.status(404).json({ error: 'Канал не найден' });
    await db.run('UPDATE channels SET banned = 1 WHERE id = $1', [channel.id]);
    broadcast('channel_banned', { channelId: channel.id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.post('/channels/:id/unban', requireAdmin, async (req, res) => {
  try {
    await db.run('UPDATE channels SET banned = 0 WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.post('/channels/:id/verify', requireAdmin, async (req, res) => {
  try {
    const ch = await db.get('SELECT id, verified FROM channels WHERE id = $1', [req.params.id]);
    if (!ch) return res.status(404).json({ error: 'Канал не найден' });
    const newVal = ch.verified ? 0 : 1;
    await db.run('UPDATE channels SET verified = $1 WHERE id = $2', [newVal, ch.id]);
    res.json({ verified: !!newVal });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// GET /api/admin/stats — статистика БД
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const userCount = await db.get('SELECT COUNT(*) as c FROM users');
    const postCount = await db.get('SELECT COUNT(*) as c FROM posts WHERE deleted = 0');
    const mediaCount = await db.get('SELECT COUNT(*) as c FROM posts WHERE media_url IS NOT NULL AND deleted = 0');
    const mediaToday = await db.get(`SELECT COUNT(*) as c FROM posts WHERE media_url IS NOT NULL AND deleted = 0 AND created_at > NOW() - INTERVAL '24 hours'`);

    // Примерный размер медиа в БД (base64 ~ 1.37x реального)
    const mediaSizeRow = await db.get(`SELECT COALESCE(SUM(LENGTH(media_url)), 0) as total FROM posts WHERE media_url IS NOT NULL AND deleted = 0`);
    const mediaSizeMB = (parseInt(mediaSizeRow.total) / 1024 / 1024).toFixed(1);

    // Топ пользователей по медиа
    const topMedia = await db.all(`
      SELECT u.username, u.display_name, COUNT(*) as cnt
      FROM posts p JOIN users u ON u.id = p.author_id
      WHERE p.media_url IS NOT NULL AND p.deleted = 0
      GROUP BY u.id, u.username, u.display_name
      ORDER BY cnt DESC LIMIT 10
    `);

    res.json({
      userCount: parseInt(userCount.c),
      postCount: parseInt(postCount.c),
      mediaCount: parseInt(mediaCount.c),
      mediaToday: parseInt(mediaToday.c),
      mediaSizeMB,
      topMedia
    });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

module.exports = router;
