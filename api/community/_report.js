const { requireAuth } = require('../_auth');
const { getPool }     = require('../_db');

// POST /api/community/report
// Body: { postId?, commentId?, reason }

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = requireAuth(req, res);
  if (!auth) return;

  const { postId, commentId, reason = 'inappropriate' } = req.body || {};
  if (!postId && !commentId) return res.status(400).json({ error: 'postId or commentId required.' });

  const pool = getPool();

  try {
    if (postId) {
      await pool.query(
        `WITH inserted AS (
           INSERT INTO community_reports (reporter_id, post_id, reason)
           VALUES ($1,$2,$3)
           ON CONFLICT (reporter_id, post_id) DO NOTHING
           RETURNING post_id
         )
         UPDATE community_posts
            SET reports=reports+1,
                hidden=(hidden OR reports+1 >= 5)
          WHERE id IN (SELECT post_id FROM inserted)`,
        [auth.id, postId, String(reason).slice(0, 100)]
      );
    } else {
      await pool.query(
        `INSERT INTO community_reports (reporter_id, comment_id, reason)
         VALUES ($1,$2,$3) ON CONFLICT (reporter_id, comment_id) DO NOTHING`,
        [auth.id, commentId, String(reason).slice(0, 100)]
      );
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('[community/report]', err.message);
    return res.status(500).json({ error: 'Report failed. Try again.' });
  }
};
