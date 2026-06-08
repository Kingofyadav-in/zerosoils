const Auth = (() => {
  let user = null;

  async function login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Login failed');
    const data = await res.json();
    user = data.user;
    localStorage.setItem('zs_token', data.token);
    if (user.hdi_code) HDI.save(user.hdi_code, user.name || '', user.username || '', user.phone || '');
    onAuthChange();
    return user;
  }

  async function logout() {
    localStorage.removeItem('zs_token');
    HDI.clear();
    user = null;
    onAuthChange();
    Router.go('home');
  }

  async function check() {
    const token = localStorage.getItem('zs_token');
    if (!token) return null;
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) { localStorage.removeItem('zs_token'); return null; }
    user = (await res.json()).user;
    if (user.hdi_code) HDI.save(user.hdi_code, user.name || '', user.username || '', user.phone || '');
    onAuthChange();
    return user;
  }

  function getToken() { return localStorage.getItem('zs_token'); }
  function getUser() { return user; }
  function isLoggedIn() { return !!user; }

  function onAuthChange() {
    const authBtn = document.getElementById('auth-btn');
    const authRequired = document.querySelectorAll('.auth-required');
    const hdiRequired = document.querySelectorAll('.hdi-required');
    const verificationRequired = document.querySelectorAll('.verification-required');
    const signedOut = document.getElementById('zs-auth-out');
    const signedIn = document.getElementById('zs-auth-in');
    const avatarLetter = document.getElementById('user-avatar-letter');
    if (user) {
      if (authBtn) { authBtn.textContent = 'Sign out'; authBtn.onclick = e => { e.preventDefault(); logout(); }; authBtn.removeAttribute('data-page'); }
      authRequired.forEach(el => el.classList.remove('hidden'));
      hdiRequired.forEach(el => el.classList.toggle('hidden', !user.hdi_code));
      verificationRequired.forEach(el => el.classList.toggle('hidden', Boolean(user.hdi_code)));
      if (signedOut) signedOut.style.display = 'none';
      if (signedIn) signedIn.style.display = 'flex';
      if (avatarLetter) avatarLetter.textContent = String(user.name || user.email || 'U').trim().charAt(0).toUpperCase();
    } else {
      if (authBtn) { authBtn.textContent = 'Join Free'; authBtn.onclick = null; authBtn.dataset.page = 'register'; }
      authRequired.forEach(el => el.classList.add('hidden'));
      hdiRequired.forEach(el => el.classList.add('hidden'));
      verificationRequired.forEach(el => el.classList.add('hidden'));
      if (signedOut) signedOut.style.display = 'flex';
      if (signedIn) signedIn.style.display = 'none';
    }
    document.dispatchEvent(new CustomEvent('zs:auth-change', { detail: { user } }));
  }

  return { login, logout, check, getToken, getUser, isLoggedIn };
})();
