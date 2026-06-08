const crypto = require('crypto');

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_KEY_LENGTH = 64;

function appSecret() {
  const configured = process.env.APP_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('APP_SECRET must be configured with at least 32 characters');
  }
  return 'local-development-secret-change-before-production';
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizePhone(phone) {
  const normalized = String(phone || '').replace(/[\s\-()]/g, '');
  return /^\+?[1-9]\d{7,14}$/.test(normalized) ? normalized : '';
}

function initials(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0))
    .join('')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 3)
    .toUpperCase() || 'HDI';
}

function identitySlug(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 20) || 'human';
}

function issuePermanentIdentity({ name, phone, email }) {
  const issuedAt = new Date();
  const nonce = crypto.randomBytes(24).toString('hex');
  const canonical = [
    String(name || '').trim().toLowerCase().replace(/\s+/g, ' '),
    normalizePhone(phone),
    normalizeEmail(email),
    nonce,
  ].join('|');
  const digest = crypto.createHmac('sha256', appSecret()).update(canonical).digest('hex').toUpperCase();
  return {
    username: `${identitySlug(name)}.${digest.slice(0, 8).toLowerCase()}`,
    hdiCode: `${initials(name)}-${issuedAt.getFullYear()}-${digest.slice(0, 6)}`,
    issuedAt,
    version: 'zs-hdi-v1',
  };
}

function sign(payload) {
  const now = Math.floor(Date.now() / 1000);
  const claims = { ...payload, iat: now, exp: now + TOKEN_TTL_SECONDS };
  const data = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig = crypto.createHmac('sha256', appSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verify(token) {
  if (!token) return null;
  const [data, sig] = String(token).split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', appSecret()).update(data).digest('base64url');
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (!Number.isInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
  }).toString('hex');
  return { salt, passwordHash: `scrypt$${SCRYPT_COST}$${hash}` };
}

function checkPassword(password, user) {
  const stored = String(user?.password_hash || '');
  const salt = String(user?.salt || '');
  if (stored.startsWith('scrypt$')) {
    const [, costText, expected] = stored.split('$');
    const cost = Number(costText);
    if (!Number.isInteger(cost) || !expected) return { valid: false, needsUpgrade: false };
    const candidate = crypto.scryptSync(String(password), salt, SCRYPT_KEY_LENGTH, {
      N: cost,
      r: SCRYPT_BLOCK_SIZE,
      p: SCRYPT_PARALLELIZATION,
    }).toString('hex');
    return { valid: safeEqual(candidate, expected), needsUpgrade: false };
  }

  // Existing prototype accounts are upgraded to scrypt after a valid login.
  const legacy = crypto.createHash('sha256').update(String(password) + salt).digest('hex');
  return { valid: safeEqual(legacy, stored), needsUpgrade: safeEqual(legacy, stored) };
}

function otpHash(userId, type, code) {
  return crypto
    .createHmac('sha256', appSecret())
    .update(`${userId}|${type}|${String(code)}`)
    .digest('hex');
}

function matchesOtp(userId, type, code, expectedHash) {
  return safeEqual(otpHash(userId, type, code), expectedHash);
}

function requireAuth(req, res) {
  let payload = null;
  try {
    const auth = req.headers.authorization || '';
    payload = verify(auth.replace(/^Bearer\s+/i, ''));
  } catch {
    res.status(500).json({ error: 'Authentication is not configured' });
    return null;
  }
  if (!payload) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return payload;
}

module.exports = {
  sign,
  verify,
  requireAuth,
  normalizeEmail,
  normalizePhone,
  issuePermanentIdentity,
  createPasswordHash,
  checkPassword,
  otpHash,
  matchesOtp,
};
