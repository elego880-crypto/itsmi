const router = require('express').Router();
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const type = req.query.type || 'all';
    if (!q || q.length < 2) return res.json({ posts: [], users: [] });

    const like = `%${q}%`;
    const uid = req.user.id;
    let posts = [], users = [];

    if (type === 'all' || type === 'posts') {
      posts = await db.all(`
        SELECT p.*, u.username, u.display_name, u.avatar_url, u.verified,
          (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) + COALESCE(p.fake_likes, 0) as like_count,
          (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) as repost_count,
          (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND deleted = 0) as comment_count,
          (SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) as liked,
          (SELECT 1 FROM reposts WHERE post_id = p.id AND user_id = $1) as reposted
        FROM posts p JOIN users u ON u.id = p.author_id
        WHERE p.deleted = 0 AND p.text ILIKE $2
        ORDER BY p.created_at DESC LIMIT 30
      `, [uid, like]);
    }

    if (type === 'all' || type === 'users') {
      users = await db.all(`
        SELECT id, username, display_name, avatar_url, verified,
          (SELECT COUNT(*) FROM follows WHERE following_id = users.id) as follower_count,
          (SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = users.id) as is_following
        FROM users
        WHERE banned = 0 AND (username ILIKE $2 OR display_name ILIKE $2)
        ORDER BY verified DESC, follower_count DESC LIMIT 20
      `, [uid, like]);
    }

    res.json({ posts, users });
  } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

module.exports = router;
