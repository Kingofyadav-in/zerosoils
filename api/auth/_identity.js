const { issuePermanentIdentity } = require('../_auth');

async function issueIdentityIfVerified(pool, userId) {
  const { rows } = await pool.query(
    `SELECT id, email, name, username, phone, role, hdi_code, hdi_generated_at,
            hdi_version, email_verified, phone_verified, created_at
       FROM users WHERE id=$1`,
    [userId]
  );
  let user = rows[0];
  if (!user || user.hdi_code || !user.email_verified || !user.phone_verified || !user.phone) return user;

  for (let attempt = 0; attempt < 3; attempt++) {
    const identity = issuePermanentIdentity({ name:user.name, phone:user.phone, email:user.email });
    try {
      const issued = await pool.query(
        `UPDATE users
            SET username=$1, hdi_code=$2, hdi_generated_at=$3, hdi_version=$4
          WHERE id=$5 AND hdi_code IS NULL AND email_verified=TRUE AND phone_verified=TRUE
          RETURNING id, email, name, username, phone, role, hdi_code, hdi_generated_at,
                    hdi_version, email_verified, phone_verified, created_at`,
        [identity.username, identity.hdiCode, identity.issuedAt, identity.version, userId]
      );
      if (issued.rows.length) return issued.rows[0];
      const current = await pool.query(
        `SELECT id, email, name, username, phone, role, hdi_code, hdi_generated_at,
                hdi_version, email_verified, phone_verified, created_at
           FROM users WHERE id=$1`,
        [userId]
      );
      return current.rows[0];
    } catch (err) {
      if (err.code !== '23505' || attempt === 2) throw err;
    }
  }
  return user;
}

module.exports = { issueIdentityIfVerified };
