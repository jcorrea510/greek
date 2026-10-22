// Recent translations and saved phrases, kept on this device.
// Each item: { en, el, read, at } (el and read are the first line, for the list preview).

import { store } from './config.js';

const RECENT_KEY = 'greek.recent', SAVED_KEY = 'greek.saved';
const RECENT_MAX = 30, SAVED_MAX = 300;

export const recent = () => store.get(RECENT_KEY, []);
export const saved = () => store.get(SAVED_KEY, []);
export const isSaved = en => saved().some(s => s.en === en);

export function addRecent(item) {
  const now = Date.now();
  // Typing "Where is" then "Where is the beach" should leave one entry, not two.
  const list = recent().filter(r => r.en !== item.en && !(now - r.at < 120000 && item.en.startsWith(r.en)));
  store.set(RECENT_KEY, [{ ...item, at: now }, ...list].slice(0, RECENT_MAX));
}

export function clearRecent() { store.set(RECENT_KEY, []); }
export function removeRecent(en) { store.set(RECENT_KEY, recent().filter(r => r.en !== en)); }
export function removeSaved(en) { store.set(SAVED_KEY, saved().filter(s => s.en !== en)); }

// Returns true if the phrase is now saved.
export function toggleSaved(item) {
  const list = saved();
  if (list.some(s => s.en === item.en)) {
    store.set(SAVED_KEY, list.filter(s => s.en !== item.en));
    return false;
  }
  store.set(SAVED_KEY, [{ ...item, at: Date.now() }, ...list].slice(0, SAVED_MAX));
  return true;
}
