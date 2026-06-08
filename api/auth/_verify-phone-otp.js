const { getPool }     = require('../_db');
const { requireAuth, matchesOtp } = require('../_auth');
const { issueIdentityIfVerified } = require('./_identity');

const MAX_ATTEMPTS = 5;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = requireAuth(req, res);
  if (!user) return;

  const { code } = req.body || {};
  if (!code || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: '6-digit code required' });
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM otp_tokens
     WHERE user_id=$1 AND type='phone' AND used=FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [user.id]
  );

  const token = rows[0];
  if (!token || token.attempts >= MAX_ATTEMPTS) {
    return res.status(400).json({ error: 'Invalid or expired code' });
  }
  if (!matchesOtp(user.id, 'phone', code, token.code_hash)) {
    await pool.query(
      'UPDATE otp_tokens SET attempts=attempts+1, used=(attempts+1 >= $2) WHERE id=$1',
      [token.id, MAX_ATTEMPTS]
    );
    return res.status(400).json({ error: 'Invalid or expired code' });
  }

  await pool.query('UPDATE otp_tokens SET used=TRUE WHERE id=$1', [token.id]);
  try {
    await pool.query(
      'UPDATE users SET phone=$1, phone_verified=TRUE, phone_verified_at=NOW() WHERE id=$2',
      [token.target, user.id]
    );
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This mobile number is already linked to another verified identity.' });
    }
    throw err;
  }

  const verifiedUser = await issueIdentityIfVerified(pool, user.id);
  res.json({ ok: true, message: 'Phone verified successfully', user: verifiedUser });
};
