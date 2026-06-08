const { getPool }     = require('../_db');
const { requireAuth } = require('../_auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = requireAuth(req, res);
  if (!user) return;

  const pool = getPool();
  const { rows } = await pool.query('SELECT username, hdi_code FROM users WHERE id=$1', [user.id]);
  if (rows[0]?.hdi_code) {
    return res.json({ ok: true, username: rows[0].username, hdi_code: rows[0].hdi_code, already_set: true });
  }
  res.status(409).json({ error: 'Permanent HDI is issued only after email and mobile verification.' });
};
