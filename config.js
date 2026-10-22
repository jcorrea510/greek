// Where the serverless functions live. The page is served from GitHub Pages, the functions
// from Vercel; locally dev.py serves both from one origin.
const host = globalThis.location?.hostname || '';
export const API = globalThis.GREEK_API ?? (host.endsWith('github.io') ? 'https://greek-speech.vercel.app' : '');

// localStorage that never throws (private mode, blocked storage, node tests).
export const store = {
  get(key, fallback = null) {
    try {
      const v = globalThis.localStorage?.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { globalThis.localStorage?.setItem(key, JSON.stringify(value)); } catch {}
  },
};
