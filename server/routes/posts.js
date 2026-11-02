const router = require('express').Router();
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { upload, compressToBase64 } = require('../middleware/upload');
const { broadcast } = require('../ws');
const { createNotif } = require('../notif');
const xss = require('xss');
const fs = require('fs');

async function checkMediaLimit(userId) {
  const row = await db.get(`
    SELECT COUNT(*) as c FROM posts
    WHERE author_id = $1 AND media_url IS NOT NULL AND deleted = 0
    AND created_at > NOW() - INTERVAL '24 hours'
  `, [userId]);
  return parseInt(row.c) < 3;
}

async function enrichPost(post, currentUserId) {
  const author = await db.get('SELECT id, username, display_name, avatar_url, verified, role FROM users WHERE id = $1', [post.author_id]);
  const likeRow = await db.get('SELECT COUNT(*) as c FROM post_likes WHERE post_id = $1', [post.id]);
  const repostRow = await db.get('SELECT COUNT(*) as c FROM reposts WHERE post_id = $1', [post.id]);
  const commentRow = await db.get('SELECT COUNT(*) as c FROM comments WHERE post_id = $1 AND deleted = 0', [post.id]);
  const liked = currentUserId ? !!(await db.get('SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2', [post.id, currentUserId])) : false;
  const reposted = currentUserId ? !!(await db.get('SELECT 1 FROM reposts WHERE post_id = $1 AND user_id = $2', [post.id, currentUserId])) : false;
  return {
    ...post,
    author,
    likeCount: parseInt(likeRow.c),
    repostCount: parseInt(repostRow.c),
    commentCount: parseInt(commentRow.c),
    liked,
    reposted
  };
}

// GET /api/posts — feed
router.get('/', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const posts = await db.all(`
      SELECT * FROM (
        SELECT p.*, NULL::integer as reposted_by_id, NULL::text as reposted_by_username, p.created_at as sort_time
        FROM posts p WHERE p.deleted = 0 AND p.channel_id IS NULL
        UNION ALL
        SELECT p.*, r.user_id as reposted_by_id, u.username as reposted_by_username, r.created_at as sort_time
        FROM reposts r
        JOIN posts p ON p.id = r.post_id
        JOIN users u ON u.id = r.user_id
        WHERE p.deleted = 0 AND p.channel_id IS NULL
      ) feed
      ORDER BY sort_time DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const enriched = await Promise.all(posts.map(p => enrichPost(p, req.user.id)));
    res.json(enriched);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка сервера' }); }
});

// POST /api/posts
router.post('/', requireAuth, upload.single('media'), async (req, res) => {
  try {
    const text = xss(String(req.body.text || '').trim());
    if (!text && !req.file) return res.status(400).json({ error: 'Текст или изображение обязательны' });
    if (text.length > 2000) return res.status(400).json({ error: 'Пост максимум 2000 символов' });

    let mediaUrl = null;
    if (req.file) {
      const allowed = await checkMediaLimit(req.user.id);
      if (!allowed) {
        fs.unlinkSync(req.file.path);
        return res.status(429).json({ error: 'Лимит изображений: максимум 3 в день' });
      }
      try {
        mediaUrl = await compressToBase64(req.file.path, req.file.mimetype);
      } finally {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      }
    }

    const result = await db.run(
      'INSERT INTO posts (author_id, text, media_url) VALUES ($1, $2, $3) RETURNING id',
      [req.user.id, text, mediaUrl]
    );
    const post = await db.get('SELECT * FROM posts WHERE id = $1', [result.lastInsertRowid]);
    const enriched = await enrichPost(post, req.user.id);
    broadcast('new_post', enriched);
    res.status(201).json(enriched);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка сервера' }); }
});

// GET /api/posts/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const post = await db.get('SELECT * FROM posts WHERE id = $1 AND deleted = 0', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Пост не найден' });
    res.json(await enrichPost(post, req.user.id));
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// DELETE /api/posts/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const post = await db.get('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Пост не найден' });
    if (post.author_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Нет прав' });
    await db.run('UPDATE posts SET deleted = 1 WHERE id = $1', [post.id]);
    broadcast('delete_post', { id: post.id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// POST /api/posts/:id/like
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const post = await db.get('SELECT id FROM posts WHERE id = $1 AND deleted = 0', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Пост не найден' });

    const exists = await db.get('SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2', [post.id, req.user.id]);
    if (exists) {
      await db.run('DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2', [post.id, req.user.id]);
    } else {
      await db.run('INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)', [post.id, req.user.id]);
    }
    const row = await db.get('SELECT COUNT(*) as c FROM post_likes WHERE post_id = $1', [post.id]);
    const count = parseInt(row.c);
    broadcast('like_post', { postId: post.id, count, liked: !exists, userId: req.user.id });
    if (!exists) {
      const postRow = await db.get('SELECT author_id FROM posts WHERE id = $1', [post.id]);
      if (postRow) createNotif(postRow.author_id, req.user.id, 'like', post.id);
    }
    res.json({ liked: !exists, count });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// POST /api/posts/:id/repost
router.post('/:id/repost', requireAuth, async (req, res) => {
  try {
    const post = await db.get('SELECT * FROM posts WHERE id = $1 AND deleted = 0', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Пост не найден' });
    if (post.author_id === req.user.id) return res.status(400).json({ error: 'Нельзя репостить свой пост' });

    const exists = await db.get('SELECT 1 FROM reposts WHERE post_id = $1 AND user_id = $2', [post.id, req.user.id]);
    if (exists) {
      await db.run('DELETE FROM reposts WHERE post_id = $1 AND user_id = $2', [post.id, req.user.id]);
    } else {
      await db.run('INSERT INTO reposts (post_id, user_id) VALUES ($1, $2)', [post.id, req.user.id]);
    }
    const row = await db.get('SELECT COUNT(*) as c FROM reposts WHERE post_id = $1', [post.id]);
    broadcast('repost', { postId: post.id, count: parseInt(row.c), reposted: !exists, userId: req.user.id });
    res.json({ reposted: !exists, count: parseInt(row.c) });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// GET /api/posts/:id/comments
router.get('/:id/comments', requireAuth, async (req, res) => {
  try {
    const comments = await db.all(`
      SELECT c.*, u.username, u.display_name, u.avatar_url, u.verified,
        (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as like_count,
        (SELECT 1 FROM comment_likes WHERE comment_id = c.id AND user_id = $1) as liked
      FROM comments c
      JOIN users u ON u.id = c.author_id
      WHERE c.post_id = $2 AND c.deleted = 0
      ORDER BY c.created_at ASC
    `, [req.user.id, req.params.id]);
    res.json(comments);
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// POST /api/posts/:id/comments
router.post('/:id/comments', requireAuth, async (req, res) => {
  try {
    const text = xss(String(req.body.text || '').trim());
    if (!text) return res.status(400).json({ error: 'Комментарий не может быть пустым' });
    if (text.length > 500) return res.status(400).json({ error: 'Комментарий максимум 500 символов' });

    const post = await db.get('SELECT id FROM posts WHERE id = $1 AND deleted = 0', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Пост не найден' });

    const result = await db.run(
      'INSERT INTO comments (post_id, author_id, text) VALUES ($1, $2, $3) RETURNING id',
      [post.id, req.user.id, text]
    );
    const comment = await db.get(`
      SELECT c.*, u.username, u.display_name, u.avatar_url, u.verified
      FROM comments c JOIN users u ON u.id = c.author_id WHERE c.id = $1
    `, [result.lastInsertRowid]);

    broadcast('new_comment', { postId: post.id, comment: { ...comment, like_count: 0, liked: false } });
    const postRow = await db.get('SELECT author_id FROM posts WHERE id = $1', [post.id]);
    if (postRow) createNotif(postRow.author_id, req.user.id, 'comment', post.id);
    res.status(201).json(comment);
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// DELETE /api/posts/:postId/comments/:commentId
router.delete('/:postId/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const comment = await db.get('SELECT * FROM comments WHERE id = $1', [req.params.commentId]);
    if (!comment) return res.status(404).json({ error: 'Комментарий не найден' });
    if (comment.author_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Нет прав' });
    await db.run('UPDATE comments SET deleted = 1 WHERE id = $1', [comment.id]);
    broadcast('delete_comment', { postId: comment.post_id, commentId: comment.id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// POST /api/posts/comments/:id/like
router.post('/comments/:id/like', requireAuth, async (req, res) => {
  try {
    const comment = await db.get('SELECT id FROM comments WHERE id = $1 AND deleted = 0', [req.params.id]);
    if (!comment) return res.status(404).json({ error: 'Комментарий не найден' });

    const exists = await db.get('SELECT 1 FROM comment_likes WHERE comment_id = $1 AND user_id = $2', [comment.id, req.user.id]);
    if (exists) {
      await db.run('DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2', [comment.id, req.user.id]);
    } else {
      await db.run('INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2)', [comment.id, req.user.id]);
    }
    const row = await db.get('SELECT COUNT(*) as c FROM comment_likes WHERE comment_id = $1', [comment.id]);
    res.json({ liked: !exists, count: parseInt(row.c) });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

module.exports = router;
