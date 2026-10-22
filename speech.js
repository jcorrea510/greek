// Greek speech.
//
// The neural voice comes from /api/tts, which returns MP3 plus per-word timings. Whole lines
// are spoken from one clip (the timings drive the word highlight). A tapped word is synthesised
// on its own: a word clipped out of a sentence carries its neighbours' coarticulation and,
// slowed down, most of the extra time goes into the pauses rather than the word (measured: a
// clipped word got only 1.16x longer at "0.7x", a standalone word gets 2.0x longer at 0.5x).
// The device voice (speechSynthesis) is only a last resort.
//
// Silent switch: iOS plays Web Audio through the "ambient" audio session by default, which the
// ring/silent switch mutes. Declaring the page's session as "playback" (Safari 17+) makes it
// behave like a music or video app. It has to be set before any audio is created or started,
// so it happens here, at module load, before the AudioContext exists.

import { API } from './config.js';

try {
  if ('audioSession' in navigator) navigator.audioSession.type = 'playback';
} catch {}

export const RATE = { normal: 0, slow: -50 };   // percent; -50 is exactly half speed
const DEVICE_RATE = { normal: 1, slow: 0.5 };
const LINE_GAP = 0.3;                            // seconds between lines when playing everything
const RETRY_AFTER = 15000;                       // after a failure, try the device voice this long

let ctx = null;
let session = 0;                                 // bumps on every play/stop so stale playback bows out
let current = null;
let downUntil = 0;
const cache = new Map();
const listeners = { deviceVoice: null };

export function onDeviceVoice(fn) { listeners.deviceVoice = fn; }

function audio() {
  ctx ??= new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  return ctx;
}

// Older iOS without navigator.audioSession: starting an <audio> element inside the tap moves
// the page's audio session to "playback" for the rest of the visit, so Web Audio ignores the
// silent switch too.
let kicked = false;
function kickMediaSession() {
  if (kicked || 'audioSession' in navigator) return;
  kicked = true;
  const el = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=');
  el.setAttribute('playsinline', '');
  el.play().catch(() => (kicked = false));
}

// Call synchronously inside every tap: iOS only lets audio start from a user gesture, and an
// interrupted context (a call, another app) needs a resume from one too.
export function unlock() {
  kickMediaSession();
  const c = audio();
  if (c.state !== 'running') c.resume().catch(() => {});
  const s = c.createBufferSource();
  s.buffer = c.createBuffer(1, 1, 22050);
  s.connect(c.destination);
  s.start();
}

const available = () => Date.now() > downUntil && !!(window.AudioContext || window.webkitAudioContext);

// ---------- Loading ----------

// The voice reads a lone "Σ’" as the letter name ("sigma agapo"). Join consonant-only
// elisions onto the next word, the way they're pronounced: Σ’ αγαπώ -> Σαγαπώ, μ’ αρέσει -> μαρέσει.
// Any other apostrophe (απ’ το, Να ’τος) costs an odd ~0.4s pause, so it goes too.
// Measured: "Σ’ αγαπώ" 1.26s of speech (letter name), "Σαγαπώ" 0.56s, same as "σαγαπώ".
export function speakable(text) {
  return text
    .replace(/(^|[^\p{L}])([βγδζθκλμνξπρσςτφχψ]+)['’ʼ`]\s*(?=\p{L})/giu, '$1$2')
    .replace(/['’ʼ`]/g, '');
}

async function fetchSpeech(text, rate) {
  const url = `${API}/api/tts?rate=${rate}&text=${encodeURIComponent(speakable(text))}`;
  let res;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await fetch(url);
      if (res.ok) break;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  if (!res?.ok) throw new Error('tts ' + (res?.status ?? 'offline'));
  const { audio: b64, words } = await res.json();
  const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
  const buffer = await new Promise((ok, fail) => audio().decodeAudioData(bytes.buffer, ok, fail));
  return { buffer, words };
}

// Where the voice actually is: the service pads clips with ~1.3s of silence.
function voiced(buffer) {
  const data = buffer.getChannelData(0), step = Math.round(buffer.sampleRate / 100);
  const rms = [];
  for (let i = 0; i + step <= data.length; i += step) {
    let sum = 0;
    for (let j = i; j < i + step; j++) sum += data[j] * data[j];
    rms.push(Math.sqrt(sum / step));
  }
  const floor = Math.max(...rms) * 0.01; // -40 dB from the peak
  const first = rms.findIndex(r => r > floor), last = rms.findLastIndex(r => r > floor);
  if (first < 0) return { start: 0, end: buffer.duration };
  return { start: Math.max(0, first / 100 - 0.03), end: Math.min(buffer.duration, (last + 1) / 100 + 0.09) };
}

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]/gu, '');

// Map the voice's word timings onto our words; estimate any it split or skipped.
function align(tokens, words, duration) {
  const t = tokens.map(() => null);
  let j = 0;
  for (const [text, start, dur] of words) {
    const n = norm(text);
    for (let k = j; k < Math.min(tokens.length, j + 4); k++) {
      if (norm(tokens[k]).endsWith(n) || norm(tokens[k]) === n) { t[k] = { start, dur }; j = k + 1; break; }
    }
  }
  for (let k = 0; k < t.length; k++) {
    if (t[k]) continue;
    let a = k; while (a < t.length && !t[a]) a++;
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
  return t.map((w, k) => {
    const next = t[k + 1];
    const end = next && next.start - (w.start + w.dur) < 0.35 ? next.start : w.start + w.dur + 0.12;
    return { start: Math.max(0, w.start - 0.03), end: Math.min(end, duration) };
  });
}

function cached(key, make) {
  if (!cache.has(key)) {
    const p = make();
    p.catch(() => { cache.delete(key); downUntil = Date.now() + RETRY_AFTER; });
    cache.set(key, p);
  }
  return cache.get(key);
}

// A line: { text, tokens } -> { buffer, times, range }
function loadLine(unit, rate) {
  return cached(`L${rate}|${unit.text}`, async () => {
    const { buffer, words } = await fetchSpeech(unit.text, rate);
    return { buffer, times: align(unit.tokens, words, buffer.duration), range: voiced(buffer) };
  });
}

// One word on its own: -> { buffer, range }
function loadWord(text, rate) {
  return cached(`W${rate}|${text}`, async () => {
    const { buffer } = await fetchSpeech(text, rate);
    return { buffer, range: voiced(buffer) };
  });
}

// Warm the cache a few requests at a time.
const queue = [];
let inFlight = 0;
function pump() {
  while (inFlight < 3 && queue.length) {
    const job = queue.shift();
    inFlight++;
    job().catch(() => {}).finally(() => { inFlight--; pump(); });
  }
}
export function prefetchLine(unit, slow) {
  if (available()) { queue.push(() => loadLine(unit, slow ? RATE.slow : RATE.normal)); pump(); }
}
export function prefetchWord(text, slow) {
  if (available()) { queue.push(() => loadWord(text, slow ? RATE.slow : RATE.normal)); pump(); }
}

// ---------- Playing ----------

// Play [from, to) of a buffer with short fades so clips never click.
function playBuffer(buffer, from = 0, to = buffer.duration) {
  const c = audio();
  const src = c.createBufferSource(), gain = c.createGain();
  src.buffer = buffer;
  src.connect(gain).connect(c.destination);
  const t0 = c.currentTime + 0.02, len = Math.max(0.05, to - from), fade = 0.008;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(1, t0 + fade);
  gain.gain.setValueAtTime(1, t0 + len - fade * 2);
  gain.gain.linearRampToValueAtTime(0, t0 + len);
  src.start(t0, from, len);
  current = src;
  return { t0, from, len, done: new Promise(r => (src.onended = r)) };
}

export function stop() {
  session++;
  try { current?.stop(); } catch {}
  current = null;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

// --- Device voice ---
let localVoice;
function deviceVoice() {
  if (localVoice === undefined && 'speechSynthesis' in window) {
    const v = speechSynthesis.getVoices().filter(x => x.lang.toLowerCase().startsWith('el'));
    localVoice = v.find(x => /enhanced|premium/i.test(x.name)) || v[0] || null;
  }
  return localVoice;
}
if ('speechSynthesis' in window) speechSynthesis.addEventListener?.('voiceschanged', () => (localVoice = undefined));

function utter(text, slow) {
  listeners.deviceVoice?.();
  const u = new SpeechSynthesisUtterance(speakable(text));
  u.lang = 'el-GR';
  if (deviceVoice()) u.voice = deviceVoice();
  u.rate = slow ? DEVICE_RATE.slow : DEVICE_RATE.normal;
  return u;
}

function devicePlayAll(units, start, slow, { onUnit, onWord, onEnd }) {
  if (!('speechSynthesis' in window)) return onEnd?.();
  const id = session;
  // Queue everything at once: iOS only lets speech start from inside the tap.
  units.slice(start).forEach((unit, n) => {
    const u = utter(unit.text, slow), i = start + n;
    const offsets = []; let pos = 0;
    for (const tok of unit.tokens) { pos = unit.text.indexOf(tok, pos); offsets.push(pos); pos += tok.length; }
    u.onstart = () => id === session && onUnit?.(i);
    u.onboundary = e => {
      if (id !== session || e.name === 'sentence') return;
      const k = offsets.findLastIndex(o => o >= 0 && o <= e.charIndex);
      if (k >= 0) onWord?.(i, k);
    };
    if (i === units.length - 1) u.onend = u.onerror = () => id === session && onEnd?.();
    speechSynthesis.speak(u);
  });
}

// Play one word. `unit` is its line (used only if the word can't be fetched on its own).
export async function playWord(text, unit, k, slow, { onStart, onEnd } = {}) {
  stop();
  const id = session, rate = slow ? RATE.slow : RATE.normal;
  const finish = () => id === session && onEnd?.();
  if (available()) {
    let clip = null;
    try {
      const w = await loadWord(text, rate);
      clip = { buffer: w.buffer, from: w.range.start, to: w.range.end };
    } catch {
      // Fall back to the word cut out of its line, if that line is already here.
      try {
        const line = await Promise.race([loadLine(unit, rate), new Promise((_, no) => setTimeout(no, 50))]);
        clip = { buffer: line.buffer, from: line.times[k].start, to: line.times[k].end + 0.02 };
      } catch {}
    }
    if (id !== session) return;
    if (clip) {
      onStart?.();
      const { done } = playBuffer(clip.buffer, clip.from, clip.to);
      await done;
      return finish();
    }
  }
  if (!('speechSynthesis' in window)) return finish();
  const u = utter(text, slow);
  u.onstart = () => onStart?.();
  u.onend = u.onerror = finish;
  speechSynthesis.speak(u);
}

// Play units[start..] back to back. onUnit(i) as a line begins, onWord(i, k) as each word is spoken,
// onProgress(fraction) for the whole run.
export async function playAll(units, start, slow, handlers) {
  stop();
  const id = session, rate = slow ? RATE.slow : RATE.normal;
  if (!available()) return devicePlayAll(units, start, slow, handlers);
  for (let i = start; i < units.length; i++) {
    let data;
    try {
      data = await loadLine(units[i], rate);
    } catch {
      if (id === session) devicePlayAll(units, i, slow, handlers);
      return;
    }
    if (id !== session) return;
    units.slice(i + 1, i + 3).forEach(u => prefetchLine(u, slow));
    handlers.onUnit?.(i);
    const { start: from, end: to } = data.range;
    const { t0, done } = playBuffer(data.buffer, from, to);
    let last = -1, live = true;
    done.then(() => (live = false));
    const tick = () => {
      if (id !== session || !live) return;
      const now = audio().currentTime - t0 + from;
      const k = data.times.findLastIndex(t => t.start + 0.03 <= now);
      if (k !== last && k >= 0) handlers.onWord?.(i, (last = k));
      handlers.onProgress?.((i - start + Math.min(1, Math.max(0, (now - from) / (to - from)))) / (units.length - start));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    await done;
    if (id !== session) return;
    if (i < units.length - 1) await new Promise(r => setTimeout(r, LINE_GAP * 1000));
    if (id !== session) return;
  }
  handlers.onEnd?.();
}

// Wake the speech function on launch so the first tap doesn't pay for a cold start.
// The minute stamp gets past the CDN cache without hammering the function.
export function warmUp() {
  fetch(`${API}/api/tts?text=${encodeURIComponent('Γεια')}&w=${Math.floor(Date.now() / 60000)}`).catch(() => {});
}
