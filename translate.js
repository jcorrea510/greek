// English -> Greek, line by line, so lyrics keep their shape.
//
//   1. Phrasebook: instant, hand-checked everyday phrases (casual first).
//   2. Saved answers in localStorage, so repeats cost nothing and work offline.
//   3. /api/translate: an LLM told to write natural spoken Greek. Cached by the CDN.
//   4. If that's unreachable or out of quota: Google's public endpoint, then MyMemory.
//
// translate() resolves to { lines: [{ en, el, formal }], basic } where a blank line
// ({ en: '', el: '' }) marks a stanza break and `basic` says step 4 was used.

import { API, store } from './config.js';
import { phrase } from './phrasebook.js';

const VERSION = '5';             // matches PROMPT_VERSION in api/translate.py
const CHUNK_CHARS = 1200;        // per request; long lyrics go out in parallel pieces
const CACHE_KEY = 'greek.translations.v' + VERSION;
const CACHE_MAX = 400;
const TIMEOUT = 26000;

// ---------- Saved answers ----------

let saved = null;
const savedMap = () => (saved ??= new Map(store.get(CACHE_KEY, [])));
function remember(text, lines) {
  const m = savedMap();
  m.delete(text);
  m.set(text, lines);
  while (m.size > CACHE_MAX) m.delete(m.keys().next().value);
  store.set(CACHE_KEY, [...m]);
}

// ---------- Helpers ----------

// Tidy pasted text: trim, drop trailing spaces, collapse runs of blank lines.
export function normalize(text) {
  return text.replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/\s+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// "Hi, how are you? I'm Jack." -> ["Hi, how are you?", "I'm Jack."]
function sentences(line) {
  return (line.match(/[^.!?…]+(?:[.!?…]+["'”’)]*|$)/g) || []).map(s => s.trim()).filter(Boolean);
}

// A whole line from the phrasebook, or null if any sentence in it is unknown.
function fromPhrasebook(line) {
  const parts = sentences(line).map(phrase);
  if (!parts.length || parts.some(p => !p)) return null;
  const el = parts.map(p => p.el).join(' ');
  const formal = parts.map(p => p.formal || p.el).join(' ');
  return { el, formal: formal !== el ? formal : '' };
}

// Split into chunks of whole lines, preferring to break at stanza gaps.
function chunk(lines) {
  const chunks = [];
  let cur = [], size = 0;
  for (const line of lines) {
    if (cur.length && size + line.length > CHUNK_CHARS) {
      // Back up to the last blank line so a stanza stays together, if there is one.
      const gap = cur.lastIndexOf('');
      const carry = gap > 0 ? cur.splice(gap) : [];
      chunks.push(cur);
      cur = carry; size = carry.reduce((n, l) => n + l.length + 1, 0);
    }
    cur.push(line);
    size += line.length + 1;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

function withTimeout(signal, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(new DOMException('Timed out', 'TimeoutError')), ms);
  signal?.addEventListener('abort', () => ctl.abort(signal.reason), { once: true });
  return { signal: ctl.signal, done: () => clearTimeout(t) };
}

// ---------- Engines ----------

async function natural(lines, signal) {
  const url = `${API}/api/translate?v=${VERSION}&q=${encodeURIComponent(lines.join('\n'))}`;
  const t = withTimeout(signal, TIMEOUT);
  try {
    const res = await fetch(url, { signal: t.signal });
    if (!res.ok) throw new Error('translate ' + res.status);
    const data = await res.json();
    if (data.lines?.length !== lines.length) throw new Error('line count');
    return data.lines.map(l => ({ el: l.el || '', formal: l.formal || '' }));
  } finally { t.done(); }
}

async function google(text, signal) {
  const res = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=el&dt=t', {
    method: 'POST', body: new URLSearchParams({ q: text }), signal,
  });
  if (!res.ok) throw new Error('google ' + res.status);
  return (await res.json())[0].map(seg => seg[0]).join('');
}

async function myMemory(text, signal) {
  const res = await fetch('https://api.mymemory.translated.net/get?langpair=en|el&q=' + encodeURIComponent(text), { signal });
  return (await res.json()).responseData.translatedText;
}

// Literal machine translation, used only when the natural one is unavailable.
async function basic(lines, signal) {
  let out;
  try {
    out = (await google(lines.join('\n'), signal)).split('\n');
  } catch (e) {
    if (signal?.aborted) throw e;
    out = await Promise.all(lines.map(l => (l ? myMemory(l, signal) : '')));
  }
  if (out.length !== lines.length) out = await Promise.all(lines.map(l => (l ? google(l, signal) : '')));
  return out.map(s => ({ el: s.trim(), formal: '' }));
}

// ---------- Translate ----------

async function translateChunk(lines, signal) {
  const text = lines.join('\n');
  const book = lines.map(l => (l ? fromPhrasebook(l) : { el: '', formal: '' }));
  if (book.every(Boolean)) return { lines: book, basic: false };

  const known = savedMap().get(text);
  if (known) return { lines: known, basic: false };

  let got, isBasic = false;
  try {
    got = await natural(lines, signal);
  } catch (e) {
    if (signal?.aborted) throw e;
    got = await basic(lines, signal);
    isBasic = true;
  }
  // Hand-checked phrases always win, even inside a longer paste.
  const merged = got.map((g, i) => book[i] || g);
  if (!isBasic) remember(text, merged);
  return { lines: merged, basic: isBasic };
}

// onChunk(index, result, total) fires as each piece arrives (in any order) so long pastes render progressively.
export async function translate(text, { signal, onChunk } = {}) {
  const all = normalize(text).split('\n');
  const chunks = chunk(all);
  const results = await Promise.all(chunks.map(async (lines, i) => {
    const res = await translateChunk(lines, signal);
    const out = { basic: res.basic, lines: res.lines.map((l, k) => ({ en: lines[k], ...l })) };
    if (!signal?.aborted) onChunk?.(i, out, chunks.length);
    return out;
  }));
  return { lines: results.flatMap(r => r.lines), basic: results.some(r => r.basic) };
}

// Instant answer when the whole text is in the phrasebook or already translated, else null.
export function translateNow(text) {
  const lines = normalize(text).split('\n');
  const chunks = chunk(lines);
  const out = [];
  for (const c of chunks) {
    const book = c.map(l => (l ? fromPhrasebook(l) : { el: '', formal: '' }));
    const got = book.every(Boolean) ? book : savedMap().get(c.join('\n'));
    if (!got) return null;
    out.push(...got.map((g, k) => ({ en: c[k], ...g })));
  }
  return { lines: out, basic: false };
}
