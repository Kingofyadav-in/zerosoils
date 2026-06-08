// zsApi(path, { method, body }) — always returns parsed JSON, never throws
// Used by community and other pages for optimistic-UI patterns
async function zsApi(path, opts = {}) {
  const { method = 'GET', body } = opts;
  const headers = { 'Content-Type': 'application/json' };
  const token = typeof Auth !== 'undefined' ? Auth.getToken() : null;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(path, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ...data, ok: res.ok, status: res.status };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

const API = (() => {
  async function req(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    const token = Auth.getToken();
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`/api${path}`, opts);
    if (!res.ok) throw new Error((await res.json()).error || `${method} ${path} failed`);
    return res.json();
  }

  return {
    get: (path) => req('GET', path),
    post: (path, body) => req('POST', path, body),
    put: (path, body) => req('PUT', path, body),
    del: (path) => req('DELETE', path),
  };
})();
