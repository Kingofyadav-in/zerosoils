const { getPool } = require('../_db');
const { sign, normalizeEmail, normalizePhone, createPasswordHash } = require('../_auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body || {};
  const email = normalizeEmail(req.body?.email);
  const name = String(req.body?.name || '').trim().slice(0, 120);
  const phone = normalizePhone(req.body?.phone);
  if (name.length < 2) return res.status(400).json({ error: 'Full name required' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  if (!phone) return res.status(400).json({ error: 'Valid mobile number required with country code' });
  if (!password || String(password).length < 8 || String(password).length > 128) {
    return res.status(400).json({ error: 'Password must be between 8 and 128 characters' });
  }

  const pool = getPool();
  const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
  if (existing.rows.length) return res.status(409).json({ error: 'Email already registered' });

  const { salt, passwordHash } = createPasswordHash(password);
  let rows;
  try {
    ({ rows } = await pool.query(
      `INSERT INTO users (email, name, phone, password_hash, salt, role)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, email, name, phone, username, role, hdi_code, hdi_generated_at, hdi_version,
                 email_verified, phone_verified`,
      [email, name, phone, passwordHash, salt, 'user']
    ));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    throw err;
  }
  const user = rows[0];
  const token = sign({ id: user.id, email: user.email, role: user.role });
  res.status(201).json({ token, user });
};
