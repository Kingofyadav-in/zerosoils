const crypto = require('crypto');
const { requireAuth } = require('../_auth');
const { getPool } = require('../_db');

const CONTENT_TYPES = new Set(['text','image','video','audio','code','dataset','design','other']);
const LICENCE_TYPES = new Set(['personal','share','open','commercial','nft','ai-training']);

function licenceId(hdiCode) {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  const prefix = (hdiCode || 'ZS').split('-')[0];
  return `ZSL-${prefix}-${ts}-${rand}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { title, contentType, licenceType, contentHash, metadata } = req.body || {};

  if (!title || String(title).trim().length < 2) return res.status(400).json({ error: 'Title required (min 2 chars).' });
  if (!CONTENT_TYPES.has(contentType)) return res.status(400).json({ error: 'Invalid content type.' });
  if (!LICENCE_TYPES.has(licenceType)) return res.status(400).json({ error: 'Invalid licence type.' });

  const cleanTitle       = String(title).trim().slice(0, 200);
  const cleanContentHash = String(contentHash || '').slice(0, 64) || crypto.randomBytes(16).toString('hex');

  try {
    const pool = getPool();
    const userResult = await pool.query('SELECT hdi_code FROM users WHERE id=$1', [auth.id]);
    const hdi_code = userResult.rows[0]?.hdi_code;
    if (!hdi_code) return res.status(403).json({ error: 'Permanent HDI required to issue licences.' });

    // Rate limit: max 10 active licences per day
    const recent = await pool.query(
      `SELECT COUNT(*) FROM hdi_licences
         WHERE user_id=$1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [auth.id]
    );
    if (Number(recent.rows[0].count) >= 10) {
      return res.status(429).json({ error: 'Licence limit: max 10 per 24 hours.' });
    }

    const lid = licenceId(hdi_code);
    const raw = [lid, hdi_code, cleanTitle, contentType, licenceType, cleanContentHash].join('|');
    const vhash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);

    const { rows } = await pool.query(
      `INSERT INTO hdi_licences
         (user_id, licence_id, owner_hdi, title, content_type, licence_type, content_hash, verification_hash, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING licence_id, owner_hdi, title, content_type, licence_type, content_hash, status, created_at`,
      [auth.id, lid, hdi_code, cleanTitle, contentType, licenceType, cleanContentHash, vhash, metadata || {}]
    );

    res.status(201).json({ ok: true, licence: {
      licenceId:   rows[0].licence_id,
      ownerHdi:    rows[0].owner_hdi,
      title:       rows[0].title,
      contentType: rows[0].content_type,
      licenceType: rows[0].licence_type,
      contentHash: rows[0].content_hash,
      status:      rows[0].status,
      createdAt:   rows[0].created_at,
    }});
  } catch (err) {
    console.error('[licences/create]', err.message);
    res.status(500).json({ error: 'Unable to create licence. Try again later.' });
  }
};
