-- ITSMI database schema
-- PostgreSQL 14+
-- Version: 1.3.0

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(32) UNIQUE NOT NULL,
  display_name  VARCHAR(64),
  bio           TEXT,
  avatar_url    TEXT,
  password_hash TEXT NOT NULL,
  verified      BOOLEAN DEFAULT FALSE,
  role          VARCHAR(16) DEFAULT 'user',
  banned        BOOLEAN DEFAULT FALSE,
  last_seen     TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  channel_id  UUID,
  text        TEXT,
  media_url   TEXT,
  deleted     BOOLEAN DEFAULT FALSE,
  fake_likes  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id   UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS reposts (
  post_id    UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID REFERENCES posts(id) ON DELETE CASCADE,
  author_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  deleted    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS channels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(64) UNIQUE NOT NULL,
  description TEXT,
  avatar_url  TEXT,
  verified    BOOLEAN DEFAULT FALSE,
  banned      BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS channel_subscriptions (
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
  post_id     UUID REFERENCES posts(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  status      VARCHAR(16) DEFAULT 'pending',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  reason         TEXT,
  status         VARCHAR(16) DEFAULT 'pending',
  reviewed_at    TIMESTAMPTZ,
  cooldown_until TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookmarks (
  post_id    UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  actor_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(16) NOT NULL,
  post_id    UUID REFERENCES posts(id) ON DELETE CASCADE,
  read       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
