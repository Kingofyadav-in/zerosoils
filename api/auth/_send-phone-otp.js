const { getPool }     = require('../_db');
const { requireAuth, otpHash } = require('../_auth');
const crypto          = require('crypto');

function webOtpHost(req) {
  const forwarded = req.headers['x-forwarded-host'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || req.headers.host || '').split(',')[0].trim();
  return /^[a-z0-9.-]+(?::\d{1,5})?$/i.test(raw) ? raw : '';
}

async function sendSMS(phone, otp, host) {
  const body = `Your Zero Soils verification code: ${otp}. Expires in 10 minutes.${host ? `\n\n@${host} #${otp}` : ''}`;
  // Plug in Twilio, MSG91, Fast2SMS, or any SMS provider here
  // Example with Twilio (set TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM in .env):
  if (process.env.TWILIO_SID) {
    const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    await twilio.messages.create({
      body,
      from: process.env.TWILIO_FROM,
      to:   phone,
    });
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMS delivery is not configured');
    }
    // Local development only.
    console.log(`[DEV] Phone OTP for ${phone}:\n${body}`);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = requireAuth(req, res);
  if (!user) return;

  const pool = getPool();
  const { rows: users } = await pool.query('SELECT phone FROM users WHERE id=$1', [user.id]);
  const clean = String(users[0]?.phone || '').replace(/[\s\-()]/g, '');
  if (!clean || !/^\+?[1-9]\d{7,14}$/.test(clean)) {
    return res.status(400).json({ error: 'Registered mobile number is missing or invalid' });
  }
  const otp     = crypto.randomInt(100000, 1000000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000);

  await pool.query(
    'UPDATE otp_tokens SET used=TRUE WHERE user_id=$1 AND type=$2 AND used=FALSE',
    [user.id, 'phone']
  );

  await pool.query(
    'INSERT INTO otp_tokens (user_id, type, target, code_hash, expires_at) VALUES ($1,$2,$3,$4,$5)',
    [user.id, 'phone', clean, otpHash(user.id, 'phone', otp), expires]
  );

  try {
    await sendSMS(clean, otp, webOtpHost(req));
  } catch {
    return res.status(503).json({ error: 'Phone verification delivery is unavailable' });
  }

  res.json({ ok: true, message: `Code sent to ${clean.slice(0, -4).replace(/./g, '*') + clean.slice(-4)}` });
};
