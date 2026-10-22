import { store } from './config.js';
import { translate, translateNow, normalize } from './translate.js';
import { readLine } from './translit.js';
import * as speech from './speech.js';
import * as dictation from './dictation.js';
import * as library from './library.js';

const $ = id => document.getElementById(id);
const input = $('input'), clearBtn = $('clear'), doneBtn = $('done'), pasteBtn = $('paste'), micBtn = $('mic');
const listening = $('listening'), count = $('count'), inputCard = $('inputCard');
const resultCard = $('result'), stateEl = $('state'), registerSeg = $('register'), saveBtn = $('save'), copyBtn = $('copy');
const home = $('home'), dock = $('dock'), playBtn = $('play'), progress = $('progress'), speedSeg = $('speed');
const toastEl = $('toast'), toastText = $('toastText');
let linesEl = $('lines');

const UNIT_CHARS = 280;          // a long line is spoken in pieces of about this many characters
const TYPING_DELAY = 650;        // ms of quiet before a sentence goes to the translator
const SUGGESTIONS = ['Hello', 'How are you?', 'Thank you', 'The bill, please', 'Cheers!', 'I love you', 'Where’s the beach?', 'How much is it?'];

const state = {
  text: '',                      // normalized input the result belongs to
  result: null,                  // { lines: [{ en, el, formal }], basic }
  register: 'casual',
  slow: store.get('greek.slow', false) === true,
  lines: [],                     // rendered lines: { node, units } | { gap }
  playing: false,
};
let request = 0, controller = null, timer = 0, lit = null, nowLine = null;

const icon = name => `<svg><use href="#i-${name}"/></svg>`;
const el = (tag, cls, text) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, text != null ? { textContent: text } : {});

// ---------- Rendering a result ----------

function wordSpan(w) {
  const span = el('span', 'w');
  w.syl.forEach((s, i) => {
    if (i) span.append(el('i', '', '-'));
    span.append(s.stressed ? el('b', '', s.text.toUpperCase()) : s.text);
  });
  return span;
}

function renderLine(line, lyrics) {
  const greek = state.register === 'formal' && line.formal ? line.formal : line.el;
  if (!greek) return { gap: true, node: el('div', 'gap') };

  const node = el('div', 'line');
  const say = el('p', 'say');
  const { words } = readLine(greek);
  const units = [];
  let unit = null;
  words.forEach((w, i) => {
    if (i) say.append(' ');
    if (w.lead) say.append(w.lead);
    if (!unit) units.push((unit = { text: '', tokens: [], spans: [], node }));
    const span = wordSpan(w);
    span.unit = unit;
    span.k = unit.tokens.length;
    span.say = w.say;
    unit.text += (unit.text ? ' ' : '') + w.lead.replace(/[“”]/g, '') + w.greek + w.trail.replace(/\?/g, ';').replace(/[“”]/g, '');
    unit.tokens.push(w.say);
    unit.spans.push(span);
    say.append(span);
    if (w.trail) say.append(w.trail);
    // Start a new spoken piece after a sentence ends, once this one is long enough.
    if (unit.text.length > UNIT_CHARS && /[.!?;]/.test(w.trail)) unit = null;
  });
  node.append(say, el('p', 'el', greek));
  if (lyrics && line.en) {
    const btn = el('button', 'en');
    btn.innerHTML = icon('speaker');
    btn.prepend(line.en);
    btn.setAttribute('aria-label', 'Play line: ' + line.en);
    node.append(btn);
  }
  node.units = units;
  return { node, units, greek };
}

const allLines = () => state.lines.filter(l => !l.gap);
const allUnits = () => allLines().flatMap(l => l.units);

// Warm the audio for lines as they come into view so taps play straight away.
const warm = new IntersectionObserver(entries => {
  for (const e of entries) if (e.isIntersecting) prefetch(e.target);
}, { rootMargin: '300px 0px' });
function prefetch(node) {
  for (const u of node.units || []) {
    speech.prefetchLine(u, state.slow);
    u.spans.forEach(s => speech.prefetchWord(s.say, state.slow));
  }
}

function sizeClass(lines) {
  const filled = lines.filter(l => l.el);
  if (filled.length > 1) return 'lyrics';
  const len = readLine(filled[0]?.el || '').plain.length;
  return len <= 22 ? 'hero' : len <= 48 ? 'big' : '';
}

function render({ animate = true } = {}) {
  stopPlaying();
  const { lines, basic } = state.result;
  const hasFormal = lines.some(l => l.formal);
  if (!hasFormal) state.register = 'casual';
  registerSeg.hidden = !hasFormal;
  setSeg(registerSeg, state.register);

  const lyrics = lines.filter(l => l.el).length > 1;
  const root = el('div', `lines ${sizeClass(lines)}${animate ? ' swap' : ''}`);
  root.id = 'lines';
  state.lines = lines.map(l => renderLine(l, lyrics));
  for (const l of state.lines) {
    root.append(l.node);
    if (!l.gap) warm.observe(l.node);
  }
  linesEl.replaceWith(root);
  linesEl = root;

  showState(basic ? 'basic' : null);
  $('resultFoot').hidden = false;
  resultCard.classList.remove('loading');
  saveBtn.setAttribute('aria-pressed', library.isSaved(state.text));
  showResult(true);
}

function skeleton() {
  const root = el('div', 'lines skeleton');
  root.id = 'lines';
  root.innerHTML = '<span></span><span></span>';
  linesEl.replaceWith(root);
  linesEl = root;
}

// Inline message inside the result card.
function showState(kind) {
  stateEl.hidden = !kind;
  stateEl.className = 'state' + (kind === 'basic' ? ' quiet' : '');
  if (!kind) return;
  const offline = !navigator.onLine;
  const copy = {
    basic: ['', 'Basic translation. The natural one is busy right now.', 'Retry'],
    error: offline
      ? ['wifi-off', '<b>You’re offline</b>Common phrases and ones you’ve translated before still work.', 'Retry']
      : ['retry', '<b>Couldn’t translate</b>Check your connection and try again.', 'Try Again'],
  }[kind];
  stateEl.innerHTML = `${copy[0] ? icon(copy[0]) : ''}<p>${copy[1]}</p><button type="button">${copy[2]}</button>`;
  stateEl.querySelector('button').onclick = () => { state.text = ''; run(true); };
}

function showResult(on) {
  resultCard.hidden = !on;
  home.hidden = on;
  dock.hidden = !on || !state.result;
  if (!on) renderHome();
}

// ---------- Translating ----------

function setResult(result, text) {
  if (text !== state.text) state.register = 'casual'; // every new phrase starts casual
  state.result = result;
  state.text = text;
  render();
}

async function run(force = false) {
  clearTimeout(timer);
  const text = normalize(input.value);
  store.set('greek.text', input.value);
  const n = text ? text.split('\n').filter(Boolean).length : 0;
  count.textContent = n > 3 ? `${n} lines` : '';
  inputCard.classList.toggle('many', n > 4);
  foldInput();

  if (text === state.text && !force) return;
  controller?.abort();
  const id = ++request;

  if (!text) {
    stopPlaying();
    state.text = '';
    state.result = null;
    showResult(false);
    return;
  }

  // Instant when the phrasebook or a saved answer has it.
  const now = translateNow(text);
  if (now) return setResult(now, text);

  // Otherwise keep the last result visible but faded, or show a skeleton the first time.
  resultCard.classList.add('loading');
  stateEl.hidden = true;
  if (state.result && !resultCard.hidden) linesEl.classList.add('stale');
  else { skeleton(); showResult(true); dock.hidden = true; }

  controller = new AbortController();
  try {
    const res = await translate(text, { signal: controller.signal });
    if (id !== request) return;
    setResult(res, text);
  } catch (e) {
    if (id !== request || e.name === 'AbortError') return;
    state.result = null;
    state.text = '';
    resultCard.classList.remove('loading');
    linesEl.replaceChildren();
    linesEl.className = 'lines';
    showState('error');
    showResult(true);
    $('resultFoot').hidden = true;
    dock.hidden = true;
  }
}

function schedule() {
  clearTimeout(timer);
  const text = normalize(input.value);
  // Phrasebook hits and saved answers show while you type, without waiting.
  if (text && text !== state.text && translateNow(text)) return run();
  timer = setTimeout(run, TYPING_DELAY);
}

// Remember a finished translation in Recent.
function commit() {
  if (!state.result || state.result.basic || !state.text) return;
  const first = state.result.lines.find(l => l.el);
  if (!first) return;
  library.addRecent({ en: state.text, el: first.el, read: readLine(first.el).plain });
}

// ---------- Playback ----------

function light(span) {
  lit?.classList.remove('on', 'wait');
  lit = span;
  span?.classList.add('on');
}

function setNowLine(node) {
  nowLine?.classList.remove('now');
  nowLine = node;
  if (!node) return;
  node.classList.add('now');
  const scroller = $('scroll'), r = node.getBoundingClientRect(), h = scroller.clientHeight;
  if (r.top < h * 0.2 || r.bottom > h * 0.7) scroller.scrollBy({ top: r.top - h * 0.32, behavior: 'smooth' });
}

function setPlaying(on) {
  state.playing = on;
  playBtn.classList.toggle('on', on);
  playBtn.querySelector('.play-label').textContent = on ? 'Stop' : 'Play';
  linesEl.classList.toggle('playing', on && allLines().length > 1);
  progress.style.transform = 'scaleX(0)';
  if (!on) { light(null); setNowLine(null); }
}

function stopPlaying() {
  speech.stop();
  setPlaying(false);
}

function play(units) {
  speech.unlock();
  setPlaying(true);
  commit();
  speech.playAll(units, 0, state.slow, {
    onUnit: i => { light(null); setNowLine(units[i].node); },
    onWord: (i, k) => light(units[i].spans[k]),
    onProgress: f => (progress.style.transform = `scaleX(${f})`),
    onEnd: () => setPlaying(false),
  });
}

playBtn.onclick = () => (state.playing ? stopPlaying() : play(allUnits()));

// Words are small targets inside running text, so a tap goes to the nearest word within reach.
function wordAt(x, y) {
  const hit = document.elementFromPoint(x, y)?.closest('.w');
  if (hit) return hit;
  let best = null, bestD = 26;
  for (const w of linesEl.querySelectorAll('.w')) {
    for (const r of w.getClientRects()) {
      const d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
      if (d < bestD) { bestD = d; best = w; }
    }
  }
  return best;
}

function playWord(word) {
  speech.unlock();
  setPlaying(false);
  commit();
  lit?.classList.remove('on', 'wait');
  lit = word;
  word.classList.add('wait');
  let litAt = 0;
  speech.playWord(word.say, word.unit, word.k, state.slow, {
    onStart: () => { word.classList.remove('wait'); light(word); litAt = performance.now(); },
    // Keep very short words lit long enough to see.
    onEnd: () => setTimeout(() => lit === word && light(null), Math.max(0, 300 - (performance.now() - litAt))),
  });
}

resultCard.addEventListener('click', e => {
  const en = e.target.closest('.en');
  if (en) return play(en.closest('.line').units);
  if (e.target.closest('button, .el') || !e.target.closest('.lines')) return;
  const word = wordAt(e.clientX, e.clientY);
  if (word) playWord(word);
});

// ---------- Segmented controls ----------

function setSeg(seg, value) {
  const buttons = [...seg.querySelectorAll('button')];
  buttons.forEach(b => b.setAttribute('aria-checked', b.dataset.value === value));
  seg.dataset.index = buttons.findIndex(b => b.dataset.value === value);
}

speedSeg.onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  speech.unlock();
  const slow = b.dataset.value === 'slow';
  if (slow === state.slow) return;
  state.slow = slow;
  store.set('greek.slow', slow);
  setSeg(speedSeg, b.dataset.value);
  const wasPlaying = state.playing;
  stopPlaying();
  allLines().forEach(l => prefetch(l.node));
  if (wasPlaying) play(allUnits());
};

registerSeg.onclick = e => {
  const b = e.target.closest('button');
  if (!b || b.dataset.value === state.register) return;
  state.register = b.dataset.value;
  setSeg(registerSeg, state.register);
  render();
};

// ---------- Copy, save, toast ----------

let toastTimer;
function toast(text, check = true) {
  toastText.textContent = text;
  toastEl.classList.toggle('plain', !check);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1600);
}

copyBtn.onclick = async () => {
  const text = allLines().map(l => `${l.greek}\n${readLine(l.greek).plain}`).join('\n\n');
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied');
  } catch {
    toast('Couldn’t copy', false);
  }
};

saveBtn.onclick = () => {
  if (!state.result) return;
  const first = state.result.lines.find(l => l.el);
  const on = library.toggleSaved({ en: state.text, el: first.el, read: readLine(first.el).plain });
  saveBtn.setAttribute('aria-pressed', on);
  saveBtn.classList.remove('pop');
  void saveBtn.offsetWidth;
  saveBtn.classList.toggle('pop', on);
  toast(on ? 'Saved' : 'Removed from Saved', on);
};

// ---------- Home: suggestions, saved, recent ----------

function rowFor(item, kind) {
  const li = el('li');
  const btn = el('button', 'row');
  btn.innerHTML = `<span class="row-text"><span class="row-en"></span><span class="row-read"></span></span>${icon('chevron')}`;
  btn.querySelector('.row-en').textContent = item.en.replace(/\n+/g, ' / ');
  btn.querySelector('.row-read').textContent = item.read;
  btn.onclick = () => (li.classList.contains('open') ? closeRow(li) : use(item.en));
  const del = el('button', 'row-delete', 'Delete');
  del.onclick = () => {
    (kind === 'saved' ? library.removeSaved : library.removeRecent)(item.en);
    li.style.height = li.offsetHeight + 'px';
    li.classList.add('gone');
    requestAnimationFrame(() => (li.style.height = '0px'));
    setTimeout(renderHome, 320);
  };
  li.append(del, btn);
  swipeable(li, btn);
  return li;
}

// Swipe a row left to reveal Delete, like an iOS list.
const REVEAL = 88;
function closeRow(li) { li.classList.remove('open'); li.querySelector('.row').style.transform = ''; }
function swipeable(li, row) {
  let x0 = 0, y0 = 0, dx = 0, dragging = false, base = 0;
  row.addEventListener('pointerdown', e => {
    x0 = e.clientX; y0 = e.clientY; dx = 0; dragging = false;
    base = li.classList.contains('open') ? -REVEAL : 0;
    document.querySelectorAll('.list li.open').forEach(o => o !== li && closeRow(o));
  });
  row.addEventListener('pointermove', e => {
    if (!e.buttons && e.pointerType === 'mouse') return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!dragging && Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my) * 1.4) { dragging = true; row.setPointerCapture(e.pointerId); li.classList.add('dragging'); }
    if (!dragging) return;
    dx = Math.min(0, Math.max(-REVEAL * 1.6, base + mx));
    row.style.transform = `translateX(${dx}px)`;
  });
  const end = () => {
    if (!dragging) return;
    li.classList.remove('dragging');
    const open = dx < -REVEAL / 2;
    li.classList.toggle('open', open);
    row.style.transform = open ? `translateX(${-REVEAL}px)` : '';
    // Swallow the click that follows a drag.
    row.addEventListener('click', e => e.stopImmediatePropagation(), { capture: true, once: true });
    dragging = false;
  };
  row.addEventListener('pointerup', end);
  row.addEventListener('pointercancel', end);
}

function renderHome() {
  const saved = library.saved(), recent = library.recent();
  $('savedGroup').hidden = !saved.length;
  $('recentGroup').hidden = !recent.length;
  $('savedList').replaceChildren(...saved.map(i => rowFor(i, 'saved')));
  $('recentList').replaceChildren(...recent.slice(0, 12).map(i => rowFor(i, 'recent')));
  $('suggest').hidden = saved.length + recent.length >= 4;
}

$('chips').append(...SUGGESTIONS.map(s => {
  const b = el('button', 'chip', s);
  b.onclick = () => use(s);
  return b;
}));
$('clearRecent').onclick = () => { library.clearRecent(); renderHome(); };

async function use(text) {
  input.value = text;
  autosize();
  syncButtons();
  await run();
  commit();
  $('scroll').scrollTo({ top: 0 });
}

// ---------- Input ----------

function autosize() {
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';
  foldInput();
}

// More than three rows of English fold away (with a fade) when you're not typing.
function foldInput() {
  const rows = input.scrollHeight / parseFloat(getComputedStyle(input).lineHeight);
  inputCard.classList.toggle('long', rows > 3.5);
}

function syncButtons() {
  const has = input.value.length > 0;
  const typing = document.activeElement === input;
  clearBtn.hidden = !has;
  doneBtn.hidden = !typing;
  pasteBtn.hidden = has || !listening.hidden;
}

input.addEventListener('input', e => {
  autosize();
  syncButtons();
  if (state.playing) stopPlaying();
  if (e.inputType === 'insertFromPaste') run();
  else schedule();
});
input.addEventListener('focus', () => { document.body.classList.add('typing'); syncButtons(); fitViewport(); });
input.addEventListener('blur', () => {
  document.body.classList.remove('typing');
  syncButtons();
  fitViewport();
  run().then(commit);
});
doneBtn.addEventListener('pointerdown', e => e.preventDefault()); // keep focus until the tap lands
doneBtn.onclick = () => input.blur();
clearBtn.addEventListener('pointerdown', e => e.preventDefault());
clearBtn.onclick = () => {
  input.value = '';
  autosize();
  syncButtons();
  run();
  input.focus();
};

pasteBtn.onclick = async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) return toast('Nothing to paste', false);
    input.value = text;
    autosize();
    syncButtons();
    await run();
    commit();
  } catch {
    input.focus();
  }
};

// The keyboard shrinks the visual viewport on iOS; size the app to what's visible so the
// result stays in view above the keyboard instead of the page scrolling underneath it.
const vv = window.visualViewport;
function fitViewport() {
  const h = vv ? vv.height : innerHeight;
  document.documentElement.style.setProperty('--vvh', `${Math.round(h)}px`);
  if (vv && vv.offsetTop) window.scrollTo(0, 0);
}
vv?.addEventListener('resize', fitViewport);
vv?.addEventListener('scroll', fitViewport);

// ---------- Dictation ----------

let stopListening = null;

function endListening() {
  stopListening = null;
  micBtn.classList.remove('live');
  micBtn.setAttribute('aria-label', 'Speak English');
  input.placeholder = 'Enter text';
  listening.hidden = true;
  syncButtons();
  run().then(commit);
}

micBtn.onclick = () => {
  if (stopListening) return stopListening();
  if (!dictation.supported) {
    input.focus();
    return toast('Tap the mic on the keyboard to dictate', false);
  }
  stopPlaying();
  const base = input.value.trim();
  try {
    stopListening = dictation.listen({
      onText: (text, settled) => {
        input.value = base ? `${base}\n${text}` : text;
        autosize();
        syncButtons();
        if (settled) run(); else schedule();
      },
      onEnd: endListening,
      onError: err => {
        if (err === 'not-allowed' || err === 'service-not-allowed') toast('Allow microphone access in Settings', false);
        else if (err !== 'no-speech' && err !== 'aborted') toast('Couldn’t hear that', false);
      },
    });
  } catch {
    return toast('Tap the mic on the keyboard to dictate', false);
  }
  micBtn.classList.add('live');
  micBtn.setAttribute('aria-label', 'Stop listening');
  input.placeholder = 'Listening…';
  listening.hidden = false;
  syncButtons();
};

// ---------- Start ----------

speech.onDeviceVoice(() => {
  if (!state.deviceVoiceNoted) { state.deviceVoiceNoted = true; toast('Using this iPhone’s voice', false); }
});
addEventListener('online', () => { if (!stateEl.hidden) run(true); });
document.addEventListener('touchstart', () => {}, { passive: true }); // enables :active on iOS

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

setSeg(speedSeg, state.slow ? 'slow' : 'normal');
input.value = store.get('greek.text', '') || '';
autosize();
syncButtons();
fitViewport();
renderHome();
speech.warmUp();
run();
