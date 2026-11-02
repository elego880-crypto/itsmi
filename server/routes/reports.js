const router = require('express').Router();
const { db } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const xss = require('xss');

router.post('/', requireAuth, async (req, res) => {
  try {
    const { postId, reason } = req.body;
    if (!postId || !reason) return res.status(400).json({ error: 'Укажи пост и причину' });

    const post = await db.get('SELECT id FROM posts WHERE id = $1 AND deleted = 0', [postId]);
    if (!post) return res.status(404).json({ error: 'Пост не найден' });

    const existing = await db.get("SELECT id FROM reports WHERE reporter_id = $1 AND post_id = $2 AND status = 'pending'", [req.user.id, postId]);
    if (existing) return res.status(400).json({ error: 'Ты уже пожаловался на этот пост' });

    await db.run('INSERT INTO reports (reporter_id, post_id, reason) VALUES ($1, $2, $3)', [req.user.id, postId, xss(String(reason).slice(0, 200))]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.get('/', requireAdmin, async (req, res) => {
  try {
    const reports = await db.all(`
      SELECT r.*, ru.username as reporter_username, p.text as post_text, p.author_id, au.username as author_username
      FROM reports r
      JOIN users ru ON ru.id = r.reporter_id
      JOIN posts p ON p.id = r.post_id
      JOIN users au ON au.id = p.author_id
      WHERE r.status = 'pending'
      ORDER BY r.created_at DESC
    `);
    res.json(reports);
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.post('/:id/resolve', requireAdmin, async (req, res) => {
  try {
    const { action } = req.body;
    const report = await db.get('SELECT * FROM reports WHERE id = $1', [req.params.id]);
    if (!report) return res.status(404).json({ error: 'Жалоба не найдена' });

    await db.run("UPDATE reports SET status = 'resolved' WHERE id = $1", [report.id]);
    if (action === 'delete_post') {
      await db.run('UPDATE posts SET deleted = 1 WHERE id = $1', [report.post_id]);
      await db.run("UPDATE reports SET status = 'resolved' WHERE post_id = $1", [report.post_id]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

module.exports = router;
