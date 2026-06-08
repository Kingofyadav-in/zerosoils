// ── Scroll progress (Profile id: scrollProgress) ─────────
const scrollBar = document.getElementById('scrollProgress');
window.addEventListener('scroll', () => {
  const pct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight) * 100;
  if (scrollBar) scrollBar.style.width = Math.min(pct, 100) + '%';
}, { passive: true });

// ── Header scroll shadow ──────────────────────────────────
const header = document.getElementById('site-header');
window.addEventListener('scroll', () => {
  header?.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

// ── Theme system (Profile pattern) ───────────────────────
function getTheme() { return localStorage.getItem('zs-theme') || 'dark'; }

function applyTheme(theme) {
  document.body.className         = 'theme-' + theme;
  document.documentElement.className = 'theme-' + theme;
  localStorage.setItem('zs-theme', theme);
  const logo = document.getElementById('siteLogo');
  if (logo) logo.src = theme === 'dark' ? '/logo/night-logo.png' : '/logo/day-logo.png';
  const footerLogo = document.getElementById('footerBrandLogo');
  if (footerLogo) footerLogo.src = theme === 'dark' ? '/logo/night-logo.png' : '/logo/day-logo.png';
  // fx.js hook — fires only on user-triggered changes (zsOnThemeChange undefined at page load)
  window.zsOnThemeChange?.(theme);
}

applyTheme(getTheme());

// Logo click = toggle theme (stops propagation so it doesn't nav home)
document.getElementById('siteLogo')?.addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();
  applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
});

// ── Product footer ─────────────────────────────────────────
function initProfileFooter() {
  const footer = document.querySelector('footer[data-footer]');
  if (!footer) return;
  const mailIcon = '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13" aria-hidden="true"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>';

  footer.innerHTML = `
    <div class="footer-inner">
      <div class="footer-brand">
        <p class="footer-brand-name">Zero Soils</p>
        <p class="footer-brand-tagline">Human Digital Identity Platform</p>
      </div>
      <div class="footer-right">
        <div class="footer-info-row">${mailIcon}<a href="mailto:zerosoils@gmail.com">zerosoils@gmail.com</a></div>
        <a href="/support" class="btn-login" data-page="support">Support</a>
      </div>
    </div>
    <nav class="footer-legal-links" aria-label="Legal and info links" style="display:flex;flex-wrap:wrap;gap:8px 20px;padding:18px 0 14px;border-top:1px solid rgba(255,255,255,0.07);border-bottom:1px solid rgba(255,255,255,0.07);margin-bottom:16px">
      ${[['HDI','hdi'],['Privacy Notice','privacy'],['Terms of Use','terms'],['Community','community'],['Verify HDI','verify-hdi'],['Support','support']].map(([label, page]) =>
        `<a href="/${page}" data-page="${page}" style="font-size:0.78rem;opacity:0.5;transition:opacity .2s" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='0.5'">${label}</a>`
      ).join('')}
    </nav>
    <div class="footer-bottom">&copy; <span id="footerYear"></span> Zero Soils &middot; Operated by Amit Ku Yadav &middot; All rights reserved</div>`;

  document.getElementById('footerYear').textContent = String(new Date().getFullYear());
}

initProfileFooter();

// ── Product dropdowns: five pages, task-focused shortcuts ──
const dropdownItems = {
  hdi: [
    ['HDI workspace', 'Identity setup and status', 'hdi', 'id-overview'],
    ['How issuance works', 'Inputs, OTP and permanent code', 'hdi', 'id-formula'],
    ['Verify an HDI', 'Check an issued public code', 'verify-hdi', ''],
  ],
  wallet: [
    ['Wallet overview', 'Balance and identity binding', 'wallet', 'w-overview'],
    ['Device security', 'Authorize this browser', 'wallet', 'w-security'],
    ['Ledger', 'Review recorded activity', 'wallet', 'w-wallet'],
    ['Recovery vault', 'Export or restore backup', 'wallet', 'w-vault'],
  ],
  licence: [
    ['Licence overview', 'Ownership records and status', 'licence', 'l-overview'],
    ['Issue certificate', 'Create a content claim', 'licence', 'l-claim'],
    ['Registry', 'Find issued records', 'licence', 'l-registry'],
    ['Device proof', 'Verify signing device', 'licence', 'l-security'],
  ],
};

function menuEscape(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function dropdownLink([label, note, page, section]) {
  return `<a class="zs-dd-item" href="/${menuEscape(page)}" data-page="${menuEscape(page)}"${section ? ` data-section="${menuEscape(section)}"` : ''} role="menuitem">
    <strong>${menuEscape(label)}</strong><span>${menuEscape(note)}</span>
  </a>`;
}

function fillProductDropdowns() {
  Object.entries(dropdownItems).forEach(([name, items]) => {
    const menu = document.getElementById(`dd-${name}`);
    if (menu) menu.innerHTML = items.map(dropdownLink).join('');
  });
}

function fillUserDropdown() {
  const menu = document.getElementById('dd-user');
  const user = Auth.getUser();
  if (!menu || !user) return;
  menu.innerHTML = `
    <div class="zs-dd-account"><strong>${menuEscape(user.name || 'Account')}</strong><span>${menuEscape(user.hdi_code || 'HDI verification pending')}</span></div>
    ${dropdownLink(['Identity account', 'Status and verification', 'dashboard', ''])}
    ${user.hdi_code ? dropdownLink(['Wallet', 'Open balance and security', 'wallet', 'w-overview']) : dropdownLink(['Complete HDI', 'Continue identity verification', 'verify', ''])}
    <a class="zs-dd-item" href="/support" data-page="support" role="menuitem"><strong>Support</strong><span>Get help</span></a>
    <button type="button" class="zs-dd-signout" role="menuitem">Sign out</button>`;
  menu.querySelector('.zs-dd-signout')?.addEventListener('click', () => {
    closeDropdowns();
    Auth.logout();
  });
}

function closeDropdowns(exception) {
  document.querySelectorAll('.zs-has-dd.is-open').forEach(item => {
    if (item === exception) return;
    item.classList.remove('is-open');
    item.querySelector('.zs-dd-trigger')?.setAttribute('aria-expanded', 'false');
  });
}

function initDropdowns() {
  fillProductDropdowns();
  fillUserDropdown();
  document.querySelectorAll('.zs-dd-trigger').forEach(trigger => {
    trigger.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const item = trigger.closest('.zs-has-dd');
      const open = !item.classList.contains('is-open');
      closeDropdowns(item);
      item.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', String(open));
      if (open) item.querySelector('.zs-dd-item')?.focus();
    });
    trigger.addEventListener('keydown', event => {
      if (event.key !== 'ArrowDown') return;
      event.preventDefault();
      trigger.click();
    });
  });
  document.querySelectorAll('.zs-dd').forEach(menu => {
    menu.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
      if (!items.length) return;
      event.preventDefault();
      const current = Math.max(0, items.indexOf(document.activeElement));
      const next = event.key === 'Home' ? 0
        : event.key === 'End' ? items.length - 1
          : event.key === 'ArrowDown' ? (current + 1) % items.length
            : (current - 1 + items.length) % items.length;
      items[next].focus();
    });
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.zs-has-dd')) closeDropdowns();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const openTrigger = document.querySelector('.zs-has-dd.is-open .zs-dd-trigger');
    closeDropdowns();
    openTrigger?.focus();
  });
  document.addEventListener('zs:navigate', () => closeDropdowns());
  document.addEventListener('zs:auth-change', fillUserDropdown);
}

initDropdowns();

// ── Hamburger / mobile nav ────────────────────────────────
const burger    = document.getElementById('hamburger');
const primaryNav = document.getElementById('primary-nav');
function closeMenu() {
  primaryNav?.classList.remove('open');
  burger?.classList.remove('open');
  burger?.setAttribute('aria-expanded', 'false');
}
burger?.addEventListener('click', () => {
  const open = !primaryNav?.classList.contains('open');
  primaryNav?.classList.toggle('open', open);
  burger.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', String(open));
});
document.addEventListener('click', e => {
  if (primaryNav?.classList.contains('open') && !primaryNav.contains(e.target) && !burger.contains(e.target)) {
    closeMenu();
  }
});

// ── Active nav link ───────────────────────────────────────
function setActiveNav(page) {
  document.querySelectorAll('#site-nav > li > a[data-page]').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });
}
document.addEventListener('zs:navigate', e => {
  setActiveNav(e.detail?.page);
  closeMenu();
});

// ── Scroll reveal (data-reveal attr) ─────────────────────
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('revealed'); revealObs.unobserve(e.target); }
  });
}, { threshold: 0.1 });

function initReveal() {
  document.querySelectorAll('[data-reveal]').forEach(el => {
    el.classList.remove('revealed');
    revealObs.observe(el);
  });
}
initReveal();
document.addEventListener('zs:navigate', initReveal);

// ── Count-up ──────────────────────────────────────────────
const countObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { startCount(e.target); countObs.unobserve(e.target); }
  });
}, { threshold: 0.5 });

function startCount(el) {
  const target = parseInt(el.dataset.countup, 10);
  const dur = 1200;
  const start = performance.now();
  const tick = now => {
    const p = Math.min((now - start) / dur, 1);
    el.textContent = Math.floor(p * target).toLocaleString();
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = target.toLocaleString();
  };
  requestAnimationFrame(tick);
}

function initCountUp() {
  document.querySelectorAll('[data-countup]').forEach(el => countObs.observe(el));
}
initCountUp();
document.addEventListener('zs:navigate', initCountUp);

// ── Button ripple (Profile: fx-ripple class) ──────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn-primary,.btn-secondary');
  if (!btn) return;
  const r    = document.createElement('span');
  const d    = Math.max(btn.clientWidth, btn.clientHeight);
  const rect = btn.getBoundingClientRect();
  r.className = 'fx-ripple';
  r.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX-rect.left-d/2}px;top:${e.clientY-rect.top-d/2}px;`;
  btn.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
});

// ── Toast helper (global) ─────────────────────────────────
window.toast = function(msg, type = 'info', ms = 3800) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.style.cssText = `
    display:flex;align-items:center;gap:10px;padding:12px 18px;
    background:var(--card-bg-dark,#1c1c1e);
    border:1px solid rgba(255,255,255,0.12);
    border-left:3px solid ${type==='success'?'#046A38':type==='error'?'#f87171':'#FF671F'};
    border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.35);
    font-size:0.875rem;font-weight:500;color:#e5e5e5;
    max-width:340px;animation:fx-page-in 0.25s ease;
  `;
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transition='0.3s'; setTimeout(()=>el.remove(),300); }, ms);
};

// ── 3D tilt (Profile effects.css handles cards) ───────────
document.addEventListener('mousemove', e => {
  document.querySelectorAll('.life-card,.blog-card,.service-card').forEach(card => {
    const r = card.getBoundingClientRect();
    if (e.clientX < r.left-60 || e.clientX > r.right+60 ||
        e.clientY < r.top-60  || e.clientY > r.bottom+60) return;
    const x = ((e.clientX - r.left) / r.width  - 0.5) * 12;
    const y = ((e.clientY - r.top)  / r.height - 0.5) * -12;
    card.style.transform = `perspective(900px) rotateY(${x}deg) rotateX(${y}deg) translateZ(4px)`;
  });
});
document.addEventListener('mouseleave', () => {
  document.querySelectorAll('.life-card,.blog-card,.service-card')
    .forEach(c => c.style.transform = '');
}, true);
