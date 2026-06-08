const { requireAuth } = require('../_auth');
const { getPool }     = require('../_db');
const crypto           = require('crypto');

const PAGE_SIZE  = 20;
const MAX_CHARS  = 280;
const POST_REWARD_TYPE = 'post';

module.exports = async (req, res) => {
  const pool = getPool();

  // ── GET /api/community/posts?page=0 ──────────────────────────
  if (req.method === 'GET') {
    const page   = Math.max(0, parseInt(req.query?.page || new URL(req.url,'http://x').searchParams.get('page') || '0'));
    const offset = page * PAGE_SIZE;

    // Optionally join to get current user's reactions
    const auth = (() => { try { return requireAuth(req, {}); } catch { return null; } })();
    const userId = auth?.id || null;

    const feedQ = userId
      ? `SELECT p.*, u.username AS author_username,
           EXISTS(SELECT 1 FROM community_post_reactions r WHERE r.post_id=p.id AND r.user_id=$3 AND r.type='like')  AS liked_by_me,
           EXISTS(SELECT 1 FROM community_post_reactions r WHERE r.post_id=p.id AND r.user_id=$3 AND r.type='trust') AS trusted_by_me,
           (SELECT COUNT(*) FROM community_comments c WHERE c.post_id=p.id)::int AS comment_count
         FROM community_posts p JOIN users u ON u.id=p.user_id
         WHERE p.hidden=FALSE ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`
      : `SELECT p.*, u.username AS author_username, FALSE AS liked_by_me, FALSE AS trusted_by_me,
           (SELECT COUNT(*) FROM community_comments c WHERE c.post_id=p.id)::int AS comment_count
         FROM community_posts p JOIN users u ON u.id=p.user_id
         WHERE p.hidden=FALSE ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`;

    const args = userId ? [PAGE_SIZE, offset, userId] : [PAGE_SIZE, offset];
    const [{ rows: posts }, { rows: total }] = await Promise.all([
      pool.query(feedQ, args),
      pool.query('SELECT COUNT(*)::int AS n FROM community_posts WHERE hidden=FALSE'),
    ]);

    return res.json({
      posts: posts.map(p => ({
        id:             p.id,
        authorHdi:      p.author_hdi,
        authorName:     p.author_name,
        authorUsername: p.author_username,
        authorTier:     p.author_tier,
        body:           p.body,
        likes:          p.likes,
        trusts:         p.trusts,
        commentCount:   p.comment_count,
        likedByMe:      Boolean(p.liked_by_me),
        trustedByMe:    Boolean(p.trusted_by_me),
        createdAt:      p.created_at,
      })),
      total:   total[0].n,
      page,
      hasMore: offset + posts.length < total[0].n,
    });
  }

  // ── POST /api/community/posts ─────────────────────────────────
  if (req.method === 'POST') {
    const auth = requireAuth(req, res);
    if (!auth) return;

    const user = (await pool.query(
      'SELECT id, name, hdi_code, email_verified, phone_verified FROM users WHERE id=$1', [auth.id]
    )).rows[0];

    if (!user?.hdi_code) return res.status(403).json({ error: 'Permanent HDI required to post.' });

    let { body } = req.body || {};
    body = String(body || '').trim();
    if (!body) return res.status(400).json({ error: 'Post body is required.' });
    if (body.length > MAX_CHARS) return res.status(400).json({ error: `Posts are limited to ${MAX_CHARS} characters.` });

    // Determine tier
    const tier = !user.email_verified ? 'bronze'
      : !user.phone_verified          ? 'bronze'
      : 'silver';  // gold/truth upgrades set separately in future

    const client = await pool.connect();
    let post;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO community_posts (user_id, author_hdi, author_name, author_tier, body)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [user.id, user.hdi_code, user.name, tier, body]
      );
      post = rows[0];

      const address = `zsw_${user.hdi_code.toLowerCase().replace(/-/g, '_')}`;
      await client.query(
        `INSERT INTO zs_wallets (user_id, owner_hdi, address, balance)
         VALUES ($1,$2,$3,0) ON CONFLICT (user_id) DO NOTHING`,
        [user.id, user.hdi_code, address]
      );

      const requestId = `post:${post.id}`;
      const rewardHash = crypto.createHash('sha256').update(`${requestId}|${POST_REWARD_TYPE}`).digest('hex');
      await client.query(
        `WITH credited AS (
           UPDATE zs_wallets
              SET balance=balance+1, updated_at=NOW()
            WHERE user_id=$3 AND balance < 99
            RETURNING id, balance
         )
         INSERT INTO zs_transactions
           (wallet_id, request_id, type, direction, amount, balance_after, note, verification_hash)
         SELECT id, $1, $2, 'credit', 1, balance, 'Community post reward', $4
           FROM credited`,
        [requestId, POST_REWARD_TYPE, user.id, rewardHash]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return res.status(201).json({
      ok:   true,
      post: {
        id:           post.id,
        authorHdi:    post.author_hdi,
        authorName:   post.author_name,
        authorTier:   post.author_tier,
        body:         post.body,
        likes:        0,
        trusts:       0,
        commentCount: 0,
        likedByMe:    false,
        trustedByMe:  false,
        createdAt:    post.created_at,
      },
    });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
