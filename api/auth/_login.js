const { getPool } = require('../_db');
const { sign, normalizeEmail, checkPassword, createPasswordHash } = require('../_auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body || {};
  const email = normalizeEmail(req.body?.email);
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const pool = getPool();
  const { rows } = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [email]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const passwordState = checkPassword(password, user);
  if (!passwordState.valid) return res.status(401).json({ error: 'Invalid credentials' });
  if (passwordState.needsUpgrade) {
    const upgraded = createPasswordHash(password);
    await pool.query('UPDATE users SET password_hash=$1, salt=$2 WHERE id=$3', [upgraded.passwordHash, upgraded.salt, user.id]);
  }

  const token = sign({ id: user.id, email: user.email, role: user.role });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      phone: user.phone,
      role: user.role,
      hdi_code: user.hdi_code,
      email_verified: Boolean(user.email_verified),
      phone_verified: Boolean(user.phone_verified),
    },
  });
};
