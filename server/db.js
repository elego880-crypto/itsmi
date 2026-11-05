const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Sync-style wrapper — query returns rows directly
const db = {
  // Returns first row or undefined
  async get(sql, params = []) {
    const { rows } = await pool.query(sql, params);
    return rows[0];
  },
  // Returns all rows
  async all(sql, params = []) {
    const { rows } = await pool.query(sql, params);
    return rows;
  },
  // Returns { lastInsertRowid, changes }
  async run(sql, params = []) {
    const returning = sql.trim().toUpperCase().includes('RETURNING');
    const { rows, rowCount } = await pool.query(sql, params);
    return {
      lastInsertRowid: returning && rows[0] ? rows[0].id : null,
      changes: rowCount
    };
  },
  pool
};

async function init() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      bio TEXT DEFAULT '',
      avatar_url TEXT DEFAULT NULL,
      password_hash TEXT NOT NULL,
      verified INTEGER DEFAULT 0,
      role TEXT DEFAULT 'user',
      banned INTEGER DEFAULT 0,
      last_seen TIMESTAMPTZ DEFAULT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      author_id INTEGER NOT NULL REFERENCES users(id),
      channel_id INTEGER DEFAULT NULL,
      text TEXT NOT NULL,
      media_url TEXT DEFAULT NULL,
      deleted INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS post_likes (
      post_id INTEGER NOT NULL REFERENCES posts(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      PRIMARY KEY (post_id, user_id)
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS reposts (
      post_id INTEGER NOT NULL REFERENCES posts(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (post_id, user_id)
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES posts(id),
      author_id INTEGER NOT NULL REFERENCES users(id),
      text TEXT NOT NULL,
      deleted INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS comment_likes (
      comment_id INTEGER NOT NULL REFERENCES comments(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      PRIMARY KEY (comment_id, user_id)
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS channels (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      avatar_url TEXT DEFAULT NULL,
      verified INTEGER DEFAULT 0,
      banned INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS channel_subscriptions (
      channel_id INTEGER NOT NULL REFERENCES channels(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      PRIMARY KEY (channel_id, user_id)
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS follows (
      follower_id INTEGER NOT NULL REFERENCES users(id),
      following_id INTEGER NOT NULL REFERENCES users(id),
      PRIMARY KEY (follower_id, following_id)
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      reporter_id INTEGER NOT NULL REFERENCES users(id),
      post_id INTEGER NOT NULL REFERENCES posts(id),
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS verification_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      reviewed_at TIMESTAMPTZ DEFAULT NULL,
      cooldown_until TIMESTAMPTZ DEFAULT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS bookmarks (
      post_id INTEGER NOT NULL REFERENCES posts(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (post_id, user_id)
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      actor_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      post_id INTEGER DEFAULT NULL,
      read INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_refresh_token ON refresh_tokens(token)`);

    // Admin seed
    const adminUsername = process.env.ADMIN_USERNAME || 'Egor';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Egor123!';
    const existing = await client.query('SELECT id FROM users WHERE username = $1', [adminUsername]);
    if (!existing.rows.length) {
      const hash = bcrypt.hashSync(adminPassword, 12);
      await client.query(
        `INSERT INTO users (username, display_name, bio, password_hash, verified, role) VALUES ($1, $2, $3, $4, 1, 'admin')`,
        [adminUsername, adminUsername, 'ИТСМИ - моя идея, моя платформа. @Egor', hash]
      );
    }

    // Migration: fake_likes column
    await client.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS fake_likes INTEGER DEFAULT 0`);

    // Auto-follow: все пользователи подписаны на админа
    const adminUser = await client.query('SELECT id FROM users WHERE username = $1', [adminUsername]);
    if (adminUser.rows.length) {
      const adminId = adminUser.rows[0].id;
      await client.query(`
        INSERT INTO follows (follower_id, following_id)
        SELECT id, $1 FROM users WHERE id != $1
        ON CONFLICT DO NOTHING
      `, [adminId]);
    }

    await client.query('COMMIT');
    console.log('[DB] PostgreSQL ready');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DB] Init failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { db, init };
