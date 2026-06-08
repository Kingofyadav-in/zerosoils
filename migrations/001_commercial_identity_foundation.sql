BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS hdi_code TEXT,
  ADD COLUMN IF NOT EXISTS hdi_device_fp TEXT,
  ADD COLUMN IF NOT EXISTS hdi_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hdi_version TEXT,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_hdi_code ON users (hdi_code) WHERE hdi_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_verified_phone ON users (phone) WHERE phone_verified = TRUE;

CREATE TABLE IF NOT EXISTS otp_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('email', 'phone')),
  target      TEXT NOT NULL,
  code_hash   TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  attempts    INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE otp_tokens ADD COLUMN IF NOT EXISTS code_hash TEXT;
ALTER TABLE otp_tokens ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
UPDATE otp_tokens SET used = TRUE WHERE code_hash IS NULL;
ALTER TABLE otp_tokens ALTER COLUMN code_hash SET NOT NULL;
ALTER TABLE otp_tokens DROP COLUMN IF EXISTS code;

CREATE INDEX IF NOT EXISTS idx_otp_tokens_lookup
  ON otp_tokens (user_id, type, used, expires_at DESC);

CREATE TABLE IF NOT EXISTS hdi_devices (
  id           BIGSERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id    TEXT NOT NULL,
  public_key   JSONB NOT NULL,
  fingerprint  TEXT NOT NULL,
  label        TEXT NOT NULL DEFAULT 'Browser device',
  first_ip     TEXT,
  last_ip      TEXT,
  verified_at  TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_hdi_devices_user ON hdi_devices (user_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hdi_primary_device_user ON hdi_devices (user_id);

CREATE TABLE IF NOT EXISTS hdi_device_challenges (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id  TEXT NOT NULL,
  challenge  TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hdi_device_challenges_lookup
  ON hdi_device_challenges (user_id, device_id, used, expires_at DESC);

CREATE TABLE IF NOT EXISTS hdi_licences (
  id                BIGSERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  licence_id        TEXT UNIQUE NOT NULL,
  owner_hdi         TEXT NOT NULL,
  title             TEXT NOT NULL,
  content_type      TEXT NOT NULL,
  licence_type      TEXT NOT NULL,
  content_hash      TEXT NOT NULL,
  verification_hash TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'transferred')),
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hdi_licences_owner ON hdi_licences (owner_hdi, created_at DESC);

CREATE TABLE IF NOT EXISTS zs_wallets (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_hdi   TEXT UNIQUE NOT NULL,
  address     TEXT UNIQUE NOT NULL,
  balance     INTEGER NOT NULL DEFAULT 0 CHECK (balance BETWEEN 0 AND 99),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS zs_transactions (
  id                BIGSERIAL PRIMARY KEY,
  wallet_id         BIGINT NOT NULL REFERENCES zs_wallets(id) ON DELETE CASCADE,
  request_id        TEXT UNIQUE,
  type              TEXT NOT NULL,
  direction         TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  amount            INTEGER NOT NULL CHECK (amount > 0),
  balance_after     INTEGER NOT NULL CHECK (balance_after BETWEEN 0 AND 99),
  note              TEXT NOT NULL DEFAULT '',
  verification_hash TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zs_transactions_wallet ON zs_transactions (wallet_id, created_at DESC);

CREATE TABLE IF NOT EXISTS waitlist (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email_lower ON waitlist (LOWER(email));

CREATE TABLE IF NOT EXISTS community_posts (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_hdi  TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_tier TEXT NOT NULL DEFAULT 'bronze',
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 280),
  likes       INTEGER NOT NULL DEFAULT 0 CHECK (likes >= 0),
  trusts      INTEGER NOT NULL DEFAULT 0 CHECK (trusts >= 0),
  reports     INTEGER NOT NULL DEFAULT 0 CHECK (reports >= 0),
  hidden      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_posts_feed
  ON community_posts (created_at DESC) WHERE hidden = FALSE;

CREATE TABLE IF NOT EXISTS community_post_reactions (
  post_id  BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type     TEXT NOT NULL CHECK (type IN ('like', 'trust')),
  PRIMARY KEY (post_id, user_id, type)
);

CREATE TABLE IF NOT EXISTS community_comments (
  id          BIGSERIAL PRIMARY KEY,
  post_id     BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_hdi  TEXT NOT NULL,
  author_name TEXT NOT NULL,
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 280),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_comments_post
  ON community_comments (post_id, created_at);

CREATE TABLE IF NOT EXISTS community_reports (
  id          BIGSERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id     BIGINT REFERENCES community_posts(id) ON DELETE CASCADE,
  comment_id  BIGINT REFERENCES community_comments(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL DEFAULT 'inappropriate',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reporter_id, post_id),
  UNIQUE (reporter_id, comment_id)
);

COMMIT;
