"use strict";

const { getPool } = require('../_db');

// Hardcoded first user — no DB required
const FIRST_USER = {
  handle:      '@kingofyadav',
  hdi_code:    'hid-jarvis-001',
  display_name:'Jarvis',
  full_name:   'Amit Ku Yadav',
  bio:         'Building the sovereign internet — one identity at a time.',
  avatar_color:'#FF9933',
  trust_level: 1,
  trust_label: 'Self-Sovereign',
  city:        'New Delhi',
  country:     'India',
  country_code:'IN',
  flag:        '🇮🇳',
  email_verified: true,
  phone_verified: true,
  hdi_generated_at: '2026-06-02T00:00:00Z',
  assets: [
    { label: 'kingofyadav.in', type: 'domain',   url: 'https://kingofyadav.in' },
    { label: 'ZeroSoils',      type: 'org',       url: 'https://zerosoils.com'  },
    { label: 'RupeeCoin',      type: 'blockchain',url: null                     },
    { label: 'Jhon Aamit LLP', type: 'business',  url: null                     },
  ],
  links: [
    { label: 'Blog',        href: 'https://kingofyadav.in/pages/blog.html'         },
    { label: 'Work',        href: 'https://kingofyadav.in/pages/professional.html' },
    { label: 'Collaborate', href: 'https://kingofyadav.in/pages/collaboration.html'},
  ],
  universe_url: 'https://zerosoils.com',
  verify_url:   'https://kingofyadav.in/verify/hid-jarvis-001',
  is_first_user: true,
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=300');

  const raw    = String(req.query?.handle || '').trim().toLowerCase();
  const handle = raw.startsWith('@') ? raw : `@${raw}`;

  if (!handle || handle === '@') {
    return res.status(400).json({ ok: false, error: 'handle required' });
  }

  // 1. Check hardcoded first user
  if (handle === '@kingofyadav') {
    return res.json({ ok: true, data: FIRST_USER });
  }

  // 2. DB lookup by username
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, username, display_name, bio, hdi_code, hdi_generated_at,
              email_verified, phone_verified,
              avatar_color, city, country, country_code, flag,
              trust_level, trust_label
       FROM users
       WHERE lower(username) = $1
         AND hdi_code IS NOT NULL`,
      [handle.slice(1)]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const u = rows[0];
    return res.json({
      ok: true,
      data: {
        handle:          `@${u.username}`,
        hdi_code:        u.hdi_code,
        display_name:    u.display_name || u.username,
        full_name:       u.display_name || u.username,
        bio:             u.bio || null,
        avatar_color:    u.avatar_color || '#4da6ff',
        trust_level:     u.trust_level ?? 0,
        trust_label:     u.trust_label || 'Unverified',
        city:            u.city || null,
        country:         u.country || null,
        country_code:    u.country_code || null,
        flag:            u.flag || '',
        email_verified:  Boolean(u.email_verified),
        phone_verified:  Boolean(u.phone_verified),
        hdi_generated_at: u.hdi_generated_at || null,
        assets:          [],
        links:           [],
        universe_url:    'https://zerosoils.com',
        verify_url:      `https://id.zerosoils.com/verify/${u.hdi_code}`,
        is_first_user:   false,
      },
    });
  } catch (err) {
    console.error('[user/index]', err.message);
    return res.status(500).json({ ok: false, error: 'Lookup failed' });
  }
};
