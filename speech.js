// Greek speech. Uses the neural voice from /api/tts, which returns per-word timings, so a
// tapped word is clipped straight out of the spoken sentence. Falls back to the device voice.

// The page may be hosted on GitHub Pages while the speech function lives on Vercel.
const API = location.hostname.endsWith('github.io') ? 'https://greek-speech.vercel.app' : '';

const SLOW_RATE = -30;           // percent, for the neural voice
const LOCAL_RATE = { normal: 0.9, slow: 0.6 };
const LINE_GAP = 0.25;           // seconds of silence between lines when playing everything

let ctx = null;
let serverDown = !('AudioContext' in window || 'webkitAudioContext' in window);
let session = 0;                 // bumps on every new play/stop so stale playback bows out
let current = null;              // { source } of what's playing now
const cache = new Map();

function audioContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    try { navigator.audioSession.type = 'playback'; } catch {} // play even with the silent switch on
  }
  return ctx;
}

// Call synchronously inside a tap so iOS lets audio start after the network round trip.
export function unlock() {
  const c = audioContext();
  if (c.state !== 'running') c.resume();
  const s = c.createBufferSource();
  s.buffer = c.createBuffer(1, 1, 22050);
  s.connect(c.destination);
  s.start();
}

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]/gu, '');

// Map the voice's word timings onto our tokens; estimate any the voice split or skipped.
function align(tokens, words, duration) {
  const t = tokens.map(() => null);
  let j = 0;
  for (const [text, start, dur] of words) {
    const n = norm(text);
    for (let k = j; k < Math.min(tokens.length, j + 4); k++) {
      if (norm(tokens[k]) === n) { t[k] = { start, dur }; j = k + 1; break; }
    }
  }
  for (let k = 0; k < t.length; k++) {
    if (t[k]) continue;
    let a = k; while (a < t.length && !t[a]) a++;           // gap is [k, a)
    const from = k > 0 ? t[k - 1].start + t[k - 1].dur : (words[0]?.[1] ?? 0.05);
    const to = a < t.length ? t[a].start : duration;
    const len = tokens.slice(k, a).reduce((n, w) => n + w.length, 0) || 1;
    let pos = from;
    for (let m = k; m < a; m++) {
      const dur = ((to - from) * tokens[m].length) / len;
      t[m] = { start: pos, dur };
      pos += dur;
    }
    k = a - 1;
  }
  // Clip end: run into the next word when they're joined, otherwise let the word ring out a little.
  return t.map((w, k) => {
    const next = t[k + 1];
    const natural = w.start + w.dur + 0.12;
    const end = next && next.start - (w.start + w.dur) < 0.35 ? next.start : natural;
    return { start: Math.max(0, w.start - 0.03), end: Math.min(end, duration) };
  });
}

function load(unit, slow) {
  const key = (slow ? 's|' : 'n|') + unit.text;
  if (!cache.has(key)) {
    const p = (async () => {
      const url = `${API}/api/tts?rate=${slow ? SLOW_RATE : 0}&text=${encodeURIComponent(unit.text)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('tts ' + res.status);
      const { audio, words } = await res.json();
      const bytes = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
      const buffer = await new Promise((ok, fail) => audioContext().decodeAudioData(bytes.buffer, ok, fail));
      return { buffer, times: align(unit.tokens, words, buffer.duration) };
    })();
    p.catch(() => { cache.delete(key); serverDown = true; });
    cache.set(key, p);
  }
  return cache.get(key);
}

export function prefetch(unit, slow) {
  if (!serverDown) load(unit, slow).catch(() => {});
}

// Play [from, to) of a buffer with tiny fades so clipped words don't click.
function playBuffer(buffer, from = 0, to = buffer.duration) {
  const c = audioContext();
  const src = c.createBufferSource(), gain = c.createGain();
  src.buffer = buffer;
  src.connect(gain).connect(c.destination);
  const t0 = c.currentTime + 0.02, len = Math.max(0.05, to - from), fade = 0.012;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(1, t0 + fade);
  gain.gain.setValueAtTime(1, t0 + len - fade);
  gain.gain.linearRampToValueAtTime(0, t0 + len);
  src.start(t0, from, len);
  current = { source: src };
  return { t0, from, done: new Promise(r => (src.onended = r)) };
}

export function stop() {
  session++;
  try { current?.source.stop(); } catch {}
  current = null;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

// --- Device voice fallback ---
let localVoice;
function deviceVoice() {
  if (localVoice === undefined && 'speechSynthesis' in window) {
    const v = speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith('el'));
    if (v.length) localVoice = v.find(x => /enhanced|premium/i.test(x.name)) || v[0];
  }
  return localVoice;
}
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { localVoice = undefined; };

function utter(text, slow) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'el-GR';
  if (deviceVoice()) u.voice = deviceVoice();
  u.rate = slow ? LOCAL_RATE.slow : LOCAL_RATE.normal;
  return u;
}

function localPlay(units, start, slow, { onUnit, onWord, onEnd }) {
  if (!('speechSynthesis' in window)) return onEnd?.();
  const id = session;
  // Queue everything up front: iOS only lets speech start from inside the tap.
  units.slice(start).forEach((unit, n) => {
    const u = utter(unit.text, slow), i = start + n;
    const offsets = []; let pos = 0;
    for (const tok of unit.tokens) { pos = unit.text.indexOf(tok, pos); offsets.push(pos); pos += tok.length; }
    u.onstart = () => id === session && onUnit?.(i);
    u.onboundary = e => {
      if (id !== session || e.name === 'sentence') return;
      let k = offsets.findLastIndex(o => o >= 0 && o <= e.charIndex);
      if (k >= 0) onWord?.(i, k);
    };
    if (i === units.length - 1) u.onend = () => id === session && onEnd?.();
    speechSynthesis.speak(u);
  });
}

// --- Public playback ---

// Play one word, clipped from its sentence.
export async function playWord(unit, k, slow, { onStart, onEnd } = {}) {
  stop();
  const id = session;
  if (!serverDown) {
    try {
      const { buffer, times } = await load(unit, slow);
      if (id !== session) return;
      onStart?.();
      const { done } = playBuffer(buffer, times[k].start, times[k].end + 0.02);
      await done;
      if (id === session) onEnd?.();
      return;
    } catch {
      if (id !== session) return;
    }
  }
  const u = utter(unit.tokens[k], slow);
  u.onstart = () => onStart?.();
  u.onend = u.onerror = () => id === session && onEnd?.();
  speechSynthesis.speak(u);
}

// Play units[start..] back to back. onUnit(i) when a unit begins, onWord(i, k) as each word is spoken.
export async function playAll(units, start, slow, handlers) {
  stop();
  const id = session;
  if (serverDown) return localPlay(units, start, slow, handlers);
  for (let i = start; i < units.length; i++) {
    let data;
    try {
      data = await load(units[i], slow);
    } catch {
      if (id === session) localPlay(units, i, slow, handlers);
      return;
    }
    if (id !== session) return;
    units.slice(i + 1, i + 3).forEach(u => prefetch(u, slow));
    handlers.onUnit?.(i);
    const { t0, done } = playBuffer(data.buffer);
    let last = -1, playing = true;
    done.then(() => (playing = false));
    const tick = () => {
      if (id !== session || !playing) return;
      const now = audioContext().currentTime - t0;
      let k = data.times.findLastIndex(t => t.start + 0.03 <= now);
      if (k !== last && k >= 0) handlers.onWord?.(i, (last = k));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    await done;
    if (id !== session) return;
    await new Promise(r => setTimeout(r, LINE_GAP * 1000));
    if (id !== session) return;
  }
  handlers.onEnd?.();
}

// Wake the speech function on launch so the first tap doesn't pay for a cold start.
// The minute stamp gets past the CDN cache without hammering the function.
export function warmUp() {
  if (serverDown) return;
  fetch(`${API}/api/tts?text=${encodeURIComponent('Γεια')}&w=${Math.floor(Date.now() / 60000)}`).catch(() => {});
}
