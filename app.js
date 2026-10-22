import { syllabify, pronounce } from './translit.js';
import { translate, normalize } from './translate.js';
import * as speech from './speech.js';
import * as dictation from './dictation.js';

const $ = id => document.getElementById(id);
const input = $('input'), clearBtn = $('clear'), doneBtn = $('done'), pasteBtn = $('paste'), micBtn = $('mic');
const listening = $('listening'), count = $('count');
const output = $('output'), spinner = $('spinner'), errorEl = $('error');
const toolbar = $('toolbar'), playBtn = $('play'), speedBtn = $('speed'), copyBtn = $('copy');
const nav = $('nav'), hud = $('hud'), hudText = $('hudText');

const UNIT_CHARS = 280;          // a long line is spoken in pieces of about this many characters
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

let chunks = [];                 // per translated chunk: [line]; line = { gap } | { node, plain, units }
let linesEl = $('lines');
let slow = store.get('greek.slow') === '1';
let request = 0, controller = null, timer = 0, lastText = null;
let playing = false, lit = null, nowLine = null;

// ---------- Rendering ----------

const PUNCT = { ';': '?', ';': '?', '·': ';', '·': ';', '«': '“', '»': '”' };
const fixPunct = s => s.replace(/[;;··«»]/g, c => PUNCT[c]);

function wordSpan(word) {
  const span = document.createElement('span');
  span.className = 'w';
  syllabify(word).forEach((s, i) => {
    if (i) {
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.textContent = '·';
      span.append(dot);
    }
    span.append(s.stressed ? Object.assign(document.createElement('b'), { textContent: s.text }) : s.text);
  });
  return span;
}

const SPEAKER = '<svg viewBox="0 0 24 24"><path class="f" d="M3.5 9.25v5.5c0 .55.45 1 1 1h2.6l4.15 3.6c.65.55 1.65.1 1.65-.75V5.4c0-.85-1-1.3-1.65-.75L7.1 8.25H4.5c-.55 0-1 .45-1 1z"/><path d="M16.5 8.75a4.6 4.6 0 0 1 0 6.5M19.25 6a8.5 8.5 0 0 1 0 12"/></svg>';

function renderLine({ en, el }, showEnglish) {
  if (!el) return { gap: true, node: Object.assign(document.createElement('div'), { className: 'gap' }) };

  const node = document.createElement('div');
  node.className = 'line';
  const say = document.createElement('p');
  say.className = 'say';
  const plain = [], units = [];
  let unit = null;

  el.split(/\s+/).filter(Boolean).forEach((token, i) => {
    if (i) say.append(' ');
    const [, lead, word, trail] = token.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u);
    if (lead) say.append(fixPunct(lead));
    if (word) {
      if (!unit) units.push((unit = { text: '', tokens: [], spans: [], node }));
      const span = wordSpan(word);
      span.unit = unit;
      span.k = unit.tokens.length;
      unit.text += (unit.text ? ' ' : '') + token;
      unit.tokens.push(word);
      unit.spans.push(span);
      say.append(span);
      plain.push(fixPunct(lead) + pronounce(word) + fixPunct(trail));
      // Start a new spoken piece after a sentence ends, once this one is long enough.
      if (unit.text.length > UNIT_CHARS && /[.!;?·]/.test(trail)) unit = null;
    } else {
      plain.push(fixPunct(token));
    }
    if (trail) say.append(fixPunct(trail));
  });
  node.append(say);

  if (showEnglish && en) {
    const btn = document.createElement('button');
    btn.className = 'en';
    btn.innerHTML = SPEAKER;
    btn.prepend(en);
    btn.setAttribute('aria-label', 'Play line: ' + en);
    node.append(btn);
  }
  return { node, plain: plain.join(' '), units };
}

const allLines = () => chunks.flat().filter(Boolean);
const allUnits = () => allLines().flatMap(l => l.units || []);

// Warm up audio for lines as they scroll into view, so taps play instantly.
const warm = new IntersectionObserver(entries => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    warm.unobserve(e.target);
    e.target.units?.forEach(u => speech.prefetch(u, slow));
  }
}, { rootMargin: '200px 0px' });

function fillChunk(root, slots, i, res, showEnglish) {
  chunks[i] = res.map(r => renderLine(r, showEnglish));
  const frag = document.createDocumentFragment();
  for (const line of chunks[i]) {
    frag.append(line.node);
    if (!line.gap) { line.node.units = line.units; warm.observe(line.node); }
  }
  slots[i].replaceWith(frag);
}

// ---------- Translating ----------

function lineCount(text) {
  return normalize(text).split('\n').filter(Boolean).length;
}

async function run() {
  clearTimeout(timer);
  const text = input.value;
  store.set('greek.text', text);
  const n = lineCount(text);
  count.textContent = n > 3 ? `${n} lines` : '';
  $('inputCard').classList.toggle('long', n > 5);

  const clean = normalize(text);
  if (clean === lastText) return;
  lastText = clean;

  controller?.abort();
  if (!n) {
    request++;
    stopPlaying();
    chunks = [];
    output.hidden = toolbar.hidden = true;
    document.body.classList.remove('has-result');
    return;
  }

  const id = ++request;
  controller = new AbortController();
  const showSpinner = setTimeout(() => id === request && (spinner.hidden = false), 150);

  // Build the new result off-screen and swap it in when the first chunk lands, so typing doesn't flicker.
  const root = document.createElement('div');
  root.className = 'lines' + (n === 1 ? ' single' : '');
  let slots = null, swapped = false;

  try {
    await translate(text, {
      signal: controller.signal,
      onChunk(i, res, total) {
        if (id !== request) return;
        if (!slots) {
          slots = Array.from({ length: total }, () => root.appendChild(document.createElement('div')));
          stopPlaying();
          chunks = new Array(total);
        }
        fillChunk(root, slots, i, res, n > 1);
        if (!swapped && chunks[0]) {
          swapped = true;
          linesEl.replaceWith(root);
          linesEl = root;
          errorEl.hidden = true;
          output.hidden = toolbar.hidden = false;
          document.body.classList.add('has-result');
        }
      },
    });
  } catch (e) {
    if (id !== request || e.name === 'AbortError') return;
    lastText = null;
    errorEl.textContent = 'Couldn’t translate. Check your connection and try again.';
    errorEl.hidden = false;
    output.hidden = false;
  } finally {
    clearTimeout(showSpinner);
    if (id === request) spinner.hidden = true;
  }
}

function schedule(delay) {
  clearTimeout(timer);
  timer = setTimeout(run, delay);
}

// ---------- Playback ----------

function light(span) {
  lit?.classList.remove('on');
  lit = span;
  span?.classList.add('on');
}

function setNowLine(node) {
  nowLine?.classList.remove('now');
  nowLine = node;
  if (!node) return;
  node.classList.add('now');
  const r = node.getBoundingClientRect();
  if (r.top < innerHeight * 0.18 || r.bottom > innerHeight * 0.72) {
    scrollTo({ top: scrollY + r.top - innerHeight * 0.32, behavior: 'smooth' });
  }
}

function setPlaying(on) {
  playing = on;
  playBtn.classList.toggle('on', on);
  playBtn.querySelector('span').textContent = on ? 'Stop' : 'Play';
  linesEl.classList.toggle('playing', on && allLines().filter(l => !l.gap).length > 1);
  if (!on) { light(null); setNowLine(null); }
}

function stopPlaying() {
  speech.stop();
  setPlaying(false);
}

function play(units) {
  speech.unlock();
  setPlaying(true);
  speech.playAll(units, 0, slow, {
    onUnit: i => { light(null); setNowLine(units[i].node); },
    onWord: (i, k) => light(units[i].spans[k]),
    onEnd: () => setPlaying(false),
  });
}

playBtn.onclick = () => (playing ? stopPlaying() : play(allUnits()));

document.addEventListener('click', e => {
  const word = e.target.closest('.w');
  if (word) {
    speech.unlock();
    setPlaying(false);
    let litAt = 0;
    speech.playWord(word.unit, word.k, slow, {
      onStart: () => { light(word); litAt = performance.now(); },
      // Keep very short words lit long enough to see.
      onEnd: () => setTimeout(() => lit === word && light(null), Math.max(0, 350 - (performance.now() - litAt))),
    });
    return;
  }
  const en = e.target.closest('.en');
  if (en) play(en.parentNode.units);
});

function renderSpeed() {
  speedBtn.textContent = slow ? '0.7×' : '1×';
  speedBtn.classList.toggle('slow', slow);
  speedBtn.setAttribute('aria-label', slow ? 'Slow speech on' : 'Slow speech off');
}
speedBtn.onclick = () => {
  slow = !slow;
  store.set('greek.slow', slow ? '1' : '0');
  renderSpeed();
  stopPlaying();
  showHud(slow ? 'Slower speech' : 'Normal speed', false);
};

// ---------- Copy / HUD ----------

let hudTimer;
function showHud(text, check = true) {
  hudText.textContent = text;
  hud.classList.toggle('text-only', !check);
  hud.classList.add('show');
  clearTimeout(hudTimer);
  hudTimer = setTimeout(() => hud.classList.remove('show'), 1300);
}

copyBtn.onclick = async () => {
  const text = allLines().map(l => (l.gap ? '' : l.plain)).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    showHud('Copied');
  } catch {
    showHud('Couldn’t copy', false);
  }
};

// ---------- Input ----------

function autosize() {
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';
}

function syncButtons() {
  const has = input.value.length > 0;
  const typing = document.activeElement === input;
  clearBtn.hidden = !has || typing;
  doneBtn.hidden = !typing;
  pasteBtn.hidden = has || !listening.hidden;
}

input.addEventListener('input', e => {
  autosize();
  syncButtons();
  if (playing) stopPlaying();
  schedule(e.inputType === 'insertFromPaste' ? 0 : 450);
});
input.addEventListener('focus', () => { document.body.classList.add('typing'); syncButtons(); });
input.addEventListener('blur', () => { document.body.classList.remove('typing'); syncButtons(); run(); });
doneBtn.onclick = () => input.blur();
clearBtn.onclick = () => {
  input.value = '';
  autosize();
  run();
  input.focus();
};

pasteBtn.onclick = async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) return showHud('Nothing to paste', false);
    input.value = text;
    autosize();
    syncButtons();
    run();
  } catch {
    input.focus();
  }
};

// ---------- Dictation ----------

let stopListening = null;

function endListening() {
  stopListening = null;
  micBtn.classList.remove('live');
  listening.hidden = true;
  syncButtons();
  run();
}

micBtn.onclick = () => {
  if (stopListening) return stopListening();
  if (!dictation.supported) {
    input.focus();
    return showHud('Tap the mic on the keyboard to dictate', false);
  }
  stopPlaying();
  const base = input.value.trim();
  try {
    stopListening = dictation.listen({
      onText: (text, settled) => {
        input.value = base ? `${base}\n${text}` : text;
        autosize();
        syncButtons();
        schedule(settled ? 0 : 600);
      },
      onEnd: endListening,
      onError: err => {
        if (err === 'not-allowed' || err === 'service-not-allowed') showHud('Allow microphone access to dictate', false);
        else if (err !== 'no-speech' && err !== 'aborted') showHud('Couldn’t hear that', false);
      },
    });
  } catch {
    return showHud('Tap the mic on the keyboard to dictate', false);
  }
  micBtn.classList.add('live');
  listening.hidden = false;
  syncButtons();
};

// ---------- Large title -> nav title ----------

new IntersectionObserver(([e]) => nav.classList.toggle('scrolled', !e.isIntersecting), {
  rootMargin: `-${nav.offsetHeight - 16}px 0px 0px 0px`,
}).observe($('title'));

// iOS only shows :active styles when a touch listener exists.
document.addEventListener('touchstart', () => {}, { passive: true });

// ---------- Start ----------

renderSpeed();
input.value = store.get('greek.text') || '';
autosize();
syncButtons();
run();
