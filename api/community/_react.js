const { requireAuth } = require('../_auth');
const { getPool }     = require('../_db');

// POST /api/community/react
// Body: { postId, type: 'like' | 'trust' }
// Toggles: adds reaction if absent, removes if present

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = requireAuth(req, res);
  if (!auth) return;

  const { postId, type } = req.body || {};
  if (!postId || !['like','trust'].includes(type))
    return res.status(400).json({ error: 'postId and type (like|trust) required.' });

  const pool = getPool();

  const col   = type === 'like' ? 'likes' : 'trusts';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const post = (await client.query(
      'SELECT id FROM community_posts WHERE id=$1 AND hidden=FALSE FOR UPDATE',
      [postId]
    )).rows[0];
    if (!post) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Post not found.' });
    }

    const existing = (await client.query(
      'SELECT post_id FROM community_post_reactions WHERE post_id=$1 AND user_id=$2 AND type=$3',
      [postId, auth.id, type]
    )).rows[0];
    let active;
    if (existing) {
      await client.query('DELETE FROM community_post_reactions WHERE post_id=$1 AND user_id=$2 AND type=$3', [postId, auth.id, type]);
      active = false;
    } else {
      await client.query('INSERT INTO community_post_reactions (post_id, user_id, type) VALUES ($1,$2,$3)', [postId, auth.id, type]);
      active = true;
    }
    const updated = (await client.query(
      `UPDATE community_posts SET ${col}=GREATEST(${col}+$2,0) WHERE id=$1 RETURNING ${col}`,
      [postId, active ? 1 : -1]
    )).rows[0];
    await client.query('COMMIT');
    return res.json({ ok: true, active, count: updated[col] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
