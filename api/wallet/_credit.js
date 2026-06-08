const crypto = require('crypto');
const { requireAuth } = require('../_auth');
const { getPool } = require('../_db');

const ALLOWED_TYPES = new Set([
  'Genesis ZS',
  'Email verification reward',
  'Phone verification reward',
  'Device enrollment reward',
  'Community trust reward',
]);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = requireAuth(req, res);
  if (!auth) return;
  if (auth.role !== 'admin') {
    return res.status(403).json({ error: 'Direct wallet credits require administrator access.' });
  }

  const { type, amount, note, requestId } = req.body || {};
  if (!ALLOWED_TYPES.has(type)) return res.status(400).json({ error: 'Invalid credit type.' });
  const amt = Number(amount);
  if (!Number.isInteger(amt) || amt < 1 || amt > 10) return res.status(400).json({ error: 'Amount must be 1–10.' });

  try {
    const pool = getPool();

    // Idempotency — same requestId never credits twice
    if (requestId) {
      const dup = await pool.query(
        'SELECT id FROM zs_transactions WHERE request_id=$1',
        [String(requestId)]
      );
      if (dup.rows.length) return res.json({ ok: true, duplicate: true });
    }

    const userResult = await pool.query(
      'SELECT hdi_code FROM users WHERE id=$1',
      [auth.id]
    );
    if (!userResult.rows[0]?.hdi_code) return res.status(403).json({ error: 'HDI required.' });

    const hdi_code = userResult.rows[0].hdi_code;
    const address  = 'zsw_' + hdi_code.toLowerCase().replace(/-/g, '_');

    const wallet = await pool.query(
      `INSERT INTO zs_wallets (user_id, owner_hdi, address, balance)
       VALUES ($1,$2,$3,0)
       ON CONFLICT (user_id) DO UPDATE SET updated_at=NOW()
       RETURNING *`,
      [auth.id, hdi_code, address]
    );
    const w = wallet.rows[0];

    if (w.balance + amt > 99) return res.status(409).json({ error: 'Maximum ZS supply reached (99).' });

    const newBalance = w.balance + amt;
    const raw = [hdi_code, type, 'credit', amt, newBalance, Date.now()].join('|');
    const vhash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);

    const updated = await pool.query(
      `UPDATE zs_wallets SET balance=$1, updated_at=NOW() WHERE id=$2 AND balance=$3 RETURNING balance`,
      [newBalance, w.id, w.balance]
    );
    if (!updated.rows.length) return res.status(409).json({ error: 'Wallet updated concurrently. Retry.' });

    await pool.query(
      `INSERT INTO zs_transactions (wallet_id, request_id, type, direction, amount, balance_after, note, verification_hash)
       VALUES ($1,$2,$3,'credit',$4,$5,$6,$7)`,
      [w.id, requestId || null, type, amt, newBalance, note || '', vhash]
    );

    res.json({ ok: true, balance: newBalance, amount: amt });
  } catch (err) {
    console.error('[wallet/credit]', err.message);
    res.status(500).json({ error: 'Credit failed. Try again later.' });
  }
};
