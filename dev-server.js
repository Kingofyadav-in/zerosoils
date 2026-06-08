const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizePhone, issuePermanentIdentity } = require('./api/_auth');

const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

// In-memory auth store for local dev
const users = new Map();
const otpTokens = new Map();
const deviceCredentials = new Map();
const deviceChallenges = new Map();
const wallets  = new Map();
const licences = [];

// Community in-memory stores
const commPosts    = [];         // [{ id, userId, authorHdi, authorName, authorTier, body, likes, trusts, reports, hidden, createdAt }]
const commReacts   = new Map();  // key: `${userId}:${postId}:type` → true
const commComments = [];         // [{ id, postId, userId, authorHdi, authorName, body, createdAt }]
const commReports  = new Set();  // key: `${userId}:post:${postId}` or `${userId}:comment:${cid}`
let   commNextId   = 1;
let   commCmtId    = 1;

// Seed 3 founding-member posts for dev
const _now = new Date();
commPosts.push(
  { id:commNextId++, userId:0, authorHdi:'RYS-2026-1A2B3C', authorName:'Riya Sharma',  authorTier:'truth',  body:'The internet needs more spaces where people show up as themselves. No filters, no fake reach. This is why HDI matters.',                         likes:42, trusts:18, reports:0, hidden:false, createdAt:new Date(_now-7200000).toISOString() },
  { id:commNextId++, userId:0, authorHdi:'DVK-2026-4D5E6F', authorName:'Dev Kapoor',   authorTier:'gold',   body:'Just completed Gold verification on Zero Soils. Having a verified digital identity that actually means something feels completely different.', likes:29, trusts:31, reports:0, hidden:false, createdAt:new Date(_now-18000000).toISOString() },
  { id:commNextId++, userId:0, authorHdi:'ANM-2026-7G8H9I', authorName:'Anjali Mehta', authorTier:'silver', body:'Social media rewards noise over truth. Zero Soils is trying something different — identity first, content second. Here for it.',              likes:17, trusts:12, reports:0, hidden:false, createdAt:new Date(_now-86400000).toISOString() }
);

function sign(payload) {
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 7 * 86400000 })).toString('base64url');
  return `${data}.localdev`;
}

function verify(token) {
  if (!token || !token.endsWith('.localdev')) return null;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
    return payload.exp > Date.now() ? payload : null;
  }
  catch { return null; }
}

function requestUser(req) {
  return verify((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
}

function localPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}

function publicUser(user) {
  return {
    id:user.id, email:user.email, name:user.name, username:user.username, phone:user.phone,
    role:user.role, hdi_code:user.hdi_code, email_verified:Boolean(user.email_verified),
    phone_verified:Boolean(user.phone_verified),
  };
}

function issueLocalIdentity(user) {
  if (!user.hdi_code && user.email_verified && user.phone_verified) {
    const issued = issuePermanentIdentity(user);
    user.username = issued.username;
    user.hdi_code = issued.hdiCode;
    user.hdi_version = issued.version;
  }
  return user;
}

function clientIp(req) {
  return String(req.socket.remoteAddress || 'Unavailable').slice(0, 80);
}

function deviceFingerprint(jwk) {
  if (!jwk || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.x || !jwk.y) return '';
  try { crypto.createPublicKey({ key: jwk, format: 'jwk' }); } catch { return ''; }
  const digest = crypto.createHash('sha256')
    .update(`${jwk.kty}|${jwk.crv}|${jwk.x}|${jwk.y}`)
    .digest('hex')
    .toUpperCase()
    .slice(0, 32);
  return digest.match(/.{1,4}/g).join('-');
}

function publicDevice(device) {
  return {
    id:device.deviceId, fingerprint:device.fingerprint, label:device.label,
    firstIp:device.firstIp, lastIp:device.lastIp, verifiedAt:device.verifiedAt,
    lastSeenAt:device.lastSeenAt,
  };
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  try { return JSON.parse(body); } catch { return {}; }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // ── API routes ────────────────────────────────────────────────
  if (p.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');

    // POST /api/auth/register
    if (p === '/api/auth/register' && req.method === 'POST') {
      let { email, password, name, phone } = await readBody(req);
      email = String(email || '').trim().toLowerCase();
      phone = normalizePhone(phone);
      name = String(name || '').trim().slice(0, 120);
      if (name.length < 2) { res.writeHead(400); return res.end(JSON.stringify({ error: 'Full name required' })); }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.writeHead(400); return res.end(JSON.stringify({ error: 'Valid email required' })); }
      if (!password || String(password).length < 8 || String(password).length > 128) { res.writeHead(400); return res.end(JSON.stringify({ error: 'Password must be between 8 and 128 characters' })); }
      if (!phone) { res.writeHead(400); return res.end(JSON.stringify({ error: 'Valid mobile number required with country code' })); }
      if (users.has(email)) { res.writeHead(409); return res.end(JSON.stringify({ error: 'Email already registered' })); }
      const salt = crypto.randomBytes(16).toString('hex');
      users.set(email, { id: users.size + 1, email, name, phone, salt, passwordHash: localPassword(password, salt), role: 'user', email_verified:false, phone_verified:false, createdAt:new Date().toISOString() });
      const user = users.get(email);
      const token = sign({ id: user.id, email, role: user.role });
      res.writeHead(201);
      return res.end(JSON.stringify({ token, user: publicUser(user) }));
    }

    // POST /api/auth/login
    if (p === '/api/auth/login' && req.method === 'POST') {
      let { email, password } = await readBody(req);
      email = String(email || '').trim().toLowerCase();
      const user = users.get(email);
      if (!user || user.passwordHash !== localPassword(password, user.salt)) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Invalid credentials' })); }
      const token = sign({ id: user.id, email, role: user.role });
      res.writeHead(200);
      return res.end(JSON.stringify({ token, user: publicUser(user) }));
    }

    // GET /api/auth/me
    if (p === '/api/auth/me' && req.method === 'GET') {
      const payload = requestUser(req);
      if (!payload) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Unauthorized' })); }
      const stored = users.get(payload.email);
      if (!stored) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Session expired. Please sign in again.' })); }
      res.writeHead(200);
      return res.end(JSON.stringify({ user: publicUser(stored) }));
    }

    if (p === '/api/auth/device' && req.method === 'POST') {
      const payload = requestUser(req);
      if (!payload) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Unauthorized' })); }
      const user = users.get(payload.email);
      if (!user) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Session expired. Please sign in again.' })); }
      if (!user.hdi_code) { res.writeHead(403); return res.end(JSON.stringify({ error: 'Complete HDI verification before device enrollment.' })); }
      const body = await readBody(req);
      const deviceId = String(body.deviceId || '');
      if (!/^[a-f0-9-]{36}$/i.test(deviceId)) { res.writeHead(400); return res.end(JSON.stringify({ error:'Valid device ID required' })); }
      const key = `${payload.id}:${deviceId}`;
      const action = body.action;
      const ip = clientIp(req);

      if (action === 'enroll') {
        const fingerprint = deviceFingerprint(body.publicKey);
        if (!fingerprint) { res.writeHead(400); return res.end(JSON.stringify({ error:'Valid device public key required' })); }
        const existing = deviceCredentials.get(key);
        if (existing) {
          if (existing.fingerprint !== fingerprint) { res.writeHead(409); return res.end(JSON.stringify({ error:'Device key does not match enrolled credential.' })); }
          return res.end(JSON.stringify({ ok:true, device:publicDevice(existing) }));
        }
        const hasPrimary = Array.from(deviceCredentials.values()).some(device => device.userId === payload.id);
        if (hasPrimary) { res.writeHead(403); return res.end(JSON.stringify({ error:'A primary device is already enrolled. New device approval is required.' })); }
        const device = {
          userId:payload.id, deviceId, publicKey:body.publicKey, fingerprint,
          label:String(body.label || 'Browser device').slice(0, 80), firstIp:ip, lastIp:ip,
          lastSeenAt:new Date().toISOString(), verifiedAt:null,
        };
        deviceCredentials.set(key, device);
        user.hdi_device_fp = fingerprint;
        res.writeHead(201);
        return res.end(JSON.stringify({ ok:true, enrolled:true, device:publicDevice(device) }));
      }

      const device = deviceCredentials.get(key);
      if (!device) { res.writeHead(403); return res.end(JSON.stringify({ error:'This device is not enrolled.' })); }
      if (action === 'challenge') {
        const challengeId = crypto.randomUUID();
        const challenge = crypto.randomBytes(32).toString('base64url');
        deviceChallenges.set(challengeId, { userId:payload.id, deviceId, challenge, expiresAt:Date.now() + 300000, used:false });
        return res.end(JSON.stringify({ ok:true, challengeId, challenge }));
      }
      if (action === 'verify') {
        const challenge = deviceChallenges.get(String(body.challengeId || ''));
        if (!challenge || challenge.used || challenge.expiresAt <= Date.now() || challenge.userId !== payload.id || challenge.deviceId !== deviceId) {
          res.writeHead(400);
          return res.end(JSON.stringify({ error:'Device challenge is invalid or expired.' }));
        }
        challenge.used = true;
        let verified = false;
        try {
          const publicKey = crypto.createPublicKey({ key: device.publicKey, format:'jwk' });
          verified = crypto.verify('sha256', Buffer.from(challenge.challenge), { key:publicKey, dsaEncoding:'ieee-p1363' }, Buffer.from(String(body.signature || ''), 'base64url'));
        } catch {}
        if (!verified) { res.writeHead(401); return res.end(JSON.stringify({ error:'Device signature verification failed.' })); }
        device.lastIp = ip;
        device.lastSeenAt = new Date().toISOString();
        device.verifiedAt = device.lastSeenAt;
        return res.end(JSON.stringify({ ok:true, verified:true, device:publicDevice(device) }));
      }
      res.writeHead(400);
      return res.end(JSON.stringify({ error:'Unsupported device action' }));
    }

    if (p === '/api/auth/devices' && req.method === 'GET') {
      const payload = requestUser(req);
      if (!payload) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Unauthorized' })); }
      const userDevices = Array.from(deviceCredentials.values())
        .filter(d => d.userId === payload.id)
        .map(d => ({
          id: d.deviceId, fingerprint: d.fingerprint, label: d.label,
          firstIp: d.firstIp, lastIp: d.lastIp,
          verifiedAt: d.verifiedAt, lastSeenAt: d.lastSeenAt, enrolledAt: d.lastSeenAt,
        }));
      return res.end(JSON.stringify({ devices: userDevices }));
    }

    if (p === '/api/auth/save-hdi' && req.method === 'POST') {
      const payload = requestUser(req);
      if (!payload) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Unauthorized' })); }
      const user = users.get(payload.email);
      if (!user) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Session expired. Please sign in again.' })); }
      if (user.hdi_code) return res.end(JSON.stringify({ ok:true, username:user.username, hdi_code:user.hdi_code, already_set:true }));
      res.writeHead(409);
      return res.end(JSON.stringify({ error:'Permanent HDI must be issued after verification.' }));
    }

    if ((p === '/api/auth/send-email-otp' || p === '/api/auth/send-phone-otp') && req.method === 'POST') {
      const payload = requestUser(req);
      if (!payload) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Unauthorized' })); }
      const user = users.get(payload.email);
      if (!user) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Session expired. Please sign in again.' })); }
      const type = p.includes('email') ? 'email' : 'phone';
      const target = type === 'email' ? user.email : user.phone;
      if (type === 'phone' && !/^\+?[1-9]\d{7,14}$/.test(target)) { res.writeHead(400); return res.end(JSON.stringify({ error:'Valid phone number required' })); }
      const code = crypto.randomInt(100000, 1000000).toString();
      otpTokens.set(`${payload.id}:${type}`, { code, target, expiresAt:Date.now() + 600000, attempts:0 });
      console.log(`[DEV] ${type} OTP for ${target}: ${code}`);
      return res.end(JSON.stringify({ ok:true, dev_code:code, message:`Verification code sent to ${type === 'email' ? target : target.slice(-4).padStart(target.length, '*')}` }));
    }

    if ((p === '/api/auth/verify-email-otp' || p === '/api/auth/verify-phone-otp') && req.method === 'POST') {
      const payload = requestUser(req);
      if (!payload) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Unauthorized' })); }
      const user = users.get(payload.email);
      if (!user) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Session expired. Please sign in again.' })); }
      const type = p.includes('email') ? 'email' : 'phone';
      const { code } = await readBody(req);
      const token = otpTokens.get(`${payload.id}:${type}`);
      if (!token || token.expiresAt <= Date.now() || token.attempts >= 5 || token.code !== code) {
        if (token) token.attempts++;
        res.writeHead(400);
        return res.end(JSON.stringify({ error:'Invalid or expired code' }));
      }
      otpTokens.delete(`${payload.id}:${type}`);
      if (type === 'email') user.email_verified = true;
      else {
        const alreadyLinked = Array.from(users.values()).some(candidate =>
          candidate.id !== user.id && candidate.phone_verified && candidate.phone === token.target
        );
        if (alreadyLinked) {
          res.writeHead(409);
          return res.end(JSON.stringify({ error:'This mobile number is already linked to another verified identity.' }));
        }
        user.phone_verified = true;
        user.phone = token.target;
      }
      issueLocalIdentity(user);
      return res.end(JSON.stringify({ ok:true, message:`${type} verified successfully`, user:publicUser(user) }));
    }

    // POST /api/auth/forgot-password
    if (p === '/api/auth/forgot-password' && req.method === 'POST') {
      const { email } = await readBody(req);
      const norm = String(email || '').trim().toLowerCase();
      const user = users.get(norm);
      if (user) {
        const token = Buffer.from(JSON.stringify({ purpose:'reset', email: norm, exp: Date.now() + 900_000 })).toString('base64url');
        console.log(`[DEV] Password reset link: http://localhost:${Number(process.env.PORT||4000)}/reset-password?token=${token}`);
      }
      res.writeHead(200);
      return res.end(JSON.stringify({ ok: true }));
    }

    // POST /api/auth/reset-password
    if (p === '/api/auth/reset-password' && req.method === 'POST') {
      const { token, password } = await readBody(req);
      if (!token || !password || String(password).length < 8) {
        res.writeHead(400); return res.end(JSON.stringify({ error: 'Valid token and password required' }));
      }
      let payload;
      try { payload = JSON.parse(Buffer.from(token, 'base64url').toString()); } catch { payload = null; }
      if (!payload || payload.purpose !== 'reset' || payload.exp <= Date.now()) {
        res.writeHead(400); return res.end(JSON.stringify({ error: 'Reset link is invalid or has expired.' }));
      }
      const user = users.get(payload.email);
      if (!user) { res.writeHead(400); return res.end(JSON.stringify({ error: 'Account not found.' })); }
      const salt = crypto.randomBytes(16).toString('hex');
      user.passwordHash = localPassword(password, salt);
      user.salt = salt;
      res.writeHead(200);
      return res.end(JSON.stringify({ ok: true }));
    }

    // GET /api/hdi/verify?code=
    if (p === '/api/hdi/verify' && req.method === 'GET') {
      const code = String(url.searchParams.get('code') || '').trim().toUpperCase();
      if (!code || !/^[A-Z]{1,3}-\d{4}-[0-9A-F]{6}$/.test(code)) {
        res.writeHead(400); return res.end(JSON.stringify({ error: 'Invalid HDI format' }));
      }
      const match = Array.from(users.values()).find(u => u.hdi_code === code);
      if (!match) {
        res.writeHead(200); return res.end(JSON.stringify({ found: false, hdiCode: code }));
      }
      res.writeHead(200);
      return res.end(JSON.stringify({
        found: true, hdiCode: match.hdi_code, username: match.username || null,
        issuedAt: null, verificationLevel: (match.email_verified && match.phone_verified) ? 'silver' : 'bronze',
        emailVerified: Boolean(match.email_verified), phoneVerified: Boolean(match.phone_verified),
      }));
    }

    // GET /api/wallet — return in-memory wallet
    if (p === '/api/wallet' && req.method === 'GET') {
      const payload = requestUser(req);
      if (!payload) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Unauthorized' })); }
      const user = users.get(payload.email);
      if (!user?.hdi_code) { res.writeHead(403); return res.end(JSON.stringify({ error: 'HDI required.' })); }
      const wKey = `wallet:${user.id}`;
      if (!wallets.has(wKey)) wallets.set(wKey, { address:`zsw_${user.hdi_code.toLowerCase().replace(/-/g,'_')}`, ownerHdi:user.hdi_code, balance:0, transactions:[] });
      const w = wallets.get(wKey);
      return res.end(JSON.stringify({ ...w, maxSupply:99, createdAt: user.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() }));
    }

    // POST /api/wallet/credit
    if (p === '/api/wallet/credit' && req.method === 'POST') {
      const payload = requestUser(req);
      if (!payload) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Unauthorized' })); }
      if (payload.role !== 'admin') { res.writeHead(403); return res.end(JSON.stringify({ error: 'Direct wallet credits require administrator access.' })); }
      const user = users.get(payload.email);
      if (!user?.hdi_code) { res.writeHead(403); return res.end(JSON.stringify({ error: 'HDI required.' })); }
      const { type, amount, note, requestId } = await readBody(req);
      const amt = Number(amount) || 1;
      const wKey = `wallet:${user.id}`;
      if (!wallets.has(wKey)) wallets.set(wKey, { address:`zsw_${user.hdi_code.toLowerCase().replace(/-/g,'_')}`, ownerHdi:user.hdi_code, balance:0, transactions:[] });
      const w = wallets.get(wKey);
      if (requestId && w.transactions.find(t => t.requestId === requestId)) return res.end(JSON.stringify({ ok:true, duplicate:true }));
      if (w.balance + amt > 99) { res.writeHead(409); return res.end(JSON.stringify({ error:'Maximum ZS supply reached (99).' })); }
      w.balance += amt;
      w.transactions.push({ id:`tx_${Date.now().toString(36)}`, type, direction:'credit', amount:amt, balance:w.balance, note:note||'', requestId:requestId||null, createdAt:new Date().toISOString() });
      console.log(`[DEV] Wallet credit: +${amt} ZS → ${user.hdi_code} (${type})`);
      return res.end(JSON.stringify({ ok:true, balance:w.balance, amount:amt }));
    }

    // GET /api/licences
    if (p === '/api/licences' && req.method === 'GET') {
      const payload = requestUser(req);
      if (!payload) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Unauthorized' })); }
      const user = users.get(payload.email);
      const userLicences = licences.filter(l => l.ownerHdi === user?.hdi_code);
      return res.end(JSON.stringify({ licences: userLicences }));
    }

    // POST /api/licences
    if (p === '/api/licences' && req.method === 'POST') {
      const payload = requestUser(req);
      if (!payload) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Unauthorized' })); }
      const user = users.get(payload.email);
      if (!user?.hdi_code) { res.writeHead(403); return res.end(JSON.stringify({ error: 'Permanent HDI required to issue licences.' })); }
      const { title, contentType, licenceType, contentHash, metadata } = await readBody(req);
      if (!title || String(title).trim().length < 2) { res.writeHead(400); return res.end(JSON.stringify({ error:'Title required.' })); }
      const ts   = Date.now().toString(36).toUpperCase();
      const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
      const lid  = `ZSL-${user.hdi_code.split('-')[0]}-${ts}-${rand}`;
      const licence = { licenceId:lid, ownerHdi:user.hdi_code, title:String(title).trim(), contentType:contentType||'other', licenceType:licenceType||'personal', contentHash:contentHash||crypto.randomBytes(16).toString('hex'), status:'active', metadata:metadata||{}, createdAt:new Date().toISOString() };
      licences.push(licence);
      console.log(`[DEV] Licence created: ${lid} — "${licence.title}"`);
      res.writeHead(201);
      return res.end(JSON.stringify({ ok:true, licence }));
    }

    // GET /api/admin/stats
    if (p === '/api/admin/stats' && req.method === 'GET') {
      const payload = requestUser(req);
      if (!payload) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Unauthorized' })); }
      if (payload.role !== 'admin') { res.writeHead(403); return res.end(JSON.stringify({ error: 'Admin access required.' })); }
      const allUsers = Array.from(users.values());
      const totalZs = Array.from(wallets.values()).reduce((sum, w) => sum + (w.balance || 0), 0);
      return res.end(JSON.stringify({
        users: allUsers.length,
        hdisIssued: allUsers.filter(u => u.hdi_code).length,
        emailVerified: allUsers.filter(u => u.email_verified).length,
        phoneVerified: allUsers.filter(u => u.phone_verified).length,
        walletsActive: wallets.size,
        totalZsInCirculation: totalZs,
        activeLicences: licences.filter(l => l.status === 'active').length,
        transactions: Array.from(wallets.values()).reduce((sum, w) => sum + (w.transactions?.length || 0), 0),
        devicesEnrolled: deviceCredentials.size,
        newUsersToday: allUsers.filter(u => u.createdAt && (Date.now() - new Date(u.createdAt).getTime()) < 86400000).length,
        newUsersThisWeek: allUsers.filter(u => u.createdAt && (Date.now() - new Date(u.createdAt).getTime()) < 7*86400000).length,
        waitlistCount: 0,
        generatedAt: new Date().toISOString(),
      }));
    }

    // ── Community ────────────────────────────────────────────────

    // GET /api/community/posts?page=0
    if (p === '/api/community/posts' && req.method === 'GET') {
      const page    = Math.max(0, parseInt(url.searchParams.get('page') || '0'));
      const offset  = page * 20;
      const payload = requestUser(req);
      const uid     = payload?.id || null;
      const visible = commPosts.filter(p => !p.hidden).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const slice   = visible.slice(offset, offset + 20);
      return res.end(JSON.stringify({
        posts: slice.map(p => ({
          id: p.id, authorHdi: p.authorHdi, authorName: p.authorName,
          authorTier: p.authorTier, body: p.body, likes: p.likes, trusts: p.trusts,
          commentCount: commComments.filter(c => c.postId === p.id).length,
          likedByMe:   uid ? commReacts.has(`${uid}:${p.id}:like`)  : false,
          trustedByMe: uid ? commReacts.has(`${uid}:${p.id}:trust`) : false,
          createdAt: p.createdAt,
        })),
        total: visible.length, page, hasMore: offset + slice.length < visible.length,
      }));
    }

    // POST /api/community/posts
    if (p === '/api/community/posts' && req.method === 'POST') {
      const payload = requestUser(req);
      if (!payload) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Unauthorized' })); }
      const user = users.get(payload.email);
      if (!user?.hdi_code) { res.writeHead(403); return res.end(JSON.stringify({ error: 'HDI required to post.' })); }
      const { body } = await readBody(req);
      const text = String(body || '').trim();
      if (!text)         { res.writeHead(400); return res.end(JSON.stringify({ error: 'Post body required.' })); }
      if (text.length > 280) { res.writeHead(400); return res.end(JSON.stringify({ error: 'Posts limited to 280 characters.' })); }
      const tier = (user.email_verified && user.phone_verified) ? 'silver' : 'bronze';
      const post = { id: commNextId++, userId: user.id, authorHdi: user.hdi_code, authorName: user.name, authorTier: tier, body: text, likes: 0, trusts: 0, reports: 0, hidden: false, createdAt: new Date().toISOString() };
      commPosts.push(post);
      // Credit +1 ZS
      const wKey = `wallet:${user.id}`;
      if (!wallets.has(wKey)) wallets.set(wKey, { address:`zsw_dev`, ownerHdi:user.hdi_code, balance:0, transactions:[] });
      const w = wallets.get(wKey);
      const rid = `post:${post.id}`;
      if (!w.transactions.find(t => t.requestId === rid) && w.balance < 99) {
        w.balance++; w.transactions.push({ id:`tx_${Date.now().toString(36)}`, type:'post', direction:'credit', amount:1, balance:w.balance, note:'Community post reward', requestId:rid, createdAt:new Date().toISOString() });
      }
      console.log(`[DEV] New post by ${user.hdi_code}: "${text.slice(0,40)}..."`);
      res.writeHead(201);
      return res.end(JSON.stringify({ ok:true, post: { id:post.id, authorHdi:post.authorHdi, authorName:post.authorName, authorTier:post.authorTier, body:post.body, likes:0, trusts:0, commentCount:0, likedByMe:false, trustedByMe:false, createdAt:post.createdAt } }));
    }

    // POST /api/community/react { postId, type }
    if (p === '/api/community/react' && req.method === 'POST') {
      const payload = requestUser(req);
      if (!payload) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Unauthorized' })); }
      const { postId, type } = await readBody(req);
      if (!postId || !['like','trust'].includes(type)) { res.writeHead(400); return res.end(JSON.stringify({ error: 'postId and type required.' })); }
      const post = commPosts.find(p => p.id === Number(postId) && !p.hidden);
      if (!post) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Post not found.' })); }
      const rKey = `${payload.id}:${postId}:${type}`;
      const col  = type === 'like' ? 'likes' : 'trusts';
      let active;
      if (commReacts.has(rKey)) { commReacts.delete(rKey); post[col] = Math.max(0, post[col]-1); active = false; }
      else                       { commReacts.set(rKey, true);  post[col]++;                        active = true;  }
      return res.end(JSON.stringify({ ok:true, active, count: post[col] }));
    }

    // GET /api/community/comments?postId=X
    if (p === '/api/community/comments' && req.method === 'GET') {
      const postId = Number(url.searchParams.get('postId'));
      if (!postId) { res.writeHead(400); return res.end(JSON.stringify({ error: 'postId required.' })); }
      const result = commComments.filter(c => c.postId === postId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      return res.end(JSON.stringify({ comments: result }));
    }

    // POST /api/community/comments { postId, body }
    if (p === '/api/community/comments' && req.method === 'POST') {
      const payload = requestUser(req);
      if (!payload) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Unauthorized' })); }
      const user = users.get(payload.email);
      if (!user?.hdi_code) { res.writeHead(403); return res.end(JSON.stringify({ error: 'HDI required to comment.' })); }
      const { postId, body } = await readBody(req);
      const text = String(body || '').trim();
      if (!postId || !text) { res.writeHead(400); return res.end(JSON.stringify({ error: 'postId and body required.' })); }
      if (text.length > 280) { res.writeHead(400); return res.end(JSON.stringify({ error: 'Comments limited to 280 characters.' })); }
      const post = commPosts.find(p => p.id === Number(postId) && !p.hidden);
      if (!post) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Post not found.' })); }
      const comment = { id: commCmtId++, postId: Number(postId), userId: user.id, authorHdi: user.hdi_code, authorName: user.name, body: text, createdAt: new Date().toISOString() };
      commComments.push(comment);
      res.writeHead(201);
      return res.end(JSON.stringify({ ok:true, comment }));
    }

    // POST /api/community/report { postId?, commentId?, reason }
    if (p === '/api/community/report' && req.method === 'POST') {
      const payload = requestUser(req);
      if (!payload) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Unauthorized' })); }
      const { postId, reason } = await readBody(req);
      const rKey = `${payload.id}:post:${postId}`;
      if (!commReports.has(rKey)) {
        commReports.add(rKey);
        const post = commPosts.find(p => p.id === Number(postId));
        if (post) { post.reports++; if (post.reports >= 5) post.hidden = true; }
      }
      return res.end(JSON.stringify({ ok: true }));
    }

    // Waitlist
    if (p === '/api/waitlist/count' && req.method === 'GET') {
      res.writeHead(200);
      return res.end(JSON.stringify({ count: 0 }));
    }

    res.writeHead(404);
    return res.end(JSON.stringify({ error: 'Not found' }));
  }

  // ── Static files ──────────────────────────────────────────────
  let filePath = path.join(__dirname, p === '/' ? 'index.html' : p);

  // SPA fallback — unknown paths serve index.html
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(__dirname, 'index.html');
  }

  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
  fs.createReadStream(filePath).pipe(res);
});

const PORT = Number(process.env.PORT || 4000);
server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Zero Soils  →  http://localhost:${PORT}\n`);
});
