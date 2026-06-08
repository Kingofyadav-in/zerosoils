const { requireAuth } = require('../_auth');
const { getPool } = require('../_db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const payload = requireAuth(req, res);
  if (!payload) return;
  const { rows } = await getPool().query(
    `SELECT id, email, name, username, phone, role, hdi_code, hdi_generated_at, hdi_version,
            email_verified, phone_verified, created_at
       FROM users WHERE id=$1`,
    [payload.id]
  );
  if (!rows.length) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ user: rows[0] });
};
