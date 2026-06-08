/* ── fx.js — World-Class Interactions + Audio v2 ──────────
   01 · FX Kill-switch        11 · Button Ink Ripple
   02 · Injected Styles       12 · Number Counter
   03 · Audio Engine          13 · Text Scramble
   04 · Cursor Spotlight      14 · Scroll Parallax + Mesh
   05 · Gradient Mesh         15 · Haptic Feedback
   06 · Cursor Trail          16 · Page Visibility Guard
   07 · 3D Card Tilt          17 · Attention Pulse
   08 · Route Transitions     18 · Performance Guard
   09 · Theme Hook            19 · Children Stagger
   10 · Magnetic Nav + Burst  20 · Toast Patch
──────────────────────────────────────────────────────────── */

// ── Global flags — declared first so everything can reference them ──
let _tabHidden  = false;
let _slowDevice = false;
const _trailDots = [];  // populated in §06, referenced in §01


// ── 01. FX Kill-switch ────────────────────────────────────
function fxEnabled() { return localStorage.getItem('zs-fx') !== 'off'; }

function setFx(on) {
  localStorage.setItem('zs-fx', on ? 'on' : 'off');
  document.documentElement.classList.toggle('fx-off', !on);
  const btn = document.getElementById('fxToggle');
  if (btn) {
    btn.textContent = on ? '⚡' : '○';
    btn.title       = on ? 'Effects ON — click to disable' : 'Effects OFF — click to enable';
    btn.setAttribute('aria-pressed', String(on));
    btn.classList.toggle('fx-btn-off', !on);
  }
  _trailDots.forEach(d => { d.style.opacity = on ? '' : '0'; });
}

setFx(fxEnabled());
document.getElementById('fxToggle')?.addEventListener('click', () => setFx(!fxEnabled()));


// ── 02. Injected Effect Styles ────────────────────────────
const _fx2style = document.createElement('style');
_fx2style.textContent = `
  /* Ink ripple — must be inside relative+overflow:hidden button */
  .zs-ripple {
    position: absolute; border-radius: 50%;
    width: 8px; height: 8px; margin: -4px 0 0 -4px;
    background: rgba(255,255,255,0.32);
    transform: scale(0); pointer-events: none; z-index: 9;
    animation: zsRipple 0.6s cubic-bezier(0,0.5,0.3,1) forwards;
  }
  @keyframes zsRipple { to { transform: scale(28); opacity: 0; } }

  /* Attention pulse — breathing glow on idle CTAs */
  @keyframes zsBreath {
    0%,100% { box-shadow: 0 2px 12px rgba(4,106,56,0.28); }
    50%      { box-shadow: 0 2px 32px rgba(4,106,56,0.68), 0 0 0 5px rgba(4,106,56,0.14); }
  }
  .zs-pulse { animation: zsBreath 2s ease-in-out infinite; }

  /* Scramble — green tint while characters are randomising */
  .zs-scrambling { color: #046A38 !important; letter-spacing: 1px; }

  /* Children stagger — enter state */
  .zs-kid-enter {
    opacity: 0 !important;
    transform: translateY(14px) !important;
  }
  .zs-kid-go {
    transition:
      opacity   0.44s ease       var(--zs-d, 0ms),
      transform 0.44s cubic-bezier(0.16,1,0.3,1) var(--zs-d, 0ms);
    opacity:   1 !important;
    transform: none !important;
  }
`;
document.head.appendChild(_fx2style);


// ── 03. Audio Engine ─────────────────────────────────────
const zsAudio = (() => {
  let ctx = null;

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function safe(fn) {
    if (!fxEnabled()) return;
    try { fn(ac()); } catch(e) {}
  }

  return {
    // Theme sweep — kept exactly as before (DO NOT REMOVE)
    themeToggle(toDark) {
      safe(c => {
        const o = c.createOscillator(), g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.type = 'sine';
        const t = c.currentTime;
        o.frequency.setValueAtTime(toDark ? 520 : 330, t);
        o.frequency.exponentialRampToValueAtTime(toDark ? 180 : 720, t + 0.24);
        g.gain.setValueAtTime(0.07, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
        o.start(t); o.stop(t + 0.30);
      });
    },

    // Crisp click tick — kept exactly as before (DO NOT REMOVE)
    btnClick() {
      safe(c => {
        const len = Math.floor(c.sampleRate * 0.035);
        const buf = c.createBuffer(1, len, c.sampleRate);
        const d   = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.2;
        const src  = c.createBufferSource();
        const filt = c.createBiquadFilter();
        const g    = c.createGain();
        filt.type = 'bandpass'; filt.frequency.value = 1600; filt.Q.value = 0.7;
        src.buffer = buf;
        src.connect(filt); filt.connect(g); g.connect(c.destination);
        g.gain.value = 0.5;
        src.start();
      });
    },

    // Nav ping — kept exactly as before
    navHover: (() => {
      let last = 0;
      return () => {
        const now = Date.now();
        if (now - last < 90) return;
        last = now;
        safe(c => {
          const o = c.createOscillator(), g = c.createGain();
          o.connect(g); g.connect(c.destination);
          o.frequency.value = 1100;
          const t = c.currentTime;
          g.gain.setValueAtTime(0.018, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
          o.start(t); o.stop(t + 0.045);
        });
      };
    })(),

    // Toast chime — kept exactly as before
    toastSound(type) {
      safe(c => {
        const freqs = type === 'error' ? [440, 370, 311] : [523, 659, 784];
        freqs.forEach((f, i) => {
          const o = c.createOscillator(), g = c.createGain();
          o.connect(g); g.connect(c.destination);
          o.type = 'triangle'; o.frequency.value = f;
          const t = c.currentTime + i * 0.1;
          g.gain.setValueAtTime(0.05, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
          o.start(t); o.stop(t + 0.2);
        });
      });
    },

    // NEW: each route has its own signature note
    routeTone(page) {
      const tones = {
        home: 392, dashboard: 440, wallet: 494, licence: 523,
        identity: 370, community: 415, support: 349, admin: 587,
        login: 330, register: 440, verify: 466,
        'how-hdi-works': 415, 'forgot-password': 349, 'reset-password': 370,
      };
      const freq = tones[page] || 392;
      safe(c => {
        const o = c.createOscillator(), g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.type = 'triangle'; o.frequency.value = freq;
        const t = c.currentTime;
        g.gain.setValueAtTime(0.020, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
        o.start(t); o.stop(t + 0.13);
      });
    },

    // NEW: HDI / success fanfare (ascending triad)
    fanfare() {
      safe(c => {
        [523, 659, 784, 1047].forEach((f, i) => {
          const o = c.createOscillator(), g = c.createGain();
          o.connect(g); g.connect(c.destination);
          o.type = 'triangle'; o.frequency.value = f;
          const t = c.currentTime + i * 0.09;
          g.gain.setValueAtTime(0.06, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
          o.start(t); o.stop(t + 0.22);
        });
      });
    },
  };
})();
window.zsAudio = zsAudio;


// ── 04. Cursor Spotlight ──────────────────────────────────
const cursorGlow = document.createElement('div');
cursorGlow.id = 'fx-cursor-glow';
document.body.appendChild(cursorGlow);

let _glowX = -999, _glowY = -999, _rafGlow = null;
document.addEventListener('mousemove', e => {
  if (!fxEnabled()) return;
  _glowX = e.clientX; _glowY = e.clientY;
  if (_rafGlow) return;
  _rafGlow = requestAnimationFrame(() => {
    cursorGlow.style.left = _glowX + 'px';
    cursorGlow.style.top  = _glowY + 'px';
    const hot = document.elementFromPoint(_glowX, _glowY)
                  ?.closest('.btn-primary,.btn-secondary,.nav-list a,.brand-link,#siteLogo');
    cursorGlow.style.setProperty('--glow-color',
      hot ? 'rgba(255,103,31,0.08)' : 'rgba(4,106,56,0.06)');
    _rafGlow = null;
  });
}, { passive: true });


// ── 05. Mouse-Tracked Gradient Mesh ──────────────────────
// Fixes: explicit 0%/65% color stops (no more broken shorthand)
// New: scroll offset blended into Y position (scroll parallax in background)

const _mesh = document.getElementById('fx-gradient-mesh');
let _mx = 0.5, _my = 0.5;  // mouse target 0..1
let _cx = 0.5, _cy = 0.5;  // lerped current
let _meshRaf = null;

function _updateMesh() {
  if (!_mesh) return;
  const isDark = document.body.classList.contains('theme-dark');
  // Blend mouse position with scroll progress for a subtle vertical parallax
  const scrollMax = Math.max(1, document.body.scrollHeight - window.innerHeight);
  const sP  = window.scrollY / scrollMax;
  const bY  = _cy * 0.78 + sP * 0.22;   // 22% scroll influence
  const x   = (_cx * 100).toFixed(1) + '%';
  const y   = (bY  * 100).toFixed(1) + '%';
  const x2  = ((1 - _cx) * 100).toFixed(1) + '%';
  const y2  = ((1 - bY)  * 100).toFixed(1) + '%';

  _mesh.style.background = isDark
    ? `radial-gradient(ellipse 56% 46% at ${x} ${y}, rgba(4,106,56,0.22) 0%, transparent 65%),` +
      `radial-gradient(ellipse 50% 42% at ${x2} ${y2}, rgba(255,103,31,0.13) 0%, transparent 60%),` +
      `radial-gradient(ellipse 72% 56% at 50% 0%, rgba(4,106,56,0.07) 0%, transparent 55%)`
    : `radial-gradient(ellipse 60% 50% at ${x} ${y}, rgba(4,106,56,0.07) 0%, transparent 65%),` +
      `radial-gradient(ellipse 55% 45% at ${x2} ${y2}, rgba(255,103,31,0.04) 0%, transparent 60%)`;

  document.documentElement.style.setProperty('--mx', _cx.toFixed(4));
  document.documentElement.style.setProperty('--my', _cy.toFixed(4));
}

function _meshLoop() {
  const L = 0.055;
  _cx += (_mx - _cx) * L;
  _cy += (_my - _cy) * L;
  if (Math.abs(_mx - _cx) > 0.0004 || Math.abs(_my - _cy) > 0.0004) {
    if (fxEnabled() && !_tabHidden && !_slowDevice) _updateMesh();
    _meshRaf = requestAnimationFrame(_meshLoop);
  } else {
    _meshRaf = null;
  }
}

document.addEventListener('mousemove', e => {
  _mx = e.clientX / window.innerWidth;
  _my = e.clientY / window.innerHeight;
  if (!_meshRaf && !_tabHidden) _meshRaf = requestAnimationFrame(_meshLoop);
}, { passive: true });

window.addEventListener('scroll', () => {
  if (!_meshRaf && !_tabHidden && fxEnabled()) _meshRaf = requestAnimationFrame(_meshLoop);
}, { passive: true });

_updateMesh();


// ── 06. Cursor Trail ──────────────────────────────────────
// Fix: only updates DOM when mouse actually moved (_trailMoved flag)

const TRAIL_COLORS = ['#046A38','#0d9e56','#FF671F','#046A38'];
const TRAIL_SIZES  = [5, 7, 9, 11];
const TRAIL_DELAYS = [0, 3, 7, 14];  // frame lag per dot

const _trailBuf = Array.from({ length: 20 }, () => ({ x: -99, y: -99 }));
let   _trailMoved = false;

for (let i = 0; i < 4; i++) {
  const d = document.createElement('div');
  d.className = 'zs-trail';
  d.setAttribute('aria-hidden', 'true');
  document.body.appendChild(d);
  _trailDots.push(d);  // visible to setFx now
}

document.addEventListener('mousemove', e => {
  _trailBuf.push({ x: e.clientX, y: e.clientY });
  if (_trailBuf.length > 20) _trailBuf.shift();
  _trailMoved = true;
}, { passive: true });

(function trailLoop() {
  if (_trailMoved && fxEnabled() && !_slowDevice &&
      !matchMedia('(max-width:768px)').matches) {
    const q = _trailBuf.length;
    for (let i = 0; i < 4; i++) {
      const pos = _trailBuf[Math.max(0, q - 1 - TRAIL_DELAYS[i])];
      const op  = pos.x < 0 ? '0' : (0.55 - i * 0.10).toFixed(2);
      _trailDots[i].style.cssText =
        `left:${pos.x}px;top:${pos.y}px;opacity:${op};` +
        `width:${TRAIL_SIZES[i]}px;height:${TRAIL_SIZES[i]}px;` +
        `background:${TRAIL_COLORS[i]}`;
    }
    _trailMoved = false;
  }
  requestAnimationFrame(trailLoop);
})();


// ── 07. 3D Card Tilt ──────────────────────────────────────
// Fix: single _tiltCard tracking variable — no more querySelectorAll on every mouseover

const TILT_MAX = 8;
const TILT_SEL = '.glass:not(.site-header):not(.site-footer),.life-card,.zs-card';
const _hasFinePtr = matchMedia('(hover:hover) and (pointer:fine)').matches;
let   _tiltCard = null;

if (_hasFinePtr) {
  document.addEventListener('mousemove', e => {
    if (!fxEnabled() || _slowDevice) return;
    const card = e.target?.closest(TILT_SEL);
    if (card !== _tiltCard) {
      if (_tiltCard) { _tiltCard.style.transform = ''; _tiltCard.style.willChange = ''; }
      _tiltCard = card;
    }
    if (!card) return;
    const r  = card.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width  / 2)) / (r.width  / 2);
    const dy = (e.clientY - (r.top  + r.height / 2)) / (r.height / 2);
    card.style.transform  = `perspective(900px) rotateX(${(-dy * TILT_MAX).toFixed(2)}deg) rotateY(${(dx * TILT_MAX).toFixed(2)}deg) scale(1.008)`;
    card.style.willChange = 'transform';
  }, { passive: true });
}


// ── 08. Route Transitions ─────────────────────────────────
const _pageRoot = document.getElementById('page-root');

function _routeIn() {
  if (!fxEnabled() || !_pageRoot) return;
  _pageRoot.classList.remove('zs-route-in');
  void _pageRoot.offsetWidth;
  _pageRoot.classList.add('zs-route-in');
  _pageRoot.addEventListener('animationend',
    () => _pageRoot.classList.remove('zs-route-in'), { once: true });
}

document.addEventListener('zs:navigate', e => {
  // Signature route tone (§03 Audio — new method)
  const page = e?.detail?.page;
  if (page) zsAudio.routeTone(page);

  requestAnimationFrame(() => {
    _routeIn();
    _staggerChildren(_pageRoot);      // §19
    initCounters(_pageRoot);          // §12
    initScramble(_pageRoot);          // §13
    initParallax(_pageRoot);          // §14
  });
});


// ── 09. Theme Hook (ripple + spin + mesh refresh) ─────────
// KEPT EXACTLY — DO NOT REMOVE

function fxThemeRipple() {
  if (!fxEnabled()) return;
  const logo = document.getElementById('siteLogo');
  if (!logo) return;
  const r   = logo.getBoundingClientRect();
  const cx  = r.left + r.width  / 2;
  const cy  = r.top  + r.height / 2;
  const rad = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy)) * 2.2;
  const el  = document.createElement('div');
  el.className = 'fx-logo-ripple';
  el.style.cssText = `left:${cx}px;top:${cy}px;width:${rad}px;height:${rad}px`;
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

function fxSpinLogo() {
  if (!fxEnabled()) return;
  const logo = document.getElementById('siteLogo');
  if (!logo) return;
  logo.classList.remove('fx-spin');
  void logo.offsetWidth;
  logo.classList.add('fx-spin');
  logo.addEventListener('animationend', () => logo.classList.remove('fx-spin'), { once: true });
}

window.zsOnThemeChange = theme => {
  zsAudio.themeToggle(theme === 'dark');
  fxThemeRipple();
  fxSpinLogo();
  _updateMesh();
};


// ── 10. Magnetic Nav + Particle Burst ─────────────────────
// KEPT EXACTLY — DO NOT REMOVE

if (_hasFinePtr) {
  document.querySelectorAll('.nav-list a').forEach(link => {
    link.addEventListener('mousemove', e => {
      if (!fxEnabled()) return;
      const r = link.getBoundingClientRect();
      link.style.transform =
        `translate(${((e.clientX - r.left - r.width  / 2) * 0.28).toFixed(1)}px,` +
                  `${((e.clientY - r.top  - r.height / 2) * 0.28).toFixed(1)}px)`;
    });
    link.addEventListener('mouseleave', () => { link.style.transform = ''; });
    link.addEventListener('mouseenter', () => zsAudio.navHover());
  });
}

function fxBurst(x, y, color) {
  if (!fxEnabled() || _slowDevice) return;
  for (let i = 0; i < 9; i++) {
    const el    = document.createElement('div');
    const angle = (i / 9) * Math.PI * 2 + Math.random() * 0.5;
    const speed = 34 + Math.random() * 30;
    el.className = 'fx-particle';
    el.style.cssText =
      `left:${x}px;top:${y}px;` +
      `--dx:${(Math.cos(angle) * speed).toFixed(1)}px;` +
      `--dy:${(Math.sin(angle) * speed).toFixed(1)}px;` +
      `background:${color}`;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }
}

document.addEventListener('click', e => {
  const btn = e.target.closest('.btn-primary,.btn-secondary');
  if (btn) { zsAudio.btnClick(); fxBurst(e.clientX, e.clientY, '#046A38'); }
  if (e.target.id === 'siteLogo') fxBurst(e.clientX, e.clientY, '#FF671F');
});


// ── 11. Button Ink Ripple ─────────────────────────────────
// Ink spreads from exact click position within the button

document.addEventListener('click', e => {
  const btn = e.target.closest('.btn-primary,.btn-login');
  if (!btn || !fxEnabled()) return;
  const r      = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'zs-ripple';
  ripple.style.top  = (e.clientY - r.top)  + 'px';
  ripple.style.left = (e.clientX - r.left) + 'px';
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
});


// ── 12. Number Counter ────────────────────────────────────
// Usage: <span data-count="1234"></span>  — counts up when scrolled into view
// Exposed as window.zsCountUp(el, end, durationMs) for manual triggers

function zsCountUp(el, end, dur = 1100) {
  const from  = parseInt(el.textContent.replace(/[^0-9-]/g, '')) || 0;
  if (from === end) return;
  const t0 = performance.now();
  (function tick(now) {
    const p  = Math.min((now - t0) / dur, 1);
    const ep = 1 - Math.pow(1 - p, 3);  // ease-out cubic
    el.textContent = Math.round(from + (end - from) * ep).toLocaleString();
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}
window.zsCountUp = zsCountUp;

function initCounters(root) {
  if (!root) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(({ isIntersecting, target }) => {
      if (!isIntersecting) return;
      const n = parseInt(target.dataset.count);
      if (!isNaN(n)) zsCountUp(target, n);
      obs.unobserve(target);
    });
  }, { threshold: 0.5 });
  root.querySelectorAll('[data-count]').forEach(el => obs.observe(el));
}


// ── 13. Text Scramble ─────────────────────────────────────
// Usage: <span data-scramble="AKY-2026-3F8A2C">AKY-2026-3F8A2C</span>
// Exposed as window.zsScramble(el, finalText) for manual triggers (HDI reveal etc.)

const SCRAMBLE_CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function zsScramble(el, finalText) {
  const target = finalText || el.dataset.scramble || el.textContent.trim();
  if (!target) return;
  el.dataset.scramble = target;
  const len    = target.length;
  const frames = len * 3 + 14;
  let   frame  = 0;
  el.classList.add('zs-scrambling');
  (function tick() {
    frame++;
    const settled = Math.floor((frame / frames) * len);
    let out = '';
    for (let i = 0; i < len; i++) {
      const ch = target[i];
      if ('-. @/'.includes(ch))      { out += ch; continue; }
      out += i < settled ? ch : SCRAMBLE_CH[Math.floor(Math.random() * SCRAMBLE_CH.length)];
    }
    el.textContent = out;
    if (frame < frames) requestAnimationFrame(tick);
    else { el.textContent = target; el.classList.remove('zs-scrambling'); }
  })();
}
window.zsScramble = zsScramble;

function initScramble(root) {
  if (!root) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(({ isIntersecting, target }) => {
      if (!isIntersecting) return;
      zsScramble(target);
      obs.unobserve(target);
    });
  }, { threshold: 0.6 });
  root.querySelectorAll('[data-scramble]').forEach(el => obs.observe(el));
}


// ── 14. Scroll Parallax ───────────────────────────────────
// Usage: <div data-parallax="0.3">  (0.3 = 30% of scroll speed)
// Also feeds scroll position into gradient mesh (§05)

const _parallaxItems = [];

function initParallax(root) {
  if (!root) return;
  root.querySelectorAll('[data-parallax]').forEach(el => {
    if (!_parallaxItems.find(p => p.el === el))
      _parallaxItems.push({ el, speed: parseFloat(el.dataset.parallax) || 0.3 });
  });
}

window.addEventListener('scroll', () => {
  if (!fxEnabled() || !_parallaxItems.length) return;
  const y = window.scrollY;
  _parallaxItems.forEach(({ el, speed }) => {
    const mid = window.innerHeight / 2;
    const off = el.getBoundingClientRect().top + y - mid;
    el.style.transform = `translateY(${(-off * speed * 0.08).toFixed(2)}px)`;
  });
}, { passive: true });


// ── 15. Haptic Feedback ───────────────────────────────────
// Subtle vibration on mobile CTA clicks

if ('vibrate' in navigator) {
  document.addEventListener('click', e => {
    if      (e.target.closest('.btn-primary')) navigator.vibrate(8);
    else if (e.target.closest('.btn-login'))   navigator.vibrate(4);
  }, { passive: true });
}


// ── 16. Page Visibility Guard ─────────────────────────────
// Pause heavy rAF loops when tab is hidden — saves battery

document.addEventListener('visibilitychange', () => {
  _tabHidden = document.hidden;
  if (!_tabHidden && !_meshRaf) _meshRaf = requestAnimationFrame(_meshLoop);
});


// ── 17. Attention Pulse ───────────────────────────────────
// After 5 s of no interaction → primary CTAs breathe; any activity stops it

let _idleTimer = null;
let _pulsing   = false;

function _startPulse() {
  if (_pulsing || !fxEnabled()) return;
  _pulsing = true;
  document.querySelectorAll('.btn-primary:not([disabled])').forEach(b => b.classList.add('zs-pulse'));
}
function _stopPulse() {
  if (!_pulsing) return;
  _pulsing = false;
  document.querySelectorAll('.zs-pulse').forEach(b => b.classList.remove('zs-pulse'));
}
function _resetIdle() {
  _stopPulse();
  clearTimeout(_idleTimer);
  _idleTimer = setTimeout(_startPulse, 5000);
}

['mousemove','keydown','scroll','click','touchstart'].forEach(ev =>
  document.addEventListener(ev, _resetIdle, { passive: true }));
_resetIdle();


// ── 18. Performance Guard ─────────────────────────────────
// Measure average frame time over 30 frames; if < ~27 fps → reduce effects

const _perfT0 = performance.now();
let   _perfN  = 0;
(function _perfCheck() {
  if (++_perfN < 30) { requestAnimationFrame(_perfCheck); return; }
  const avg = (performance.now() - _perfT0) / _perfN;
  if (avg > 37) {
    _slowDevice = true;
    _trailDots.forEach(d => d.remove());
    console.info('[ZS FX] Slow device — trail + tilt disabled');
  }
})();


// ── 19. Children Stagger ─────────────────────────────────
// Called on every route change: direct children of #page-root fade + slide up
// with a 48 ms stagger. Skips elements that already have [data-reveal].

function _staggerChildren(root) {
  if (!root || !fxEnabled()) return;
  const kids = Array.from(root.children)
    .filter(el => !el.hasAttribute('data-reveal'))
    .slice(0, 14);
  if (!kids.length) return;

  // Frame 1 — hide
  kids.forEach((el, i) => {
    el.style.setProperty('--zs-d', i * 48 + 'ms');
    el.classList.add('zs-kid-enter');
    el.classList.remove('zs-kid-go');
  });

  // Frame 2 — animate in
  requestAnimationFrame(() => {
    kids.forEach(el => {
      el.classList.add('zs-kid-go');
    });
    // Cleanup inline state after all transitions complete
    const total = 440 + kids.length * 48 + 60;
    setTimeout(() => {
      kids.forEach(el => {
        el.classList.remove('zs-kid-enter', 'zs-kid-go');
        el.style.removeProperty('--zs-d');
      });
    }, total);
  });
}


// ── 20. Toast Sound Patch ─────────────────────────────────
const _origToast = window.toast;
window.toast = function(msg, type = 'info', ms) {
  zsAudio.toastSound(type);
  _origToast?.(msg, type, ms);
};
