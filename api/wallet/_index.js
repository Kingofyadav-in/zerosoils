const { requireAuth } = require('../_auth');
const { getPool } = require('../_db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const auth = requireAuth(req, res);
  if (!auth) return;

  try {
    const pool = getPool();

    const userResult = await pool.query(
      'SELECT hdi_code, name FROM users WHERE id=$1',
      [auth.id]
    );
    const user = userResult.rows[0];
    if (!user?.hdi_code) return res.status(403).json({ error: 'HDI required to access wallet.' });

    let walletResult = await pool.query(
      'SELECT * FROM zs_wallets WHERE user_id=$1',
      [auth.id]
    );

    // Auto-create wallet on first access
    if (!walletResult.rows.length) {
      const address = 'zsw_' + user.hdi_code.toLowerCase().replace(/-/g, '_');
      walletResult = await pool.query(
        `INSERT INTO zs_wallets (user_id, owner_hdi, address, balance)
         VALUES ($1,$2,$3,0) ON CONFLICT (user_id) DO UPDATE SET updated_at=NOW()
         RETURNING *`,
        [auth.id, user.hdi_code, address]
      );
    }

    const wallet = walletResult.rows[0];
    const txResult = await pool.query(
      `SELECT id, type, direction, amount, balance_after, note, created_at
         FROM zs_transactions WHERE wallet_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [wallet.id]
    );

    res.json({
      address:    wallet.address,
      ownerHdi:   wallet.owner_hdi,
      balance:    wallet.balance,
      maxSupply:  99,
      createdAt:  wallet.created_at,
      updatedAt:  wallet.updated_at,
      transactions: txResult.rows.map(t => ({
        id:         String(t.id),
        type:       t.type,
        direction:  t.direction,
        amount:     t.amount,
        balance:    t.balance_after,
        note:       t.note,
        createdAt:  t.created_at,
      })),
    });
  } catch (err) {
    console.error('[wallet/index]', err.message);
    res.status(500).json({ error: 'Unable to load wallet. Try again later.' });
  }
};
