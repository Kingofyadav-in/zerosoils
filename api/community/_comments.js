const { requireAuth } = require('../_auth');
const { getPool }     = require('../_db');

const MAX_COMMENT = 280;

module.exports = async (req, res) => {
  const pool = getPool();

  // ── GET /api/community/comments?postId=X ─────────────────────
  if (req.method === 'GET') {
    const postId = new URL(req.url, 'http://x').searchParams.get('postId');
    if (!postId) return res.status(400).json({ error: 'postId required.' });

    const { rows } = await pool.query(
      `SELECT c.id, c.author_hdi, c.author_name, c.body, c.created_at,
              u.username AS author_username
       FROM community_comments c JOIN users u ON u.id=c.user_id
       WHERE c.post_id=$1 ORDER BY c.created_at ASC LIMIT 50`,
      [postId]
    );

    return res.json({
      comments: rows.map(c => ({
        id:             c.id,
        authorHdi:      c.author_hdi,
        authorName:     c.author_name,
        authorUsername: c.author_username,
        body:           c.body,
        createdAt:      c.created_at,
      })),
    });
  }

  // ── POST /api/community/comments ──────────────────────────────
  if (req.method === 'POST') {
    const auth = requireAuth(req, res);
    if (!auth) return;

    const { postId, body } = req.body || {};
    const text = String(body || '').trim();
    if (!postId)         return res.status(400).json({ error: 'postId required.' });
    if (!text)           return res.status(400).json({ error: 'Comment body required.' });
    if (text.length > MAX_COMMENT) return res.status(400).json({ error: `Comments limited to ${MAX_COMMENT} characters.` });

    const user = (await pool.query(
      'SELECT id, name, hdi_code FROM users WHERE id=$1', [auth.id]
    )).rows[0];

    if (!user?.hdi_code) return res.status(403).json({ error: 'HDI required to comment.' });

    const post = (await pool.query('SELECT id FROM community_posts WHERE id=$1 AND hidden=FALSE', [postId])).rows[0];
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const { rows } = await pool.query(
      `INSERT INTO community_comments (post_id, user_id, author_hdi, author_name, body)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [postId, user.id, user.hdi_code, user.name, text]
    );
    const comment = rows[0];

    return res.status(201).json({
      ok: true,
      comment: {
        id:         comment.id,
        authorHdi:  comment.author_hdi,
        authorName: comment.author_name,
        body:       comment.body,
        createdAt:  comment.created_at,
      },
    });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
