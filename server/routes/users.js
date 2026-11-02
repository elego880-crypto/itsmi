const router = require('express').Router();
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { upload, compressToBase64 } = require('../middleware/upload');
const { createNotif } = require('../notif');
const xss = require('xss');
const fs = require('fs');

function safeUser(u) {
  if (!u) return null;
  const { password_hash, ...safe } = u;
  return safe;
}

router.get('/:username', requireAuth, async (req, res) => {
  try {
    const user = await db.get('SELECT * FROM users WHERE username = $1', [req.params.username]);
    if (!user || user.banned) return res.status(404).json({ error: 'Пользователь не найден' });

    const followerRow = await db.get('SELECT COUNT(*) as c FROM follows WHERE following_id = $1', [user.id]);
    const followingRow = await db.get('SELECT COUNT(*) as c FROM follows WHERE follower_id = $1', [user.id]);
    const isFollowing = !!(await db.get('SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2', [req.user.id, user.id]));
    const isOnline = user.last_seen && (Date.now() - new Date(user.last_seen)) < 5 * 60 * 1000;

    res.json({ ...safeUser(user), followerCount: parseInt(followerRow.c), followingCount: parseInt(followingRow.c), isFollowing, isOnline });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.get('/:username/posts', requireAuth, async (req, res) => {
  try {
    const user = await db.get('SELECT id FROM users WHERE username = $1', [req.params.username]);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const posts = await db.all(`
      SELECT p.*, u.username, u.display_name, u.avatar_url, u.verified,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count,
        (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) as repost_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND deleted = 0) as comment_count,
        (SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) as liked,
        (SELECT 1 FROM reposts WHERE post_id = p.id AND user_id = $1) as reposted
      FROM posts p JOIN users u ON u.id = p.author_id
      WHERE p.author_id = $2 AND p.deleted = 0 AND p.channel_id IS NULL
      ORDER BY p.created_at DESC LIMIT $3 OFFSET $4
    `, [req.user.id, user.id, limit, offset]);

    res.json(posts);
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.post('/:username/follow', requireAuth, async (req, res) => {
  try {
    const target = await db.get('SELECT id FROM users WHERE username = $1', [req.params.username]);
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'Нельзя подписаться на себя' });

    const exists = await db.get('SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2', [req.user.id, target.id]);
    if (exists) {
      await db.run('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2', [req.user.id, target.id]);
    } else {
      await db.run('INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)', [req.user.id, target.id]);
    }
    const row = await db.get('SELECT COUNT(*) as c FROM follows WHERE following_id = $1', [target.id]);
    if (!exists) createNotif(target.id, req.user.id, 'follow', null);
    res.json({ following: !exists, followerCount: parseInt(row.c) });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.patch('/me', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    const displayName = req.body.displayName ? xss(String(req.body.displayName).trim()) : undefined;
    const bio = req.body.bio !== undefined ? xss(String(req.body.bio).trim().slice(0, 200)) : undefined;

    const updates = {};
    if (displayName) updates.display_name = displayName;
    if (bio !== undefined) updates.bio = bio;
    if (req.file) {
      try {
        updates.avatar_url = await compressToBase64(req.file.path, req.file.mimetype);
      } finally {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      }
    }

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Нечего обновлять' });

    const keys = Object.keys(updates);
    const vals = Object.values(updates);
    const setCols = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    await db.run(`UPDATE users SET ${setCols} WHERE id = $${keys.length + 1}`, [...vals, req.user.id]);

    const user = await db.get('SELECT * FROM users WHERE id = $1', [req.user.id]);
    res.json(safeUser(user));
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.get('/:username/followers', requireAuth, async (req, res) => {
  try {
    const user = await db.get('SELECT id FROM users WHERE username = $1', [req.params.username]);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    const followers = await db.all(`
      SELECT u.id, u.username, u.display_name, u.avatar_url, u.verified,
        (SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id) as is_following
      FROM follows f JOIN users u ON u.id = f.follower_id
      WHERE f.following_id = $2 AND u.banned = 0
      ORDER BY f.follower_id DESC
    `, [req.user.id, user.id]);
    res.json(followers);
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.get('/:username/following', requireAuth, async (req, res) => {
  try {
    const user = await db.get('SELECT id FROM users WHERE username = $1', [req.params.username]);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    const following = await db.all(`
      SELECT u.id, u.username, u.display_name, u.avatar_url, u.verified,
        (SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id) as is_following
      FROM follows f JOIN users u ON u.id = f.following_id
      WHERE f.follower_id = $2 AND u.banned = 0
      ORDER BY f.following_id DESC
    `, [req.user.id, user.id]);
    res.json(following);
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.get('/:username/liked', requireAuth, async (req, res) => {
  try {
    const user = await db.get('SELECT id FROM users WHERE username = $1', [req.params.username]);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    const posts = await db.all(`
      SELECT p.*, u.username, u.display_name, u.avatar_url, u.verified,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count,
        (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) as repost_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND deleted = 0) as comment_count,
        1 as liked,
        (SELECT 1 FROM reposts WHERE post_id = p.id AND user_id = $1) as reposted
      FROM post_likes pl
      JOIN posts p ON p.id = pl.post_id
      JOIN users u ON u.id = p.author_id
      WHERE pl.user_id = $2 AND p.deleted = 0
      ORDER BY pl.post_id DESC LIMIT 20
    `, [req.user.id, user.id]);
    res.json(posts);
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.get('/:username/reposts', requireAuth, async (req, res) => {
  try {
    const user = await db.get('SELECT id FROM users WHERE username = $1', [req.params.username]);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    const posts = await db.all(`
      SELECT p.*, u.username, u.display_name, u.avatar_url, u.verified,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count,
        (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) as repost_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND deleted = 0) as comment_count,
        (SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) as liked,
        1 as reposted
      FROM reposts r
      JOIN posts p ON p.id = r.post_id
      JOIN users u ON u.id = p.author_id
      WHERE r.user_id = $2 AND p.deleted = 0
      ORDER BY r.post_id DESC LIMIT 20
    `, [req.user.id, user.id]);
    res.json(posts);
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

module.exports = router;
