// ─────────────────────────────────────────────────────────
// Zero Soils — app.js
// Pages: home · how-hdi-works · community · identity · verify
//        login · register · dashboard · privacy · terms
// Uses Profile CSS classes throughout
// ─────────────────────────────────────────────────────────

// ── HOME ──────────────────────────────────────────────────
Router.register('home', root => {
  root.innerHTML = `
  <div class="site-main zs-public-page zs-home-page">

    <!-- HERO -->
    <section style="padding:clamp(72px,11vw,140px) 0 clamp(48px,7vw,90px);max-width:760px" data-reveal>
      <p style="display:inline-flex;align-items:center;gap:8px;font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green);margin-bottom:22px">
        <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--brand-green);animation:pulse 2s infinite"></span>
        Human Digital Identity Community
      </p>
      <h1 style="font-size:clamp(2.6rem,6vw,4.4rem);font-weight:900;line-height:1.06;letter-spacing:-0.03em;margin-bottom:22px">
        Your verified identity<br/>
        <span style="background:var(--gradient-brand);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">on the internet.</span>
      </h1>
      <p style="font-size:1.08rem;line-height:1.78;max-width:56ch;margin-bottom:40px;opacity:0.72">
        Zero Soils issues one permanent HDI code per verified account,
        after email and mobile OTP confirmation.
      </p>
      <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center">
        <a href="#" class="btn-primary" data-page="register">Create your HDI — free →</a>
        <a href="#" class="btn-login" data-page="verify-hdi">Verify an HDI</a>
      </div>
    </section>

    <!-- 3 TRUST POINTS -->
    <section style="padding:clamp(40px,6vw,80px) 0" data-reveal>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px">
        ${[
          { icon:'✦', title:'Truth-first',       body:'No fake profiles, purchased followers, or inflated numbers. Identity is built on verifiable facts only.' },
          { icon:'🔒', title:'Private by design', body:'We store only what is needed to issue your HDI. You control what your public profile shows.' },
          { icon:'🪪', title:'Yours forever',      body:'HDI codes are permanent. Your password can be changed. Your issued identity never changes.' },
        ].map(f => `
        <div class="life-card glass" style="padding:28px;border-radius:18px" data-reveal>
          <div style="font-size:1.5rem;margin-bottom:14px;line-height:1">${f.icon}</div>
          <h3 style="font-size:0.97rem;font-weight:700;margin-bottom:8px">${f.title}</h3>
          <p style="font-size:0.86rem;line-height:1.65;opacity:0.6">${f.body}</p>
        </div>`).join('')}
      </div>
    </section>

    <!-- CTA BAND -->
    <section style="padding:clamp(48px,7vw,90px) 0" data-reveal>
      <div class="glass" style="padding:clamp(32px,5vw,64px);border-radius:26px;text-align:center;background:linear-gradient(135deg,rgba(4,106,56,0.09),rgba(255,103,31,0.06));border:1px solid rgba(4,106,56,0.16)">
        <h2 style="font-size:clamp(1.6rem,3.5vw,2.6rem);font-weight:900;margin-bottom:14px;letter-spacing:-0.02em;line-height:1.1">Ready to claim your HDI?</h2>
        <p style="opacity:0.58;margin:0 auto 32px;max-width:48ch;font-size:0.97rem;line-height:1.7">One real identity. One permanent code. Free to claim.</p>
        <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center">
          <a href="#" class="btn-primary" data-page="register">Create your HDI →</a>
          <a href="#" class="btn-login" data-page="login">Sign in</a>
        </div>
        <p style="margin-top:20px;font-size:0.82rem;opacity:0.4">
          <a href="/hdi" data-page="hdi" data-section="id-formula" style="color:inherit;text-decoration:underline;text-underline-offset:3px">How it works →</a>
        </p>
      </div>
    </section>

  </div>
  <style>@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.7)}}</style>
  `;
});

// ── WALLET ────────────────────────────────────────────────
// ZS Coin: max 99 per identity. Device-bound. LocalStorage ledger.
// Address format: zsw_aky_2026_3f8a2c

const ZS_MAX_SUPPLY = 99;
const ZS_GENESIS    = 1;

const ZsWallet = (() => {
  function key(hdi) { return `zs_wallet:${hdi}`; }

  function address(hdi) {
    return 'zsw_' + (hdi || 'pending').toLowerCase().replace(/-/g, '_');
  }

  function load(hdi) {
    try { return JSON.parse(localStorage.getItem(key(hdi))); } catch { return null; }
  }

  function save(wallet) {
    localStorage.setItem(key(wallet.hdi), JSON.stringify(wallet));
  }

  function trustScore(wallet) {
    const txs = wallet.transactions?.length || 0;
    let s = 20;
    if (wallet.genesisIssued)  s += 15;
    if (wallet.emailVerified)  s += 20;
    if (wallet.phoneVerified)  s += 20;
    s += Math.min(15, txs * 3);
    s += Math.min(10, Math.floor((Date.now() - (wallet.createdAt || Date.now())) / 86_400_000));
    return Math.min(100, s);
  }

  async function hash(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  }

  async function addTx(wallet, { type, direction, amount, note = '' }) {
    const bal = Number(wallet.balance || 0);
    const next = direction === 'debit' ? bal - amount : bal + amount;
    if (direction === 'debit' && next < 0) throw new Error('Insufficient ZS balance.');
    if (direction === 'credit' && next > ZS_MAX_SUPPLY) throw new Error('Maximum supply reached (99 ZS).');
    const raw = [wallet.hdi, type, direction, amount, next, Date.now()].join('|');
    const tx = {
      id:        'tx_' + Date.now().toString(36),
      type, direction, amount,
      balance:   next,
      note,
      hash:      await hash(raw),
      createdAt: Date.now(),
    };
    wallet.balance = next;
    wallet.transactions = wallet.transactions || [];
    wallet.transactions.push(tx);
    wallet.updatedAt = Date.now();
    save(wallet);
    return wallet;
  }

  async function loadOrCreate(identity) {
    const hdi = identity.code;
    let w = load(hdi);
    if (!w) {
      w = {
        hdi,
        address:      address(hdi),
        ownerName:    identity.name || '',
        balance:      0,
        maxSupply:    ZS_MAX_SUPPLY,
        emailVerified: false,
        phoneVerified: false,
        genesisIssued: false,
        transactions:  [],
        createdAt:     Date.now(),
        updatedAt:     Date.now(),
      };
      save(w);
    }
    if (!w.genesisIssued) {
      w = await addTx(w, { type: 'Genesis ZS', direction: 'credit', amount: ZS_GENESIS, note: 'Initial balance after HDI issuance' });
      w.genesisIssued = true;
      w.genesisAt = Date.now();
      save(w);
    }
    // Sync nav balance chip
    const chip = document.getElementById('nav-balance');
    if (chip) chip.textContent = w.balance;
    return w;
  }

  return { load, save, loadOrCreate, addTx, trustScore, address, hash };
})();

// ── ZS LICENCE MODULE ─────────────────────────────────────
const ZS_LIC_TYPES = {
  personal:      { label: 'ZS Personal',    desc: 'Only you may use this content — no sharing or sublicensing' },
  share:         { label: 'ZS Share',       desc: 'Others may share and distribute with full credit to you' },
  open:          { label: 'ZS Open',        desc: 'Free to use by anyone — attribution required' },
  commercial:    { label: 'ZS Commercial',  desc: 'Commercial use requires explicit written permission from owner' },
  collaboration: { label: 'ZS Collaborate', desc: 'Joint ownership arrangement — shared rights between parties' },
  exclusive:     { label: 'ZS Exclusive',   desc: 'Sole owner — no sublicence, transfer or redistribution' },
  transfer:      { label: 'ZS Transfer',    desc: 'Full ownership transfer from one HDI to another' },
  nft:           { label: 'ZS Digital NFT', desc: 'Non-fungible digital good — one unique owner at a time' },
};
const ZS_CONTENT_TYPES = [
  'Idea','Blog Post','Project','Goal','Note','Design','Code','Video',
  'Software','Template','Document','Music','Photo','Asset','Contract',
  'E-book','Course','Dataset','Digital Download','Licence Key','3D Asset','Other',
];

const ZsLicence = (() => {
  const LS_KEY = 'zs_licences';
  const AUDIT_KEY = 'zs_licence_audit';

  function loadAll()        { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; } }
  function saveAll(arr)     { localStorage.setItem(LS_KEY, JSON.stringify(arr)); }
  function loadAudit()      { try { return JSON.parse(localStorage.getItem(AUDIT_KEY)) || []; } catch { return []; } }
  function audit(type, detail = {}) {
    const log = loadAudit();
    log.push({ type, detail, at: Date.now() });
    localStorage.setItem(AUDIT_KEY, JSON.stringify(log.slice(-100)));
  }
  function _genId()         { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36); }
  function _prefix(hdi)     { return String(hdi || 'ZS').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || 'ZS'; }

  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function _stableStr(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return `[${v.map(_stableStr).join(',')}]`;
    return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${_stableStr(v[k])}`).join(',')}}`;
  }

  function _fmtDate(ms) {
    return new Date(ms).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  async function claim({ title, contentType, licenceType, content, sourceUrl = '', sourceDate = '', sourceCategory = '' }, identity, deviceProof) {
    if (!title?.trim()) throw new Error('Title is required');
    if (!identity?.code) throw new Error('An issued HDI is required for ownership marking.');
    if (!deviceProof?.verified || !deviceProof?.device?.fingerprint) {
      throw new Error('Verify your primary device before issuing a licence certificate.');
    }
    const all   = loadAll();
    const now   = Date.now();
    const seq   = String(all.length + 1).padStart(3, '0');
    const dstr  = new Date(now).toISOString().slice(0, 10).replace(/-/g, '');
    const pfx   = _prefix(identity?.code || '');
    const licenceId = `ZSL-${pfx}-${dstr}-${seq}`;

    const contentHash    = await sha256(_stableStr({ title: title.trim(), contentType, licenceType, content: (content || '').trim(), sourceUrl, sourceDate }));
    const ownerMark = {
      ownerName: identity.name || '',
      ownerHdi: identity.code,
      deviceFingerprint: deviceProof.device.fingerprint,
      deviceLabel: deviceProof.device.label || 'Browser device',
      observedIp: deviceProof.device.lastIp || deviceProof.device.firstIp || '',
      deviceVerifiedAt: deviceProof.device.verifiedAt || '',
      ownerMarkIssuedAt: now,
    };
    const ownerMarkHash = await sha256(_stableStr({ licenceId, contentHash, ownerMark }));
    const verification   = {
      protocol: 'ZS-Licence-v2',
      licenceId,
      ownerHdi: identity.code,
      deviceFingerprint: ownerMark.deviceFingerprint,
      ownerMarkHash,
      title: title.trim(),
      contentType,
      licenceType,
      contentHash,
      sourceUrl,
      issuedAt: now,
    };
    const verificationHash = await sha256(_stableStr(verification));

    const entry = {
      id: _genId(), licenceId,
      ownerName: identity?.name || '', ownerHdi: identity?.code || '',
      title: title.trim(), contentType: contentType || 'Idea', licenceType: licenceType || 'personal',
      sourceUrl, sourceDate, sourceCategory, contentHash, ownerMark, ownerMarkHash, verificationHash, verification,
      issuedAt: now, createdAtStr: _fmtDate(now),
    };
    all.push(entry);
    saveAll(all);
    audit('LICENCE_ISSUED', { licenceId, title: entry.title, ownerHdi: identity.code, deviceFingerprint: ownerMark.deviceFingerprint });
    return entry;
  }

  async function secureOwnedEntries(identity, deviceProof) {
    if (!identity?.code || !deviceProof?.verified || !deviceProof?.device?.fingerprint) return 0;
    const all = loadAll();
    const now = Date.now();
    let upgraded = 0;
    for (const entry of all) {
      if (entry.ownerMark || entry.ownerHdi !== identity.code) continue;
      entry.ownerMark = {
        ownerName: identity.name || entry.ownerName || '',
        ownerHdi: identity.code,
        deviceFingerprint: deviceProof.device.fingerprint,
        deviceLabel: deviceProof.device.label || 'Browser device',
        observedIp: deviceProof.device.lastIp || deviceProof.device.firstIp || '',
        deviceVerifiedAt: deviceProof.device.verifiedAt || '',
        ownerMarkIssuedAt: now,
      };
      entry.ownerMarkHash = await sha256(_stableStr({
        licenceId: entry.licenceId,
        contentHash: entry.contentHash,
        ownerMark: entry.ownerMark,
      }));
      entry.verification = {
        protocol: 'ZS-Licence-v2',
        licenceId: entry.licenceId,
        ownerHdi: identity.code,
        deviceFingerprint: entry.ownerMark.deviceFingerprint,
        ownerMarkHash: entry.ownerMarkHash,
        title: entry.title,
        contentType: entry.contentType,
        licenceType: entry.licenceType,
        contentHash: entry.contentHash,
        sourceUrl: entry.sourceUrl || '',
        issuedAt: entry.issuedAt,
      };
      entry.verificationHash = await sha256(_stableStr(entry.verification));
      upgraded++;
    }
    if (upgraded) {
      saveAll(all);
      audit('LEGACY_MARKS_UPGRADED', {
        ownerHdi: identity.code,
        deviceFingerprint: deviceProof.device.fingerprint,
        count: upgraded,
      });
    }
    return upgraded;
  }

  function remove(id) {
    const licence = loadAll().find(entry => entry.id === id);
    saveAll(loadAll().filter(l => l.id !== id));
    audit('LICENCE_REMOVED', { licenceId: licence?.licenceId || id });
  }

  function exportJSON(identity, deviceProof) {
    const blob = new Blob([JSON.stringify({
      format: 'zs-licences-v2', exportedAt: new Date().toISOString(),
      ownerHdi: identity?.code || '',
      deviceAuthorization: deviceProof?.verified ? deviceProof.device : null,
      licences: loadAll(),
      audit: loadAudit(),
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `zs-licences-${Date.now()}.json` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    audit('REGISTRY_EXPORTED', { ownerHdi: identity?.code || '', count: loadAll().length });
  }

  function importJSON(data) {
    if (!['zs-licences-v1', 'zs-licences-v2'].includes(data?.format) || !Array.isArray(data?.licences)) throw new Error('Invalid ZS Licences backup file.');
    saveAll(data.licences);
    audit('REGISTRY_IMPORTED', { count: data.licences.length, format: data.format });
    return data.licences.length;
  }

  return { loadAll, saveAll, loadAudit, audit, claim, secureOwnedEntries, remove, exportJSON, importJSON, sha256, _fmtDate };
})();

Router.register('wallet', root => {
  if (!Auth.isLoggedIn()) { Router.go('login'); return; }
  if (!Auth.getUser()?.hdi_code) { Router.go('verify'); return; }
  const hdi  = HDI.get();

  if (!hdi.code) {
    root.innerHTML = `
    <div class="site-main zs-empty-page">
      <div style="text-align:center;max-width:420px" data-reveal>
        <div style="width:80px;height:80px;border-radius:22px;background:linear-gradient(135deg,rgba(4,106,56,0.15),rgba(255,103,31,0.10));border:1px solid rgba(4,106,56,0.25);display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 24px">✦</div>
        <h2 style="font-size:1.8rem;font-weight:900;margin-bottom:12px">No HDI found</h2>
        <p style="opacity:0.6;margin-bottom:28px;line-height:1.7">Your ZS Wallet is bound to your Human Digital Identity. Create your HDI first to unlock your wallet and receive your Genesis ZS Coin.</p>
        <a href="#" class="btn-primary" data-page="register">Claim your HDI — free →</a>
      </div>
    </div>`;
    return;
  }

  // ── Shared input style (injected once) ──
  const INP = 'width:100%;padding:11px 14px;background:rgba(255,255,255,0.05);border:1.5px solid rgba(255,255,255,0.10);border-radius:11px;color:inherit;font-family:inherit;font-size:0.9rem;outline:none;box-sizing:border-box;transition:border-color 0.2s';
  const PANEL = 'padding:26px;border-radius:20px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03)';

  root.innerHTML = `
  <div class="zs-workspace">

  <div class="site-main zs-workspace-content" style="max-width:1100px">

  <!-- ════ LOADING ════ -->
  <div id="wallet-loading" style="text-align:center;padding:60px;opacity:0.4;font-size:0.9rem">Loading wallet…</div>
  <div id="wallet-content" hidden>

  <!-- ════════════════════════════════════════════
       ① OVERVIEW
  ═══════════════════════════════════════════════ -->
  <section id="w-overview" style="padding:clamp(40px,6vw,80px) 0 clamp(32px,4vw,56px)">

    <!-- Hero row -->
    <div style="display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center;margin-bottom:36px;flex-wrap:wrap" data-reveal>
      <div>
        <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green);margin-bottom:10px">ZS Wallet Suite</p>
        <h1 style="font-size:clamp(2rem,5vw,3.6rem);font-weight:900;line-height:1.05;letter-spacing:-0.03em;margin-bottom:14px">The command center<br>for your HDI.</h1>
        <p style="opacity:0.6;font-size:1rem;line-height:1.75;max-width:52ch;margin-bottom:24px">View your HDI-linked balance, confirm this device, review activity, and manage encrypted recovery.</p>
        <div style="display:flex;flex-wrap:wrap;gap:10px">
          ${[['security','Device Auth','primary'],['wallet','Open Wallet','secondary'],['vault','Vault','secondary']].map(([id,label,type]) =>
            `<a href="#w-${id}" data-wtab="${id}" class="btn-${type === 'primary' ? 'primary' : 'login'}" style="font-size:0.85rem">${label}</a>`
          ).join('')}
        </div>
      </div>

      <!-- Balance card (credit card style) -->
      <div id="w-card" style="width:300px;min-height:168px;border-radius:20px;background:linear-gradient(135deg,#0a3d20,#1a1a2e,#2d1810);border:1px solid rgba(4,106,56,0.35);padding:22px;position:relative;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.5)" data-reveal>
        <div style="position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,rgba(4,106,56,0.25),transparent 70%);pointer-events:none"></div>
        <div style="font-size:0.62rem;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;opacity:0.5;margin-bottom:20px">ZS Wallet · Identity Bound</div>
        <div style="margin-bottom:16px">
          <div style="font-size:0.65rem;opacity:0.45;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.08em">Available Balance</div>
          <div style="display:flex;align-items:baseline;gap:8px">
            <span id="wc-balance" style="font-size:2.6rem;font-weight:900;line-height:1;color:#fff">0</span>
            <span style="font-size:0.9rem;opacity:0.5;font-weight:700">ZS</span>
          </div>
        </div>
        <code id="wc-address" style="font-size:0.65rem;color:rgba(4,200,100,0.8);letter-spacing:0.5px;word-break:break-all;line-height:1.4;display:block;margin-bottom:14px"></code>
        <div style="display:flex;justify-content:space-between;font-size:0.68rem">
          <div><div style="opacity:0.4;margin-bottom:2px">Genesis</div><strong id="wc-genesis" style="color:var(--brand-green)">Pending</strong></div>
          <div><div style="opacity:0.4;margin-bottom:2px">Trust</div><strong id="wc-trust">0/100</strong></div>
          <div><div style="opacity:0.4;margin-bottom:2px">Security</div><strong style="opacity:0.7">HDI bound</strong></div>
        </div>
      </div>
    </div>

    <!-- Stats bar -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px" data-reveal>
      ${[
        { label:'Balance',      id:'ws-balance', suffix:' ZS' },
        { label:'Trust Score',  id:'ws-trust',   suffix:'/100' },
        { label:'Transactions', id:'ws-txcount', suffix:'' },
        { label:'Genesis',      id:'ws-genesis', suffix:'' },
      ].map(s => `
      <div class="glass" style="padding:18px 20px;border-radius:14px;border-top:2px solid rgba(4,106,56,0.3)">
        <div style="font-size:0.68rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;opacity:0.45;margin-bottom:8px">${s.label}</div>
        <div style="font-size:1.5rem;font-weight:900;line-height:1"><span id="${s.id}">0</span><span style="font-size:0.8rem;opacity:0.45;font-weight:600"> ${s.suffix}</span></div>
      </div>`).join('')}
    </div>

  </section>

  <section id="w-security" style="padding:clamp(40px,6vw,72px) 0;border-top:1px solid rgba(255,255,255,0.06)">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:26px">
      <div>
        <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green);margin-bottom:10px">Device Authentication</p>
        <h2 style="font-size:clamp(1.6rem,3vw,2.4rem);font-weight:900;letter-spacing:-0.02em;margin-bottom:8px">Primary device proof.</h2>
        <p style="opacity:0.56;max-width:62ch;line-height:1.7">This wallet authorizes its first browser with a non-exportable signing key. IP is shown as observed session context, not as identity proof.</p>
      </div>
      <div id="wda-status" style="padding:9px 15px;border-radius:999px;border:1px solid rgba(255,255,255,.12);font-size:.78rem;font-weight:700;opacity:.65">Verifying device...</div>
    </div>
    <div class="glass" style="${PANEL};display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:20px;margin-bottom:16px" data-reveal>
      ${[
        ['Final HDI','wda-hdi'],
        ['Device Key Fingerprint','wda-fingerprint'],
        ['Observed IP','wda-ip'],
        ['Device Label','wda-label'],
        ['Last Verified','wda-last'],
        ['Authorization','wda-auth'],
      ].map(([label,id]) => `<div>
        <div style="font-size:0.64rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;opacity:.42;margin-bottom:6px">${label}</div>
        <code id="${id}" style="font-size:.82rem;font-weight:700;color:var(--brand-green);word-break:break-all">Pending</code>
      </div>`).join('')}
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:14px 18px;border-radius:14px;border:1px solid rgba(4,106,56,.18);background:rgba(4,106,56,.06)">
      <p id="wda-note" style="font-size:.8rem;opacity:.62;line-height:1.55">Creating a signed challenge for this wallet device.</p>
      <button id="verify-device-btn" class="btn-login" style="font-size:.8rem;padding:8px 16px;border-radius:999px">Verify again</button>
    </div>
  </section>

  <!-- ════════════════════════════════════════════
       ② WALLET — Balance · Receive · Ledger
  ═══════════════════════════════════════════════ -->
  <section id="w-wallet" style="padding:clamp(40px,6vw,72px) 0;border-top:1px solid rgba(255,255,255,0.06)">
    <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green);margin-bottom:10px">Wallet</p>
    <h2 style="font-size:clamp(1.6rem,3vw,2.4rem);font-weight:900;letter-spacing:-0.02em;margin-bottom:32px">Identity-powered value system.</h2>

    <!-- Binding proof -->
    <div class="glass" style="${PANEL};display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:20px" data-reveal>
      ${[
        { label:'Owner',           id:'wb-owner'  },
        { label:'HDI Code',        id:'wb-hdi'    },
        { label:'Wallet Address',  id:'wb-address'},
        { label:'Wallet Type',     val:'ZS Personal Wallet' },
        { label:'Device Proof',     val:'Required for protected actions' },
        { label:'Record Policy',    val:'Server activity only' },
      ].map(b => `
      <div>
        <div style="font-size:0.65rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;opacity:0.4;margin-bottom:5px">${b.label}</div>
        <code id="${b.id || ''}" style="font-size:0.82rem;font-weight:700;color:var(--brand-green);word-break:break-all">${b.val || '—'}</code>
      </div>`).join('')}
    </div>

    <div class="glass" style="${PANEL};text-align:center;max-width:420px;margin-bottom:20px" data-reveal>
        <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--brand-green);margin-bottom:16px">Receive ZS</p>
        <div style="width:72px;height:72px;border-radius:18px;background:rgba(4,106,56,0.10);border:2px dashed rgba(4,106,56,0.28);display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 14px">✦</div>
        <div style="font-size:0.75rem;opacity:0.5;margin-bottom:8px">Your wallet address</div>
        <code id="w-address-copy" style="font-size:0.7rem;color:var(--brand-green);word-break:break-all;display:block;margin-bottom:14px;line-height:1.5"></code>
        <button id="copy-address-btn" class="btn-login" style="font-size:0.8rem;padding:8px 18px;border-radius:999px;width:100%">Copy address</button>
    </div>

    <!-- Ledger -->
    <div class="glass" style="${PANEL}" data-reveal>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:10px">
        <div>
          <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green)">Wallet Activity</p>
          <span id="w-ledger-count" style="font-size:0.78rem;opacity:0.4"></span>
        </div>
        <button id="export-proof-btn" class="btn-login" style="font-size:0.8rem;padding:8px 16px;border-radius:999px">Export Proof JSON</button>
      </div>
      <div id="w-ledger" style="display:flex;flex-direction:column;gap:6px"></div>
      <p style="font-size:0.72rem;opacity:0.45;margin-top:14px">Only server-recorded wallet activity should be treated as an official platform record.</p>
    </div>
  </section>

  <!-- ════════════════════════════════════════════
       ④ VAULT — Recovery · Export · Restore
  ═══════════════════════════════════════════════ -->
  <section id="w-vault" style="padding:clamp(40px,6vw,72px) 0;border-top:1px solid rgba(255,255,255,0.06)">
    <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green);margin-bottom:10px">Vault</p>
    <h2 style="font-size:clamp(1.6rem,3vw,2.4rem);font-weight:900;letter-spacing:-0.02em;margin-bottom:8px">Encrypted backup and recovery.</h2>
    <p style="opacity:0.55;max-width:56ch;line-height:1.75;margin-bottom:32px">Export your wallet and identity as an encrypted JSON backup. Restore it using the passphrase that encrypts your vault file.</p>

    <!-- Vault metrics -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px" data-reveal>
      ${[
        { label:'Encryption', val:'AES-GCM 256-bit' },
        { label:'Key Derivation', val:'PBKDF2 SHA-256' },
        { label:'Storage', val:'Local JSON export' },
      ].map(m => `
      <div class="glass" style="${PANEL}">
        <div style="font-size:0.68rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;opacity:0.4;margin-bottom:8px">${m.label}</div>
        <div style="font-size:1.1rem;font-weight:800;color:var(--brand-green)">${m.val}</div>
      </div>`).join('')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">

      <!-- Recovery phrase -->
      <div class="glass" style="${PANEL}" data-reveal>
        <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--brand-green);margin-bottom:14px">Recovery Phrase</p>
        <p style="font-size:0.84rem;opacity:0.6;line-height:1.65;margin-bottom:16px">Generate a 12-word offline recovery note for your records. Your encrypted file is restored with its passphrase.</p>
        <div id="vault-phrase" style="padding:14px;border-radius:10px;background:rgba(4,106,56,0.06);border:1px solid rgba(4,106,56,0.18);font-family:monospace;font-size:0.8rem;line-height:1.7;min-height:60px;word-break:break-word;color:var(--brand-green);margin-bottom:14px;opacity:0.7">Generate a recovery phrase</div>
        <div style="display:flex;gap:8px">
          <button id="vault-gen-phrase" class="btn-primary" style="flex:1;padding:10px;font-size:0.83rem">Generate</button>
          <button id="vault-copy-phrase" class="btn-login" style="padding:10px 14px;font-size:0.83rem">Copy</button>
        </div>
        <p id="vault-phrase-status" style="font-size:0.75rem;min-height:1em;margin-top:8px"></p>
      </div>

      <!-- Export -->
      <div class="glass" style="${PANEL}" data-reveal>
        <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--brand-green);margin-bottom:14px">Export Backup</p>
        <p style="font-size:0.84rem;opacity:0.6;line-height:1.65;margin-bottom:16px">Create an encrypted JSON backup of your wallet, identity, and ledger history.</p>
        <form id="vault-export-form" style="display:flex;flex-direction:column;gap:10px">
          <input id="vault-export-pass" type="password" placeholder="Backup passphrase (min 8 chars)" style="${INP}" minlength="8" required />
          <input id="vault-export-label" placeholder="Label e.g. my-zs-backup" style="${INP}" />
          <button type="submit" class="btn-primary" style="padding:11px;font-size:0.85rem">Export .json →</button>
        </form>
        <p id="vault-export-status" style="font-size:0.75rem;min-height:1em;margin-top:8px"></p>
      </div>

      <!-- Restore -->
      <div class="glass" style="${PANEL}" data-reveal>
        <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--brand-green);margin-bottom:14px">Restore</p>
        <p style="font-size:0.84rem;opacity:0.6;line-height:1.65;margin-bottom:16px">Decrypt and import a ZS Vault backup file with the passphrase used during export.</p>
        <form id="vault-restore-form" style="display:flex;flex-direction:column;gap:10px">
          <input id="vault-restore-file" type="file" accept=".json,application/json" required style="font-size:0.83rem;opacity:0.7" />
          <input id="vault-restore-pass" type="password" placeholder="Backup passphrase" style="${INP}" required />
          <button type="submit" class="btn-primary" style="padding:11px;font-size:0.85rem">Restore →</button>
        </form>
        <p id="vault-restore-status" style="font-size:0.75rem;min-height:1em;margin-top:8px"></p>
      </div>
    </div>
  </section>

  </div><!-- /wallet-content -->
  </div><!-- /site-main -->
  </div>

  <style>
    #earn-grid button:hover { background:rgba(4,106,56,0.10)!important; border-color:rgba(4,106,56,0.30)!important; }
    #earn-grid button[data-done] { opacity:0.45; cursor:default; pointer-events:none; }
    @media(max-width:760px){
      #w-card { width:100%; }
      [style*="grid-template-columns:1fr 1fr 1fr"] { grid-template-columns:1fr!important; }
      [style*="grid-template-columns:1fr 1fr"] { grid-template-columns:1fr!important; }
      [style*="grid-template-columns:repeat(4"] { grid-template-columns:repeat(2,1fr)!important; }
    }
  </style>
  `;

  // ── Boot: load local wallet first, then sync with server ──
  ZsWallet.loadOrCreate({ code: hdi.code, name: hdi.name }).then(async wallet => {
    document.getElementById('wallet-loading').hidden = true;
    document.getElementById('wallet-content').hidden = false;
    _recoveryPhrase = '';
    _renderAll(wallet);
    _bindAll(wallet);
    _initSubNav();
    _verifyDevice();

    // Silent server sync — prefer server balance if it's higher
    try {
      const serverWallet = await API.get('/wallet');
      const serverBal = Number(serverWallet.balance || 0);
      const localBal  = Number(wallet.balance || 0);
      if (serverBal > localBal) {
        wallet.balance = serverBal;
        ZsWallet.save(wallet);
        _setText('wc-balance', serverBal);
        const chip = document.getElementById('nav-balance');
        if (chip) chip.textContent = serverBal;
      }
    } catch { /* server sync is optional — local wallet is always authoritative offline */ }
  });

  let _recoveryPhrase = '';
  let _deviceProof = null;
  let _deviceVerified = false;

  function _renderAll(w) {
    const bal   = Number(w.balance || 0);
    const trust = ZsWallet.trustScore(w);
    const txs   = (w.transactions || []).slice().reverse();
    const addr  = w.address;
    const trustLabel = trust >= 80 ? 'Truth ✦' : trust >= 60 ? 'Gold' : trust >= 40 ? 'Silver' : 'Bronze';

    // Card
    _setText('wc-balance', bal);
    _setText('wc-address', addr);
    _setText('wc-genesis', w.genesisIssued ? '✦ Issued' : 'Pending');
    _setText('wc-trust', trust + '/100');
    // Stats bar
    _setText('ws-balance', bal + ' ZS');
    _setText('ws-trust', trust + '/100');
    _setText('ws-txcount', (w.transactions || []).length);
    _setText('ws-genesis', w.genesisIssued ? '✦ Issued' : 'Pending');
    // Binding
    _setText('wb-owner',   w.ownerName || hdi.name || '—');
    _setText('wb-hdi',     w.hdi);
    _setText('wb-address', addr);
    // Receive
    const rc = document.getElementById('w-address-copy');
    if (rc) rc.textContent = addr;
    // Nav chip
    const chip = document.getElementById('nav-balance');
    if (chip) chip.textContent = bal;
    // Ledger
    _renderLedger(txs);
    // Ledger count
    _setText('w-ledger-count', txs.length + ' transaction' + (txs.length !== 1 ? 's' : ''));
  }

  function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function _renderDevice(result) {
    const device = result?.device || {};
    _setText('wda-hdi', hdi.code);
    _setText('wda-fingerprint', device.fingerprint || 'Unavailable');
    _setText('wda-ip', device.lastIp || device.firstIp || 'Unavailable');
    _setText('wda-label', device.label || 'Browser device');
    _setText('wda-last', device.verifiedAt ? new Date(device.verifiedAt).toLocaleString('en-IN') : 'Not verified');
    _setText('wda-auth', result?.verified ? 'Signed challenge verified' : 'Verification required');
    const status = document.getElementById('wda-status');
    const note = document.getElementById('wda-note');
    if (status) {
      status.textContent = result?.verified ? 'Verified device' : 'Device not verified';
      status.style.color = result?.verified ? 'var(--brand-green)' : '#f87171';
      status.style.borderColor = result?.verified ? 'rgba(4,106,56,.38)' : 'rgba(248,113,113,.35)';
      status.style.opacity = '1';
    }
    if (note) note.textContent = result?.verified
      ? 'Private signing key confirmed. Sensitive wallet actions are enabled on this device.'
      : 'Verify this device before using protected wallet actions.';
  }

  async function _verifyDevice() {
    const status = document.getElementById('wda-status');
    if (status) status.textContent = 'Verifying device...';
    try {
      _deviceProof = await DeviceAuth.verifyCurrent();
      _deviceVerified = Boolean(_deviceProof.verified);
      _renderDevice(_deviceProof);
    } catch (ex) {
      _deviceVerified = false;
      _renderDevice(null);
      const note = document.getElementById('wda-note');
      if (note) note.textContent = ex.message || 'Device verification failed.';
    }
  }

  function _requireDevice() {
    if (_deviceVerified) return true;
    window.toast('Verify this device before using protected wallet actions.', 'error');
    document.getElementById('w-security')?.scrollIntoView({ behavior:'smooth', block:'start' });
    return false;
  }

  function _escapeHTML(value) {
    return String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _renderLedger(txs) {
    const ledger = document.getElementById('w-ledger');
    if (!ledger) return;
    if (!txs.length) { ledger.innerHTML = `<div style="padding:20px;text-align:center;opacity:0.35;font-size:0.85rem">No transactions yet</div>`; return; }
    ledger.innerHTML = txs.map(tx => {
      const d = new Date(tx.createdAt).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
      const credit = tx.direction === 'credit';
      const col = credit ? 'var(--brand-green)' : 'var(--brand-orange)';
      return `<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.05)">
        <div style="width:32px;height:32px;border-radius:50%;background:${credit?'rgba(4,106,56,0.14)':'rgba(255,103,31,0.10)'};display:flex;align-items:center;justify-content:center;font-size:0.85rem;flex-shrink:0;color:${col}">${credit?'↓':'↑'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.86rem;font-weight:700">${_escapeHTML(tx.type)}</div>
          <div style="font-size:0.7rem;opacity:0.4;margin-top:1px">${_escapeHTML(tx.note)}</div>
          <code style="font-size:0.62rem;opacity:0.25;display:block;margin-top:2px">${_escapeHTML(tx.hash)}</code>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:0.92rem;font-weight:800;color:${col}">${credit?'+':'-'}${tx.amount} ZS</div>
          <div style="font-size:0.68rem;opacity:0.35;margin-top:2px">${d}</div>
        </div>
      </div>`;
    }).join('');
  }

  function _simpleWordList() {
    const w = ['solar','earth','truth','stone','river','flame','cloud','anchor','forest','signal','bridge','grain','steady','clear','proof','layer','vault','root','chain','cipher'];
    const values = crypto.getRandomValues(new Uint32Array(12));
    return Array.from(values, n => w[n % w.length]).join(' ');
  }

  function _bytesToBase64(bytes) {
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function _base64ToBytes(value) {
    return Uint8Array.from(atob(value), char => char.charCodeAt(0));
  }

  async function _vaultKey(passphrase, salt, usages) {
    const sourceKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name:'PBKDF2', salt, iterations:250000, hash:'SHA-256' },
      sourceKey,
      { name:'AES-GCM', length:256 },
      false,
      usages
    );
  }

  async function _encryptVault(payload, passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const key  = await _vaultKey(passphrase, salt, ['encrypt']);
    const aad  = new TextEncoder().encode(`zs-vault-v2|${payload.hdi}`);
    const data = await crypto.subtle.encrypt(
      { name:'AES-GCM', iv, additionalData:aad },
      key,
      new TextEncoder().encode(JSON.stringify(payload))
    );
    return {
      format: 'zs-vault-v2',
      label: payload.label,
      exportedAt: payload.exportedAt,
      hdi: payload.hdi,
      encryption: {
        cipher: 'AES-GCM',
        keyLength: 256,
        kdf: 'PBKDF2-SHA-256',
        iterations: 250000,
        salt: _bytesToBase64(salt),
        iv: _bytesToBase64(iv),
        data: _bytesToBase64(new Uint8Array(data)),
      },
    };
  }

  async function _decryptVault(backup, passphrase) {
    if (backup?.format !== 'zs-vault-v2' || backup?.encryption?.cipher !== 'AES-GCM') {
      throw new Error('Not an encrypted ZS Vault v2 backup file.');
    }
    const encryption = backup.encryption;
    const key = await _vaultKey(passphrase, _base64ToBytes(encryption.salt), ['decrypt']);
    let plain;
    try {
      plain = await crypto.subtle.decrypt(
        {
          name:'AES-GCM',
          iv:_base64ToBytes(encryption.iv),
          additionalData:new TextEncoder().encode(`zs-vault-v2|${backup.hdi}`),
        },
        key,
        _base64ToBytes(encryption.data)
      );
    } catch {
      throw new Error('Wrong passphrase or damaged backup file.');
    }
    const payload = JSON.parse(new TextDecoder().decode(plain));
    if (!payload?.wallet || payload.hdi !== payload.wallet.hdi || payload.hdi !== backup.hdi) {
      throw new Error('Backup identity validation failed.');
    }
    if (!/^[A-Z]{1,3}-\d{4}-[0-9A-F]{6}$/.test(payload.hdi)) {
      throw new Error('Backup contains an invalid HDI code.');
    }
    return payload;
  }

  function _bindAll(initialWallet) {
    let wallet = initialWallet;

    document.getElementById('verify-device-btn')?.addEventListener('click', _verifyDevice);

    // ── Sub-nav anchor clicks ──
    document.querySelectorAll('[data-wtab]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const id = a.dataset.wtab;
        const sec = document.getElementById('w-' + id);
        if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // ── Copy address ──
    document.getElementById('copy-address-btn')?.addEventListener('click', async () => {
      await navigator.clipboard.writeText(wallet.address).catch(()=>{});
      window.toast('Address copied ✓', 'success');
    });

    // ── Export proof JSON ──
    document.getElementById('export-proof-btn')?.addEventListener('click', () => {
      if (!_requireDevice()) return;
      const proof = {
        project:'ZS Wallet',
        exportedAt:new Date().toISOString(),
        identity:{ name:wallet.ownerName, hdi:wallet.hdi },
        deviceAuthorization:{ verified:_deviceVerified, ...(_deviceProof?.device || {}) },
        wallet:{ address:wallet.address, balance:wallet.balance, trustScore:ZsWallet.trustScore(wallet), genesis:wallet.genesisIssued },
        transactions:wallet.transactions,
      };
      const blob = new Blob([JSON.stringify(proof, null, 2)], { type:'application/json' });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download:`zs-wallet-proof-${wallet.hdi.toLowerCase()}.json` });
      document.body.appendChild(a); a.click(); a.remove();
      window.toast('Proof JSON exported ✓', 'success');
    });

    // ── Vault: generate recovery phrase ──
    document.getElementById('vault-gen-phrase')?.addEventListener('click', () => {
      _recoveryPhrase = _simpleWordList();
      const el = document.getElementById('vault-phrase');
      if (el) { el.textContent = _recoveryPhrase; el.style.opacity = '1'; }
      _setStatus('vault-phrase-status', 'Recovery phrase generated — copy and store offline.', 'success');
    });

    // ── Vault: copy phrase ──
    document.getElementById('vault-copy-phrase')?.addEventListener('click', async () => {
      if (!_recoveryPhrase) { _setStatus('vault-phrase-status', 'Generate a phrase first.', 'error'); return; }
      await navigator.clipboard.writeText(_recoveryPhrase).catch(()=>{});
      _setStatus('vault-phrase-status', 'Copied to clipboard.', 'success');
      window.toast('Recovery phrase copied ✓', 'success');
    });

    // ── Vault: export ──
    document.getElementById('vault-export-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      if (!_requireDevice()) return;
      const pass  = document.getElementById('vault-export-pass')?.value;
      const label = document.getElementById('vault-export-label')?.value || 'zs-backup';
      if (!pass || pass.length < 8) { _setStatus('vault-export-status', '✗ Passphrase must be at least 8 characters', 'error'); return; }
      try {
        const payload = { label, exportedAt: new Date().toISOString(), hdi: wallet.hdi, wallet, recoveryPhraseHint: _recoveryPhrase ? 'set' : 'not-set' };
        const backup  = await _encryptVault(payload, pass);
        const blob    = new Blob([JSON.stringify(backup, null, 2)], { type:'application/json' });
        const url     = URL.createObjectURL(blob);
        const a       = Object.assign(document.createElement('a'), { href:url, download:`${label}.json` });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        _setStatus('vault-export-status', '✦ AES-GCM encrypted backup exported', 'success');
        window.toast('Encrypted Vault backup exported ✓', 'success');
      } catch(ex) {
        _setStatus('vault-export-status', '✗ ' + ex.message, 'error');
      }
    });

    // ── Vault: restore ──
    document.getElementById('vault-restore-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const file = document.getElementById('vault-restore-file')?.files?.[0];
      const pass = document.getElementById('vault-restore-pass')?.value;
      if (!file) { _setStatus('vault-restore-status', '✗ Choose a backup file', 'error'); return; }
      if (!pass) { _setStatus('vault-restore-status', '✗ Enter the backup passphrase', 'error'); return; }
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const payload = await _decryptVault(data, pass);
        wallet = payload.wallet;
        ZsWallet.save(wallet);
        HDI.save(wallet.hdi, wallet.ownerName || hdi.name || '');
        _renderAll(wallet);
        _setStatus('vault-restore-status', `✦ Decrypted and restored — HDI: ${wallet.hdi}.`, 'success');
        window.toast('Vault restored ✓', 'success');
      } catch(ex) { _setStatus('vault-restore-status', '✗ ' + ex.message, 'error'); }
    });

  }

  function _setStatus(id, msg, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.style.color = type === 'success' ? 'var(--brand-green)' : type === 'error' ? '#f87171' : 'inherit';
  }

  // ── Sub-nav active tab on scroll ──
  function _initSubNav() {
    const sections = ['overview','security','wallet','vault'];
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id.replace('w-','');
          document.querySelectorAll('[data-wtab]').forEach(a => {
            a.classList.toggle('wt-active', a.dataset.wtab === id);
          });
        }
      });
    }, { threshold: 0.2 });
    sections.forEach(id => {
      const el = document.getElementById('w-' + id);
      if (el) obs.observe(el);
    });
  }
});

// ── COMMUNITY ─────────────────────────────────────────────
Router.register('community', root => {
  const user    = Auth.getUser();
  const hasHdi  = Boolean(user?.hdi_code);
  const loggedIn = Auth.isLoggedIn();
  const tierColor = { truth:'var(--brand-green)', gold:'#D4AF37', silver:'#A8B8C0', bronze:'#CD7F32' };

  root.innerHTML = `
  <div class="site-main zs-public-page">
    <div style="padding:clamp(32px,5vw,64px) 0 24px" data-reveal>
      <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green);margin-bottom:10px">Community</p>
      <h1 style="font-size:clamp(1.8rem,4vw,3rem);font-weight:900;letter-spacing:-0.02em;margin-bottom:10px">Real people. Real stories.</h1>
      <p style="opacity:0.65;font-size:1rem;max-width:52ch">A live feed built on truth. Every post comes from a verified Human Digital Identity.</p>
    </div>

    <div style="display:grid;grid-template-columns:1fr 300px;gap:32px;padding-bottom:80px" id="community-grid">
      <div>
        ${hasHdi ? `
        <div class="glass" style="padding:20px;border-radius:18px;margin-bottom:20px;display:flex;gap:14px;align-items:flex-start" data-reveal id="compose-box">
          <div style="width:40px;height:40px;border-radius:50%;background:var(--gradient-brand);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:1rem;flex-shrink:0">${(user.name||user.email||'U')[0].toUpperCase()}</div>
          <div style="flex:1;min-width:0">
            <textarea id="compose-text" maxlength="280" style="width:100%;min-height:72px;background:transparent;border:none;outline:none;color:inherit;font-family:inherit;font-size:0.95rem;line-height:1.65;resize:none" placeholder="Share something true…" oninput="zsUpdateCompose()"></textarea>
            <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.07);padding-top:10px;margin-top:4px">
              <span id="compose-counter" style="font-size:0.72rem;opacity:0.35;transition:color 0.2s">0 / 280</span>
              <button id="compose-btn" class="btn-primary" style="font-size:0.8rem;padding:7px 18px" onclick="communityPost()">Post truth</button>
            </div>
          </div>
        </div>` : loggedIn ? `
        <div style="padding:14px 18px;border-radius:14px;background:rgba(4,106,56,0.07);border:1px solid rgba(4,106,56,0.20);margin-bottom:20px;font-size:0.87rem" data-reveal>
          ✦ Complete <a href="#" data-page="verify" style="color:var(--brand-green);font-weight:700">identity verification</a> to post in the community.
        </div>` : `
        <div style="padding:14px 18px;border-radius:14px;background:rgba(4,106,56,0.07);border:1px solid rgba(4,106,56,0.20);margin-bottom:20px;font-size:0.87rem" data-reveal>
          ✦ <a href="#" data-page="register" style="color:var(--brand-green);font-weight:700">Join free</a> or <a href="#" data-page="login" style="color:var(--brand-green)">sign in</a> to post.
        </div>`}

        <div id="comm-feed" style="display:flex;flex-direction:column;gap:14px">
          <div style="padding:40px;text-align:center;opacity:0.4;font-size:0.88rem">Loading feed…</div>
        </div>

        <div id="comm-more-wrap" style="display:none;text-align:center;margin-top:20px">
          <button class="btn-login" style="padding:10px 28px;font-size:0.84rem" onclick="communityLoadMore()">Load more posts</button>
        </div>
      </div>

      <aside id="comm-sidebar">
        <div class="glass" style="padding:20px;border-radius:18px;margin-bottom:16px" data-reveal>
          <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--brand-green);margin-bottom:14px">Top verified members</p>
          <div style="display:flex;flex-direction:column;gap:12px">
            ${_sampleMembers().map(m => `
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:36px;height:36px;border-radius:50%;background:var(--gradient-brand);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:0.85rem;flex-shrink:0">${m.name[0]}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:0.875rem;font-weight:700">${m.name} <span style="color:var(--brand-green);font-size:0.7rem">✓</span></div>
                <div style="font-size:0.73rem;opacity:0.45">${m.handle}</div>
              </div>
              <span style="font-size:0.65rem;font-weight:800;padding:3px 8px;border-radius:999px;background:rgba(4,106,56,0.12);color:var(--brand-green);border:1px solid rgba(4,106,56,0.22);text-transform:uppercase">${m.tier}</span>
            </div>`).join('')}
          </div>
        </div>
        <div class="glass" style="padding:20px;border-radius:18px;margin-bottom:16px" data-reveal>
          <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--brand-orange);margin-bottom:12px">Trending</p>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${['#TruthOnline','#RealIdentity','#HDI','#DigitalSelf','#ZeroSoils','#NoFakeProfiles'].map(t =>
              `<span style="padding:4px 10px;border-radius:999px;font-size:0.72rem;font-weight:700;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);cursor:pointer">${t}</span>`).join('')}
          </div>
        </div>
        <div class="glass" style="padding:16px 20px;border-radius:14px" data-reveal>
          <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;opacity:0.4;margin-bottom:10px">Platform</p>
          <div style="display:flex;flex-direction:column;gap:8px">
            <a href="/hdi" data-page="hdi" data-section="id-formula" style="font-size:0.83rem;opacity:0.6;color:inherit">How HDI works →</a>
            <a href="#" data-page="verify-hdi"    style="font-size:0.83rem;opacity:0.6;color:inherit">Verify an HDI →</a>
            <a href="#" data-page="support"        style="font-size:0.83rem;opacity:0.6;color:inherit">Help &amp; Support →</a>
          </div>
        </div>
      </aside>
    </div>
  </div>
  <style>@media(max-width:720px){#comm-sidebar{display:none}}</style>
  `;

  // ── State ───────────────────────────────────────────────────
  let _page    = 0;
  let _loading = false;
  let _hasMore = false;

  // ── Expose functions to window (inline onclick scope) ────────

  window.zsUpdateCompose = () => {
    const ta  = document.getElementById('compose-text');
    const ctr = document.getElementById('compose-counter');
    const btn = document.getElementById('compose-btn');
    if (!ta || !ctr) return;
    const n = ta.value.length;
    ctr.textContent = `${n} / 280`;
    ctr.style.color = n > 250 ? (n > 270 ? '#f87171' : '#fbbf24') : '';
    if (btn) btn.disabled = n === 0 || n > 280;
  };

  window.communityPost = async () => {
    const ta  = document.getElementById('compose-text');
    const btn = document.getElementById('compose-btn');
    if (!ta) return;
    const body = ta.value.trim();
    if (!body) return;
    btn.disabled = true; btn.textContent = 'Posting…';
    try {
      const res = await zsApi('/api/community/posts', { method:'POST', body:{ body } });
      if (!res.ok) { window.toast(res.error || 'Failed to post', 'error'); return; }
      ta.value = '';
      window.zsUpdateCompose();
      // Prepend the new post to the feed
      const feed = document.getElementById('comm-feed');
      if (feed) {
        const card = document.createElement('div');
        card.innerHTML = _commPostCard(res.post, true);
        feed.prepend(card.firstElementChild);
      }
      window.toast('+1 ZS earned for posting truth ✦', 'success');
      if (window.zsAudio?.fanfare) window.zsAudio.fanfare();
    } finally {
      btn.disabled = false; btn.textContent = 'Post truth';
    }
  };

  window.communityLoadMore = async () => {
    if (_loading || !_hasMore) return;
    _page++;
    await _loadFeed(_page, true);
  };

  window.communityLike = async (postId) => {
    if (!Auth.isLoggedIn()) { window.toast('Sign in to like posts', 'error'); return; }
    await _react(postId, 'like');
  };

  window.communityTrust = async (postId) => {
    if (!Auth.isLoggedIn()) { window.toast('Sign in to give truth votes', 'error'); return; }
    await _react(postId, 'trust');
  };

  window.communityToggleComments = async (postId) => {
    const panel = document.getElementById(`comments-${postId}`);
    if (!panel) return;
    if (panel.dataset.loaded) {
      panel.style.display = panel.style.display === 'none' ? '' : 'none';
      return;
    }
    panel.dataset.loaded = '1';
    panel.innerHTML = `<div style="padding:12px;font-size:0.8rem;opacity:0.4">Loading…</div>`;
    panel.style.display = '';
    const res = await zsApi(`/api/community/comments?postId=${postId}`);
    _renderComments(panel, postId, res.comments || []);
  };

  window.communitySubmitComment = async (postId) => {
    const inp = document.getElementById(`comment-input-${postId}`);
    if (!inp) return;
    const body = inp.value.trim();
    if (!body) return;
    inp.disabled = true;
    const res = await zsApi('/api/community/comments', { method:'POST', body:{ postId, body } });
    inp.disabled = false;
    if (!res.ok) { window.toast(res.error || 'Failed to comment', 'error'); return; }
    inp.value = '';
    // Append new comment to panel
    const panel = document.getElementById(`comments-${postId}`);
    const list  = panel?.querySelector('.comm-cmt-list');
    if (list) {
      const el = document.createElement('div');
      el.innerHTML = _commCommentRow(res.comment);
      list.appendChild(el.firstElementChild);
    }
    // Increment comment count badge
    const badge = document.getElementById(`cmt-count-${postId}`);
    if (badge) badge.textContent = (parseInt(badge.textContent) || 0) + 1;
  };

  // ── Helpers ─────────────────────────────────────────────────

  async function _react(postId, type) {
    const btn   = document.getElementById(`btn-${type}-${postId}`);
    const count = document.getElementById(`${type}-count-${postId}`);
    if (!btn) return;
    btn.disabled = true;
    const res = await zsApi('/api/community/react', { method:'POST', body:{ postId, type } });
    btn.disabled = false;
    if (!res.ok) { window.toast(res.error || 'Failed', 'error'); return; }
    if (count) count.textContent = res.count;
    if (type === 'like') {
      btn.style.color = res.active ? '#f87171' : '';
      btn.style.background = res.active ? 'rgba(248,113,113,0.10)' : '';
    } else {
      btn.style.color = res.active ? 'var(--brand-green)' : '';
      btn.style.background = res.active ? 'rgba(4,106,56,0.12)' : '';
    }
  }

  function _renderComments(panel, postId, comments) {
    const canPost = hasHdi;
    panel.innerHTML = `
      <div class="comm-cmt-list" style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">
        ${comments.length ? comments.map(_commCommentRow).join('') :
          `<p style="font-size:0.8rem;opacity:0.35;margin:0">No comments yet. Be first.</p>`}
      </div>
      ${canPost ? `
      <div style="display:flex;gap:8px;align-items:center">
        <input id="comment-input-${postId}" type="text" maxlength="280"
          placeholder="Reply…"
          style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;font-size:0.83rem;color:inherit;outline:none;font-family:inherit"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();communitySubmitComment(${postId})}"
        />
        <button class="btn-primary" style="font-size:0.78rem;padding:8px 14px;flex-shrink:0"
          onclick="communitySubmitComment(${postId})">Reply</button>
      </div>` : `<p style="font-size:0.78rem;opacity:0.38;margin:0">Verify your identity to comment.</p>`}
    `;
  }

  function _commCommentRow(c) {
    const ago = _timeAgo(c.createdAt);
    return `
    <div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
      <div style="width:28px;height:28px;border-radius:50%;background:var(--gradient-brand);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:0.72rem;flex-shrink:0">${c.authorName[0]}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:0.78rem;font-weight:700;margin-bottom:3px">${_esc(c.authorName)} <span style="font-size:0.65rem;opacity:0.38;font-weight:400">${ago}</span></div>
        <div style="font-size:0.83rem;opacity:0.75;line-height:1.55">${_esc(c.body)}</div>
      </div>
    </div>`;
  }

  async function _loadFeed(page, append = false) {
    if (_loading) return;
    _loading = true;
    const feed = document.getElementById('comm-feed');
    if (!append && feed) feed.innerHTML = `<div style="padding:40px;text-align:center;opacity:0.4;font-size:0.88rem">Loading…</div>`;
    try {
      const data = await zsApi(`/api/community/posts?page=${page}`);
      _hasMore = data.hasMore || false;
      const wrap = document.getElementById('comm-more-wrap');
      if (wrap) wrap.style.display = _hasMore ? '' : 'none';
      if (!data.posts?.length && !append) {
        if (feed) feed.innerHTML = `<div style="padding:40px;text-align:center;opacity:0.35;font-size:0.88rem">No posts yet — be the first to share something true.</div>`;
        return;
      }
      const cards = (data.posts || []).map(p => _commPostCard(p)).join('');
      if (feed) {
        if (append) feed.insertAdjacentHTML('beforeend', cards);
        else        feed.innerHTML = cards;
      }
    } catch(e) {
      if (feed && !append) feed.innerHTML = `<div style="padding:40px;text-align:center;opacity:0.35;font-size:0.88rem">Could not load feed. Refresh to try again.</div>`;
    } finally {
      _loading = false;
    }
  }

  // ── Boot ─────────────────────────────────────────────────────
  _loadFeed(0);
});

function _commPostCard(p, fresh = false) {
  const tierColor = { truth:'var(--brand-green)', gold:'#D4AF37', silver:'#A8B8C0', bronze:'#CD7F32' };
  const tierIcon  = { truth:'✦', gold:'🥇', silver:'🥈', bronze:'🥉' };
  const tc        = tierColor[p.authorTier] || '#fff';
  const ago       = _timeAgo(p.createdAt);
  const likeStyle = p.likedByMe
    ? 'color:#f87171;background:rgba(248,113,113,0.10)'
    : 'opacity:0.52;background:transparent';
  const trustStyle = p.trustedByMe
    ? 'color:var(--brand-green);background:rgba(4,106,56,0.12)'
    : 'color:var(--brand-green);background:rgba(4,106,56,0.07)';

  return `
  <div class="glass" style="padding:22px;border-radius:18px${fresh ? ';animation:zsRtIn 0.3s ease' : ''}" id="post-${p.id}">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:11px">
        <div style="width:40px;height:40px;border-radius:50%;background:var(--gradient-brand);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;flex-shrink:0">${p.authorName[0]}</div>
        <div>
          <div style="font-size:0.9rem;font-weight:700;display:flex;align-items:center;gap:5px">
            ${_esc(p.authorName)}
            <span style="color:var(--brand-green);font-size:0.68rem">✓</span>
          </div>
          <div style="font-size:0.73rem;opacity:0.45;display:flex;align-items:center;gap:5px">
            <span style="font-family:monospace;font-size:0.68rem">${_esc(p.authorHdi)}</span>
            <span>·</span>
            <span style="color:${tc};font-weight:700">${tierIcon[p.authorTier]||''} ${p.authorTier}</span>
          </div>
        </div>
      </div>
      <span style="font-size:0.72rem;opacity:0.38;white-space:nowrap;flex-shrink:0">${ago}</span>
    </div>

    <p style="font-size:0.93rem;line-height:1.68;margin-bottom:16px">${_esc(p.body)}</p>

    <div style="display:flex;gap:4px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);flex-wrap:wrap;align-items:center">
      <button id="btn-like-${p.id}" onclick="communityLike(${p.id})"
        style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:999px;font-size:0.78rem;font-weight:500;border:none;cursor:pointer;${likeStyle};transition:all 0.18s">
        🤍 <span id="like-count-${p.id}">${p.likes}</span>
      </button>
      <button id="btn-trust-${p.id}" onclick="communityTrust(${p.id})"
        style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:999px;font-size:0.78rem;font-weight:700;border:none;cursor:pointer;${trustStyle};transition:all 0.18s">
        ✦ <span id="trust-count-${p.id}">${p.trusts}</span> truth
      </button>
      <button onclick="communityToggleComments(${p.id})"
        style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:999px;font-size:0.78rem;opacity:0.52;border:none;background:transparent;color:inherit;cursor:pointer">
        💬 <span id="cmt-count-${p.id}">${p.commentCount}</span>
      </button>
      <button onclick="communityShare(${p.id})"
        style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:999px;font-size:0.78rem;opacity:0.52;border:none;background:transparent;color:inherit;cursor:pointer;margin-left:auto">
        ↗ Share
      </button>
      <button onclick="zsReportContent('post-${p.id}','post','${_esc(p.authorHdi)}',${p.id})"
        style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:999px;font-size:0.72rem;opacity:0.25;border:none;background:transparent;color:inherit;cursor:pointer"
        title="Report this content">⚑</button>
    </div>

    <div id="comments-${p.id}" style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.06);display:none"></div>
  </div>`;
}

function communityShare(postId) {
  const url = `${location.origin}/community#post-${postId}`;
  navigator.clipboard?.writeText(url).then(() => window.toast('Link copied', 'success')).catch(() => {});
}
window.communityShare = communityShare;

function _esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day:'numeric', month:'short' });
}

// ── HDI ───────────────────────────────────────────────────
Router.register('hdi', root => {
  const IP    = 'padding:24px;border-radius:18px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03)';
  const account = Auth.getUser();
  const hdiAction = !account
    ? `<a href="/register" data-page="register" class="btn-primary">Create account</a>
       <a href="/verify-hdi" data-page="verify-hdi" class="btn-login">Verify an HDI</a>`
    : !account.hdi_code
      ? `<a href="/verify" data-page="verify" class="btn-primary">Complete verification</a>
         <a href="/verify-hdi" data-page="verify-hdi" class="btn-login">Verify an HDI</a>`
      : `<a href="/dashboard" data-page="dashboard" class="btn-primary">View my HDI</a>
         <a href="/verify-hdi" data-page="verify-hdi" class="btn-login">Verify another HDI</a>`;
  const hdiStatus = !account ? 'Create an account to begin issuance.'
    : !account.hdi_code ? 'Your HDI is pending required verification.'
      : `Issued identity: ${account.hdi_code}`;

  root.innerHTML = `
  <div class="zs-workspace">

  <div class="zs-workspace-content" style="max-width:1100px;margin:0 auto;padding:0 clamp(16px,4vw,48px) 80px">

  <!-- ════ ① OVERVIEW ════ -->
  <section id="id-overview" style="padding-top:64px">
    <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green);margin-bottom:10px">Human Digital Identity</p>
    <h1 style="font-size:clamp(2rem,5vw,3.5rem);font-weight:900;line-height:1.06;letter-spacing:-0.03em;margin-bottom:18px">One person.<br>One truth.<br><span style="background:var(--gradient-brand);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">One identity.</span></h1>
    <p style="opacity:0.65;font-size:1.02rem;line-height:1.8;max-width:60ch;margin-bottom:40px">HDI is a permanent identity code issued after your name, mobile number and email are connected to one verified account. Your password secures access, but never changes your identity.</p>

    <div class="zs-service-action" data-reveal>
      <div>
        <p class="zs-service-action-label">Your next action</p>
        <strong>${hdiStatus}</strong>
      </div>
      <div class="zs-service-action-buttons">${hdiAction}</div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;margin-bottom:32px" data-reveal>
      ${[['🧬','Identity Inputs','Full name, mobile number and email establish the identity application.'],
         ['🔐','Ownership Verified','Both email and mobile OTP checks are required before an HDI can be issued.'],
         ['🪪','Permanent Record','After issuance, your username and HDI stay fixed even when a password changes.'],
         ['🌱','Account-first','Use only identity signals that the platform has actually verified.'],
        ].map(([icon,t,d])=>`
      <div style="${IP}">
        <div style="font-size:1.4rem;margin-bottom:10px">${icon}</div>
        <div style="font-weight:700;font-size:0.95rem;margin-bottom:7px">${t}</div>
        <div style="font-size:0.82rem;opacity:0.55;line-height:1.65">${d}</div>
      </div>`).join('')}
    </div>

    <div style="${IP}" data-reveal>
      <p style="font-size:0.68rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--brand-green);margin-bottom:16px">HDI Code Anatomy</p>
      <div style="display:flex;flex-wrap:wrap;align-items:flex-start;gap:16px;margin-bottom:18px">
        ${[['AKY','Initials','Up to 3 chars from full name'],['2026','Year','Year HDI was issued'],['3F8A2C','Secure ID','Permanent issuance suffix']].map(([val,lbl,desc],i)=>`
        <div style="display:flex;align-items:center;gap:10px">
          <div style="text-align:center">
            <div style="font-family:monospace;font-size:1.4rem;font-weight:900;padding:10px 18px;border-radius:10px;background:rgba(4,106,56,0.12);border:1px solid rgba(4,106,56,0.28);color:var(--brand-green);letter-spacing:2px">${val}</div>
            <div style="font-size:0.7rem;font-weight:700;margin-top:4px">${lbl}</div>
            <div style="font-size:0.62rem;opacity:0.38;margin-top:2px">${desc}</div>
          </div>
          ${i<2?`<span style="font-size:1.4rem;opacity:0.25;margin-top:-16px">—</span>`:''}
        </div>`).join('')}
      </div>
      <div style="padding:12px 18px;border-radius:10px;background:rgba(4,106,56,0.06);border:1px dashed rgba(4,106,56,0.22);font-family:monospace;font-size:1rem;letter-spacing:3px;color:var(--brand-green);text-align:center;font-weight:900">AKY-2026-3F8A2C</div>
    </div>
  </section>

  <!-- ════ ② FORMULA ════ -->
  <section id="id-formula" style="padding-top:80px;border-top:1px solid rgba(255,255,255,0.05);margin-top:60px">
    <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green);margin-bottom:10px">HDI Formula</p>
    <h2 style="font-size:clamp(1.6rem,3.5vw,2.5rem);font-weight:900;letter-spacing:-0.02em;margin-bottom:12px">How your code is built.</h2>
    <p style="opacity:0.55;max-width:56ch;line-height:1.75;margin-bottom:36px">Registration requires your name, mobile number, email and password. Email and mobile are verified first. The server then issues a unique permanent username and HDI; the password remains a replaceable security credential.</p>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-bottom:32px;position:relative" data-reveal>
      <div style="position:absolute;top:28px;left:calc(12.5% + 4px);right:calc(12.5% + 4px);height:2px;background:linear-gradient(90deg,var(--brand-green),var(--brand-orange));pointer-events:none;z-index:0"></div>
      ${[['01','Register','Name + mobile + email','Required identity inputs'],
         ['02','Protect','Password','Secures account access only'],
         ['03','Verify','Email OTP + mobile OTP','Ownership must be confirmed'],
         ['04','Issue','username + HDI','Permanent after issuance'],
        ].map(([n,t,v,d])=>`
      <div style="display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 10px;position:relative;z-index:1">
        <div style="width:48px;height:48px;border-radius:50%;background:var(--brand-green);border:2px solid var(--brand-green);display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:900;color:#fff;margin-bottom:10px">${n}</div>
        <p style="font-size:0.68rem;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:var(--brand-green);margin-bottom:5px">${t}</p>
        <code style="font-size:0.7rem;padding:3px 7px;border-radius:5px;background:rgba(255,255,255,0.05);margin-bottom:5px;font-weight:700">${v}</code>
        <p style="font-size:0.71rem;opacity:0.4;line-height:1.45">${d}</p>
      </div>`).join('')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div style="${IP}" data-reveal>
        <p style="font-size:0.68rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--brand-green);margin-bottom:12px">Permanent Identity Rules</p>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${['Full name required at enrollment','Mobile ownership verified by OTP','Email ownership verified by OTP','One verified mobile may activate one HDI','Password can be reset without replacing HDI','Issued identifiers cannot be edited'].map(s=>`
          <div style="display:flex;align-items:center;gap:8px;font-size:0.8rem;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
            <span style="color:var(--brand-green);font-size:0.65rem;flex-shrink:0">✦</span>${s}</div>`).join('')}
        </div>
        <p style="font-size:0.75rem;opacity:0.38;margin-top:10px;line-height:1.6">Changing devices does not change your issued identity. Account recovery must restore access to the same HDI.</p>
      </div>
      <div style="${IP}" data-reveal>
        <p style="font-size:0.68rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--brand-green);margin-bottom:12px">Issuance Protocol</p>
        <pre style="font-family:monospace;font-size:0.74rem;line-height:1.75;opacity:0.72;overflow-x:auto;margin:0;white-space:pre-wrap;tab-size:2">required = [fullName, mobile, email, password]
verify(emailOTP) &amp;&amp; verify(mobileOTP)
identity = secureIssue(fullName, mobile, email)
username = permanent(identity)
HDI      = initials + '-' + year + '-' + suffix
password = replaceableAccessCredential()</pre>
        <p style="font-size:0.75rem;opacity:0.38;margin-top:10px">The public protocol is documented; private issuance keys are protected server credentials.</p>
      </div>
    </div>
  </section>

  <!-- ════ ③ VERIFY ════ -->
  <section id="id-verify" style="padding-top:80px;border-top:1px solid rgba(255,255,255,0.05);margin-top:60px">
    <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green);margin-bottom:10px">Verification</p>
    <h2 style="font-size:clamp(1.6rem,3.5vw,2.5rem);font-weight:900;letter-spacing:-0.02em;margin-bottom:12px">Confirm your channels.</h2>
    <p style="opacity:0.55;max-width:56ch;line-height:1.75;margin-bottom:36px">Email and mobile OTP verification confirms access to the contact channels used for the account. Once both complete, Zero Soils issues the permanent HDI.</p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:28px">
      ${[{ n:'01', title:'Email Verification', reward:'Required for issuance', body:'A 6-digit OTP is sent to your registered email. Confirming it validates access to that inbox.', icon:'📧', badge:'Required' },
         { n:'02', title:'Phone Verification', reward:'Required for issuance', body:'An SMS OTP is sent to your mobile number. This confirms access to the number used for this account.', icon:'📱', badge:'Issues HDI' },
        ].map(v=>`
      <div style="${IP}" data-reveal>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
          <div style="width:44px;height:44px;border-radius:12px;background:rgba(4,106,56,0.12);border:1px solid rgba(4,106,56,0.25);display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0">${v.icon}</div>
          <div><div style="font-size:0.62rem;font-weight:900;color:var(--brand-orange);font-family:monospace;margin-bottom:2px">${v.n}</div><div style="font-weight:700;font-size:0.95rem">${v.title}</div></div>
        </div>
        <p style="font-size:0.84rem;opacity:0.6;line-height:1.65;margin-bottom:14px">${v.body}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span style="font-size:0.68rem;font-weight:800;padding:4px 10px;border-radius:999px;background:rgba(4,106,56,0.12);border:1px solid rgba(4,106,56,0.25);color:var(--brand-green)">${v.reward}</span>
          <span style="font-size:0.68rem;font-weight:700;padding:4px 10px;border-radius:999px;background:rgba(255,103,31,0.08);border:1px solid rgba(255,103,31,0.2);color:var(--brand-orange)">${v.badge}</span>
        </div>
      </div>`).join('')}
    </div>

    <div style="${IP};max-width:500px" data-reveal>
      <p style="font-size:0.68rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--brand-green);margin-bottom:16px">Verification Journey</p>
      ${[['Register','Submit required identity and access details','var(--brand-green)','Start'],
         ['Email OTP','Confirm access to your inbox','var(--brand-green)','Required'],
         ['Mobile OTP','Confirm number and issue permanent HDI','var(--brand-green)','Issue'],
        ].map(([t,d,c,tier],i)=>`
      <div style="display:flex;gap:14px;align-items:flex-start">
        <div style="display:flex;flex-direction:column;align-items:center">
          <div style="width:34px;height:34px;border-radius:50%;background:${c};display:flex;align-items:center;justify-content:center;font-size:0.68rem;font-weight:900;color:#fff;flex-shrink:0">${i+1}</div>
          ${i<2?`<div style="width:2px;min-height:28px;background:rgba(4,106,56,0.22);margin:4px 0;flex:1"></div>`:''}
        </div>
        <div style="padding-bottom:18px;flex:1">
          <div style="font-weight:700;font-size:0.88rem;margin-bottom:2px">${t}</div>
          <div style="font-size:0.76rem;opacity:0.48;margin-bottom:5px">${d}</div>
          <span style="font-size:0.62rem;font-weight:800;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.10)">${tier}</span>
        </div>
      </div>`).join('')}
    </div>

    <div class="zs-service-action-buttons" style="margin-top:24px">${hdiAction}</div>
  </section>

  </div>
  </div>

  <style>
    @media(max-width:700px){
      [style*="grid-template-columns:1fr 1fr"]{grid-template-columns:1fr!important}
      [style*="grid-template-columns:repeat(4"]{grid-template-columns:repeat(2,1fr)!important}
    }
  </style>
  `;

});

// ── VERIFY ────────────────────────────────────────────────
Router.register('verify', root => {
  if (!Auth.isLoggedIn()) { Router.go('login'); return; }
  const user = Auth.getUser();
  if (user?.hdi_code) { Router.go('dashboard'); return; }

  const esc       = v => String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const emailDone = Boolean(user?.email_verified);
  const phoneDone = Boolean(user?.phone_verified);

  function stepState(done, active) {
    if (done)   return { border:'var(--brand-green)', bg:'rgba(4,106,56,0.08)', badge:'<span style="font-size:0.7rem;font-weight:800;color:var(--brand-green);background:rgba(4,106,56,0.12);padding:3px 10px;border-radius:999px">Done ✓</span>' };
    if (active) return { border:'var(--brand-orange)', bg:'rgba(255,103,31,0.05)', badge:'<span style="font-size:0.7rem;font-weight:800;color:var(--brand-orange);background:rgba(255,103,31,0.1);padding:3px 10px;border-radius:999px">In progress</span>' };
    return       { border:'rgba(255,255,255,0.08)', bg:'rgba(255,255,255,0.02)', badge:'<span style="font-size:0.7rem;font-weight:700;opacity:0.35;padding:3px 10px;border-radius:999px;border:1px solid rgba(255,255,255,0.1)">Pending</span>' };
  }

  const emailState = stepState(emailDone, !emailDone);
  const phoneState = stepState(phoneDone, emailDone && !phoneDone);

  // Progress bar steps
  const steps = [
    { label:'Register',   done:true },
    { label:'Email OTP',  done:emailDone },
    { label:'Phone OTP',  done:phoneDone },
    { label:'HDI Issued', done:false },
  ];

  root.innerHTML = `
  <div class="zs-auth-page zs-auth-page--verify">
    <div style="width:100%;max-width:580px">

      <!-- Progress indicator -->
      <div style="display:flex;align-items:center;gap:0;margin-bottom:28px;padding:0 4px">
        ${steps.map((s, i) => `
          <div style="display:flex;flex-direction:column;align-items:center;flex:1;position:relative">
            <div style="width:32px;height:32px;border-radius:50%;border:2px solid ${s.done?'var(--brand-green)':'rgba(255,255,255,0.15)'};background:${s.done?'var(--brand-green)':'rgba(255,255,255,0.04)'};display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:800;color:${s.done?'#fff':'rgba(255,255,255,0.4)'};z-index:1;position:relative">
              ${s.done ? '✓' : String(i+1).padStart(2,'0')}
            </div>
            <div style="font-size:0.62rem;font-weight:700;margin-top:5px;opacity:${s.done?'0.9':'0.38'};text-align:center;white-space:nowrap">${s.label}</div>
            ${i < steps.length - 1 ? `<div style="position:absolute;top:15px;left:50%;width:100%;height:2px;background:${s.done?'var(--brand-green)':'rgba(255,255,255,0.08)'};z-index:0"></div>` : ''}
          </div>`).join('')}
      </div>

      <div class="glass" style="padding:clamp(22px,5vw,36px);border-radius:22px">
        <h1 style="font-size:clamp(1.4rem,3.5vw,1.9rem);font-weight:900;margin-bottom:6px;text-align:center">Confirm your identity</h1>
        <p style="opacity:0.5;font-size:0.88rem;line-height:1.65;text-align:center;margin-bottom:28px">Verify email and mobile to receive your permanent HDI code.</p>

        <div style="display:flex;flex-direction:column;gap:14px">

          <!-- Email card -->
          <div id="card-email" style="padding:20px;border-radius:14px;border:1px solid ${emailState.border};background:${emailState.bg};transition:border-color .3s,background .3s">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:${emailDone?'0':'14px'}">
              <div>
                <div style="font-size:0.92rem;font-weight:700">Email verification</div>
                <div style="font-size:0.75rem;opacity:0.45;margin-top:2px">${esc(user?.email)}</div>
              </div>
              ${emailState.badge}
            </div>
            ${emailDone ? '' : `<div id="verify-email-ui">
              <button onclick="verifySendCode('email')" class="btn-primary" style="font-size:0.84rem;width:100%;padding:10px">Send email code</button>
            </div>`}
          </div>

          <!-- Phone card -->
          <div id="card-phone" style="padding:20px;border-radius:14px;border:1px solid ${phoneState.border};background:${phoneState.bg};transition:border-color .3s,background .3s">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:${phoneDone?'0':'14px'}">
              <div>
                <div style="font-size:0.92rem;font-weight:700">Mobile verification</div>
                <div style="font-size:0.75rem;opacity:0.45;margin-top:2px">${esc(user?.phone || 'Registered mobile number')}</div>
              </div>
              ${phoneState.badge}
            </div>
            ${phoneDone ? '' : `<div id="verify-phone-ui">
              <button onclick="verifySendCode('phone')" ${!emailDone ? 'disabled style="opacity:0.4;cursor:not-allowed;font-size:0.84rem;width:100%;padding:10px" title="Verify email first"' : 'class="btn-primary" style="font-size:0.84rem;width:100%;padding:10px"'}>Send SMS code</button>
              <p style="font-size:0.71rem;opacity:0.4;line-height:1.5;margin-top:8px">On supported mobile browsers, the code can be auto-detected from the verification SMS after your approval.</p>
            </div>`}
          </div>

        </div>

        <!-- HDI Reveal (shown after both verified) -->
        <div id="verify-hdi-reveal" style="display:none;margin-top:20px;padding:26px;border-radius:16px;background:linear-gradient(135deg,rgba(4,106,56,0.12),rgba(4,106,56,0.05));border:1px solid rgba(4,106,56,0.30);text-align:center">
          <div style="font-size:1.5rem;margin-bottom:10px">✦</div>
          <p style="font-size:0.7rem;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:var(--brand-green);margin-bottom:8px">HDI Issued</p>
          <p style="font-size:0.88rem;opacity:0.6;margin-bottom:18px">Your permanent Human Digital Identity has been issued.</p>
          <div style="display:inline-flex;align-items:center;gap:10px;padding:12px 20px;border-radius:12px;background:rgba(4,106,56,0.15);border:1px solid rgba(4,106,56,0.3);margin-bottom:8px">
            <span id="reveal-hdi-code" style="font-family:monospace;font-size:1.1rem;font-weight:900;color:var(--brand-green);letter-spacing:3px"></span>
            <button id="reveal-copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('reveal-hdi-code').textContent).then(()=>window.toast('HDI copied ✓','success'))" style="background:none;border:none;cursor:pointer;opacity:0.5;font-size:1rem;padding:2px 4px" title="Copy HDI">⎘</button>
          </div>
          <p id="reveal-username" style="font-family:monospace;font-size:0.82rem;opacity:0.5;margin-bottom:22px"></p>
          <a href="#" class="btn-primary" data-page="dashboard" style="display:inline-flex">Go to Dashboard →</a>
        </div>

        <p id="verify-error" style="font-size:0.82rem;color:#f87171;min-height:1.2em;margin-top:14px;text-align:center"></p>
      </div>

    </div>
  </div>`;

  let webOtpController = null;
  const resendTimers = {};

  function showError(message = '') {
    const el = document.getElementById('verify-error');
    if (el) el.textContent = message;
  }

  function startResendTimer(type, seconds = 60) {
    clearInterval(resendTimers[type]);
    let rem = seconds;
    const btn = document.getElementById(`resend-${type}-btn`);
    if (btn) { btn.disabled = true; btn.textContent = `Resend in ${rem}s`; }
    resendTimers[type] = setInterval(() => {
      rem--;
      const b = document.getElementById(`resend-${type}-btn`);
      if (b && document.contains(b)) {
        if (rem <= 0) {
          clearInterval(resendTimers[type]);
          b.disabled = false; b.textContent = 'Resend code';
        } else {
          b.textContent = `Resend in ${rem}s`;
        }
      } else {
        clearInterval(resendTimers[type]);
      }
    }, 1000);
  }

  function showHdiReveal(verifiedUser) {
    const reveal = document.getElementById('verify-hdi-reveal');
    if (!reveal) return;
    const codeEl    = document.getElementById('reveal-hdi-code');
    const userEl    = document.getElementById('reveal-username');
    if (codeEl) codeEl.textContent = verifiedUser.hdi_code || '';
    if (userEl) userEl.textContent = verifiedUser.username ? `@${verifiedUser.username}` : '';
    reveal.style.display = 'block';
    reveal.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function setupIssuedIdentity(verifiedUser) {
    if (!verifiedUser?.hdi_code) return false;
    HDI.save(verifiedUser.hdi_code, verifiedUser.name || '', verifiedUser.username || '', verifiedUser.phone || '');
    const wallet = await ZsWallet.loadOrCreate({ code: verifiedUser.hdi_code, name: verifiedUser.name || '' });
    for (const [verified, flag, label] of [
      [verifiedUser.email_verified, 'emailVerified', 'Email'],
      [verifiedUser.phone_verified, 'phoneVerified', 'Phone'],
    ]) {
      if (!verified || wallet[flag]) continue;
      wallet[flag] = true;
      ZsWallet.save(wallet);
      if (Number(wallet.balance || 0) + 5 <= ZS_MAX_SUPPLY) {
        await ZsWallet.addTx(wallet, { type: `${label} verification reward`, direction:'credit', amount:5, note:'OTP verification complete' });
      }
    }
    return true;
  }

  async function completeStep(type, code) {
    showError();
    try {
      const result = await API.post(`/auth/verify-${type}-otp`, { code });
      await Auth.check();
      const verifiedUser = Auth.getUser()?.hdi_code ? Auth.getUser() : result.user;
      const issued = await setupIssuedIdentity(verifiedUser);
      if (issued) {
        // Show HDI reveal in-page instead of redirecting
        showHdiReveal(verifiedUser);
        window.toast(`HDI issued: ${verifiedUser.hdi_code}`, 'success', 6000);
      } else {
        window.toast(`${type === 'email' ? 'Email' : 'Mobile'} verified ✓ — complete the next step.`, 'success');
        Router.go('verify');
      }
    } catch (ex) {
      showError(ex.message);
    }
  }

  async function watchForPhoneOtp() {
    if (!('OTPCredential' in window) || !navigator.credentials) return;
    webOtpController?.abort();
    webOtpController = new AbortController();
    try {
      const otp = await navigator.credentials.get({
        otp: { transport: ['sms'] },
        signal: webOtpController.signal,
      });
      if (Router.current !== 'verify' || !otp?.code) return;
      const input = document.getElementById('verify-phone-code');
      if (input) input.value = otp.code;
      await completeStep('phone', otp.code);
    } catch (ex) {
      if (ex.name !== 'AbortError') showError('Automatic SMS detection was unavailable. Enter the code manually.');
    }
  }

  window.verifySendCode = async type => {
    const ui = document.getElementById(`verify-${type}-ui`);
    if (!ui) return;
    showError();
    ui.innerHTML = `<p style="font-size:0.82rem;opacity:0.5">Sending code...</p>`;
    try {
      if (type === 'phone') watchForPhoneOtp();
      const delivery = await API.post(`/auth/send-${type}-otp`, {});
      ui.innerHTML = `<div style="display:flex;gap:8px">
        <input id="verify-${type}-code" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="6-digit code" style="flex:1;min-width:0;padding:10px 12px;background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.12);border-radius:10px;color:inherit;font-family:monospace;font-size:1rem;letter-spacing:3px;text-align:center;outline:none" />
        <button onclick="verifySubmitCode('${type}')" class="btn-primary" style="padding:10px 14px;font-size:0.82rem">Verify</button>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">
        <p style="font-size:0.72rem;opacity:0.45;margin:0">${delivery.dev_code ? 'Dev code filled in below.' : 'Code sent. Expires in 10 minutes.'}</p>
        <button id="resend-${type}-btn" onclick="verifySendCode('${type}')" style="font-size:0.72rem;opacity:0.6;background:none;border:none;cursor:pointer;color:inherit;padding:0;text-decoration:underline">Resend code</button>
      </div>`;
      const input = document.getElementById(`verify-${type}-code`);
      if (delivery.dev_code) input.value = delivery.dev_code;
      input?.focus();
      startResendTimer(type, 60);
    } catch (ex) {
      if (type === 'phone') webOtpController?.abort();
      ui.innerHTML = `<button onclick="verifySendCode('${type}')" class="btn-primary" style="font-size:0.84rem;width:100%;padding:10px">Send code again</button>`;
      showError(ex.message);
    }
  };

  window.verifySubmitCode = async type => {
    const code = document.getElementById(`verify-${type}-code`)?.value.trim() || '';
    if (!/^\d{6}$/.test(code)) { showError('Enter the 6-digit verification code.'); return; }
    if (type === 'phone') webOtpController?.abort();
    await completeStep(type, code);
  };
});

// ── LOGIN ─────────────────────────────────────────────────
Router.register('login', root => {
  if (Auth.isLoggedIn()) { Router.go('dashboard'); return; }
  root.innerHTML = `
  <div class="zs-auth-page">
    <div style="width:100%;max-width:400px">
      <div class="glass" style="padding:36px;border-radius:22px" data-reveal>
        <div style="text-align:center;margin-bottom:28px">
          <img src="/logo/night-logo.png" id="loginLogo" alt="Zero Soils" style="width:52px;height:52px;border-radius:12px;margin:0 auto 12px;display:block;object-fit:cover" />
          <h2 style="font-size:1.4rem;font-weight:900;margin-bottom:4px">Welcome back</h2>
          <p style="opacity:0.55;font-size:0.88rem">Sign in to your HDI</p>
        </div>
        <form id="login-form" style="display:flex;flex-direction:column;gap:14px">
          <div>
            <label style="display:block;font-size:0.8rem;font-weight:700;opacity:0.7;margin-bottom:6px">Email</label>
            <input class="field-input-zs" type="email" name="email" placeholder="you@example.com" required autocomplete="email" />
          </div>
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
              <label style="font-size:0.8rem;font-weight:700;opacity:0.7">Password</label>
              <a href="#" data-page="forgot-password" style="font-size:0.78rem;opacity:0.55;color:var(--brand-green)">Forgot password?</a>
            </div>
            <input class="field-input-zs" type="password" name="password" placeholder="••••••••" required autocomplete="current-password" />
          </div>
          <p id="login-err" style="font-size:0.83rem;color:#f87171;min-height:1.2em"></p>
          <button type="submit" class="btn-primary" style="width:100%;padding:13px">Sign in</button>
        </form>
        <div style="display:flex;align-items:center;gap:12px;margin:18px 0;opacity:0.35">
          <div style="flex:1;height:1px;background:currentColor"></div>or<div style="flex:1;height:1px;background:currentColor"></div>
        </div>
        <p style="text-align:center;font-size:0.875rem;opacity:0.6">
          No identity yet? <a href="#" data-page="register" style="color:var(--brand-green)">Claim your HDI →</a>
        </p>
      </div>
    </div>
  </div>
  <style>.field-input-zs{width:100%;padding:12px 14px;background:rgba(255,255,255,0.05);border:1.5px solid rgba(255,255,255,0.10);border-radius:12px;color:inherit;font-family:inherit;font-size:0.95rem;outline:none;transition:border-color 0.2s,box-shadow 0.2s}.field-input-zs:focus{border-color:var(--brand-green);box-shadow:0 0 0 3px rgba(4,106,56,0.14)}.field-input-zs::placeholder{opacity:0.38}</style>
  `;
  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const err = document.getElementById('login-err');
    btn.disabled = true; btn.textContent = '...'; err.textContent = '';
    try {
      const fd = new FormData(e.target);
      const user = await Auth.login(fd.get('email'), fd.get('password'));
      window.toast('Welcome back ✦', 'success');
      Router.go(user.hdi_code ? 'dashboard' : 'verify');
    } catch(ex) {
      err.textContent = ex.message;
      btn.disabled = false; btn.textContent = 'Sign in';
    }
  });
  const ll = document.getElementById('loginLogo');
  if (ll) ll.src = document.body.classList.contains('theme-light') ? '/logo/day-logo.png' : '/logo/night-logo.png';
});

// ── REGISTER ──────────────────────────────────────────────
Router.register('register', root => {
  if (Auth.isLoggedIn()) { Router.go('dashboard'); return; }
  root.innerHTML = `
  <div class="zs-auth-page zs-auth-page--register">
    <div style="width:100%;max-width:560px">
      <div class="glass" style="padding:36px;border-radius:22px" data-reveal>
        <div style="text-align:center;margin-bottom:28px">
          <img src="/logo/night-logo.png" id="regLogo" alt="Zero Soils" style="width:52px;height:52px;border-radius:12px;margin:0 auto 12px;display:block;object-fit:cover" />
          <h2 style="font-size:1.4rem;font-weight:900;margin-bottom:4px">Claim your HDI</h2>
          <p style="opacity:0.55;font-size:0.88rem">Create your account, verify both channels, receive your HDI.</p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:24px">
          ${[['01','Account'],['02','Verify'],['03','Issue HDI']].map(([n,label],i) => `
          <div style="padding:10px 8px;border-radius:10px;border:1px solid ${i===0?'rgba(4,106,56,.35)':'rgba(255,255,255,.08)'};background:${i===0?'rgba(4,106,56,.1)':'rgba(255,255,255,.025)'};text-align:center">
            <div style="font-family:monospace;font-size:.65rem;font-weight:800;color:${i===0?'var(--brand-green)':'rgba(255,255,255,.35)'};margin-bottom:3px">${n}</div>
            <div style="font-size:.75rem;font-weight:700;opacity:${i===0?'1':'.55'}">${label}</div>
          </div>`).join('')}
        </div>
        <form id="reg-form" style="display:flex;flex-direction:column;gap:14px">
          <div>
            <label style="display:block;font-size:0.8rem;font-weight:700;opacity:0.7;margin-bottom:6px">Full name <span style="color:var(--brand-orange)">*</span></label>
            <input class="field-input-zs" type="text" name="name" id="reg-name" placeholder="Your real name" required autocomplete="name" />
            <p style="font-size:0.75rem;opacity:0.45;margin-top:4px">Your legal identity name for permanent HDI issuance.</p>
          </div>
          <div>
            <label style="display:block;font-size:0.8rem;font-weight:700;opacity:0.7;margin-bottom:6px">Mobile number <span style="color:var(--brand-orange)">*</span></label>
            <input class="field-input-zs" type="tel" name="phone" id="reg-phone" placeholder="+91 98765 43210" required autocomplete="tel" />
            <p style="font-size:0.75rem;opacity:0.45;margin-top:4px">Include country code. This number is verified after registration.</p>
          </div>
          <div>
            <label style="display:block;font-size:0.8rem;font-weight:700;opacity:0.7;margin-bottom:6px">Email <span style="color:var(--brand-orange)">*</span></label>
            <input class="field-input-zs" type="email" name="email" placeholder="you@example.com" required autocomplete="email" />
          </div>
          <div>
            <label style="display:block;font-size:0.8rem;font-weight:700;opacity:0.7;margin-bottom:6px">Password <span style="color:var(--brand-orange)">*</span></label>
            <input class="field-input-zs" type="password" name="password" placeholder="Min 8 characters" required minlength="8" autocomplete="new-password" />
          </div>
          <div style="padding:14px 18px;border-radius:12px;background:rgba(4,106,56,0.08);border:1px solid rgba(4,106,56,0.22)">
            <div style="font-size:0.65rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:var(--brand-green);margin-bottom:7px">Permanent Identity Issuance</div>
            <div style="font-size:0.79rem;line-height:1.65;opacity:0.65">Your name, mobile number and email establish one permanent username and HDI after both OTP checks. Your password protects access and can be changed without changing who you are.</div>
          </div>
          <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer">
            <input type="checkbox" id="reg-consent" required style="width:16px;height:16px;accent-color:var(--brand-green);margin-top:3px;flex-shrink:0" />
            <span style="font-size:0.82rem;line-height:1.6;opacity:0.75">I have read and agree to the <a href="#" data-page="terms" style="color:var(--brand-green)">Terms of Use</a> and <a href="#" data-page="privacy" style="color:var(--brand-green)">Privacy Notice</a>. I understand that my name, email, and mobile are used to issue a permanent, non-transferable HDI.</span>
          </label>
          <p id="reg-err" style="font-size:0.83rem;color:#f87171;min-height:1.2em"></p>
          <button type="submit" class="btn-primary" style="width:100%;padding:13px">Create account &amp; verify →</button>
        </form>
        <p style="text-align:center;font-size:0.75rem;opacity:0.4;margin-top:14px">Already have one? <a href="#" data-page="login" style="color:var(--brand-green)">Sign in →</a></p>
        <p style="text-align:center;font-size:0.75rem;opacity:0.35;margin-top:8px"><a href="/hdi" data-page="hdi" data-section="id-formula" style="color:inherit;text-decoration:underline;text-underline-offset:3px">How does HDI work? →</a></p>
      </div>
    </div>
  </div>
  <style>.field-input-zs{width:100%;padding:12px 14px;background:rgba(255,255,255,0.05);border:1.5px solid rgba(255,255,255,0.10);border-radius:12px;color:inherit;font-family:inherit;font-size:0.95rem;outline:none;transition:border-color 0.2s,box-shadow 0.2s}.field-input-zs:focus{border-color:var(--brand-green);box-shadow:0 0 0 3px rgba(4,106,56,0.14)}.field-input-zs::placeholder{opacity:0.38}</style>
  `;

  const rl = document.getElementById('regLogo');
  if (rl) rl.src = document.body.classList.contains('theme-light') ? '/logo/day-logo.png' : '/logo/night-logo.png';

  document.getElementById('reg-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const err = document.getElementById('reg-err');
    btn.disabled = true; btn.textContent = '...'; err.textContent = '';
    if (!document.getElementById('reg-consent')?.checked) {
      err.textContent = 'You must agree to the Terms and Privacy Notice to continue.';
      btn.disabled = false; btn.textContent = 'Create account & verify →';
      return;
    }
    try {
      const fd   = new FormData(e.target);
      const name = fd.get('name');
      const res  = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone: fd.get('phone'), email: fd.get('email'), password: fd.get('password') })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      localStorage.setItem('zs_token', data.token);
      await Auth.check();
      window.toast('Account created. Verify email and mobile to issue your permanent HDI.', 'success', 6000);
      Router.go('verify');
    } catch(ex) {
      err.textContent = ex.message;
      btn.disabled = false; btn.textContent = 'Create account & verify →';
    }
  });
});

// ── DASHBOARD ─────────────────────────────────────────────
Router.register('dashboard', root => {
  if (!Auth.isLoggedIn()) { Router.go('login'); return; }
  const user     = Auth.getUser();
  if (!user?.hdi_code) { Router.go('verify'); return; }
  const hdi      = HDI.get();
  const esc      = value => String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const ini      = (hdi.name || user?.email || 'U')[0].toUpperCase();
  const wallet   = hdi.code ? ZsWallet.load(hdi.code) : null;
  const licences = ZsLicence.loadAll();
  const trust    = wallet ? ZsWallet.trustScore(wallet) : 20;
  const tier     = trust >= 90 ? 'Truth ✦' : trust >= 70 ? 'Gold' : trust >= 40 ? 'Silver' : 'Bronze';
  const tierColor= trust >= 90 ? 'var(--brand-green)' : trust >= 70 ? '#FFD700' : trust >= 40 ? '#C0C0C0' : '#CD7F32';
  const tierBg   = trust >= 90 ? 'rgba(4,106,56,0.15)' : trust >= 70 ? 'rgba(255,215,0,0.10)' : trust >= 40 ? 'rgba(192,192,192,0.08)' : 'rgba(205,127,50,0.10)';
  const DP       = 'padding:22px;border-radius:16px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03)';

  root.innerHTML = `
  <div class="zs-workspace">

  <div class="zs-workspace-content" style="max-width:1100px;margin:0 auto;padding:0 clamp(16px,4vw,48px) 80px">

  <!-- ════ ① IDENTITY ════ -->
  <section id="d-identity" style="padding-top:56px">
    <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green);margin-bottom:12px">Your HDI Profile</p>

    <!-- Hero card -->
    <div style="display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:start;padding:26px;border-radius:20px;background:linear-gradient(135deg,rgba(4,106,56,0.08),rgba(255,103,31,0.04));border:1px solid rgba(4,106,56,0.22);margin-bottom:18px" data-reveal>
      <div style="width:78px;height:78px;border-radius:18px;background:var(--gradient-brand);display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;font-size:2rem;flex-shrink:0;box-shadow:0 8px 24px rgba(4,106,56,0.28)">${ini}</div>
      <div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
          <h2 style="font-size:1.15rem;font-weight:800">${esc(hdi.name || user?.email || 'Anonymous')}</h2>
          <span style="font-size:0.62rem;font-weight:800;padding:3px 10px;border-radius:999px;background:${tierBg};color:${tierColor};border:1px solid ${tierColor};letter-spacing:0.08em;text-transform:uppercase">${tier}</span>
        </div>
        ${hdi.code ? `
        <div style="display:inline-flex;flex-direction:column;gap:4px;padding:7px 14px;border-radius:10px;background:rgba(4,106,56,0.08);border:1px solid rgba(4,106,56,0.22);margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-family:monospace;font-size:0.96rem;font-weight:900;color:var(--brand-green);letter-spacing:2px">${esc(hdi.code)}</span>
            <button onclick="navigator.clipboard.writeText('${hdi.code}').then(()=>window.toast('HDI copied ✓','success'))" style="background:none;border:none;cursor:pointer;opacity:0.4;font-size:0.85rem;padding:2px 4px" title="Copy HDI">⎘</button>
          </div>
          <span style="font-family:monospace;font-size:0.78rem;opacity:0.62">@${esc(hdi.username || user?.username || '')}</span>
        </div>` : `<div style="padding:7px 12px;border-radius:10px;background:rgba(255,103,31,0.07);border:1px solid rgba(255,103,31,0.18);font-size:0.84rem;opacity:0.7;margin-bottom:12px">Permanent HDI pending email and mobile verification</div>`}
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <span style="font-size:0.7rem;opacity:0.48;padding:3px 10px;border-radius:999px;border:1px solid rgba(255,255,255,0.1)">📧 ${esc(user?.email || '—')}</span>
          ${wallet ? `<span style="font-size:0.7rem;padding:3px 10px;border-radius:999px;border:1px solid rgba(4,106,56,0.3);color:var(--brand-green)">✦ ${wallet.balance||0} ZS</span>` : ''}
          <span style="font-size:0.7rem;opacity:0.48;padding:3px 10px;border-radius:999px;border:1px solid rgba(255,255,255,0.1)">📜 ${licences.length} Licence${licences.length!==1?'s':''}</span>
        </div>
      </div>
    </div>

    <!-- Stats grid -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px" data-reveal>
      ${[{ label:'HDI Score', val:trust+'/100', color:'var(--brand-green)' },
         { label:'ZS Balance', val:(wallet?.balance||0)+' ZS', color:'var(--brand-green)' },
         { label:'Licences', val:licences.length, color:'rgba(255,255,255,0.8)' },
         { label:'Tier', val:tier, color:tierColor },
        ].map(s=>`
      <div style="${DP};text-align:center;border-top:2px solid rgba(4,106,56,0.2)">
        <div style="font-size:1.4rem;font-weight:900;color:${s.color};margin-bottom:4px;line-height:1.1">${s.val}</div>
        <div style="font-size:0.63rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:0.42">${s.label}</div>
      </div>`).join('')}
    </div>

    <!-- Trust bar -->
    <div style="${DP};margin-bottom:18px" data-reveal>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px">
        <p style="font-size:0.7rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--brand-green)">HDI Trust Score</p>
        <span style="font-size:0.82rem;font-weight:700">${trust}/100 — ${tier}</span>
      </div>
      <div style="height:7px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;margin-bottom:12px">
        <div style="width:${trust}%;height:100%;background:linear-gradient(90deg,var(--brand-green),var(--brand-orange));border-radius:4px;transition:width 1.2s ease"></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:7px">
        ${[['Account',20,'Base on join'],
           ['Email',wallet?.emailVerified?20:0,'Verify → +20'],
           ['Phone',wallet?.phoneVerified?20:0,'Verify → +20'],
           ['Activity',Math.min(15,(wallet?.transactions?.length||0)*3),'From transactions'],
           ['Age',Math.min(10,Math.floor((Date.now()-(wallet?.createdAt||Date.now()))/86400000)),'Days active'],
          ].map(([l,v,h])=>`
        <div style="padding:7px 10px;border-radius:8px;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.05)">
          <div style="font-size:0.65rem;opacity:0.38;margin-bottom:1px">${l}</div>
          <div style="font-size:0.82rem;font-weight:700;color:var(--brand-green)">+${v} pts</div>
          <div style="font-size:0.62rem;opacity:0.32">${h}</div>
        </div>`).join('')}
      </div>
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <a href="#" class="btn-primary" data-page="wallet" style="font-size:0.84rem">Open Wallet →</a>
      <a href="#" class="btn-login" data-page="licence" style="font-size:0.84rem">View Licences</a>
      <a href="/hdi" class="btn-login" data-page="hdi" data-section="id-overview" style="font-size:0.84rem">Open HDI</a>
    </div>
  </section>

  <!-- ════ ② VERIFY ════ -->
  <section id="d-verify" style="padding-top:72px;border-top:1px solid rgba(255,255,255,0.05);margin-top:52px">
    <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green);margin-bottom:10px">Verify</p>
    <h2 style="font-size:clamp(1.4rem,3vw,2rem);font-weight:900;letter-spacing:-0.02em;margin-bottom:6px">Complete your identity.</h2>
    <p style="opacity:0.55;max-width:54ch;line-height:1.75;margin-bottom:26px">Each step raises your HDI tier, earns ZS Coin, and unlocks more platform features.</p>

    <div style="display:flex;flex-direction:column;gap:10px;max-width:600px">
      <div style="${DP};display:flex;align-items:center;gap:14px;border-left:3px solid var(--brand-green)">
        <div style="width:34px;height:34px;border-radius:50%;background:rgba(4,106,56,0.18);display:flex;align-items:center;justify-content:center;color:var(--brand-green);font-size:1.1rem;flex-shrink:0">✓</div>
        <div style="flex:1"><div style="font-weight:700;font-size:0.9rem">Account created</div><div style="font-size:0.76rem;opacity:0.5;margin-top:2px">Enrollment started · verify both channels to issue HDI</div></div>
        <span style="font-size:0.7rem;font-weight:700;color:var(--brand-green);white-space:nowrap">Done ✦</span>
      </div>

      <div id="d-email-card" style="${DP};border-left:3px solid ${wallet?.emailVerified?'var(--brand-green)':'rgba(255,255,255,0.12)'}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${wallet?.emailVerified?'0':'12px'}">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:34px;height:34px;border-radius:50%;background:${wallet?.emailVerified?'rgba(4,106,56,0.18)':'rgba(255,255,255,0.04)'};display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">${wallet?.emailVerified?'<span style="color:var(--brand-green)">✓</span>':'📧'}</div>
            <div><div style="font-weight:700;font-size:0.9rem">Email verification</div><div style="font-size:0.73rem;opacity:0.45;margin-top:1px">+20 HDI Score · +5 ZS Coin · Unlocks Silver</div></div>
          </div>
          <span id="dash-email-status" style="font-size:0.7rem;font-weight:700;color:${wallet?.emailVerified?'var(--brand-green)':'rgba(255,255,255,0.28)'};white-space:nowrap">${wallet?.emailVerified?'Done ✦':'Pending'}</span>
        </div>
        ${!wallet?.emailVerified?`<div id="dash-email-otp-ui">
          <button onclick="dashSendEmailOTP()" class="btn-login" style="font-size:0.82rem;padding:9px 18px;border-radius:999px;border:1px solid rgba(4,106,56,0.3);color:var(--brand-green);width:100%">Send OTP to ${esc(user?.email)}</button>
        </div>`:''}
      </div>

      <div id="d-phone-card" style="${DP};border-left:3px solid ${wallet?.phoneVerified?'var(--brand-green)':'rgba(255,255,255,0.12)'}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${wallet?.phoneVerified?'0':'12px'}">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:34px;height:34px;border-radius:50%;background:${wallet?.phoneVerified?'rgba(4,106,56,0.18)':'rgba(255,255,255,0.04)'};display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">${wallet?.phoneVerified?'<span style="color:var(--brand-green)">✓</span>':'📱'}</div>
            <div><div style="font-weight:700;font-size:0.9rem">Phone verification</div><div style="font-size:0.73rem;opacity:0.45;margin-top:1px">+20 HDI Score · +5 ZS Coin · Unlocks Gold path</div></div>
          </div>
          <span id="dash-phone-status" style="font-size:0.7rem;font-weight:700;color:${wallet?.phoneVerified?'var(--brand-green)':'rgba(255,255,255,0.28)'};white-space:nowrap">${wallet?.phoneVerified?'Done ✦':'Pending'}</span>
        </div>
        ${!wallet?.phoneVerified?`<div id="dash-phone-otp-ui">
          <button onclick="dashSendPhoneOTP()" class="btn-login" style="font-size:0.82rem;padding:9px 18px;border-radius:999px;border:1px solid rgba(4,106,56,0.3);color:var(--brand-green);width:100%">Send OTP to ${esc(user?.phone || 'registered mobile')}</button>
        </div>`:''}
      </div>

      <div style="${DP};opacity:0.38">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:34px;height:34px;border-radius:50%;border:2px dashed rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">🌐</div>
          <div><div style="font-weight:700;font-size:0.9rem">Community trust</div><div style="font-size:0.73rem;opacity:0.45;margin-top:1px">Trusted by 3+ Gold members → Truth ✦ · Coming soon</div></div>
        </div>
      </div>
    </div>
  </section>

  <!-- ════ ③ ACTIVITY ════ -->
  <section id="d-activity" style="padding-top:72px;border-top:1px solid rgba(255,255,255,0.05);margin-top:52px">
    <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green);margin-bottom:10px">Activity</p>
    <h2 style="font-size:clamp(1.4rem,3vw,2rem);font-weight:900;letter-spacing:-0.02em;margin-bottom:22px">Recent activity.</h2>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px" data-reveal>
      <div style="${DP}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <p style="font-size:0.7rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--brand-green)">Wallet Transactions</p>
          <a href="#" data-page="wallet" style="font-size:0.73rem;opacity:0.42;color:inherit;text-decoration:none">All →</a>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px">
          ${(wallet?.transactions||[]).slice(-5).reverse().map(tx=>{
            const d=new Date(tx.createdAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
            const cr=tx.direction==='credit';
            return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.025)">
              <span style="color:${cr?'var(--brand-green)':'var(--brand-orange)'};font-size:0.9rem">${cr?'↓':'↑'}</span>
              <div style="flex:1;min-width:0"><div style="font-size:0.8rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(tx.type)}</div><div style="font-size:0.63rem;opacity:0.32">${d}</div></div>
              <span style="font-size:0.8rem;font-weight:700;color:${cr?'var(--brand-green)':'var(--brand-orange)'};">${cr?'+':'-'}${tx.amount} ZS</span>
            </div>`;
          }).join('')||`<div style="padding:18px;text-align:center;opacity:0.28;font-size:0.84rem">No transactions yet</div>`}
        </div>
      </div>
      <div style="${DP}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <p style="font-size:0.7rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--brand-green)">Recent Licences</p>
          <a href="#" data-page="licence" style="font-size:0.73rem;opacity:0.42;color:inherit;text-decoration:none">All →</a>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px">
          ${licences.slice(-5).reverse().map(l=>`
          <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.025)">
            <span style="color:var(--brand-orange);font-size:0.85rem;flex-shrink:0">📜</span>
            <div style="flex:1;min-width:0"><div style="font-size:0.8rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.title)}</div><code style="font-size:0.63rem;opacity:0.28">${esc(l.licenceId)}</code></div>
          </div>`).join('')||`<div style="padding:18px;text-align:center;opacity:0.28;font-size:0.84rem">No licences yet</div>`}
        </div>
      </div>
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <a href="#" class="btn-login" data-page="wallet" style="font-size:0.82rem">Earn more ZS →</a>
      <a href="#" class="btn-login" data-page="licence" style="font-size:0.82rem">Claim content →</a>
      <a href="#" class="btn-login" data-page="community" style="font-size:0.82rem">Community →</a>
    </div>
  </section>

  <!-- ════ ④ DEVICE SECURITY ════ -->
  <section id="d-device" style="padding-top:72px;border-top:1px solid rgba(255,255,255,0.05);margin-top:52px">
    <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green);margin-bottom:10px">Device Security</p>
    <h2 style="font-size:clamp(1.4rem,3vw,2rem);font-weight:900;letter-spacing:-0.02em;margin-bottom:8px">Enrolled devices.</h2>
    <p style="opacity:0.55;max-width:54ch;line-height:1.75;margin-bottom:24px">Your browser generates a cryptographic key stored locally. Only you can sign challenges — Zero Soils never sees your private key.</p>
    <div id="d-device-card" style="max-width:600px">
      <div style="${DP};opacity:0.4;text-align:center;padding:28px">
        <p style="font-size:0.85rem">Loading device status…</p>
      </div>
    </div>
  </section>

  <!-- ════ ⑤ WALLET ════ -->
  <section id="d-wallet" style="padding-top:72px;border-top:1px solid rgba(255,255,255,0.05);margin-top:52px">
    <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green);margin-bottom:10px">Wallet</p>
    <h2 style="font-size:clamp(1.4rem,3vw,2rem);font-weight:900;letter-spacing:-0.02em;margin-bottom:22px">Your ZS balance.</h2>
    ${wallet?`
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:18px" data-reveal>
      ${[['Balance',wallet.balance+' ZS','var(--brand-green)'],
         ['Trust Score',ZsWallet.trustScore(wallet)+'/100','rgba(255,255,255,0.75)'],
         ['Genesis',wallet.genesisIssued?'Issued':'Pending','var(--brand-orange)'],
        ].map(([l,v,c])=>`
      <div style="${DP};text-align:center">
        <div style="font-size:1.5rem;font-weight:900;color:${c};margin-bottom:4px">${v}</div>
        <div style="font-size:0.63rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:0.42">${l}</div>
      </div>`).join('')}
    </div>
    <a href="#" class="btn-primary" data-page="wallet" style="font-size:0.84rem">Open full wallet →</a>`:
    `<div style="padding:20px;border-radius:14px;background:rgba(4,106,56,0.06);border:1px solid rgba(4,106,56,0.18);max-width:420px;font-size:0.9rem;opacity:0.65">
      Your wallet activates after permanent HDI issuance. Complete email and mobile verification above.
    </div>`}
  </section>

  <!-- ════ ⑤ LICENCE ════ -->
  <section id="d-licence" style="padding-top:72px;border-top:1px solid rgba(255,255,255,0.05);margin-top:52px">
    <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green);margin-bottom:10px">Licence</p>
    <h2 style="font-size:clamp(1.4rem,3vw,2rem);font-weight:900;letter-spacing:-0.02em;margin-bottom:22px">Content ownership.</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px" data-reveal>
      ${[['Total Claims',licences.length,'var(--brand-green)'],
         ['Content Types',new Set(licences.map(l=>l.contentType)).size,'var(--brand-green)'],
         ['Licence Types',new Set(licences.map(l=>l.licenceType)).size,'var(--brand-orange)'],
        ].map(([l,v,c])=>`
      <div style="${DP};text-align:center">
        <div style="font-size:1.5rem;font-weight:900;color:${c};margin-bottom:4px">${v}</div>
        <div style="font-size:0.63rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:0.42">${l}</div>
      </div>`).join('')}
    </div>
    <a href="#" class="btn-primary" data-page="licence" style="font-size:0.84rem">Open Licence registry →</a>
  </section>

  <!-- ════ ⑥ SETTINGS ════ -->
  <section id="d-settings" style="padding-top:72px;border-top:1px solid rgba(255,255,255,0.05);margin-top:52px;padding-bottom:40px">
    <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green);margin-bottom:10px">Settings</p>
    <h2 style="font-size:clamp(1.4rem,3vw,2rem);font-weight:900;letter-spacing:-0.02em;margin-bottom:22px">Account settings.</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;max-width:680px">
      <div style="${DP}" data-reveal>
        <p style="font-size:0.7rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--brand-green);margin-bottom:12px">Account Info</p>
        ${[['Email',user?.email||'—'],['Mobile',user?.phone||'—'],['Permanent Username',(hdi.username||user?.username) ? '@'+(hdi.username||user?.username) : 'Pending verification'],['HDI Code',hdi.code||'Not issued'],['Tier',tier],
           ['Member Since',hdi.ts?new Date(Number(hdi.ts)).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'—'],
          ].map(([k,v])=>`
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
          <span style="font-size:0.82rem;opacity:0.48">${k}</span>
          <code style="font-size:0.8rem;font-weight:700;color:var(--brand-green);max-width:58%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right">${esc(v)}</code>
        </div>`).join('')}
      </div>
      <div style="${DP}" data-reveal>
        <p style="font-size:0.7rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--brand-green);margin-bottom:12px">Quick Links</p>
        <div style="display:flex;flex-direction:column;gap:8px">
          <a href="#" class="btn-login" data-page="wallet"    style="display:block;text-align:center;font-size:0.84rem;padding:10px">Wallet</a>
          <a href="#" class="btn-login" data-page="licence"   style="display:block;text-align:center;font-size:0.84rem;padding:10px">Licence</a>
          <a href="#" class="btn-login" data-page="community" style="display:block;text-align:center;font-size:0.84rem;padding:10px">Community</a>
          <a href="/hdi" class="btn-login" data-page="hdi" style="display:block;text-align:center;font-size:0.84rem;padding:10px">HDI</a>
          <button onclick="Auth.logout()" style="display:block;width:100%;padding:10px;font-size:0.84rem;border-radius:12px;border:1px solid rgba(248,113,113,0.2);background:rgba(248,113,113,0.05);color:rgba(248,113,113,0.8);cursor:pointer">Sign out</button>
        </div>
      </div>
    </div>
  </section>

  </div>
  </div>

  <style>
    @media(max-width:700px){
      [style*="grid-template-columns:1fr 1fr"]{grid-template-columns:1fr!important}
      [style*="grid-template-columns:repeat(4"]{grid-template-columns:repeat(2,1fr)!important}
      [style*="grid-template-columns:1fr 1fr 1fr"],[style*="grid-template-columns:repeat(3"]{grid-template-columns:1fr!important}
    }
  </style>
  `;

  // ── Device Security ──────────────────────────────────────
  const DP_DEVICE = DP;

  function renderDeviceCard(devices) {
    const card = document.getElementById('d-device-card');
    if (!card) return;
    if (!devices.length) {
      card.innerHTML = `
        <div style="${DP_DEVICE};border:1.5px dashed rgba(255,255,255,0.12)" data-reveal>
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
            <div style="width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.04);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0">🔐</div>
            <div>
              <p style="font-weight:700;font-size:0.95rem;margin-bottom:2px">No device enrolled</p>
              <p style="font-size:0.78rem;opacity:0.45">Enroll this browser to enable cryptographic identity signing.</p>
            </div>
          </div>
          <button id="enroll-device-btn" onclick="dashEnrollDevice()" class="btn-primary" style="font-size:0.84rem;padding:11px 20px">Enroll this browser →</button>
          <p id="device-err" style="font-size:0.8rem;color:#f87171;min-height:1.1em;margin-top:8px"></p>
        </div>`;
      return;
    }
    const d = devices[0];
    const fp = d.fingerprint || '';
    const fpShort = fp.slice(0, 19) + (fp.length > 19 ? '…' : '');
    const lastSeen = d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
    const enrolledAt = d.enrolledAt ? new Date(d.enrolledAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—';
    const isVerified = Boolean(d.verifiedAt);
    card.innerHTML = `
      <div style="${DP_DEVICE};border-left:3px solid ${isVerified ? 'var(--brand-green)' : 'rgba(255,165,0,0.5)'}" data-reveal>
        <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:16px">
          <div style="width:40px;height:40px;border-radius:10px;background:${isVerified ? 'rgba(4,106,56,0.15)' : 'rgba(255,165,0,0.08)'};display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0">${isVerified ? '🔒' : '🔓'}</div>
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px">
              <p style="font-weight:700;font-size:0.95rem">${esc(d.label || 'Browser device')}</p>
              <span style="font-size:0.68rem;font-weight:700;padding:2px 9px;border-radius:999px;border:1px solid ${isVerified ? 'var(--brand-green)' : 'rgba(255,165,0,0.5)'};color:${isVerified ? 'var(--brand-green)' : '#ffa500'}">${isVerified ? 'Verified' : 'Not verified'}</span>
            </div>
            <code style="font-size:0.72rem;opacity:0.45;font-family:monospace">${fpShort}</code>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
          <div style="padding:10px 12px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">
            <p style="font-size:0.65rem;opacity:0.38;margin-bottom:3px;text-transform:uppercase;letter-spacing:.4px">Enrolled</p>
            <p style="font-size:0.82rem;font-weight:600">${enrolledAt}</p>
          </div>
          <div style="padding:10px 12px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">
            <p style="font-size:0.65rem;opacity:0.38;margin-bottom:3px;text-transform:uppercase;letter-spacing:.4px">Last seen</p>
            <p style="font-size:0.82rem;font-weight:600">${lastSeen}</p>
          </div>
        </div>
        <button id="enroll-device-btn" onclick="dashEnrollDevice()" class="btn-login" style="font-size:0.83rem;padding:10px 18px;border-radius:12px;border:1px solid rgba(4,106,56,0.3);color:var(--brand-green)">
          ${isVerified ? 'Re-verify this browser' : 'Verify this browser →'}
        </button>
        <p id="device-err" style="font-size:0.8rem;color:#f87171;min-height:1.1em;margin-top:8px"></p>
      </div>`;
  }

  async function loadDevices() {
    try {
      const { devices } = await API.get('/auth/devices');
      renderDeviceCard(devices || []);
    } catch {
      renderDeviceCard([]);
    }
  }

  window.dashEnrollDevice = async () => {
    const btn = document.getElementById('enroll-device-btn');
    const errEl = document.getElementById('device-err');
    if (btn) { btn.disabled = true; btn.textContent = 'Working…'; }
    if (errEl) errEl.textContent = '';
    try {
      if (!window.crypto?.subtle || !window.indexedDB) throw new Error('Secure device authentication unavailable in this browser.');
      await DeviceAuth.verifyCurrent();
      window.toast('Device verified ✦', 'success');
      await loadDevices();
    } catch (ex) {
      if (errEl) errEl.textContent = ex.message;
      if (btn) { btn.disabled = false; btn.textContent = btn.textContent.includes('Re-verify') ? 'Re-verify this browser' : 'Verify this browser →'; }
    }
  };

  loadDevices();

  async function recordVerificationReward(kind) {
    if (!hdi.code) return;
    const target = wallet || await ZsWallet.loadOrCreate({ code:hdi.code, name:hdi.name });
    const flag = kind === 'Email' ? 'emailVerified' : 'phoneVerified';
    if (target[flag]) return false;
    target[flag] = true;
    ZsWallet.save(target);
    if (Number(target.balance || 0) + 5 > ZS_MAX_SUPPLY) return false;
    await ZsWallet.addTx(target, {
      type: `${kind} verification reward`,
      direction: 'credit',
      amount: 5,
      note: 'OTP verification complete',
    });
    return true;
  }

  async function syncIssuedIdentity(apiUser) {
    if (!apiUser?.hdi_code) return false;
    HDI.save(apiUser.hdi_code, apiUser.name || '', apiUser.username || '', apiUser.phone || '');
    const issuedWallet = await ZsWallet.loadOrCreate({ code:apiUser.hdi_code, name:apiUser.name || '' });
    for (const [verified, flag, label] of [
      [apiUser.email_verified, 'emailVerified', 'Email'],
      [apiUser.phone_verified, 'phoneVerified', 'Phone'],
    ]) {
      if (!verified || issuedWallet[flag]) continue;
      issuedWallet[flag] = true;
      ZsWallet.save(issuedWallet);
      if (Number(issuedWallet.balance || 0) + 5 <= ZS_MAX_SUPPLY) {
        await ZsWallet.addTx(issuedWallet, {
          type: `${label} verification reward`,
          direction:'credit',
          amount:5,
          note:'OTP verification complete',
        });
      }
    }
    return true;
  }

  window.dashSendEmailOTP = async () => {
    const ui = document.getElementById('dash-email-otp-ui');
    if (!ui) return;
    ui.innerHTML = `<div style="font-size:0.82rem;opacity:0.5">Sending…</div>`;
    try {
      await API.post('/auth/send-email-otp', {});
      ui.innerHTML = `<div style="display:flex;gap:8px">
        <input id="dash-email-code" placeholder="6-digit code" maxlength="6" style="flex:1;padding:9px 12px;background:rgba(255,255,255,0.05);border:1.5px solid rgba(255,255,255,0.1);border-radius:10px;color:inherit;font-family:monospace;font-size:1rem;letter-spacing:3px;outline:none;text-align:center"/>
        <button onclick="dashVerifyEmailOTP()" class="btn-primary" style="font-size:0.82rem;padding:9px 14px">Verify</button>
      </div><p style="font-size:0.72rem;opacity:0.38;margin-top:5px">Code sent to ${esc(user?.email)}</p>`;
      window.toast('OTP sent ✓', 'success');
    } catch(ex) { ui.textContent = ex.message; ui.style.color = '#f87171'; ui.style.fontSize = '0.82rem'; }
  };

  window.dashVerifyEmailOTP = async () => {
    try {
      const result = await API.post('/auth/verify-email-otp', { code: document.getElementById('dash-email-code')?.value });
      const issued = await syncIssuedIdentity(result.user);
      const rewarded = await recordVerificationReward('Email');
      document.getElementById('dash-email-otp-ui').innerHTML = `<p style="color:var(--brand-green);font-weight:700;font-size:0.88rem">✦ Email verified!</p>`;
      const s = document.getElementById('dash-email-status');
      if (s) { s.textContent='Done ✦'; s.style.color='var(--brand-green)'; }
      window.toast(issued ? `Permanent HDI issued: ${result.user.hdi_code}` : (rewarded ? 'Email verified ✦ +20 HDI +5 ZS' : 'Email verified ✦ +20 HDI'), 'success');
      if (issued) Router.go('wallet');
    } catch(ex) { window.toast(ex.message, 'error'); }
  };

  window.dashSendPhoneOTP = async () => {
    try {
      await API.post('/auth/send-phone-otp', {});
      document.getElementById('dash-phone-otp-ui').innerHTML = `<div style="display:flex;gap:8px">
        <input id="dash-phone-code" placeholder="6-digit code" maxlength="6" style="flex:1;padding:9px 12px;background:rgba(255,255,255,0.05);border:1.5px solid rgba(255,255,255,0.1);border-radius:10px;color:inherit;font-family:monospace;font-size:1rem;letter-spacing:3px;outline:none;text-align:center"/>
        <button onclick="dashVerifyPhoneOTP()" class="btn-primary" style="font-size:0.82rem;padding:9px 14px">Verify</button>
      </div>`;
      window.toast('SMS sent ✓', 'success');
    } catch(ex) { window.toast(ex.message, 'error'); }
  };

  window.dashVerifyPhoneOTP = async () => {
    try {
      const result = await API.post('/auth/verify-phone-otp', { code: document.getElementById('dash-phone-code')?.value });
      const issued = await syncIssuedIdentity(result.user);
      const rewarded = await recordVerificationReward('Phone');
      document.getElementById('dash-phone-otp-ui').innerHTML = `<p style="color:var(--brand-green);font-weight:700;font-size:0.88rem">✦ Phone verified!</p>`;
      const s = document.getElementById('dash-phone-status');
      if (s) { s.textContent='Done ✦'; s.style.color='var(--brand-green)'; }
      window.toast(issued ? `Permanent HDI issued: ${result.user.hdi_code}` : (rewarded ? 'Phone verified ✦ +20 HDI +5 ZS' : 'Phone verified ✦ +20 HDI'), 'success');
      if (issued) Router.go('wallet');
    } catch(ex) { window.toast(ex.message, 'error'); }
  };
});

// ── LICENCE ───────────────────────────────────────────────
Router.register('licence', root => {
  if (!Auth.isLoggedIn()) { Router.go('login'); return; }
  if (!Auth.getUser()?.hdi_code) { Router.go('verify'); return; }
  const hdi      = HDI.get();
  const identity = { code: hdi.code, name: hdi.name || '' };
  const LPANEL   = 'padding:26px;border-radius:20px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03)';
  const LINP     = 'width:100%;padding:11px 14px;background:rgba(255,255,255,0.05);border:1.5px solid rgba(255,255,255,0.10);border-radius:11px;color:inherit;font-family:inherit;font-size:0.9rem;outline:none;transition:border-color .2s';
  let licenceDeviceProof = null;

  root.innerHTML = `
  <div class="zs-workspace">
    <div class="zs-workspace-content zs-workspace-content--wide" style="padding:0 clamp(16px,4vw,48px) 80px">

      <!-- ① OVERVIEW -->
      <section id="l-overview" style="padding-top:56px">
        <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green);margin-bottom:8px">ZS Licence</p>
        <h2 style="font-size:clamp(1.6rem,3.5vw,2.5rem);font-weight:900;letter-spacing:-0.02em;margin-bottom:10px">Own your digital content.</h2>
        <p style="opacity:0.6;max-width:66ch;line-height:1.7;margin-bottom:36px">ZS Licence marks ideas, articles, software, and digital goods with your permanent HDI, a signed primary-device verification snapshot, and tamper-evident content and owner-mark hashes.</p>
        <div id="l-stats-bar" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin-bottom:32px"></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:28px">
          ${[['HDI','Permanent owner mark','Every new certificate includes your issued HDI and owner name.'],
             ['KEY','Device authorization','A signed challenge confirms this primary device before marking.'],
             ['HASH','Tamper evidence','Content, owner mark and certificate each carry SHA-256 hashes.'],
             ['LOG','Audit timeline','Device verification and licence operations record local timestamps.']
            ].map(([icon,title,desc]) => `<div style="${LPANEL}" data-reveal><div style="font-size:1.4rem;margin-bottom:10px">${icon}</div><div style="font-weight:700;margin-bottom:6px;font-size:0.95rem">${title}</div><div style="font-size:0.82rem;opacity:0.55;line-height:1.6">${desc}</div></div>`).join('')}
        </div>
        <div style="${LPANEL}" data-reveal>
          <p style="font-size:0.68rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--brand-green);margin-bottom:14px">Licence Types</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px">
            ${Object.entries(ZS_LIC_TYPES).map(([,v]) => `<div style="padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.02)"><div style="font-size:0.78rem;font-weight:700;color:var(--brand-green);margin-bottom:4px">${v.label}</div><div style="font-size:0.73rem;opacity:0.5">${v.desc}</div></div>`).join('')}
          </div>
        </div>
      </section>

      <section id="l-security" style="padding-top:72px">
        <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap;margin-bottom:22px">
          <div>
            <p style="font-size:.68rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--brand-green);margin-bottom:4px">Protection Layers</p>
            <h3 style="font-size:1.3rem;font-weight:800;margin-bottom:6px">How each owner mark is secured</h3>
            <p style="opacity:.55;font-size:.86rem;line-height:1.65;max-width:64ch">Your HDI establishes the named owner. Your enrolled device signs a fresh challenge. IP is logged as observed context only, never as ownership proof.</p>
          </div>
          <div id="lic-device-status" style="padding:8px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.12);font-size:.76rem;font-weight:750;opacity:.7">Checking device...</div>
        </div>
        <div style="${LPANEL};display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:18px;margin-bottom:14px">
          ${[['Owner HDI','lic-sec-hdi'],['Device Fingerprint','lic-sec-fp'],['Observed IP','lic-sec-ip'],['Device Verified At','lic-sec-time'],['Certificate Protocol','lic-sec-protocol'],['Owner Mark','lic-sec-owner']].map(([l,id]) => `<div><div style="font-size:.63rem;text-transform:uppercase;letter-spacing:.09em;font-weight:800;opacity:.4;margin-bottom:6px">${l}</div><code id="${id}" style="font-size:.79rem;font-weight:700;color:var(--brand-green);word-break:break-all">Pending</code></div>`).join('')}
        </div>
        <div style="${LPANEL};padding:18px 22px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px">
            <p style="font-size:.68rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--brand-green)">Security Timeline</p>
            <button id="lic-device-refresh" class="btn-login" style="font-size:.75rem;padding:6px 13px;border-radius:999px">Verify device now</button>
          </div>
          <div id="lic-audit-log" style="display:flex;flex-direction:column;gap:6px"></div>
        </div>
      </section>

      <!-- ② REGISTRY -->
      <section id="l-registry" style="padding-top:72px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
          <div>
            <p style="font-size:0.68rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--brand-green);margin-bottom:3px">Registry</p>
            <h3 style="font-size:1.3rem;font-weight:800">Your claimed content</h3>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            <button data-lfilter="" class="l-fb lf-on" style="padding:5px 14px;border-radius:999px;font-size:0.78rem;font-weight:600;border:1px solid rgba(4,106,56,0.4);background:var(--brand-green);color:#fff;cursor:pointer">All</button>
            ${ZS_CONTENT_TYPES.map(t => `<button data-lfilter="${t}" class="l-fb" style="padding:5px 14px;border-radius:999px;font-size:0.78rem;font-weight:600;border:1px solid rgba(255,255,255,0.1);background:none;color:rgba(255,255,255,0.55);cursor:pointer">${t}</button>`).join('')}
            <input id="l-search" type="search" placeholder="Search…" style="padding:6px 14px;border-radius:999px;font-size:0.8rem;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:inherit;outline:none;width:180px" />
          </div>
        </div>
        <div id="l-registry-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px">
          <div style="opacity:0.4;font-size:0.9rem;padding:32px 0;text-align:center;grid-column:1/-1">Loading…</div>
        </div>
      </section>

      <!-- ③ CLAIM -->
      <section id="l-claim" style="padding-top:72px">
        <p style="font-size:0.68rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--brand-green);margin-bottom:4px">Claim</p>
        <h3 style="font-size:1.3rem;font-weight:800;margin-bottom:6px">Register new content</h3>
        <p style="opacity:0.55;font-size:0.88rem;margin-bottom:22px">Generates a SHA-256 fingerprint and a ZS Licence certificate bound to your HDI.</p>
        ${!hdi.code ? `<div style="max-width:620px;padding:13px 16px;margin-bottom:14px;border-radius:12px;background:rgba(255,103,31,.07);border:1px solid rgba(255,103,31,.22);font-size:.84rem">An HDI is required to issue a licence certificate. <a href="#" data-page="register" style="color:var(--brand-green);font-weight:700">Create your HDI first →</a></div>` : ''}
        <div style="${LPANEL};max-width:620px">
          <form id="l-claim-form" style="display:flex;flex-direction:column;gap:16px">
            <div>
              <label style="display:block;font-size:0.8rem;font-weight:700;opacity:0.7;margin-bottom:6px">Title <span style="color:var(--brand-orange)">*</span></label>
              <input id="l-title" type="text" maxlength="200" placeholder="What did you create?" style="${LINP}" required />
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div>
                <label style="display:block;font-size:0.8rem;font-weight:700;opacity:0.7;margin-bottom:6px">Content Type</label>
                <select id="l-ctype" style="${LINP};cursor:pointer">${ZS_CONTENT_TYPES.map(t => `<option>${t}</option>`).join('')}</select>
              </div>
              <div>
                <label style="display:block;font-size:0.8rem;font-weight:700;opacity:0.7;margin-bottom:6px">Licence Type</label>
                <select id="l-ltype" style="${LINP};cursor:pointer">${Object.entries(ZS_LIC_TYPES).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}</select>
              </div>
            </div>
            <div>
              <label style="display:block;font-size:0.8rem;font-weight:700;opacity:0.7;margin-bottom:6px">Content / Description <small style="opacity:0.5;font-weight:400">(used for fingerprint)</small></label>
              <textarea id="l-content" rows="4" maxlength="4000" placeholder="Paste content or describe it — generates a unique SHA-256 fingerprint" style="${LINP};resize:vertical"></textarea>
            </div>
            <p id="l-claim-err" style="font-size:0.83rem;color:#f87171;min-height:1.1em"></p>
            <button type="submit" class="btn-primary" style="padding:12px;width:100%">Claim &amp; Generate Certificate ⚡</button>
          </form>
          <div id="l-claim-success" style="display:none;margin-top:20px"></div>
        </div>
      </section>

      <!-- ④ DIGITAL GOODS -->
      <section id="l-goods" style="padding-top:72px">
        <p style="font-size:0.68rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--brand-green);margin-bottom:4px">Digital Goods</p>
        <h3 style="font-size:1.3rem;font-weight:800;margin-bottom:6px">Licence downloadable value.</h3>
        <p style="opacity:0.55;font-size:0.88rem;line-height:1.65;max-width:64ch;margin-bottom:22px">Register downloadable products and reusable assets with a fingerprinted record: ownership assertion, usage terms, and a portable certificate in one place.</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-bottom:22px">
          ${[
            ['Software','Apps, plugins, code packages','commercial'],
            ['Template','UI kits, prompts, layouts','commercial'],
            ['E-book','Guides and digital publications','exclusive'],
            ['Course','Lessons and learning bundles','personal'],
            ['Dataset','Curated data collections','open'],
            ['3D Asset','Models, textures and scenes','nft'],
            ['Music','Tracks, stems and samples','commercial'],
            ['Licence Key','Digital product entitlements','transfer'],
          ].map(([type, desc, licence]) => `
          <div style="${LPANEL};padding:18px">
            <div style="font-size:.92rem;font-weight:750;margin-bottom:6px">${type}</div>
            <p style="font-size:.77rem;opacity:.52;line-height:1.5;margin-bottom:12px">${desc}</p>
            <button data-lgoods="${type}" data-lgoods-lic="${licence}" class="btn-login" style="font-size:.76rem;padding:7px 13px;border-radius:999px;color:var(--brand-green);border-color:rgba(4,106,56,.28)">Create claim</button>
          </div>`).join('')}
        </div>
        <div style="${LPANEL};display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px">
          ${[
            ['01','Describe','Name the good and provide identifying content or metadata.'],
            ['02','Fingerprint','SHA-256 creates a repeatable content fingerprint.'],
            ['03','Licence','Select sharing, commercial, exclusive, or transfer terms.'],
            ['04','Export','Download the certificate JSON for your records.'],
          ].map(([n,title,body]) => `<div><div style="font-family:monospace;color:var(--brand-orange);font-size:.68rem;font-weight:800;margin-bottom:6px">${n}</div><div style="font-size:.87rem;font-weight:700;margin-bottom:5px">${title}</div><p style="font-size:.76rem;opacity:.5;line-height:1.5">${body}</p></div>`).join('')}
        </div>
      </section>

      <!-- ⑤ CERTIFICATE -->
      <section id="l-cert" style="padding-top:72px">
        <p style="font-size:0.68rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--brand-green);margin-bottom:4px">Certificate</p>
        <h3 style="font-size:1.3rem;font-weight:800;margin-bottom:6px">Your HDI Identity Certificate</h3>
        <p style="opacity:0.55;font-size:0.88rem;margin-bottom:22px">A tamper-evident certificate linking your Human Digital Identity to all claimed content.</p>
        <div id="l-cert-panel"><div style="opacity:0.4;padding:32px 0;text-align:center">Loading…</div></div>
      </section>

      <!-- ⑥ BACKUP -->
      <section id="l-backup" style="padding-top:72px">
        <p style="font-size:0.68rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--brand-green);margin-bottom:4px">Backup</p>
        <h3 style="font-size:1.3rem;font-weight:800;margin-bottom:6px">Export &amp; Restore</h3>
        <p style="opacity:0.55;font-size:0.88rem;margin-bottom:22px">Download all your licence records as a portable JSON file. Import on any device.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:600px">
          <div style="${LPANEL}">
            <div style="font-weight:700;margin-bottom:8px">Export</div>
            <p style="font-size:0.82rem;opacity:0.55;margin-bottom:16px;line-height:1.6">Download all licences as a fingerprinted JSON record. Includes verification hashes.</p>
            <button id="l-export-btn" class="btn-primary" style="width:100%;padding:10px">Export JSON</button>
          </div>
          <div style="${LPANEL}">
            <div style="font-weight:700;margin-bottom:8px">Import</div>
            <p style="font-size:0.82rem;opacity:0.55;margin-bottom:16px;line-height:1.6">Restore from a previously exported <code>.json</code> backup file.</p>
            <label for="l-import-file" class="btn-login" style="display:block;text-align:center;padding:10px;cursor:pointer;border-radius:12px">Import JSON</label>
            <input id="l-import-file" type="file" accept=".json,application/json" hidden />
          </div>
        </div>
        <p id="l-backup-status" style="font-size:0.83rem;margin-top:12px;min-height:1.2em"></p>
      </section>

    </div>
  </div>
  <style>
    .l-fb.lf-on{background:var(--brand-green)!important;color:#fff!important;border-color:rgba(4,106,56,.4)!important}
    .l-lc{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:20px;position:relative;overflow:hidden;transition:border-color .2s}
    .l-lc::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,var(--brand-green),var(--brand-orange))}
    .l-lc:hover{border-color:rgba(4,106,56,.3)}
  </style>
  `;

  // ── helpers ──
  function _esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function _seal(hash) {
    const src = String(hash||'zs').padEnd(64,'0');
    let c='';
    for(let i=0;i<49;i++){const n=parseInt(src[i%src.length],16);c+=`<span style="width:10px;height:10px;border-radius:2px;display:inline-block;background:${n%3===0?'var(--brand-green)':n%2===0?'rgba(4,106,56,.35)':'rgba(255,255,255,.05)'}"></span>`;}
    return `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;width:82px">${c}</div>`;
  }

  function _chunks(h) {
    return [h.slice(0,16),h.slice(16,32),h.slice(32,48),h.slice(48,64)].filter(Boolean)
      .map(c=>`<span style="display:block;font-family:monospace;font-size:0.72rem;color:rgba(255,255,255,.7)">${_esc(c)}</span>`).join('');
  }

  function _renderAudit() {
    const panel = document.getElementById('lic-audit-log');
    if (!panel) return;
    const audit = ZsLicence.loadAudit().slice(-7).reverse();
    panel.innerHTML = audit.length ? audit.map(event => {
      const at = new Date(event.at).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
      const reference = event.detail?.licenceId || event.detail?.deviceFingerprint || event.detail?.count || '';
      return `<div style="display:flex;gap:12px;align-items:center;padding:9px 11px;border-radius:9px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.05)">
        <span style="width:8px;height:8px;border-radius:50%;background:var(--brand-green);flex-shrink:0"></span>
        <code style="font-size:.7rem;color:var(--brand-green);min-width:132px">${_esc(event.type)}</code>
        <span style="font-size:.72rem;opacity:.48;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(reference)}</span>
        <span style="font-size:.68rem;opacity:.35;white-space:nowrap">${_esc(at)}</span>
      </div>`;
    }).join('') : `<p style="font-size:.82rem;opacity:.4">Security events will appear after device verification or ownership marking.</p>`;
  }

  function _renderSecurity() {
    const device = licenceDeviceProof?.device || {};
    const verified = Boolean(licenceDeviceProof?.verified);
    const status = document.getElementById('lic-device-status');
    if (status) {
      status.textContent = verified ? 'Primary device verified' : 'Verification required';
      status.style.color = verified ? 'var(--brand-green)' : '#f87171';
      status.style.borderColor = verified ? 'rgba(4,106,56,.38)' : 'rgba(248,113,113,.35)';
      status.style.opacity = '1';
    }
    const values = {
      'lic-sec-hdi': hdi.code || 'Not issued',
      'lic-sec-fp': device.fingerprint || 'Not verified',
      'lic-sec-ip': device.lastIp || device.firstIp || 'Not observed',
      'lic-sec-time': device.verifiedAt ? new Date(device.verifiedAt).toLocaleString('en-IN') : 'Not verified',
      'lic-sec-protocol': 'ZS-Licence-v2',
      'lic-sec-owner': verified ? 'HDI + Signed Device' : 'Pending signed device',
    };
    Object.entries(values).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });
    _renderAudit();
  }

  async function _verifyOwnershipDevice(recordAudit = true) {
    licenceDeviceProof = await DeviceAuth.verifyCurrent();
    if (!licenceDeviceProof?.verified) throw new Error('Primary device authentication is required.');
    await ZsLicence.secureOwnedEntries(identity, licenceDeviceProof);
    if (recordAudit) {
      ZsLicence.audit('DEVICE_VERIFIED', {
        deviceFingerprint: licenceDeviceProof.device.fingerprint,
        observedIp: licenceDeviceProof.device.lastIp || '',
      });
    }
    _renderSecurity();
    return licenceDeviceProof;
  }

  function _card(lic) {
    const lt = ZS_LIC_TYPES[lic.licenceType]||{label:lic.licenceType||'Licence'};
    return `<div class="l-lc">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px">
        <div><div style="font-size:0.6rem;font-weight:800;letter-spacing:1.2px;color:var(--brand-green);font-family:monospace;margin-bottom:3px">${_esc(lic.licenceId)}</div><div style="font-size:0.9rem;font-weight:700;line-height:1.3">${_esc(lic.title)}</div></div>
        <span style="font-size:0.6rem;font-weight:800;text-transform:uppercase;color:var(--brand-orange);background:rgba(255,103,31,.1);border:1px solid rgba(255,103,31,.25);border-radius:999px;padding:2px 8px;white-space:nowrap;flex-shrink:0">${_esc(lic.contentType)}</span>
      </div>
      <div style="font-size:0.72rem;opacity:0.4;display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
        <span>${_esc(lt.label)}</span>
        <span>SHA-256: <code>${_esc((lic.contentHash||'').slice(0,16))}…</code></span>
        <span>${_esc(lic.createdAtStr||'')}</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:13px">
        <span style="font-size:.62rem;padding:3px 8px;border-radius:999px;background:rgba(4,106,56,.1);border:1px solid rgba(4,106,56,.22);color:var(--brand-green);font-weight:700">HDI ${_esc(lic.ownerHdi||'Legacy')}</span>
        <span style="font-size:.62rem;padding:3px 8px;border-radius:999px;background:${lic.ownerMark?'rgba(4,106,56,.1)':'rgba(255,103,31,.08)'};border:1px solid ${lic.ownerMark?'rgba(4,106,56,.22)':'rgba(255,103,31,.2)'};color:${lic.ownerMark?'var(--brand-green)':'var(--brand-orange)'};font-weight:700">${lic.ownerMark?'Device Marked':'Legacy Claim'}</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn-login l-cp" data-lid="${_esc(lic.licenceId)}" style="font-size:0.72rem;padding:5px 12px;border-radius:8px">Copy ID</button>
        <button class="btn-login l-vc" data-id="${_esc(lic.id)}" style="font-size:0.72rem;padding:5px 12px;border-radius:8px;color:var(--brand-green);border-color:rgba(4,106,56,.3)">Certificate</button>
        <button class="btn-login l-ex" data-id="${_esc(lic.id)}" style="font-size:0.72rem;padding:5px 12px;border-radius:8px">Export JSON</button>
        <button class="l-dl" data-id="${_esc(lic.id)}" style="font-size:0.72rem;padding:5px 10px;border-radius:8px;border:1px solid rgba(248,113,113,.2);color:rgba(248,113,113,.7);background:none;cursor:pointer;margin-left:auto">✕</button>
      </div>
    </div>`;
  }

  function _certMarkup(lic) {
    const lt = ZS_LIC_TYPES[lic.licenceType]||{label:lic.licenceType};
    const mark = lic.ownerMark || {};
    return `<div style="border:1px solid rgba(4,106,56,.25);border-radius:20px;overflow:hidden;max-width:680px">
      <div style="height:4px;background:linear-gradient(90deg,var(--brand-green),var(--brand-orange))"></div>
      <div style="padding:28px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:22px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,var(--brand-green),rgba(4,106,56,.4));display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;font-size:0.85rem;flex-shrink:0">ZS</div>
            <div><div style="font-size:0.65rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--brand-green);margin-bottom:2px">Zero Soils</div><div style="font-size:0.9rem;font-weight:700">Digital Ownership Certificate</div></div>
          </div>
          <span style="font-size:0.65rem;font-weight:800;padding:4px 10px;border-radius:999px;border:1px solid rgba(4,106,56,.3);color:var(--brand-green)">ZS-Licence Protocol</span>
        </div>
        <div style="margin-bottom:20px">
          <div style="font-size:0.62rem;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;opacity:.4;margin-bottom:4px">Licence ID</div>
          <div style="font-family:monospace;font-size:1.1rem;font-weight:900;letter-spacing:1.5px;color:var(--brand-green)">${_esc(lic.licenceId)}</div>
          <h4 style="font-size:1.05rem;font-weight:700;margin:6px 0 4px">${_esc(lic.title)}</h4>
          <p style="font-size:0.82rem;opacity:.5">${_esc(lt.label)} · ${_esc(lic.contentType)}</p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:20px">
          ${[['Issued To',_esc(lic.ownerName||'—'),_esc(lic.ownerHdi||'HDI pending')],
             ['Issued By','Zero Soils','zerosoils.com'],
             ['Issued At',_esc(lic.createdAtStr||'—'),'Asia/Kolkata'],
             ['Content Type',_esc(lic.contentType||'—'),_esc(lt.label)]
            ].map(([l,v,s])=>`<div style="padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07)"><div style="font-size:0.62rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;opacity:.35;margin-bottom:4px">${l}</div><div style="font-size:0.85rem;font-weight:700">${v}</div><code style="font-size:0.68rem;opacity:.45">${s}</code></div>`).join('')}
        </div>
        <div style="padding:14px;border-radius:13px;background:rgba(4,106,56,.06);border:1px solid rgba(4,106,56,.18);margin-bottom:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px">
            <div style="font-size:.65rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--brand-green)">Ownership Security Mark</div>
            <span style="font-size:.62rem;font-weight:750;padding:3px 9px;border-radius:999px;border:1px solid ${lic.ownerMark?'rgba(4,106,56,.35)':'rgba(255,103,31,.25)'};color:${lic.ownerMark?'var(--brand-green)':'var(--brand-orange)'}">${lic.ownerMark?'Device Verified':'Legacy Certificate'}</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px">
            ${[
              ['Owner HDI', lic.ownerHdi || '—'],
              ['Device Fingerprint', mark.deviceFingerprint || 'Not captured'],
              ['Observed IP', mark.observedIp || 'Not captured'],
              ['Verified At', mark.deviceVerifiedAt ? new Date(mark.deviceVerifiedAt).toLocaleString('en-IN') : 'Not captured'],
            ].map(([l,v]) => `<div><div style="font-size:.6rem;font-weight:800;text-transform:uppercase;opacity:.4;margin-bottom:4px">${l}</div><code style="font-size:.67rem;color:var(--brand-green);word-break:break-all">${_esc(v)}</code></div>`).join('')}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 88px;gap:16px;align-items:start;margin-bottom:18px">
          <div>
            <div style="font-size:0.65rem;font-weight:800;text-transform:uppercase;opacity:.35;margin-bottom:6px">Content SHA-256</div>
            <div style="padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07)">${_chunks(lic.contentHash||'')}</div>
            <div style="font-size:0.65rem;font-weight:800;text-transform:uppercase;opacity:.35;margin-top:10px;margin-bottom:6px">Verification Hash</div>
            <div style="padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07)">${_chunks(lic.verificationHash||'')}</div>
            ${lic.ownerMarkHash ? `<div style="font-size:0.65rem;font-weight:800;text-transform:uppercase;opacity:.35;margin-top:10px;margin-bottom:6px">Owner Mark Hash</div><div style="padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07)">${_chunks(lic.ownerMarkHash)}</div>` : ''}
          </div>
          <div style="text-align:center">${_seal(lic.verificationHash||lic.contentHash)}<div style="font-size:0.62rem;opacity:.3;margin-top:6px">ZS Seal</div></div>
        </div>
        <p style="font-size:0.72rem;opacity:.42;line-height:1.6;padding-top:14px;border-top:1px solid rgba(255,255,255,.06)">This certificate is a local ZS App ownership assertion: it binds the content fingerprint to the declared HDI and, for v2 marks, a server-verified primary-device snapshot. It is not a government copyright registration.</p>
      </div>
    </div>`;
  }

  function _renderRegistry(activeType, activeQ) {
    const all = ZsLicence.loadAll();
    const items = all.filter(l =>
      (!activeType || l.contentType === activeType) &&
      (!activeQ    || (l.title||'').toLowerCase().includes(activeQ) || (l.licenceId||'').toLowerCase().includes(activeQ))
    );
    const grid = document.getElementById('l-registry-grid');
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML = `<div style="opacity:.35;font-size:0.9rem;padding:48px 0;text-align:center;grid-column:1/-1">${all.length?'No claims match.':'No content claimed yet — use the Claim section to register your first piece.'}</div>`;
    } else {
      grid.innerHTML = items.slice().reverse().map(_card).join('');
    }
    grid.querySelectorAll('.l-cp').forEach(b => b.onclick = () =>
      navigator.clipboard.writeText(b.dataset.lid).then(() => { b.textContent='Copied!'; setTimeout(()=>b.textContent='Copy ID',1400); }));
    grid.querySelectorAll('.l-vc').forEach(b => b.onclick = () => {
      const lic = ZsLicence.loadAll().find(l => l.id===b.dataset.id);
      if (!lic) return;
      document.getElementById('l-cert-panel').innerHTML = _certMarkup(lic);
      document.getElementById('l-cert').scrollIntoView({ behavior:'smooth', block:'start' });
    });
    grid.querySelectorAll('.l-ex').forEach(b => b.onclick = async () => {
      const lic = ZsLicence.loadAll().find(l => l.id===b.dataset.id);
      if (!lic) return;
      try { await _verifyOwnershipDevice(); } catch (ex) { window.toast(ex.message, 'error'); return; }
      const blob = new Blob([JSON.stringify(lic,null,2)],{type:'application/json'});
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'),{href:url,download:`${lic.licenceId}.json`});
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      ZsLicence.audit('CERTIFICATE_EXPORTED', { licenceId: lic.licenceId });
      _renderSecurity();
    });
    grid.querySelectorAll('.l-dl').forEach(b => b.onclick = async () => {
      try { await _verifyOwnershipDevice(); } catch (ex) { window.toast(ex.message, 'error'); return; }
      if (!confirm('Delete this licence record?')) return;
      ZsLicence.remove(b.dataset.id);
      _renderAll();
    });
  }

  function _renderCert() {
    const panel = document.getElementById('l-cert-panel');
    if (!panel) return;
    const all   = ZsLicence.loadAll();
    const ini   = (hdi.name||'ZS').split(' ').map(w=>w[0]).join('').slice(0,3).toUpperCase();
    const certData = {
      protocol:'ZS Human Digital Identity Certificate', version:'2.0', issuer:'zerosoils.com',
      exportedAt: new Date().toISOString(),
      identity: { name: hdi.name||'', hdi: hdi.code||'' },
      deviceAuthorization: licenceDeviceProof?.verified ? licenceDeviceProof.device : null,
      claims: all.map(l=>({ licenceId:l.licenceId, title:l.title, contentType:l.contentType, ownerHdi:l.ownerHdi, ownerMarkHash:l.ownerMarkHash, verificationHash:l.verificationHash, issuedAt:l.issuedAt })),
      audit: ZsLicence.loadAudit(),
      claimCount: all.length,
    };
    panel.innerHTML = `
    <div style="max-width:680px">
      <div style="border:1px solid rgba(4,106,56,.25);border-radius:20px;overflow:hidden;margin-bottom:20px">
        <div style="height:4px;background:linear-gradient(90deg,var(--brand-green),var(--brand-orange))"></div>
        <div style="padding:28px">
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;flex-wrap:wrap">
            <div style="width:56px;height:56px;border-radius:14px;background:var(--gradient-brand);display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;font-size:1.2rem;flex-shrink:0">${_esc(ini)}</div>
            <div>
              <div style="font-size:0.62rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--brand-green);margin-bottom:3px">HDI Owner</div>
              <h4 style="font-size:1.1rem;font-weight:800;margin-bottom:4px">${_esc(hdi.name||'Anonymous')}</h4>
              <code style="font-family:monospace;font-size:0.82rem;opacity:.6">${_esc(hdi.code||'HDI not issued')}</code>
              <div style="font-size:.67rem;color:var(--brand-green);margin-top:5px">${licenceDeviceProof?.verified ? 'Primary device signed and verified' : 'Device verification pending'}</div>
            </div>
            <div style="margin-left:auto;text-align:center">${_seal(hdi.code||'zerosoils')}<div style="font-size:0.6rem;opacity:.3;margin-top:4px">HDI Seal</div></div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;padding-top:16px;border-top:1px solid rgba(255,255,255,.07)">
            ${[
              [all.length,'Total Claims'],
              [new Set(all.map(l=>l.contentType)).size,'Content Types'],
              [all.length?new Date(all.at(-1).issuedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'}):'—','Last Claim'],
              ['zerosoils.com','Issued By']
            ].map(([v,l])=>`<div style="text-align:center;padding:10px 0"><div style="font-size:1.4rem;font-weight:900;background:var(--gradient-brand);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1.2">${_esc(String(v))}</div><div style="font-size:0.65rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;opacity:.4">${l}</div></div>`).join('')}
          </div>
        </div>
      </div>
      ${all.length ? `
      <div style="${LPANEL};margin-bottom:18px">
        <p style="font-size:0.68rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--brand-green);margin-bottom:14px">Linked Claims Preview</p>
        ${all.slice(-5).reverse().map(l=>`<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05)"><code style="font-family:monospace;font-size:0.68rem;color:var(--brand-green);flex-shrink:0;width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(l.licenceId)}</code><div style="flex:1;min-width:0;font-size:0.82rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(l.title)}</div><code style="font-family:monospace;font-size:0.65rem;opacity:.35;flex-shrink:0">${_esc((l.verificationHash||'').slice(0,14))}</code></div>`).join('')}
        ${all.length>5?`<p style="font-size:0.78rem;opacity:.4;margin-top:10px">+${all.length-5} more in Registry</p>`:''}
      </div>` : `<p style="opacity:.35;font-size:0.88rem;margin-bottom:18px">No claims yet. Use the Claim section to register your first piece of content.</p>`}
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button id="l-cert-exp" class="btn-primary" style="padding:10px 20px">Export HDI Certificate</button>
        <button id="l-cert-copy" class="btn-login" style="padding:10px 20px">Copy as JSON</button>
      </div>
    </div>`;

    document.getElementById('l-cert-exp')?.addEventListener('click', async () => {
      try {
        const proof = await _verifyOwnershipDevice();
        certData.deviceAuthorization = proof.device;
        certData.audit = ZsLicence.loadAudit();
        certData.exportedAt = new Date().toISOString();
      } catch (ex) {
        window.toast(ex.message, 'error');
        return;
      }
      const blob = new Blob([JSON.stringify(certData,null,2)],{type:'application/json'});
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'),{href:url,download:`${hdi.code||'zs'}-hdi-cert.json`});
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    document.getElementById('l-cert-copy')?.addEventListener('click', async () => {
      try {
        const proof = await _verifyOwnershipDevice();
        certData.deviceAuthorization = proof.device;
        certData.audit = ZsLicence.loadAudit();
        certData.exportedAt = new Date().toISOString();
      } catch (ex) {
        window.toast(ex.message, 'error');
        return;
      }
      navigator.clipboard.writeText(JSON.stringify(certData,null,2)).then(() => {
        const btn = document.getElementById('l-cert-copy');
        if (btn) { btn.textContent='Copied!'; setTimeout(()=>btn.textContent='Copy as JSON',1400); }
      });
    });
  }

  function _renderStats() {
    const all = ZsLicence.loadAll();
    const bar = document.getElementById('l-stats-bar');
    if (!bar) return;
    bar.innerHTML = [
      ['Total Claims',  all.length,                            'var(--brand-green)'],
      ['Content Types', new Set(all.map(l=>l.contentType)).size,'var(--brand-green)'],
      ['Licence Types', new Set(all.map(l=>l.licenceType)).size,'var(--brand-orange)'],
      ['Your HDI',      hdi.code||'—',                         'rgba(255,255,255,.7)'],
    ].map(([lbl,val,color])=>`<div style="${LPANEL};text-align:center"><div style="font-size:clamp(1.3rem,3vw,2rem);font-weight:900;color:${color};margin-bottom:4px">${_esc(String(val))}</div><div style="font-size:0.65rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.45">${lbl}</div></div>`).join('');
  }

  function _renderAll() {
    _renderStats();
    _renderSecurity();
    _renderRegistry('', '');
    _renderCert();
    document.getElementById('l-search') && (document.getElementById('l-search').value='');
    document.querySelectorAll('.l-fb').forEach(b => {
      const on = b.dataset.lfilter === '';
      b.classList.toggle('lf-on', on);
    });
  }

  // ── boot ──
  _renderAll();
  _verifyOwnershipDevice().then(() => _renderAll()).catch(ex => {
    _renderSecurity();
    const status = document.getElementById('lic-device-status');
    if (status) { status.textContent = ex.message; status.style.color = '#f87171'; }
  });
  document.getElementById('lic-device-refresh')?.addEventListener('click', async () => {
    try {
      await _verifyOwnershipDevice();
      window.toast('Primary device verified for licence actions.', 'success');
    } catch (ex) { window.toast(ex.message, 'error'); }
  });

  // ── filter ──
  let _at='', _aq='';
  document.querySelectorAll('.l-fb').forEach(btn => btn.addEventListener('click', () => {
    _at = btn.dataset.lfilter;
    document.querySelectorAll('.l-fb').forEach(b => b.classList.toggle('lf-on', b.dataset.lfilter === _at));
    _renderRegistry(_at, _aq);
  }));
  document.getElementById('l-search')?.addEventListener('input', e => {
    _aq = e.target.value.toLowerCase();
    _renderRegistry(_at, _aq);
  });

  // ── digital goods shortcuts ──
  document.querySelectorAll('[data-lgoods]').forEach(btn => btn.addEventListener('click', () => {
    document.getElementById('l-ctype').value = btn.dataset.lgoods;
    document.getElementById('l-ltype').value = btn.dataset.lgoodsLic;
    document.getElementById('l-claim').scrollIntoView({ behavior:'smooth', block:'start' });
    document.getElementById('l-title').focus();
  }));

  // ── claim form ──
  document.getElementById('l-claim-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn  = e.target.querySelector('button[type=submit]');
    const errEl = document.getElementById('l-claim-err');
    const succ  = document.getElementById('l-claim-success');
    btn.disabled=true; btn.textContent='Generating…'; errEl.textContent='';
    try {
      if (!identity.code) throw new Error('Create your HDI before issuing a licence certificate.');
      const proof = await _verifyOwnershipDevice();
      const lic = await ZsLicence.claim({
        title:       document.getElementById('l-title').value,
        contentType: document.getElementById('l-ctype').value,
        licenceType: document.getElementById('l-ltype').value,
        content:     document.getElementById('l-content').value,
      }, identity, proof);
      succ.style.display='block';
      succ.innerHTML=`<div style="padding:16px 20px;border-radius:14px;background:rgba(4,106,56,.08);border:1px solid rgba(4,106,56,.22)"><div style="font-size:0.65rem;font-weight:800;letter-spacing:1.2px;color:var(--brand-green);margin-bottom:4px">CLAIMED</div><code style="font-family:monospace;font-size:1rem;font-weight:900;letter-spacing:1.5px">${_esc(lic.licenceId)}</code><p style="font-size:0.82rem;opacity:.6;margin-top:6px">"${_esc(lic.title)}" — certificate saved locally.</p><button class="btn-login" onclick="navigator.clipboard.writeText('${_esc(lic.licenceId)}').then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy Licence ID',1400)})" style="margin-top:10px;font-size:0.78rem;padding:6px 14px;border-radius:999px;color:var(--brand-green);border-color:rgba(4,106,56,.3)">Copy Licence ID</button></div>`;
      e.target.reset();
      _renderAll();
      window.toast && window.toast(`Licence ${lic.licenceId} created ✦`, 'success');
    } catch(ex) {
      errEl.textContent = ex.message || 'Failed to claim content.';
    } finally {
      btn.disabled=false; btn.textContent='Claim & Generate Certificate ⚡';
    }
  });

  // ── backup ──
  document.getElementById('l-export-btn').addEventListener('click', async () => {
    try {
      const proof = await _verifyOwnershipDevice();
      ZsLicence.exportJSON(identity, proof);
      _renderSecurity();
    } catch (ex) { window.toast(ex.message, 'error'); }
  });
  document.getElementById('l-import-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const st = document.getElementById('l-backup-status');
    try {
      await _verifyOwnershipDevice();
      const count = ZsLicence.importJSON(JSON.parse(await file.text()));
      st.textContent = `Imported ${count} licence(s). Registry updated.`;
      st.style.color = 'var(--brand-green)';
      _renderAll();
      window.toast && window.toast(`${count} licences imported ✦`, 'success');
    } catch(ex) {
      st.textContent = ex.message || 'Import failed.';
      st.style.color = '#f87171';
    }
    e.target.value = '';
  });
});

function _samplePosts() {
  return [
    { name:'Riya Sharma',  handle:'@riya',   time:'2h', tier:'truth',  body:'The internet needs more spaces where people show up as themselves. No filters, no fake reach. This is why HDI matters.', likes:42, trusts:18 },
    { name:'Dev Kapoor',   handle:'@devk',   time:'5h', tier:'gold',   body:'Just completed Gold verification on Zero Soils. Having a verified digital identity that actually means something feels different.', likes:29, trusts:31 },
    { name:'Anjali Mehta', handle:'@anjali', time:'1d', tier:'silver', body:'Social media rewards noise over truth. Zero Soils is trying something different — identity first, content second.', likes:17, trusts:12 },
  ];
}

function _postCard(p) {
  const tierColor = { truth:'var(--brand-green)', gold:'#D4AF37', silver:'#A8B8C0', bronze:'#CD7F32' };
  const pid = 'post_' + Math.random().toString(36).slice(2);
  return `
  <div class="life-card glass" id="${pid}" style="padding:22px;border-radius:18px" data-reveal>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:40px;height:40px;border-radius:50%;background:var(--gradient-brand);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;flex-shrink:0">${p.name[0]}</div>
        <div>
          <div style="font-size:0.9rem;font-weight:700;display:flex;align-items:center;gap:5px">${p.name} <span style="color:var(--brand-green);font-size:0.7rem">✓</span></div>
          <div style="font-size:0.75rem;opacity:0.5">${p.handle} · <span style="color:${tierColor[p.tier]||'#fff'};font-weight:700">${p.tier}</span></div>
        </div>
      </div>
      <span style="font-size:0.73rem;opacity:0.4;white-space:nowrap">${p.time} ago</span>
    </div>
    <p style="font-size:0.92rem;line-height:1.65;opacity:0.75;margin-bottom:14px">${p.body}</p>
    <div style="display:flex;gap:4px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.06);flex-wrap:wrap">
      <button style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:999px;font-size:0.78rem;font-weight:500;opacity:0.55;border:none;background:transparent;color:inherit;cursor:pointer">🤍 ${p.likes}</button>
      <button style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:999px;font-size:0.78rem;font-weight:600;color:var(--brand-green);border:none;background:rgba(4,106,56,0.08);cursor:pointer">✦ ${p.trusts} truth</button>
      <button style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:999px;font-size:0.78rem;opacity:0.55;border:none;background:transparent;color:inherit;cursor:pointer;margin-left:auto">↗ Share</button>
      <button onclick="zsReportContent('${pid}','post','${p.handle}')" style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:999px;font-size:0.72rem;opacity:0.28;border:none;background:transparent;color:inherit;cursor:pointer" title="Report this content">⚑</button>
    </div>
  </div>`;
}

async function zsReportContent(targetId, type, handle, postId) {
  if (!Auth.isLoggedIn()) { window.toast('Sign in to report content', 'error'); return; }
  const el = document.getElementById(targetId);
  if (el) { el.style.opacity = '0.35'; el.style.pointerEvents = 'none'; }
  window.toast('Report submitted. Our team will review it within 48 hours.', 'success');
  if (postId) {
    await zsApi('/api/community/report', { method:'POST', body:{ postId, reason:'inappropriate' } }).catch(() => {});
  }
}

function _sampleMembers() {
  return [
    { name:'Riya Sharma',  handle:'@riya',   tier:'truth'  },
    { name:'Dev Kapoor',   handle:'@devk',   tier:'gold'   },
    { name:'Anjali Mehta', handle:'@anjali', tier:'silver' },
  ];
}

// ── HOW HDI WORKS ─────────────────────────────────────────
Router.register('how-hdi-works', root => {
  const STEP_STYLE = 'display:grid;grid-template-columns:52px 1fr;gap:22px;margin-bottom:52px;align-items:start';
  const NUM_STYLE  = 'width:52px;height:52px;border-radius:50%;border:2px solid var(--brand-green);background:rgba(4,106,56,0.10);display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:900;font-family:monospace;color:var(--brand-green)';
  const steps = [
    {
      n:'01', label:'Registration',
      title:'You provide your name, email, and mobile number.',
      body:`Fill the registration form with your real name, a reachable email address, and a mobile number you own. You also choose a password that protects access to your account.
      <br/><br/>Your name and contact details are stored to issue one permanent identity. Duplicate registrations on the same email or mobile are rejected.`,
    },
    {
      n:'02', label:'OTP Verification',
      title:'We send a one-time code to your email and your mobile.',
      body:`After registration, two separate OTPs are sent — one to your email, one to your mobile number. You must confirm both before any HDI is issued.
      <br/><br/>This proves that a real mailbox and a real SIM card back the identity. OTPs expire after 10 minutes and can be resent once per minute.`,
    },
    {
      n:'03', label:'HDI Issuance',
      title:'Your permanent HDI code is issued after both checks pass.',
      body:`Once email and mobile OTPs are both verified, Zero Soils issues your permanent username and HDI in the format <code style="font-family:monospace;background:rgba(4,106,56,0.12);padding:2px 7px;border-radius:5px">INITIALS-YEAR-HEX6</code> (example: <code style="font-family:monospace;background:rgba(4,106,56,0.12);padding:2px 7px;border-radius:5px">AKY-2026-3F8A2C</code>).
      <br/><br/>This code is immutable. It cannot be reissued, transferred, or regenerated. Your password and email can be updated later without affecting your HDI.`,
    },
    {
      n:'04', label:'Privacy',
      title:'What we store and why.',
      body:`We store your name, email address, mobile number, hashed password, and device fingerprint. Passwords are never stored in plain text. We do not share your data with advertisers.
      <br/><br/>Your public profile shows only what you choose to make visible. Unverified users see only your public username and HDI validity status.
      <br/><br/><a href="#" data-page="privacy" style="color:var(--brand-green)">Read the full Privacy Notice →</a>`,
    },
    {
      n:'05', label:'Recovery',
      title:'What you can do if you lose access.',
      body:`If you lose account access, you can recover it using your registered email address. A recovery link is sent to that address.
      <br/><br/>If you lose both registered email and mobile, contact support with proof of identity. We cannot bypass this process — it protects the integrity of every HDI.
      <br/><br/>Account deletion removes your profile data, but the HDI slot remains reserved to prevent re-registration fraud.`,
    },
    {
      n:'06', label:'What HDI does not prove',
      title:'Honest limits of this system.',
      body:`Your HDI confirms that an account completed email and mobile verification at issuance. It does not prove:
      <br/><br/><ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:9px">
        ${['Your government identity or legal name','Your current location or nationality','Ownership of a phone number later reassigned by a carrier','That you are the same person if credentials are shared or stolen'].map(x =>
        `<li style="font-size:0.88rem;opacity:0.72;display:flex;align-items:flex-start;gap:9px"><span style="color:var(--brand-orange);flex-shrink:0;margin-top:1px">✗</span>${x}</li>`).join('')}
      </ul><br/>HDI is a verified registration credential — not a government-issued document.`,
    },
  ];
  root.innerHTML = `
  <div class="site-main zs-public-page">
    <div style="max-width:720px;padding:clamp(64px,9vw,120px) 0 80px">
      <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green);margin-bottom:12px" data-reveal>How it works</p>
      <h1 style="font-size:clamp(2rem,4.5vw,3.2rem);font-weight:900;letter-spacing:-0.03em;line-height:1.1;margin-bottom:18px" data-reveal>
        How HDI is issued,<br/>protected, and recovered.
      </h1>
      <p style="font-size:1rem;line-height:1.8;opacity:0.65;margin-bottom:64px;max-width:58ch" data-reveal>
        Zero Soils issues a Human Digital Identity after required account verification. Here is what happens at every step, and what we do not claim.
      </p>
      ${steps.map(s => `
      <div style="${STEP_STYLE}" data-reveal>
        <div><div style="${NUM_STYLE}">${s.n}</div></div>
        <div>
          <p style="font-size:0.7rem;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:var(--brand-green);margin-bottom:7px">${s.label}</p>
          <h3 style="font-size:1.06rem;font-weight:800;margin-bottom:12px;line-height:1.45">${s.title}</h3>
          <div style="font-size:0.91rem;line-height:1.78;opacity:0.68">${s.body}</div>
        </div>
      </div>`).join('')}
      <div style="display:flex;flex-wrap:wrap;gap:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.08)" data-reveal>
        <a href="#" class="btn-primary" data-page="register">Create your HDI →</a>
        <a href="#" class="btn-login" data-page="privacy">Privacy Notice</a>
        <a href="#" class="btn-login" data-page="terms">Terms</a>
      </div>
    </div>
  </div>
  `;
});


// ── PRIVACY NOTICE ────────────────────────────────────────
Router.register('privacy', root => {
  const SEC  = 'margin-bottom:52px';
  const H2   = 'font-size:1.12rem;font-weight:800;margin-bottom:14px;color:var(--brand-green)';
  const BODY = 'font-size:0.92rem;line-height:1.82;opacity:0.72';
  const UL   = 'list-style:none;padding:0;margin:12px 0 0;display:flex;flex-direction:column;gap:8px';
  const LI   = 'display:flex;align-items:flex-start;gap:9px;font-size:0.88rem;opacity:0.72';
  const DOT  = `<span style="color:var(--brand-green);flex-shrink:0;margin-top:2px">→</span>`;
  root.innerHTML = `
  <div class="site-main zs-public-page">
    <div style="max-width:680px;padding:clamp(64px,9vw,120px) 0 80px">
      <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green);margin-bottom:12px" data-reveal>Legal</p>
      <h1 style="font-size:clamp(1.8rem,4vw,3rem);font-weight:900;letter-spacing:-0.03em;line-height:1.1;margin-bottom:12px" data-reveal>Privacy Notice</h1>
      <p style="opacity:0.45;font-size:0.83rem;margin-bottom:52px" data-reveal>Last updated: May 2026 &nbsp;·&nbsp; Controller: Zero Soils / Amit Ku Yadav, Bhagalpur, Bihar, India</p>

      <div style="${SEC}" data-reveal>
        <h2 style="${H2}">1. What we collect</h2>
        <p style="${BODY}">When you register for an HDI, we collect and store the following information:</p>
        <ul style="${UL}">
          ${['Full name — used to issue your HDI and display on your profile','Email address — used for OTP verification, account recovery, and service communications','Mobile number — used for OTP verification only','Hashed password — stored using a one-way hash; we cannot read your password','Device fingerprint — a browser-derived identifier used to secure device-bound actions','IP address — logged at registration and OTP verification as an audit record','Timestamps of account creation, verification, and significant account events'].map(x => `<li style="${LI}">${DOT}${x}</li>`).join('')}
        </ul>
      </div>

      <div style="${SEC}" data-reveal>
        <h2 style="${H2}">2. Purpose of collection</h2>
        <p style="${BODY}">We collect this data solely to:</p>
        <ul style="${UL}">
          ${['Issue and maintain your permanent Human Digital Identity (HDI)','Verify that your email address and mobile number are real and accessible to you','Protect your account against unauthorised access','Send you transactional messages (OTP codes, account alerts) — no marketing without consent','Comply with legal obligations if required'].map(x => `<li style="${LI}">${DOT}${x}</li>`).join('')}
        </ul>
      </div>

      <div style="${SEC}" data-reveal>
        <h2 style="${H2}">3. Consent</h2>
        <p style="${BODY}">By completing registration and ticking the consent checkbox, you give informed consent to the collection and processing described in this notice. You may withdraw consent at any time by requesting account deletion. Withdrawal of consent will result in the removal of your profile data, though the HDI slot will remain reserved to prevent re-registration fraud.</p>
      </div>

      <div style="${SEC}" data-reveal>
        <h2 style="${H2}">4. Data retention</h2>
        <p style="${BODY}">We retain your data for as long as your account is active. If you request deletion:</p>
        <ul style="${UL}">
          ${['Your name, email, mobile, and password hash are deleted within 30 days','Your HDI code is retained as a reserved (inactive) record to prevent re-use','Audit logs (OTP events, device records) are retained for 90 days after deletion for fraud prevention','Anonymous aggregate statistics (count of issued HDIs, verification events) may be retained indefinitely'].map(x => `<li style="${LI}">${DOT}${x}</li>`).join('')}
        </ul>
      </div>

      <div style="${SEC}" data-reveal>
        <h2 style="${H2}">5. Data sharing</h2>
        <p style="${BODY}">We do not sell your data. We share data only with:</p>
        <ul style="${UL}">
          ${['Twilio Inc — your mobile number is transmitted to Twilio to deliver OTP SMS messages','Email service provider — your email address is used to send OTP and account emails','Legal authorities — only if required by a valid court order or law enforcement request with jurisdiction'].map(x => `<li style="${LI}">${DOT}${x}</li>`).join('')}
        </ul>
        <p style="${BODY};margin-top:12px">No other third-party sharing occurs. We do not use your data for advertising.</p>
      </div>

      <div style="${SEC}" data-reveal>
        <h2 style="${H2}">6. Your rights</h2>
        <p style="${BODY}">You have the right to:</p>
        <ul style="${UL}">
          ${['Access the personal data we hold about you','Correct inaccurate data (email, phone, name)','Request deletion of your account and personal data','Object to processing in cases where we rely on legitimate interest','Withdraw consent at any time without affecting the lawfulness of prior processing'].map(x => `<li style="${LI}">${DOT}${x}</li>`).join('')}
        </ul>
        <p style="${BODY};margin-top:12px">To exercise any of these rights, contact: <a href="mailto:zerosoils@gmail.com" style="color:var(--brand-green)">zerosoils@gmail.com</a></p>
      </div>

      <div style="${SEC}" data-reveal>
        <h2 style="${H2}">7. Grievance contact</h2>
        <p style="${BODY}">If you have a complaint about how your data is handled, contact us at <a href="mailto:zerosoils@gmail.com" style="color:var(--brand-green)">zerosoils@gmail.com</a>. We will acknowledge your complaint within 48 hours and respond within 15 business days.</p>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:12px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.08)" data-reveal>
        <a href="#" class="btn-login" data-page="terms">Terms of Use</a>
        <a href="#" class="btn-login" data-page="home">Home</a>
      </div>
    </div>
  </div>
  `;
});


// ── TERMS OF USE ──────────────────────────────────────────
Router.register('terms', root => {
  const SEC  = 'margin-bottom:52px';
  const H2   = 'font-size:1.12rem;font-weight:800;margin-bottom:14px;color:var(--brand-green)';
  const BODY = 'font-size:0.92rem;line-height:1.82;opacity:0.72';
  const UL   = 'list-style:none;padding:0;margin:12px 0 0;display:flex;flex-direction:column;gap:8px';
  const LI   = 'display:flex;align-items:flex-start;gap:9px;font-size:0.88rem;opacity:0.72';
  const DOT  = `<span style="color:var(--brand-green);flex-shrink:0;margin-top:2px">→</span>`;
  root.innerHTML = `
  <div class="site-main zs-public-page">
    <div style="max-width:680px;padding:clamp(64px,9vw,120px) 0 80px">
      <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green);margin-bottom:12px" data-reveal>Legal</p>
      <h1 style="font-size:clamp(1.8rem,4vw,3rem);font-weight:900;letter-spacing:-0.03em;line-height:1.1;margin-bottom:12px" data-reveal>Terms of Use</h1>
      <p style="opacity:0.45;font-size:0.83rem;margin-bottom:52px" data-reveal>Last updated: May 2026 &nbsp;·&nbsp; Zero Soils is operated by Amit Ku Yadav, Bhagalpur, Bihar, India</p>

      <div style="${SEC}" data-reveal>
        <h2 style="${H2}">1. What HDI is and is not</h2>
        <p style="${BODY}">A Human Digital Identity (HDI) code issued by Zero Soils is a verified registration credential. It proves that a person registered with a real email address and mobile number at the time of issuance. It is not:</p>
        <ul style="${UL}">
          ${['A government-issued identity document','A guarantee of your legal name or nationality','A proof of your physical location','A credential that prevents account sharing or stolen credentials'].map(x => `<li style="${LI}"><span style="color:var(--brand-orange);flex-shrink:0;margin-top:2px">✗</span>${x}</li>`).join('')}
        </ul>
        <p style="${BODY};margin-top:12px">Zero Soils makes no legal claims about the identity of its users beyond what can be verified by OTP confirmation.</p>
      </div>

      <div style="${SEC}" data-reveal>
        <h2 style="${H2}">2. Account rules</h2>
        <ul style="${UL}">
          ${['One person may hold only one HDI. Creating duplicate accounts is a violation of these terms.','You must provide accurate information during registration. Intentionally false names or contact details are not permitted.','You are responsible for maintaining the confidentiality of your password and account access.','You must be at least 13 years of age to register. Accounts for minors under 18 require parental consent.','Account credentials may not be shared, sold, or transferred to another person.'].map(x => `<li style="${LI}">${DOT}${x}</li>`).join('')}
        </ul>
      </div>

      <div style="${SEC}" data-reveal>
        <h2 style="${H2}">3. Prohibited use</h2>
        <p style="${BODY}">You may not use Zero Soils to:</p>
        <ul style="${UL}">
          ${['Impersonate another person or entity','Register with false contact details or bypass verification','Distribute spam, malware, or unsolicited commercial messages through the community','Scrape, harvest, or automate data collection from the platform','Attempt to exploit, hack, or disrupt the service or its infrastructure','Use an HDI to make false identity claims in external contexts','Engage in any activity that violates applicable Indian or international law'].map(x => `<li style="${LI}"><span style="color:#f87171;flex-shrink:0;margin-top:2px">✗</span>${x}</li>`).join('')}
        </ul>
      </div>

      <div style="${SEC}" data-reveal>
        <h2 style="${H2}">4. Community rules</h2>
        <p style="${BODY}">Posts and content in the Zero Soils community must:</p>
        <ul style="${UL}">
          ${['Be written by verified HDI holders','Not contain hate speech, threats, harassment, or discrimination','Not promote unlawful products or services','Not contain misinformation presented as verified fact','Respect the privacy of other users'].map(x => `<li style="${LI}">${DOT}${x}</li>`).join('')}
        </ul>
        <p style="${BODY};margin-top:12px">Zero Soils reserves the right to remove content and suspend accounts that violate these rules without prior notice.</p>
      </div>

      <div style="${SEC}" data-reveal>
        <h2 style="${H2}">5. Account termination</h2>
        <p style="${BODY}">Zero Soils may suspend or permanently terminate accounts that violate these terms. You may also request account deletion at any time by contacting support. Upon termination:</p>
        <ul style="${UL}">
          ${['Your profile and personal data are removed within 30 days','Your HDI code is retained as a reserved (inactive) record to prevent re-use','Community posts may remain visible in anonymised form at our discretion'].map(x => `<li style="${LI}">${DOT}${x}</li>`).join('')}
        </ul>
      </div>

      <div style="${SEC}" data-reveal>
        <h2 style="${H2}">6. Liability limitations</h2>
        <p style="${BODY}">Zero Soils is provided on an "as is" basis. We do not guarantee uninterrupted availability. We are not liable for:</p>
        <ul style="${UL}">
          ${['Any loss arising from reliance on an HDI code as a legal identity document','Harm resulting from your use of the community or third-party links','Data loss due to circumstances outside our control','Actions taken by other users of the platform'].map(x => `<li style="${LI}"><span style="color:rgba(255,255,255,0.35);flex-shrink:0;margin-top:2px">—</span>${x}</li>`).join('')}
        </ul>
        <p style="${BODY};margin-top:12px">Our total liability for any claim related to this service is limited to the amount you paid us in the 12 months preceding the claim, or ₹1,000 — whichever is greater.</p>
      </div>

      <div style="${SEC}" data-reveal>
        <h2 style="${H2}">7. Changes to these terms</h2>
        <p style="${BODY}">We may update these Terms of Use. Material changes will be communicated via email to registered users at least 14 days before they take effect. Continued use of Zero Soils after that date constitutes acceptance of the updated terms.</p>
        <p style="${BODY};margin-top:10px">Questions: <a href="mailto:zerosoils@gmail.com" style="color:var(--brand-green)">zerosoils@gmail.com</a></p>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:12px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.08)" data-reveal>
        <a href="#" class="btn-login" data-page="privacy">Privacy Notice</a>
        <a href="#" class="btn-login" data-page="home">Home</a>
      </div>
    </div>
  </div>
  `;
});


// ── FORGOT PASSWORD ───────────────────────────────────────
Router.register('forgot-password', root => {
  root.innerHTML = `
  <div class="zs-auth-page">
    <div style="width:100%;max-width:400px">
      <div class="glass" style="padding:36px;border-radius:22px" data-reveal>
        <div style="text-align:center;margin-bottom:28px">
          <div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,var(--brand-green),#0a9a52);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:1.4rem">🔑</div>
          <h2 style="font-size:1.4rem;font-weight:900;margin-bottom:4px">Reset password</h2>
          <p style="opacity:0.55;font-size:0.88rem">We'll email you a secure reset link</p>
        </div>
        <div id="fp-form-wrap">
          <form id="fp-form" style="display:flex;flex-direction:column;gap:14px">
            <div>
              <label style="display:block;font-size:0.8rem;font-weight:700;opacity:0.7;margin-bottom:6px">Email address</label>
              <input class="field-input-zs" type="email" name="email" placeholder="you@example.com" required autocomplete="email" />
            </div>
            <p id="fp-err" style="font-size:0.83rem;color:#f87171;min-height:1.2em"></p>
            <button type="submit" class="btn-primary" style="width:100%;padding:13px">Send reset link</button>
          </form>
        </div>
        <div style="text-align:center;margin-top:20px">
          <a href="#" data-page="login" style="font-size:0.85rem;opacity:0.55;color:inherit">← Back to sign in</a>
        </div>
      </div>
    </div>
  </div>
  <style>.field-input-zs{width:100%;padding:12px 14px;background:rgba(255,255,255,0.05);border:1.5px solid rgba(255,255,255,0.10);border-radius:12px;color:inherit;font-family:inherit;font-size:0.95rem;outline:none;transition:border-color 0.2s,box-shadow 0.2s}.field-input-zs:focus{border-color:var(--brand-green);box-shadow:0 0 0 3px rgba(4,106,56,0.14)}.field-input-zs::placeholder{opacity:0.38}</style>
  `;
  document.getElementById('fp-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const err = document.getElementById('fp-err');
    btn.disabled = true; btn.textContent = 'Sending…'; err.textContent = '';
    try {
      await API.post('/auth/forgot-password', { email: new FormData(e.target).get('email') });
      document.getElementById('fp-form-wrap').innerHTML = `
        <div style="text-align:center;padding:18px 0">
          <div style="font-size:2.2rem;margin-bottom:12px">📬</div>
          <p style="font-weight:700;margin-bottom:6px">Check your inbox</p>
          <p style="font-size:0.85rem;opacity:0.55">If that email is registered, a reset link is on its way. It expires in 15 minutes.</p>
        </div>`;
    } catch(ex) {
      err.textContent = ex.message;
      btn.disabled = false; btn.textContent = 'Send reset link';
    }
  });
});

// ── RESET PASSWORD ────────────────────────────────────────
Router.register('reset-password', root => {
  const token = new URLSearchParams(location.search).get('token') || '';
  root.innerHTML = `
  <div class="zs-auth-page">
    <div style="width:100%;max-width:400px">
      <div class="glass" style="padding:36px;border-radius:22px" data-reveal>
        <div style="text-align:center;margin-bottom:28px">
          <div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,var(--brand-green),#0a9a52);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:1.4rem">🔒</div>
          <h2 style="font-size:1.4rem;font-weight:900;margin-bottom:4px">New password</h2>
          <p style="opacity:0.55;font-size:0.88rem">Choose a strong password for your account</p>
        </div>
        <div id="rp-form-wrap">
          ${!token ? `<p style="text-align:center;opacity:0.6;font-size:0.9rem">This reset link is invalid or missing. <a href="#" data-page="forgot-password" style="color:var(--brand-green)">Request a new one →</a></p>` : `
          <form id="rp-form" style="display:flex;flex-direction:column;gap:14px">
            <div>
              <label style="display:block;font-size:0.8rem;font-weight:700;opacity:0.7;margin-bottom:6px">New password</label>
              <input class="field-input-zs" type="password" id="rp-password" placeholder="Min. 8 characters" required autocomplete="new-password" minlength="8" />
            </div>
            <div>
              <label style="display:block;font-size:0.8rem;font-weight:700;opacity:0.7;margin-bottom:6px">Confirm password</label>
              <input class="field-input-zs" type="password" id="rp-confirm" placeholder="Repeat password" required autocomplete="new-password" />
            </div>
            <p id="rp-err" style="font-size:0.83rem;color:#f87171;min-height:1.2em"></p>
            <button type="submit" class="btn-primary" style="width:100%;padding:13px">Set new password</button>
          </form>`}
        </div>
        <div style="text-align:center;margin-top:20px">
          <a href="#" data-page="login" style="font-size:0.85rem;opacity:0.55;color:inherit">← Back to sign in</a>
        </div>
      </div>
    </div>
  </div>
  <style>.field-input-zs{width:100%;padding:12px 14px;background:rgba(255,255,255,0.05);border:1.5px solid rgba(255,255,255,0.10);border-radius:12px;color:inherit;font-family:inherit;font-size:0.95rem;outline:none;transition:border-color 0.2s,box-shadow 0.2s}.field-input-zs:focus{border-color:var(--brand-green);box-shadow:0 0 0 3px rgba(4,106,56,0.14)}.field-input-zs::placeholder{opacity:0.38}</style>
  `;
  if (!token) return;
  document.getElementById('rp-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const err = document.getElementById('rp-err');
    const pw = document.getElementById('rp-password').value;
    const cf = document.getElementById('rp-confirm').value;
    if (pw !== cf) { err.textContent = 'Passwords do not match.'; return; }
    if (pw.length < 8) { err.textContent = 'Password must be at least 8 characters.'; return; }
    btn.disabled = true; btn.textContent = 'Saving…'; err.textContent = '';
    try {
      await API.post('/auth/reset-password', { token, password: pw });
      document.getElementById('rp-form-wrap').innerHTML = `
        <div style="text-align:center;padding:18px 0">
          <div style="font-size:2.2rem;margin-bottom:12px">✅</div>
          <p style="font-weight:700;margin-bottom:6px">Password updated!</p>
          <p style="font-size:0.85rem;opacity:0.55;margin-bottom:18px">You can now sign in with your new password.</p>
          <a href="#" data-page="login" class="btn-primary" style="display:inline-block;padding:12px 28px;text-decoration:none">Sign in →</a>
        </div>`;
    } catch(ex) {
      err.textContent = ex.message;
      btn.disabled = false; btn.textContent = 'Set new password';
    }
  });
});

// ── VERIFY HDI ────────────────────────────────────────────
Router.register('verify-hdi', root => {
  const HDI_RE = /^[A-Z]{1,3}-\d{4}-[0-9A-F]{6}$/;
  root.innerHTML = `
  <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:60px 20px 80px">
    <div style="width:100%;max-width:520px">
      <div style="text-align:center;margin-bottom:36px" data-reveal>
        <div style="width:60px;height:60px;border-radius:16px;background:linear-gradient(135deg,var(--brand-green),#0a9a52);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:1.6rem">🔍</div>
        <h1 style="font-size:1.8rem;font-weight:900;margin-bottom:8px">Verify an HDI</h1>
        <p style="opacity:0.55;font-size:0.92rem;max-width:340px;margin:0 auto">Enter a Human Digital Identity code to confirm it is genuine and see its verification status.</p>
      </div>

      <div class="glass" style="padding:28px;border-radius:20px;margin-bottom:20px" data-reveal>
        <div style="display:flex;gap:10px">
          <input id="hdi-search-input" type="text" placeholder="e.g. AKY-2026-3F8A2C" maxlength="16"
            style="flex:1;padding:13px 16px;background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.12);border-radius:12px;color:inherit;font-family:monospace;font-size:1rem;letter-spacing:2px;text-transform:uppercase;outline:none;transition:border-color .2s"
            oninput="this.value=this.value.toUpperCase()"
            onkeydown="if(event.key==='Enter')zsVerifyHdi()" />
          <button onclick="zsVerifyHdi()" class="btn-primary" style="padding:13px 20px;font-size:0.9rem;white-space:nowrap">Look up</button>
        </div>
        <p style="font-size:0.75rem;opacity:0.4;margin-top:10px">Format: INITIALS-YEAR-HEX6 &nbsp;·&nbsp; Not case-sensitive</p>
      </div>

      <div id="hdi-result" style="display:none"></div>

      <p style="text-align:center;margin-top:28px;font-size:0.82rem;opacity:0.4" data-reveal>
        No personal information (email or phone) is ever shown in public lookups.
      </p>
    </div>
  </div>
  `;

  window.zsVerifyHdi = async () => {
    const raw = (document.getElementById('hdi-search-input')?.value || '').trim().toUpperCase();
    const result = document.getElementById('hdi-result');
    if (!result) return;

    if (!raw) { showHdiResult(result, 'empty'); return; }
    if (!HDI_RE.test(raw)) { showHdiResult(result, 'format'); return; }

    result.style.display = 'block';
    result.innerHTML = `<div class="glass" style="padding:24px;border-radius:18px;text-align:center;opacity:0.6"><p>Looking up <strong>${raw}</strong>…</p></div>`;

    try {
      const data = await API.get(`/hdi/verify?code=${encodeURIComponent(raw)}`);
      showHdiResult(result, 'found', data);
    } catch(ex) {
      showHdiResult(result, 'error', { message: ex.message });
    }
  };

  function showHdiResult(el, state, data = {}) {
    el.style.display = 'block';
    if (state === 'empty') {
      el.innerHTML = `<div class="glass" style="padding:20px;border-radius:16px;text-align:center;opacity:0.6"><p style="font-size:0.88rem">Enter an HDI code above.</p></div>`;
      return;
    }
    if (state === 'format') {
      el.innerHTML = `<div class="glass" style="padding:20px;border-radius:16px;text-align:center"><p style="color:#f87171;font-size:0.88rem">Invalid format. Expected: <code style="font-family:monospace">INITIALS-YEAR-HEX6</code></p></div>`;
      return;
    }
    if (state === 'error') {
      el.innerHTML = `<div class="glass" style="padding:20px;border-radius:16px;text-align:center"><p style="color:#f87171;font-size:0.88rem">${data.message || 'Lookup failed. Try again.'}</p></div>`;
      return;
    }
    if (!data.found) {
      el.innerHTML = `
        <div class="glass" style="padding:28px;border-radius:18px;text-align:center" data-reveal>
          <div style="font-size:2rem;margin-bottom:10px">❌</div>
          <p style="font-weight:700;margin-bottom:6px">HDI not found</p>
          <p style="font-size:0.85rem;opacity:0.55">No registered identity matches <code style="font-family:monospace">${data.hdiCode}</code>.</p>
        </div>`;
      return;
    }
    const levelColor = data.verificationLevel === 'silver' ? '#c0c0c0' : '#cd7f32';
    const levelLabel = data.verificationLevel === 'silver' ? '🥈 Silver' : '🥉 Bronze';
    const levelDesc  = data.verificationLevel === 'silver' ? 'Email + Phone verified' : 'Email verified';
    const issuedStr  = data.issuedAt ? new Date(data.issuedAt).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }) : 'Unknown';
    el.innerHTML = `
      <div class="glass" style="padding:28px;border-radius:18px" data-reveal>
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
          <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,var(--brand-green),#0a9a52);display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0">✦</div>
          <div>
            <p style="font-weight:900;font-size:1.1rem;margin-bottom:2px;font-family:monospace;letter-spacing:1px">${data.hdiCode}</p>
            ${data.username ? `<p style="font-size:0.82rem;opacity:0.55">@${data.username}</p>` : ''}
          </div>
          <div style="margin-left:auto;text-align:right">
            <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:0.78rem;font-weight:700;background:rgba(255,255,255,.06);border:1.5px solid ${levelColor};color:${levelColor}">${levelLabel}</span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div style="padding:14px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)">
            <p style="font-size:0.72rem;opacity:0.45;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Verification</p>
            <p style="font-size:0.88rem;font-weight:600">${levelDesc}</p>
          </div>
          <div style="padding:14px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)">
            <p style="font-size:0.72rem;opacity:0.45;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Issued</p>
            <p style="font-size:0.88rem;font-weight:600">${issuedStr}</p>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <div style="flex:1;padding:10px 14px;border-radius:10px;background:${data.emailVerified ? 'rgba(4,106,56,.15)' : 'rgba(255,255,255,.04)'};border:1px solid ${data.emailVerified ? 'rgba(4,106,56,.4)' : 'rgba(255,255,255,.07)'};text-align:center">
            <p style="font-size:0.72rem;opacity:0.5;margin-bottom:2px">Email</p>
            <p style="font-size:0.9rem">${data.emailVerified ? '✅' : '○'}</p>
          </div>
          <div style="flex:1;padding:10px 14px;border-radius:10px;background:${data.phoneVerified ? 'rgba(4,106,56,.15)' : 'rgba(255,255,255,.04)'};border:1px solid ${data.phoneVerified ? 'rgba(4,106,56,.4)' : 'rgba(255,255,255,.07)'};text-align:center">
            <p style="font-size:0.72rem;opacity:0.5;margin-bottom:2px">Phone</p>
            <p style="font-size:0.9rem">${data.phoneVerified ? '✅' : '○'}</p>
          </div>
        </div>
        <p style="font-size:0.75rem;opacity:0.35;margin-top:14px;text-align:center">This identity is genuine and registered on Zero Soils.</p>
      </div>`;
  }
});

// ── SUPPORT ───────────────────────────────────────────────
Router.register('support', root => {
  const SEC = 'padding:22px 24px;border-radius:16px;border:1px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.02);margin-bottom:10px';
  const faqs = [
    ['What is a Human Digital Identity (HDI)?', 'An HDI is your permanent, verified digital identity on Zero Soils. It combines your initials, registration year, and a unique hex code — e.g. AKY-2026-3F8A2C. Once issued it never changes.'],
    ['Is Zero Soils free to join?', 'Yes. Creating your HDI and verifying email + phone is completely free. Advanced features may have optional paid tiers in the future.'],
    ['How do I get my HDI issued?', 'Register an account, verify your email with a one-time code, then verify your mobile number. Your permanent HDI is issued automatically when both are confirmed.'],
    ['What is ZS Coin?', 'ZS Coin is the native community token of Zero Soils. Each identity can hold a maximum of 99 ZS. You earn ZS by completing verification steps and contributing to the community.'],
    ['Can I change my HDI code?', 'No. Your HDI is permanent and immutable — that is the core of its value. You can update your display name, but the code itself is fixed at issuance.'],
    ['What is a ZS Licence?', 'A ZS Licence lets you stake a content ownership claim linked to your HDI. It creates a verifiable, tamper-evident record that a specific piece of content belongs to a specific identity.'],
    ['How do I reset my password?', 'On the Sign In page, click "Forgot password?" and enter your email. You will receive a secure reset link valid for 15 minutes.'],
    ['How do I verify another person\'s HDI?', 'Use the "Verify HDI" page accessible from the footer. Enter their HDI code (format: INITIALS-YEAR-HEX6) to see their verification status. No personal data is ever shown.'],
    ['Is my personal data safe?', 'We never expose your email or phone number in public lookups. All verification uses one-time codes over secure channels. See our Privacy Notice for full details.'],
    ['How do I contact the team?', 'Email us at zerosoils@gmail.com — we respond within 48 hours.'],
  ];
  root.innerHTML = `
  <div class="site-main zs-public-page">
    <div style="max-width:700px">
      <div style="padding:clamp(32px,5vw,64px) 0 32px" data-reveal>
        <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green);margin-bottom:10px">Help & Support</p>
        <h1 style="font-size:clamp(1.8rem,4vw,2.8rem);font-weight:900;letter-spacing:-0.02em;margin-bottom:10px">How can we help?</h1>
        <p style="opacity:0.55;font-size:1rem;max-width:50ch">Common questions about Zero Soils, HDI, ZS Coin, and Licences.</p>
      </div>

      <div id="faq-list" style="margin-bottom:52px">
        ${faqs.map((([q, a], i) => `
        <div style="${SEC};cursor:pointer" onclick="this.querySelector('.faq-answer').style.display=this.querySelector('.faq-answer').style.display==='block'?'none':'block';this.querySelector('.faq-icon').textContent=this.querySelector('.faq-answer').style.display==='block'?'−':'+'" data-reveal>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px">
            <p style="font-weight:700;font-size:0.95rem">${q}</p>
            <span class="faq-icon" style="font-size:1.2rem;opacity:0.5;flex-shrink:0;width:20px;text-align:center">+</span>
          </div>
          <div class="faq-answer" style="display:none;margin-top:12px;font-size:0.88rem;opacity:0.65;line-height:1.75">${a}</div>
        </div>`)).join('')}
      </div>

      <div class="glass" style="padding:32px;border-radius:20px;margin-bottom:60px" data-reveal>
        <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green);margin-bottom:12px">Still need help?</p>
        <h2 style="font-size:1.3rem;font-weight:900;margin-bottom:6px">Contact us</h2>
        <p style="opacity:0.55;font-size:0.9rem;margin-bottom:20px">We respond within 48 hours, Monday – Saturday.</p>
        <form id="support-form" style="display:flex;flex-direction:column;gap:12px">
          <input class="field-input-zs" type="text" name="name" placeholder="Your name" required />
          <input class="field-input-zs" type="email" name="email" placeholder="your@email.com" required />
          <select class="field-input-zs" name="topic" required style="appearance:none;cursor:pointer">
            <option value="" disabled selected>Select a topic…</option>
            <option>HDI verification issue</option>
            <option>Account access / password</option>
            <option>ZS Coin question</option>
            <option>Licence dispute</option>
            <option>Privacy / data request</option>
            <option>Other</option>
          </select>
          <textarea class="field-input-zs" name="message" placeholder="Describe your issue…" rows="4" required style="resize:vertical"></textarea>
          <p id="support-err" style="font-size:0.83rem;color:#f87171;min-height:1.1em"></p>
          <button type="submit" class="btn-primary" style="padding:13px;width:100%">Send message</button>
        </form>
      </div>
    </div>
  </div>
  <style>.field-input-zs{width:100%;padding:12px 14px;background:rgba(255,255,255,0.05);border:1.5px solid rgba(255,255,255,0.10);border-radius:12px;color:inherit;font-family:inherit;font-size:0.95rem;outline:none;transition:border-color 0.2s,box-shadow 0.2s;box-sizing:border-box}.field-input-zs:focus{border-color:var(--brand-green);box-shadow:0 0 0 3px rgba(4,106,56,0.14)}.field-input-zs::placeholder{opacity:0.38}</style>
  `;

  document.getElementById('support-form').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Sending…';
    const subject = encodeURIComponent(`[Zero Soils Support] ${fd.get('topic') || 'Enquiry'}`);
    const body    = encodeURIComponent(`Name: ${fd.get('name')}\nEmail: ${fd.get('email')}\n\nMessage:\n${fd.get('message')}`);
    window.open(`mailto:zerosoils@gmail.com?subject=${subject}&body=${body}`);
    e.target.reset();
    btn.disabled = false; btn.textContent = 'Send message';
    window.toast('Opening your email client…', 'success');
  });
});

// ── ADMIN ─────────────────────────────────────────────────
Router.register('admin', root => {
  if (!Auth.isLoggedIn()) { Router.go('login'); return; }
  const user = Auth.getUser();
  if (user?.role !== 'admin') {
    root.innerHTML = `<div style="min-height:60vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:40px"><div><p style="font-size:2rem;margin-bottom:12px">🔐</p><h2 style="font-weight:900;margin-bottom:8px">Admin access only</h2><p style="opacity:0.55">This page is restricted to Zero Soils administrators.</p></div></div>`;
    return;
  }

  const DP = 'padding:20px;border-radius:14px;border:1px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.03)';
  root.innerHTML = `
  <div style="min-height:100vh;padding:40px clamp(16px,4vw,48px) 80px;max-width:1100px;margin:0 auto">
    <div style="margin-bottom:32px" data-reveal>
      <p style="font-size:0.72rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:var(--brand-green);margin-bottom:8px">Admin</p>
      <h1 style="font-size:clamp(1.6rem,3.5vw,2.4rem);font-weight:900;letter-spacing:-0.02em;margin-bottom:6px">Platform overview</h1>
      <p style="opacity:0.45;font-size:0.85rem" id="admin-generated-at">Loading…</p>
    </div>

    <div id="admin-stats-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:32px" data-reveal>
      ${[1,2,3,4,5,6,7,8].map(() => `<div style="${DP};animation:pulse 1.5s infinite"><div style="height:28px;background:rgba(255,255,255,0.06);border-radius:6px;margin-bottom:8px"></div><div style="height:12px;background:rgba(255,255,255,0.04);border-radius:4px;width:60%"></div></div>`).join('')}
    </div>

    <div id="admin-details" style="display:grid;grid-template-columns:1fr 1fr;gap:16px" data-reveal>
      <div style="${DP};opacity:0.4;min-height:120px"></div>
      <div style="${DP};opacity:0.4;min-height:120px"></div>
    </div>
  </div>
  <style>@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.7}}@media(max-width:700px){[style*="repeat(4,1fr)"]{grid-template-columns:repeat(2,1fr)!important}[style*="1fr 1fr"]{grid-template-columns:1fr!important}}</style>
  `;

  API.get('/admin/stats').then(stats => {
    document.getElementById('admin-generated-at').textContent =
      'Last refreshed: ' + new Date(stats.generatedAt).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });

    const statCards = [
      { label: 'Total Users',          val: stats.users,                    color: 'var(--brand-green)' },
      { label: 'HDIs Issued',          val: stats.hdisIssued,               color: 'var(--brand-green)' },
      { label: 'Email Verified',        val: stats.emailVerified,            color: 'rgba(255,255,255,0.8)' },
      { label: 'Phone Verified',        val: stats.phoneVerified,            color: 'rgba(255,255,255,0.8)' },
      { label: 'ZS in Circulation',    val: stats.totalZsInCirculation + ' ZS', color: 'var(--brand-orange)' },
      { label: 'Active Licences',      val: stats.activeLicences,           color: 'var(--brand-orange)' },
      { label: 'Devices Enrolled',     val: stats.devicesEnrolled,          color: 'rgba(255,255,255,0.7)' },
      { label: 'Waitlist',             val: stats.waitlistCount,            color: 'rgba(255,255,255,0.7)' },
    ];

    document.getElementById('admin-stats-grid').innerHTML = statCards.map(s => `
      <div style="${DP};border-top:2px solid rgba(4,106,56,0.25)">
        <div style="font-size:1.6rem;font-weight:900;color:${s.color};margin-bottom:4px;line-height:1.1">${s.val}</div>
        <div style="font-size:0.62rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:0.42">${s.label}</div>
      </div>`).join('');

    document.getElementById('admin-details').innerHTML = `
      <div style="${DP}">
        <p style="font-size:0.7rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--brand-green);margin-bottom:14px">Growth</p>
        ${[['New users today', stats.newUsersToday], ['New this week', stats.newUsersThisWeek], ['Total transactions', stats.transactions], ['Active wallets', stats.walletsActive]].map(([l,v]) => `
        <div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
          <span style="font-size:0.83rem;opacity:0.5">${l}</span>
          <span style="font-size:0.85rem;font-weight:700;color:var(--brand-green)">${v}</span>
        </div>`).join('')}
      </div>
      <div style="${DP}">
        <p style="font-size:0.7rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--brand-green);margin-bottom:14px">Quick actions</p>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button onclick="location.reload()" class="btn-login" style="font-size:0.84rem;padding:10px;display:block;width:100%;text-align:center">Refresh stats</button>
          <a href="#" data-page="dashboard" class="btn-login" style="font-size:0.84rem;padding:10px;display:block;text-align:center">My dashboard</a>
          <a href="mailto:zerosoils@gmail.com" class="btn-login" style="font-size:0.84rem;padding:10px;display:block;text-align:center">Send broadcast</a>
        </div>
      </div>`;
  }).catch(() => {
    document.getElementById('admin-generated-at').textContent = 'Failed to load stats.';
  });
});

// ── BOOT ──────────────────────────────────────────────────
(async () => {
  await Auth.check();
  Router.init();
})();
