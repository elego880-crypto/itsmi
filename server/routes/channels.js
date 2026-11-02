const router = require('express').Router();
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { upload, compressToBase64 } = require('../middleware/upload');
const { broadcast } = require('../ws');
const xss = require('xss');
const fs = require('fs');

async function enrichChannelPost(post, currentUserId) {
  const author = await db.get('SELECT id, username, display_name, avatar_url, verified FROM users WHERE id = $1', [post.author_id]);
  const likeRow = await db.get('SELECT COUNT(*) as c FROM post_likes WHERE post_id = $1', [post.id]);
  const commentRow = await db.get('SELECT COUNT(*) as c FROM comments WHERE post_id = $1 AND deleted = 0', [post.id]);
  const liked = currentUserId ? !!(await db.get('SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2', [post.id, currentUserId])) : false;
  return { ...post, author, likeCount: parseInt(likeRow.c), commentCount: parseInt(commentRow.c), liked };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const channels = await db.all(`
      SELECT ch.*, u.username as owner_username, u.display_name as owner_display_name,
        (SELECT COUNT(*) FROM channel_subscriptions WHERE channel_id = ch.id) as subscriber_count,
        (SELECT 1 FROM channel_subscriptions WHERE channel_id = ch.id AND user_id = $1) as subscribed
      FROM channels ch JOIN users u ON u.id = ch.owner_id
      WHERE ch.banned = 0 ORDER BY ch.created_at DESC
    `, [req.user.id]);
    res.json(channels);
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.post('/', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    const name = xss(String(req.body.name || '').trim());
    const description = xss(String(req.body.description || '').trim().slice(0, 300));
    if (!name || name.length < 3) return res.status(400).json({ error: 'Название канала минимум 3 символа' });

    let avatarUrl = null;
    if (req.file) {
      try {
        avatarUrl = await compressToBase64(req.file.path, req.file.mimetype);
      } finally {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      }
    }

    const result = await db.run(
      'INSERT INTO channels (owner_id, name, description, avatar_url) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.user.id, name, description, avatarUrl]
    );
    const channel = await db.get('SELECT * FROM channels WHERE id = $1', [result.lastInsertRowid]);
    broadcast('new_channel', channel);
    res.status(201).json(channel);
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const channel = await db.get(`
      SELECT ch.*, u.username as owner_username, u.display_name as owner_display_name, u.avatar_url as owner_avatar,
        (SELECT COUNT(*) FROM channel_subscriptions WHERE channel_id = ch.id) as subscriber_count,
        (SELECT 1 FROM channel_subscriptions WHERE channel_id = ch.id AND user_id = $1) as subscribed
      FROM channels ch JOIN users u ON u.id = ch.owner_id
      WHERE ch.id = $2 AND ch.banned = 0
    `, [req.user.id, req.params.id]);
    if (!channel) return res.status(404).json({ error: 'Канал не найден' });
    res.json(channel);
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.post('/:id/subscribe', requireAuth, async (req, res) => {
  try {
    const channel = await db.get('SELECT id FROM channels WHERE id = $1 AND banned = 0', [req.params.id]);
    if (!channel) return res.status(404).json({ error: 'Канал не найден' });

    const exists = await db.get('SELECT 1 FROM channel_subscriptions WHERE channel_id = $1 AND user_id = $2', [channel.id, req.user.id]);
    if (exists) {
      await db.run('DELETE FROM channel_subscriptions WHERE channel_id = $1 AND user_id = $2', [channel.id, req.user.id]);
    } else {
      await db.run('INSERT INTO channel_subscriptions (channel_id, user_id) VALUES ($1, $2)', [channel.id, req.user.id]);
    }
    const row = await db.get('SELECT COUNT(*) as c FROM channel_subscriptions WHERE channel_id = $1', [channel.id]);
    res.json({ subscribed: !exists, subscriberCount: parseInt(row.c) });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.get('/:id/posts', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;
    const posts = await db.all(
      'SELECT * FROM posts WHERE channel_id = $1 AND deleted = 0 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [req.params.id, limit, offset]
    );
    const enriched = await Promise.all(posts.map(p => enrichChannelPost(p, req.user.id)));
    res.json(enriched);
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.post('/:id/posts', requireAuth, upload.single('media'), async (req, res) => {
  try {
    const channel = await db.get('SELECT * FROM channels WHERE id = $1 AND banned = 0', [req.params.id]);
    if (!channel) return res.status(404).json({ error: 'Канал не найден' });
    if (channel.owner_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Только владелец канала может публиковать' });

    const text = xss(String(req.body.text || '').trim());
    if (!text && !req.file) return res.status(400).json({ error: 'Текст или изображение обязательны' });
    if (text.length > 2000) return res.status(400).json({ error: 'Пост максимум 2000 символов' });

    let mediaUrl = null;
    if (req.file) {
      try {
        mediaUrl = await compressToBase64(req.file.path, req.file.mimetype);
      } finally {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      }
    }

    const result = await db.run(
      'INSERT INTO posts (author_id, channel_id, text, media_url) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.user.id, channel.id, text, mediaUrl]
    );
    const post = await db.get('SELECT * FROM posts WHERE id = $1', [result.lastInsertRowid]);
    const enriched = await enrichChannelPost(post, req.user.id);
    broadcast('new_channel_post', { channelId: channel.id, post: enriched });
    res.status(201).json(enriched);
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

module.exports = router;
