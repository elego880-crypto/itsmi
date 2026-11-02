const { db } = require('./db');
const { sendToUser } = require('./ws');

async function createNotif(userId, actorId, type, postId = null) {
  if (userId === actorId) return;

  try {
    // Дедупликация за последние 5 минут
    const existing = await db.get(
      `SELECT id FROM notifications
       WHERE user_id = $1 AND actor_id = $2 AND type = $3
       AND (post_id = $4 OR (post_id IS NULL AND $4 IS NULL))
       AND created_at > NOW() - INTERVAL '5 minutes'`,
      [userId, actorId, type, postId]
    );
    if (existing) return;

    const result = await db.run(
      'INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [userId, actorId, type, postId]
    );

    const notif = await db.get(`
      SELECT n.*,
        u.username as actor_username, u.display_name as actor_display_name,
        u.avatar_url as actor_avatar, u.verified as actor_verified,
        p.text as post_text
      FROM notifications n
      JOIN users u ON u.id = n.actor_id
      LEFT JOIN posts p ON p.id = n.post_id
      WHERE n.id = $1
    `, [result.lastInsertRowid]);

    sendToUser(userId, 'notification', notif);
  } catch (e) {
    console.error('[notif]', e);
  }
}

module.exports = { createNotif, notifyMentions };

async function notifyMentions(text, actorId, postId) {
  const matches = text.match(/@([a-zA-Z0-9_]+)/g);
  if (!matches) return;
  const usernames = [...new Set(matches.map(m => m.slice(1)))];
  for (const username of usernames) {
    try {
      const user = await db.get('SELECT id FROM users WHERE username = $1 AND banned = 0', [username]);
      if (user) await createNotif(user.id, actorId, 'mention', postId);
    } catch {}
  }
}