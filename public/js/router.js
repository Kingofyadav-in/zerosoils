const Router = (() => {
  const routes = {};
  let current = null;
  const aliases = {
    identity: 'hdi',
    'how-hdi-works': 'hdi',
  };

  function register(name, renderFn) {
    routes[name] = renderFn;
  }

  function go(page, { updateHistory = true } = {}) {
    const root = document.getElementById('page-root');
    const canonical = aliases[page] || page;
    const routeName = canonical === 'hdi' && !routes.hdi ? 'identity' : canonical;
    const render = routes[routeName] || routes['home'];
    current = canonical;
    root.innerHTML = '';
    render(root);
    if (current !== canonical) return;
    if (updateHistory) {
      history.pushState({ page: canonical }, '', canonical === 'home' ? '/' : `/${canonical}`);
    }
    window.scrollTo(0, 0);
    document.dispatchEvent(new CustomEvent('zs:navigate', { detail: { page: canonical } }));
  }

  function init() {
    document.addEventListener('click', e => {
      const a = e.target.closest('[data-page]');
      if (a) {
        e.preventDefault();
        go(a.dataset.page);
        if (a.dataset.section) {
          requestAnimationFrame(() => document.getElementById(a.dataset.section)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }
      }
    });
    window.addEventListener('popstate', e => go(e.state?.page || 'home', { updateHistory: false }));
    const path = location.pathname.replace('/', '') || 'home';
    go(path, { updateHistory: false });
  }

  return { register, go, init, get current() { return current; } };
})();
