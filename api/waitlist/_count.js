const { getPool } = require('../_db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const pool = getPool();
  const { rows } = await pool.query('SELECT COUNT(*) AS count FROM waitlist');
  res.json({ count: Number(rows[0].count) });
};
