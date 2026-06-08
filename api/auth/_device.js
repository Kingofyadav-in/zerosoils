const crypto = require('crypto');
const { requireAuth } = require('../_auth');
const { getPool } = require('../_db');

function requestIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '').split(',')[0].trim();
  return String(value || req.socket?.remoteAddress || 'Unavailable').slice(0, 80);
}

function publicKeyFingerprint(jwk) {
  if (!jwk || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.x || !jwk.y) {
    throw new Error('Invalid device public key');
  }
  crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const digest = crypto.createHash('sha256')
    .update(`${jwk.kty}|${jwk.crv}|${jwk.x}|${jwk.y}`)
    .digest('hex')
    .toUpperCase()
    .slice(0, 32);
  return digest.match(/.{1,4}/g).join('-');
}

function devicePayload(device) {
  return {
    id: device.device_id,
    fingerprint: device.fingerprint,
    label: device.label,
    firstIp: device.first_ip,
    lastIp: device.last_ip,
    verifiedAt: device.verified_at,
    lastSeenAt: device.last_seen_at,
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = requireAuth(req, res);
  if (!auth) return;
  const { action, deviceId } = req.body || {};
  if (!/^[a-f0-9-]{36}$/i.test(String(deviceId || ''))) {
    return res.status(400).json({ error: 'Valid device ID required' });
  }

  const pool = getPool();
  const userResult = await pool.query('SELECT hdi_code FROM users WHERE id=$1', [auth.id]);
  if (!userResult.rows[0]?.hdi_code) {
    return res.status(403).json({ error: 'Complete HDI verification before device enrollment.' });
  }
  const ip = requestIp(req);

  if (action === 'enroll') {
    let fingerprint;
    try {
      fingerprint = publicKeyFingerprint(req.body?.publicKey);
    } catch {
      return res.status(400).json({ error: 'Valid device public key required' });
    }
    const existing = await pool.query(
      'SELECT * FROM hdi_devices WHERE user_id=$1 AND device_id=$2',
      [auth.id, deviceId]
    );
    if (existing.rows.length) {
      if (existing.rows[0].fingerprint !== fingerprint) {
        return res.status(409).json({ error: 'Device key does not match enrolled credential.' });
      }
      return res.json({ ok: true, device: devicePayload(existing.rows[0]) });
    }
    const enrolled = await pool.query('SELECT id FROM hdi_devices WHERE user_id=$1 LIMIT 1', [auth.id]);
    if (enrolled.rows.length) {
      return res.status(403).json({ error: 'A primary device is already enrolled. New device approval is required.' });
    }
    const label = String(req.body?.label || 'Browser device').slice(0, 80);
    let inserted;
    try {
      inserted = await pool.query(
        `INSERT INTO hdi_devices (user_id, device_id, public_key, fingerprint, label, first_ip, last_ip, last_seen_at)
         VALUES ($1,$2,$3,$4,$5,$6,$6,NOW())
         RETURNING *`,
        [auth.id, deviceId, req.body.publicKey, fingerprint, label, ip]
      );
    } catch (err) {
      if (err.code === '23505') {
        return res.status(403).json({ error: 'A primary device is already enrolled. New device approval is required.' });
      }
      throw err;
    }
    await pool.query(
      'UPDATE users SET hdi_device_fp=COALESCE(hdi_device_fp, $1) WHERE id=$2',
      [fingerprint, auth.id]
    );
    return res.status(201).json({ ok: true, enrolled: true, device: devicePayload(inserted.rows[0]) });
  }

  const deviceResult = await pool.query(
    'SELECT * FROM hdi_devices WHERE user_id=$1 AND device_id=$2',
    [auth.id, deviceId]
  );
  const device = deviceResult.rows[0];
  if (!device) return res.status(403).json({ error: 'This device is not enrolled.' });

  if (action === 'challenge') {
    const challengeId = crypto.randomUUID();
    const challenge = crypto.randomBytes(32).toString('base64url');
    await pool.query(
      `INSERT INTO hdi_device_challenges (id, user_id, device_id, challenge, expires_at)
       VALUES ($1,$2,$3,$4,NOW() + INTERVAL '5 minutes')`,
      [challengeId, auth.id, deviceId, challenge]
    );
    return res.json({ ok: true, challengeId, challenge });
  }

  if (action === 'verify') {
    const { challengeId, signature } = req.body || {};
    const result = await pool.query(
      `SELECT challenge FROM hdi_device_challenges
       WHERE id=$1 AND user_id=$2 AND device_id=$3 AND used=FALSE AND expires_at > NOW()`,
      [challengeId, auth.id, deviceId]
    );
    if (!result.rows.length) return res.status(400).json({ error: 'Device challenge is invalid or expired.' });
    let valid = false;
    try {
      const key = crypto.createPublicKey({ key: device.public_key, format: 'jwk' });
      valid = crypto.verify(
        'sha256',
        Buffer.from(result.rows[0].challenge),
        { key, dsaEncoding: 'ieee-p1363' },
        Buffer.from(String(signature || ''), 'base64url')
      );
    } catch {
      valid = false;
    }
    await pool.query('UPDATE hdi_device_challenges SET used=TRUE WHERE id=$1', [challengeId]);
    if (!valid) return res.status(401).json({ error: 'Device signature verification failed.' });
    const updated = await pool.query(
      `UPDATE hdi_devices SET last_ip=$1, last_seen_at=NOW(), verified_at=NOW()
       WHERE user_id=$2 AND device_id=$3 RETURNING *`,
      [ip, auth.id, deviceId]
    );
    return res.json({ ok: true, verified: true, device: devicePayload(updated.rows[0]) });
  }

  return res.status(400).json({ error: 'Unsupported device action' });
};
