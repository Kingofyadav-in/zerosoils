// ── Zero Soils HDI — Human Digital Identity Generator ────
// Permanent identifiers are issued once by the server during registration.
// This module caches the signed-in account's issued identity in the browser.

const HDI = (() => {
  // Save issued identity to localStorage
  function save(code, name, username = '', phone = '') {
    localStorage.setItem('zs_hdi_code', code);
    localStorage.setItem('zs_hdi_name', name);
    localStorage.setItem('zs_hdi_username', username);
    localStorage.setItem('zs_hdi_phone', phone);
    localStorage.setItem('zs_hdi_ts',   Date.now().toString());
  }

  // Retrieve saved HDI
  function get() {
    return {
      code: localStorage.getItem('zs_hdi_code'),
      name: localStorage.getItem('zs_hdi_name'),
      username: localStorage.getItem('zs_hdi_username'),
      phone: localStorage.getItem('zs_hdi_phone'),
      ts:   localStorage.getItem('zs_hdi_ts'),
    };
  }

  // Check if user has an HDI
  function exists() { return !!localStorage.getItem('zs_hdi_code'); }

  // Clear HDI (logout / reset)
  function clear() {
    localStorage.removeItem('zs_hdi_code');
    localStorage.removeItem('zs_hdi_name');
    localStorage.removeItem('zs_hdi_username');
    localStorage.removeItem('zs_hdi_phone');
    localStorage.removeItem('zs_hdi_ts');
  }

  return { save, get, exists, clear };
})();
