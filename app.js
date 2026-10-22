import { pronounce } from './translit.js';

const $ = id => document.getElementById(id);
const input = $('input'), clearBtn = $('clear'), result = $('result');
const wordsEl = $('words'), scriptEl = $('script'), playBtn = $('play'), status = $('status');

const cache = new Map();
let latest = 0;
let greekSentence = '';

async function translate(text) {
  if (cache.has(text)) return cache.get(text);
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=el&dt=t&q=' + encodeURIComponent(text);
  let greek;
  try {
    const data = await (await fetch(url)).json();
    greek = data[0].map(seg => seg[0]).join('');
  } catch {
    const fallback = 'https://api.mymemory.translated.net/get?langpair=en|el&q=' + encodeURIComponent(text);
    greek = (await (await fetch(fallback)).json()).responseData.translatedText;
  }
  cache.set(text, greek);
  return greek;
}

function render(greek) {
  greekSentence = greek;
  wordsEl.replaceChildren();
  for (const token of greek.split(/\s+/).filter(Boolean)) {
    const m = token.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}'’-]+)([^\p{L}\p{N}]*)$/u);
    const word = m ? m[2] : token;
    const trail = (m ? m[3] : '').replace(/;/g, '?').replace(/·/g, ';');
    if (!/[\p{L}\p{N}]/u.test(word)) continue;

    const btn = document.createElement('button');
    btn.className = 'word';
    btn.innerHTML = `<span class="say"></span><span class="gr"></span>`;
    btn.querySelector('.say').textContent = pronounce(word);
    btn.querySelector('.gr').textContent = word;
    btn.onclick = () => speak(word, btn, 0.75);
    wordsEl.append(btn);
    if (trail) {
      const p = document.createElement('span');
      p.className = 'punct';
      p.textContent = trail;
      wordsEl.append(p);
    }
  }
  scriptEl.textContent = greek;
  result.hidden = false;
  playBtn.hidden = false;
}

async function run() {
  const text = input.value.trim();
  clearBtn.hidden = !input.value;
  if (!text) { result.hidden = playBtn.hidden = true; status.textContent = ''; return; }
  const id = ++latest;
  result.classList.add('loading');
  try {
    const greek = await translate(text);
    if (id !== latest) return;
    render(greek);
    status.textContent = '';
  } catch {
    if (id === latest) status.textContent = 'Couldn’t translate — check your connection.';
  } finally {
    if (id === latest) result.classList.remove('loading');
  }
}

// --- Voice ---
let greekVoice = null;
function pickVoice() {
  const voices = speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith('el'));
  greekVoice = voices.find(v => /enhanced|premium/i.test(v.name)) || voices[0] || null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

function speak(text, el, rate = 0.9) {
  if (!('speechSynthesis' in window)) { status.textContent = 'Voice isn’t supported on this device.'; return; }
  speechSynthesis.cancel();
  document.querySelectorAll('.speaking').forEach(e => e.classList.remove('speaking'));
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'el-GR';
  if (greekVoice) u.voice = greekVoice;
  u.rate = rate;
  el?.classList.add('speaking');
  u.onend = u.onerror = () => el?.classList.remove('speaking');
  speechSynthesis.speak(u);
}

// --- Events ---
let timer;
input.addEventListener('input', () => {
  clearTimeout(timer);
  clearBtn.hidden = !input.value;
  timer = setTimeout(run, 350);
});
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    clearTimeout(timer);
    run();
    input.blur();
  }
});
clearBtn.onclick = () => {
  input.value = '';
  run();
  input.focus();
};
playBtn.onclick = () => speak(greekSentence, playBtn);
