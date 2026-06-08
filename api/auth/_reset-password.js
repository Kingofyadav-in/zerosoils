const crypto = require('crypto');
const { normalizeEmail, createPasswordHash } = require('../_auth');
const { getPool } = require('../_db');

function appSecret() {
  const s = process.env.APP_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('APP_SECRET must be set');
  return 'local-development-secret-change-before-production';
}

function verifyResetToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = crypto.createHmac('sha256', appSecret()).update(data).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'base64url'), Buffer.from(expected, 'base64url'))) return null;
  } catch { return null; }
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (payload.purpose !== 'reset') return null;
    if (!payload.exp || payload.exp <= Date.now()) return null;
    return payload;
  } catch { return null; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { token, password } = req.body || {};
  if (!token || !password || String(password).length < 8) {
    return res.status(400).json({ error: 'Valid token and new password (min 8 chars) required' });
  }

  const payload = verifyResetToken(token);
  if (!payload) return res.status(400).json({ error: 'Reset link is invalid or has expired. Request a new one.' });

  try {
    const pool = getPool();
    const email = normalizeEmail(payload.email);
    const { rows } = await pool.query(
      'SELECT id, password_hash FROM users WHERE id = $1 AND LOWER(email) = $2',
      [payload.id, email]
    );
    if (!rows.length) return res.status(400).json({ error: 'Account not found.' });

    const user = rows[0];
    // Token is invalidated if password was already changed (pwSnap mismatch)
    if (String(user.password_hash || '').slice(0, 8) !== payload.pwSnap) {
      return res.status(400).json({ error: 'Reset link has already been used. Request a new one.' });
    }

    const { salt, passwordHash } = createPasswordHash(password);
    await pool.query(
      'UPDATE users SET password_hash = $1, salt = $2 WHERE id = $3',
      [passwordHash, salt, user.id]
    );
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[reset-password]', err.message);
    res.status(500).json({ error: 'Unable to reset password. Try again later.' });
  }
};
