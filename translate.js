// English -> Greek, line by line, so lyrics keep their shape.
// Returns lines: [{ en, el }] where a blank line ({ en: '', el: '' }) marks a stanza break.

import { phrase } from './phrasebook.js';

const ENDPOINT = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=el&dt=t';
const CHUNK_CHARS = 3500;
const cache = new Map();

// Split text into chunks of whole lines so no request gets too big.
function chunk(lines) {
  const chunks = [];
  let cur = [], size = 0;
  for (const line of lines) {
    if (size + line.length > CHUNK_CHARS && cur.length) {
      chunks.push(cur);
      cur = []; size = 0;
    }
    cur.push(line);
    size += line.length + 1;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

async function google(text, signal) {
  const res = await fetch(ENDPOINT, { method: 'POST', body: new URLSearchParams({ q: text }), signal });
  if (!res.ok) throw new Error('translate ' + res.status);
  const data = await res.json();
  return data[0].map(seg => seg[0]).join('');
}

async function myMemory(text, signal) {
  const url = 'https://api.mymemory.translated.net/get?langpair=en|el&q=' + encodeURIComponent(text);
  const data = await (await fetch(url, { signal })).json();
  return data.responseData.translatedText;
}

async function translateChunk(lines, signal) {
  // Blank lines at the edges of a chunk can get dropped by the translator, so add them back ourselves.
  const lead = lines.findIndex(l => l), trail = lines.length - 1 - lines.findLastIndex(l => l);
  const blank = { en: '', el: '' };
  if (lead === -1) return lines.map(() => blank);
  if (lead > 0 || trail > 0) {
    const inner = await translateChunk(lines.slice(lead, lines.length - trail), signal);
    return [...Array(lead).fill(blank), ...inner, ...Array(trail).fill(blank)];
  }
  const text = lines.join('\n');
  if (cache.has(text)) return cache.get(text);

  // Known everyday phrases come from the phrasebook; everything else goes to the translator,
  // one sentence per line so the answers can be put back in place.
  const plan = lines.map(line => sentences(line).map(s => ({ en: s, el: phrase(s) })));
  const pending = plan.flat().filter(p => p.el === null);
  if (pending.length) {
    const out = await machine(pending.map(p => p.en), signal);
    if (out) {
      pending.forEach((p, i) => (p.el = out[i]));
    } else {
      // Sentence count drifted; fall back to whole lines.
      const whole = await machine(lines, signal);
      plan.forEach((parts, i) => {
        if (parts.some(p => p.el === null)) plan[i] = [{ el: whole ? whole[i] : '' }];
      });
    }
  }

  const result = lines.map((en, i) => ({ en, el: plan[i].map(p => p.el).join(' ').trim() }));
  cache.set(text, result);
  return result;
}

// Translate a list of lines; null if the translator didn't hand back the same number of lines.
async function machine(lines, signal) {
  let greek;
  try {
    greek = await google(lines.join('\n'), signal);
  } catch (e) {
    if (signal?.aborted) throw e;
    // MyMemory only takes short text, so go line by line.
    greek = (await Promise.all(lines.map(l => (l.trim() ? myMemory(l, signal) : '')))).join('\n');
  }
  const out = greek.split('\n').map(s => s.trim());
  return out.length === lines.length ? out : null;
}

// "Hi, how are you? I'm Jack." -> ["Hi, how are you?", "I'm Jack."]
function sentences(line) {
  const parts = line.match(/[^.!?…]+(?:[.!?…]+["'”’)]*|$)/g) || [];
  return parts.map(s => s.trim()).filter(Boolean);
}

// Tidy pasted text: trim, drop trailing spaces, collapse runs of blank lines.
export function normalize(text) {
  return text.replace(/\r\n?/g, '\n').split('\n').map(l => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Calls onChunk(index, lines) as each chunk arrives (in any order) so long pastes render progressively.
export async function translate(text, { signal, onChunk } = {}) {
  const chunks = chunk(normalize(text).split('\n'));
  const results = await Promise.all(chunks.map(async (lines, i) => {
    const res = await translateChunk(lines, signal);
    if (!signal?.aborted) onChunk?.(i, res, chunks.length);
    return res;
  }));
  return results.flat();
}
