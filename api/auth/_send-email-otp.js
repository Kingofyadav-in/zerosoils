const { getPool }       = require('../_db');
const { requireAuth, otpHash } = require('../_auth');
const { sendOTPEmail }  = require('../_mailer');
const crypto            = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = requireAuth(req, res);
  if (!user) return;

  const target = user.email;
  if (!target || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const otp     = crypto.randomInt(100000, 1000000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  const pool = getPool();
  // Invalidate previous unused OTPs for this user+type
  await pool.query(
    'UPDATE otp_tokens SET used=TRUE WHERE user_id=$1 AND type=$2 AND used=FALSE',
    [user.id, 'email']
  );

  await pool.query(
    'INSERT INTO otp_tokens (user_id, type, target, code_hash, expires_at) VALUES ($1,$2,$3,$4,$5)',
    [user.id, 'email', target, otpHash(user.id, 'email', otp), expires]
  );

  try {
    await sendOTPEmail(target, otp, user.email?.split('@')[0] || '');
  } catch {
    return res.status(503).json({ error: 'Email verification delivery is unavailable' });
  }

  res.json({ ok: true, message: `Verification code sent to ${target}` });
};
