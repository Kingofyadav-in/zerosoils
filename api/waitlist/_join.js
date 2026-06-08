const { getPool } = require('../_db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const pool = getPool();
  const result = await pool.query(
    'INSERT INTO waitlist (email) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id',
    [email]
  );
  const { rows } = await pool.query('SELECT COUNT(*) AS count FROM waitlist');

  const already = result.rows.length === 0;
  res.status(already ? 200 : 201).json({ ok: true, already, count: Number(rows[0].count) });
};
