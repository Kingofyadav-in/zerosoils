const { requireAuth } = require('../_auth');
const { getPool } = require('../_db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const auth = requireAuth(req, res);
  if (!auth) return;
  if (auth.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });

  try {
    const pool = getPool();
    const [users, hdis, wallets, licences, txs, waitlist] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM users WHERE hdi_code IS NOT NULL'),
      pool.query('SELECT COUNT(*), COALESCE(SUM(balance),0) AS total_zs FROM zs_wallets'),
      pool.query("SELECT COUNT(*) FROM hdi_licences WHERE status='active'"),
      pool.query('SELECT COUNT(*) FROM zs_transactions'),
      pool.query('SELECT COUNT(*) FROM waitlist'),
    ]);

    const emailVerified = await pool.query('SELECT COUNT(*) FROM users WHERE email_verified=TRUE');
    const phoneVerified = await pool.query('SELECT COUNT(*) FROM users WHERE phone_verified=TRUE');
    const devices       = await pool.query('SELECT COUNT(*) FROM hdi_devices');
    const newToday      = await pool.query("SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '24 hours'");
    const newThisWeek   = await pool.query("SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '7 days'");

    res.json({
      users:          Number(users.rows[0].count),
      hdisIssued:     Number(hdis.rows[0].count),
      emailVerified:  Number(emailVerified.rows[0].count),
      phoneVerified:  Number(phoneVerified.rows[0].count),
      walletsActive:  Number(wallets.rows[0].count),
      totalZsInCirculation: Number(wallets.rows[0].total_zs),
      activeLicences: Number(licences.rows[0].count),
      transactions:   Number(txs.rows[0].count),
      waitlistCount:  Number(waitlist.rows[0].count),
      devicesEnrolled: Number(devices.rows[0].count),
      newUsersToday:  Number(newToday.rows[0].count),
      newUsersThisWeek: Number(newThisWeek.rows[0].count),
      generatedAt:    new Date().toISOString(),
    });
  } catch (err) {
    console.error('[admin/stats]', err.message);
    res.status(500).json({ error: 'Unable to fetch stats. Try again later.' });
  }
};
