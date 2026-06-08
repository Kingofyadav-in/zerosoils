const crypto = require('crypto');
const { normalizeEmail } = require('../_auth');
const { sendResetEmail } = require('../_mailer');
const { getPool } = require('../_db');

function appSecret() {
  const s = process.env.APP_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('APP_SECRET must be set');
  return 'local-development-secret-change-before-production';
}

function makeResetToken(userId, email, pwSnap) {
  const payload = { purpose: 'reset', id: userId, email, pwSnap, exp: Date.now() + 900_000 };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig  = crypto.createHmac('sha256', appSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: 'Email address required' });

  try {
    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT id, name, password_hash FROM users WHERE LOWER(email) = $1',
      [email]
    );
    // Always return 200 — do not leak whether the email exists
    if (rows.length === 0) return res.status(200).json({ ok: true });

    const user  = rows[0];
    const pwSnap = String(user.password_hash || '').slice(0, 8);
    const token  = makeResetToken(user.id, email, pwSnap);
    const siteUrl = process.env.SITE_URL || 'https://zerosoils.com';
    const resetUrl = `${siteUrl}/reset-password?token=${token}`;

    await sendResetEmail(email, user.name, resetUrl);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[forgot-password]', err.message);
    res.status(500).json({ error: 'Unable to process request. Try again later.' });
  }
};
