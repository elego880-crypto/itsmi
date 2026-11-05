const router = require('express').Router();
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const uid = req.user.id;
    const posts = await db.all(`
      SELECT p.*, u.username, u.display_name, u.avatar_url, u.verified,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) + COALESCE(p.fake_likes, 0) as like_count,
        (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) as repost_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND deleted = 0) as comment_count,
        (SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) as liked,
        (SELECT 1 FROM reposts WHERE post_id = p.id AND user_id = $1) as reposted,
        1 as bookmarked
      FROM bookmarks b
      JOIN posts p ON p.id = b.post_id
      JOIN users u ON u.id = p.author_id
      WHERE b.user_id = $1 AND p.deleted = 0
      ORDER BY b.created_at DESC LIMIT 50
    `, [uid]);

    res.json(posts.map(p => ({
      ...p,
      author: { id: p.author_id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, verified: p.verified }
    })));
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.post('/:postId', requireAuth, async (req, res) => {
  try {
    const post = await db.get('SELECT id FROM posts WHERE id = $1 AND deleted = 0', [req.params.postId]);
    if (!post) return res.status(404).json({ error: 'Пост не найден' });

    const exists = await db.get('SELECT 1 FROM bookmarks WHERE post_id = $1 AND user_id = $2', [post.id, req.user.id]);
    if (exists) {
      await db.run('DELETE FROM bookmarks WHERE post_id = $1 AND user_id = $2', [post.id, req.user.id]);
    } else {
      await db.run('INSERT INTO bookmarks (post_id, user_id) VALUES ($1, $2)', [post.id, req.user.id]);
    }
    res.json({ bookmarked: !exists });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

module.exports = router;
