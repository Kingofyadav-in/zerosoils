const { requireAuth } = require('../_auth');
const { getPool } = require('../_db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const auth = requireAuth(req, res);
  if (!auth) return;
  try {
    const { rows } = await getPool().query(
      `SELECT device_id, fingerprint, label, first_ip, last_ip, verified_at, last_seen_at, created_at
         FROM hdi_devices WHERE user_id=$1 ORDER BY created_at ASC LIMIT 10`,
      [auth.id]
    );
    res.json({ devices: rows.map(d => ({
      id:          d.device_id,
      fingerprint: d.fingerprint,
      label:       d.label,
      firstIp:     d.first_ip,
      lastIp:      d.last_ip,
      verifiedAt:  d.verified_at,
      lastSeenAt:  d.last_seen_at,
      enrolledAt:  d.created_at,
    })) });
  } catch (err) {
    console.error('[auth/devices]', err.message);
    res.status(500).json({ error: 'Unable to fetch devices. Try again later.' });
  }
};
