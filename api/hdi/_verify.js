const { getPool } = require('../_db');

// Public HDI verification — returns only safe fields (no email/phone)
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const code = String(req.query?.code || new URL(req.url, 'http://x').searchParams.get('code') || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'HDI code required' });
  if (!/^[A-Z]{1,3}-\d{4}-[0-9A-F]{6}$/.test(code)) {
    return res.status(400).json({ error: 'Invalid HDI format. Expected: INITIALS-YEAR-HEX6' });
  }

  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT username, hdi_code, hdi_generated_at, email_verified, phone_verified
       FROM users WHERE hdi_code = $1`,
      [code]
    );

    if (!rows.length) {
      return res.status(200).json({ found: false, hdiCode: code });
    }

    const u = rows[0];
    const verificationLevel =
      u.email_verified && u.phone_verified ? 'silver' :
      u.email_verified ? 'bronze' : 'bronze';

    res.status(200).json({
      found:             true,
      hdiCode:           u.hdi_code,
      username:          u.username || null,
      issuedAt:          u.hdi_generated_at || null,
      verificationLevel,
      emailVerified:     Boolean(u.email_verified),
      phoneVerified:     Boolean(u.phone_verified),
    });
  } catch (err) {
    console.error('[hdi/verify]', err.message);
    res.status(500).json({ error: 'Lookup failed. Try again later.' });
  }
};
