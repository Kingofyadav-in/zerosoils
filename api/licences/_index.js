const { requireAuth } = require('../_auth');
const { getPool } = require('../_db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const auth = requireAuth(req, res);
  if (!auth) return;

  try {
    const pool = getPool();
    const userResult = await pool.query('SELECT hdi_code FROM users WHERE id=$1', [auth.id]);
    const hdi_code = userResult.rows[0]?.hdi_code;
    if (!hdi_code) return res.json({ licences: [] });

    const { rows } = await pool.query(
      `SELECT licence_id, owner_hdi, title, content_type, licence_type,
              content_hash, status, metadata, created_at
         FROM hdi_licences WHERE owner_hdi=$1 AND status='active' ORDER BY created_at DESC LIMIT 100`,
      [hdi_code]
    );

    res.json({ licences: rows.map(r => ({
      licenceId:    r.licence_id,
      ownerHdi:     r.owner_hdi,
      title:        r.title,
      contentType:  r.content_type,
      licenceType:  r.licence_type,
      contentHash:  r.content_hash,
      status:       r.status,
      metadata:     r.metadata,
      createdAt:    r.created_at,
    })) });
  } catch (err) {
    console.error('[licences/index]', err.message);
    res.status(500).json({ error: 'Unable to load licences. Try again later.' });
  }
};
