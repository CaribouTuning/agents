// Thin wrapper over localStorage so the save layer never touches the
// browser API directly (and so a cloud backend can swap in later).
const PREFIX = 'caribou:';

export const storage = {
  available() {
    try {
      const k = PREFIX + '__probe';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch { return false; }
  },

  read(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? null : JSON.parse(raw);
    } catch { return null; }
  },

  write(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn('[storage] write failed', err);
      return false;
    }
  },

  remove(key) {
    try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
  },

  keys() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length));
      }
    } catch { /* ignore */ }
    return out;
  },
};
