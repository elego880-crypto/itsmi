const router = require('express').Router();
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const notifs = await db.all(`
      SELECT n.*, u.username as actor_username, u.display_name as actor_display_name,
        u.avatar_url as actor_avatar, u.verified as actor_verified, p.text as post_text
      FROM notifications n
      JOIN users u ON u.id = n.actor_id
      LEFT JOIN posts p ON p.id = n.post_id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC LIMIT 50
    `, [req.user.id]);
    res.json(notifs);
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const row = await db.get('SELECT COUNT(*) as c FROM notifications WHERE user_id = $1 AND read = 0', [req.user.id]);
    res.json({ count: parseInt(row.c) });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.post('/read-all', requireAuth, async (req, res) => {
  try {
    await db.run('UPDATE notifications SET read = 1 WHERE user_id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

module.exports = router;
