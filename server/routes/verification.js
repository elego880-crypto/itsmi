const router = require('express').Router();
const { db } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const xss = require('xss');

const MIN_DAYS = 3;
const MIN_POSTS = 3;
const COOLDOWN_DAYS = 14;

router.get('/status', requireAuth, async (req, res) => {
  try {
    const req_ = await db.get('SELECT * FROM verification_requests WHERE user_id = $1', [req.user.id]);
    const postRow = await db.get('SELECT COUNT(*) as c FROM posts WHERE author_id = $1 AND deleted = 0', [req.user.id]);
    const postCount = parseInt(postRow.c);
    const daysSince = Math.floor((Date.now() - new Date(req.user.created_at)) / 86400000);
    const eligible = daysSince >= MIN_DAYS && postCount >= MIN_POSTS;

    res.json({
      request: req_ || null,
      eligible,
      requirements: { minDays: MIN_DAYS, daysSince, minPosts: MIN_POSTS, postCount },
      cooldownUntil: req_?.cooldown_until || null
    });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.post('/apply', requireAuth, async (req, res) => {
  try {
    if (req.user.verified) return res.status(400).json({ error: 'Уже верифицирован' });

    const existing = await db.get('SELECT * FROM verification_requests WHERE user_id = $1', [req.user.id]);
    if (existing) {
      if (existing.status === 'pending') return res.status(400).json({ error: 'Заявка уже отправлена' });
      if (existing.cooldown_until && new Date(existing.cooldown_until) > new Date()) {
        return res.status(400).json({ error: `Повторная заявка доступна ${new Date(existing.cooldown_until).toLocaleDateString('ru-RU')}` });
      }
    }

    const postRow = await db.get('SELECT COUNT(*) as c FROM posts WHERE author_id = $1 AND deleted = 0', [req.user.id]);
    const postCount = parseInt(postRow.c);
    const daysSince = Math.floor((Date.now() - new Date(req.user.created_at)) / 86400000);

    if (daysSince < MIN_DAYS) return res.status(400).json({ error: `Аккаунту нужно минимум ${MIN_DAYS} дня` });
    if (postCount < MIN_POSTS) return res.status(400).json({ error: `Нужно минимум ${MIN_POSTS} поста` });

    const reason = xss(String(req.body.reason || '').trim().slice(0, 500));
    if (!reason) return res.status(400).json({ error: 'Укажи причину для верификации' });

    if (existing) {
      await db.run(
        'UPDATE verification_requests SET reason = $1, status = $2, reviewed_at = NULL, cooldown_until = NULL, created_at = NOW() WHERE user_id = $3',
        [reason, 'pending', req.user.id]
      );
    } else {
      await db.run('INSERT INTO verification_requests (user_id, reason) VALUES ($1, $2)', [req.user.id, reason]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.get('/requests', requireAdmin, async (req, res) => {
  try {
    const requests = await db.all(`
      SELECT vr.*, u.username, u.display_name, u.avatar_url,
        (SELECT COUNT(*) FROM posts WHERE author_id = u.id AND deleted = 0) as post_count,
        (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as follower_count
      FROM verification_requests vr
      JOIN users u ON u.id = vr.user_id
      WHERE vr.status = 'pending'
      ORDER BY vr.created_at ASC
    `);
    res.json(requests);
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.post('/requests/:id/approve', requireAdmin, async (req, res) => {
  try {
    const vr = await db.get('SELECT * FROM verification_requests WHERE id = $1', [req.params.id]);
    if (!vr) return res.status(404).json({ error: 'Заявка не найдена' });
    await db.run('UPDATE verification_requests SET status = $1, reviewed_at = NOW() WHERE id = $2', ['approved', vr.id]);
    await db.run('UPDATE users SET verified = 1 WHERE id = $1', [vr.user_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.post('/requests/:id/reject', requireAdmin, async (req, res) => {
  try {
    const vr = await db.get('SELECT * FROM verification_requests WHERE id = $1', [req.params.id]);
    if (!vr) return res.status(404).json({ error: 'Заявка не найдена' });
    const cooldown = new Date(Date.now() + COOLDOWN_DAYS * 86400000).toISOString();
    await db.run('UPDATE verification_requests SET status = $1, reviewed_at = NOW(), cooldown_until = $2 WHERE id = $3', ['rejected', cooldown, vr.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

module.exports = router;
