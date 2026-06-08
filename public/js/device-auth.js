const DeviceAuth = (() => {
  const DB_NAME = 'zs-device-auth';
  const STORE_NAME = 'credentials';
  const PRIMARY_KEY = 'primary-device';
  const ID_KEY = 'zs_device_id';

  function bytesToBase64Url(bytes) {
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function readCredential() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(PRIMARY_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function writeCredential(value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(value, PRIMARY_KEY);
      transaction.oncomplete = () => resolve(value);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  function deviceId() {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  }

  async function credential() {
    let stored = await readCredential();
    if (stored?.privateKey && stored?.publicKey) return stored;
    const keys = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign', 'verify']
    );
    const publicKey = await crypto.subtle.exportKey('jwk', keys.publicKey);
    stored = { privateKey: keys.privateKey, publicKey };
    return writeCredential(stored);
  }

  function label() {
    const platform = navigator.userAgentData?.platform || navigator.platform || 'Browser device';
    return String(platform).slice(0, 80);
  }

  async function verifyCurrent() {
    if (!window.crypto?.subtle || !window.indexedDB) {
      throw new Error('Secure device authentication is unavailable in this browser.');
    }
    const stored = await credential();
    const id = deviceId();
    await API.post('/auth/device', {
      action: 'enroll',
      deviceId: id,
      publicKey: stored.publicKey,
      label: label(),
    });
    const challenge = await API.post('/auth/device', { action: 'challenge', deviceId: id });
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      stored.privateKey,
      new TextEncoder().encode(challenge.challenge)
    );
    return API.post('/auth/device', {
      action: 'verify',
      deviceId: id,
      challengeId: challenge.challengeId,
      signature: bytesToBase64Url(new Uint8Array(signature)),
    });
  }

  return { verifyCurrent };
})();
