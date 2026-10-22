// Greek script -> English-letter reading with the stressed syllable marked.
//   Καλημέρα -> ka-lee-MEH-ra     Γεια σου -> YAH soo     Σ' αγαπώ -> s'a-ga-POH
//
// Conventions (chosen so an English speaker reads them right first time):
//   stressed open syllables end in -AH -EH -EE -OH -OO; unstressed ones use a, eh, ee, o, oo.
//   One-syllable words take the full "ah/eh/oh" sound (yah, toh, meh) and no stress mark.
//   χ is "kh" (ef-kha-ree-STOH) but "h" before e/i sounds (OH-hee); δ is "dh", θ is "th".

const ACCENTED = { 'ά': 'α', 'έ': 'ε', 'ή': 'η', 'ί': 'ι', 'ό': 'ο', 'ύ': 'υ', 'ώ': 'ω', 'ΐ': 'ϊ', 'ΰ': 'ϋ' };
const VOWEL = { 'α': 'a', 'ε': 'e', 'η': 'i', 'ι': 'i', 'ο': 'o', 'υ': 'i', 'ω': 'o', 'ϊ': 'i', 'ϋ': 'i' };
const CONS = {
  'β': 'v', 'δ': 'dh', 'ζ': 'z', 'θ': 'th', 'κ': 'k', 'λ': 'l', 'μ': 'm', 'ν': 'n',
  'ξ': 'ks', 'π': 'p', 'ρ': 'r', 'σ': 's', 'ς': 's', 'τ': 't', 'φ': 'f', 'χ': 'kh', 'ψ': 'ps',
};
const VOWEL_DIGRAPHS = { 'ου': 'u', 'αι': 'e', 'ει': 'i', 'οι': 'i', 'υι': 'i' };
// Word-initially these are a single sound; inside a word they keep the nasal: Αντίο -> an-DEE-o.
const NASAL_PAIRS = { 'μπ': ['b', 'm'], 'ντ': ['d', 'n'], 'γκ': ['g', 'n'] };
const VOICELESS = new Set(['θ', 'κ', 'ξ', 'π', 'σ', 'ς', 'τ', 'φ', 'χ', 'ψ']);
const VOICED_AFTER_S = new Set(['β', 'γ', 'δ', 'μ', 'ν', 'λ', 'ρ']); // σμ -> zm (κόσμος -> KOZ-mos)
// Consonant pairs that start a syllable together.
const ONSETS = new Set([
  'pr', 'tr', 'kr', 'br', 'dr', 'gr', 'fr', 'vr', 'thr', 'khr', 'dhr',
  'pl', 'kl', 'fl', 'gl', 'bl', 'vl', 'khl', 'sp', 'st', 'sk', 'sf',
]);

const OPEN_STRESSED = { a: 'ah', e: 'eh', i: 'ee', o: 'oh', u: 'oo' };
const OPEN = { a: 'a', e: 'eh', i: 'ee', o: 'o', u: 'oo' };
const CLOSED = { a: 'a', e: 'e', i: 'ee', o: 'o', u: 'oo' };

const GREEK = /[Ͱ-Ͽἀ-῿]/;
const isGreek = s => GREEK.test(s);

function letters(word) {
  return [...word.toLowerCase()].map(ch => ({ ch: ACCENTED[ch] || ch, stressed: ch in ACCENTED }));
}

// Letters -> sound units: { v: 'a'|'e'|'i'|'o'|'u', stressed } or { c: 'k' }.
function phonemes(word) {
  const L = letters(word);
  const u = [];
  for (let i = 0; i < L.length; i++) {
    const a = L[i].ch, b = L[i + 1]?.ch, c = L[i + 2]?.ch, pair = a + (b || '');
    // A vowel pair is one sound unless the accent is on its first letter (τσάι) or the second has a diaeresis.
    const joins = b && !L[i].stressed && b !== 'ϊ' && b !== 'ϋ';

    if (joins && 'αεη'.includes(a) && b === 'υ') {
      u.push({ v: VOWEL[a], stressed: L[i + 1].stressed }, { c: !c || VOICELESS.has(c) ? 'f' : 'v' });
      i++; continue;
    }
    if (joins && VOWEL_DIGRAPHS[pair]) { u.push({ v: VOWEL_DIGRAPHS[pair], stressed: L[i + 1].stressed }); i++; continue; }
    if (NASAL_PAIRS[pair]) {
      const [initial, nasal] = NASAL_PAIRS[pair];
      u.push(...(u.length ? [{ c: nasal }, { c: initial }] : [{ c: initial }]));
      i++; continue;
    }
    if (pair === 'γγ') { u.push(...(c === 'ν' ? [{ c: 'g' }] : [{ c: 'n' }, { c: 'g' }])); i++; continue; } // Συγγνώμη -> seeg-NOH-mee
    if (pair === 'γχ') { u.push({ c: 'n' }, { c: 'kh' }); i++; continue; }
    if (pair === 'γξ') { u.push({ c: 'n' }, { c: 'ks' }); i++; continue; }
    if (pair === 'τσ') { u.push({ c: 'ts' }); i++; continue; }
    if (pair === 'τζ') { u.push({ c: 'dz' }); i++; continue; }
    if (a === b && CONS[a]) continue; // λλ, σσ, ττ sound like one letter
    if (VOWEL[a]) { u.push({ v: VOWEL[a], stressed: L[i].stressed }); continue; }
    if (a === 'γ') { u.push({ c: '?γ' }); continue; }
    if ((a === 'σ' || a === 'ς') && VOICED_AFTER_S.has(b)) { u.push({ c: 'z' }); continue; }
    if (CONS[a]) { u.push({ c: CONS[a] }); continue; }
    u.push({ c: a }); // digits, stray Latin letters
  }

  // An unstressed i-sound between a consonant and a vowel glides into "y": παιδιά -> peh-DHYAH.
  // After a cluster ending in r/l it stays a full vowel: αύριο -> AV-ree-o.
  const out = [];
  u.forEach((x, i) => {
    const p1 = out[out.length - 1], p2 = out[out.length - 2];
    const afterCluster = p2?.c && (p1?.c === 'r' || p1?.c === 'l');
    if (x.v === 'i' && !x.stressed && p1?.c && u[i + 1]?.v && !afterCluster) out.push({ c: 'y' });
    else out.push(x);
  });

  // γ is "y" before e/i sounds, otherwise "g"; χ softens to "h" before e/i (όχι -> OH-hee).
  const front = x => x && (x.v === 'e' || x.v === 'i' || x.c === 'y');
  out.forEach((x, i) => {
    if (x.c === '?γ') x.c = front(out[i + 1]) ? 'y' : 'g';
    if (x.c === 'kh' && front(out[i + 1])) x.c = 'h';
  });
  return out.filter((x, i) => !(x.c === 'y' && out[i - 1]?.c === 'y')); // γι -> one "y"
}

function syllables(units) {
  const vi = units.map((x, i) => (x.v ? i : -1)).filter(i => i >= 0);
  if (!vi.length) return [{ onset: units.map(x => x.c), v: null, coda: [] }];

  const syl = vi.map(i => ({ onset: [], v: units[i].v, stressed: units[i].stressed, coda: [] }));
  syl[0].onset = units.slice(0, vi[0]).map(x => x.c);
  syl[syl.length - 1].coda = units.slice(vi[vi.length - 1] + 1).map(x => x.c);
  for (let k = 0; k < vi.length - 1; k++) {
    const between = units.slice(vi[k] + 1, vi[k + 1]).map(x => x.c);
    let split = Math.max(0, between.length - 1);
    if (between.length >= 2) {
      const last2 = between.slice(-2).join('');
      if (ONSETS.has(last2) || between[between.length - 1] === 'y') split = between.length - 2;
    }
    syl[k].coda = between.slice(0, split);
    syl[k + 1].onset = between.slice(split);
  }
  return syl;
}

// [{ text: 'ka', stressed: false }, { text: 'lee' }, { text: 'meh', stressed: true }, { text: 'ra' }]
export function syllabify(word) {
  if (!isGreek(word)) return [{ text: word, stressed: false }];
  const syl = syllables(phonemes(word));
  const one = syl.length === 1;
  return syl.map(s => {
    const table = s.coda.length ? CLOSED : one || s.stressed ? OPEN_STRESSED : OPEN;
    return { text: s.onset.join('') + (s.v ? table[s.v] : '') + s.coda.join(''), stressed: !one && !!s.stressed };
  });
}

const join = syl => syl.map(s => (s.stressed ? s.text.toUpperCase() : s.text)).join('-');

// Plain reading of one word: ka-lee-MEH-ra
export function pronounce(word) {
  return join(syllabify(word));
}

// ---------- Whole lines ----------

const ENCLITICS = new Set(['μου', 'σου', 'του', 'της', 'μας', 'σας', 'τους']);
// One-syllable words that never carry the stress before an enclitic (articles, particles).
const FUNCTION_WORDS = new Set([
  'ο', 'η', 'το', 'τα', 'οι', 'τον', 'την', 'τη', 'των', 'στο', 'στη', 'στην', 'στον', 'στα', 'στους', 'στις',
  'να', 'θα', 'δεν', 'μη', 'μην', 'και', 'κι', 'με', 'σε', 'για', 'από', 'ως', 'τι', 'που', 'πως', 'αν',
]);
const PUNCT = { ';': '?', ';': '?', '·': ';', '·': ';', '«': '“', '»': '”' };
const fixPunct = s => s.replace(/[;;··«»]/g, c => PUNCT[c]);
const APOS = /['’ʼ`]$/;
const bare = w => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Split a Greek line into words with their readings.
// Returns { words: [{ greek, say, syl, lead, trail }], plain }
//   greek: the Greek text for this word (an elided "Σ'" travels with the next word)
//   say:   what to send to the voice when this word is tapped
//   syl:   syllables for display; lead/trail: punctuation around it, already Latinised.
export function readLine(line) {
  const tokens = line.split(/\s+/).filter(Boolean).map(t => {
    const [, lead, word, trail] = t.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}][\p{L}\p{N}'’ʼ`\-]*?|)([^\p{L}\p{N}]*)$/u) || [, '', t, ''];
    // Keep an elision apostrophe with its word (σ', μ', απ') rather than treating it as punctuation.
    if (!word) return { lead: fixPunct(lead + trail), word: '', trail: '' };
    if (/^['’ʼ`]/.test(trail) && isGreek(word)) return { lead: fixPunct(lead), word: word + '’', trail: fixPunct(trail.slice(1)) };
    return { lead: fixPunct(lead), word, trail: fixPunct(trail) };
  });

  const words = [];
  let carry = null; // elided word waiting for the next one
  for (const t of tokens) {
    if (!t.word) {
      // Stand-alone punctuation such as a dash: hang it on the previous word.
      if (words.length) words[words.length - 1].trail += ' ' + t.lead;
      continue;
    }
    // σ’, μ’, τ’ have no vowel of their own and are said as part of the next word (s'a-ga-POH);
    // a clipped word that keeps a vowel (απ’) stays a word of its own.
    if (APOS.test(t.word) && !t.trail && isGreek(t.word) && !/[αεηιουωάέήίόύώϊϋΐΰ]/i.test(t.word)) { carry = t; continue; }
    const elided = APOS.test(t.word) ? t.word.replace(APOS, '') : null;
    const syl = elided ? syllabify(elided).map((x, i, all) => (i === all.length - 1 ? { ...x, text: x.text + "'" } : x)) : syllabify(t.word);
    const w = { greek: t.word, say: t.word, syl, lead: t.lead, trail: t.trail };
    if (carry) {
      const prefix = carry.word.replace(APOS, '');
      const sound = syllabify(prefix).map(x => x.text).join('');
      w.greek = w.say = `${prefix}’ ${t.word}`;
      w.lead = carry.lead + w.lead;
      w.syl = [{ ...syl[0], text: `${sound}'${syl[0].text}` }, ...syl.slice(1)];
      carry = null;
    }
    words.push(w);
  }
  if (carry) words.push({ greek: carry.word, say: carry.word, syl: syllabify(carry.word.replace(APOS, '')), lead: carry.lead, trail: '' });

  // Γεια σου: a one-syllable word at the start of a phrase carries the stress before an enclitic.
  words.forEach((w, i) => {
    const next = words[i + 1];
    const phraseStart = i === 0 || /[,.!?;:”]/.test(words[i - 1].trail);
    if (w.syl.length === 1 && next && !w.trail && phraseStart && isGreek(w.greek)
        && ENCLITICS.has(bare(next.greek)) && !FUNCTION_WORDS.has(bare(w.greek))) {
      w.syl = [{ ...w.syl[0], stressed: true }];
    }
  });

  const plain = words.map(w => w.lead + join(w.syl) + w.trail).join(' ');
  return { words, plain };
}
