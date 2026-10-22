// Greek script -> easy English-alphabet pronunciation, e.g. Καλημέρα -> kah-lee-MEH-rah.
// Works on one word at a time.

const ACCENTED = { 'ά': 'α', 'έ': 'ε', 'ή': 'η', 'ί': 'ι', 'ό': 'ο', 'ύ': 'υ', 'ώ': 'ω', 'ΐ': 'ϊ', 'ΰ': 'ϋ' };
const VOICELESS = new Set(['θ', 'κ', 'ξ', 'π', 'σ', 'ς', 'τ', 'φ', 'χ', 'ψ']);
const FRONT = new Set(['e', 'i']);

// Single-letter sounds. Vowels map to a vowel class: a e i o u.
const VOWEL = { 'α': 'a', 'ε': 'e', 'η': 'i', 'ι': 'i', 'ο': 'o', 'υ': 'i', 'ω': 'o', 'ϊ': 'i', 'ϋ': 'i' };
const CONS = {
  'β': 'v', 'δ': 'dh', 'ζ': 'z', 'θ': 'th', 'κ': 'k', 'λ': 'l', 'μ': 'm', 'ν': 'n',
  'ξ': 'ks', 'π': 'p', 'ρ': 'r', 'σ': 's', 'ς': 's', 'τ': 't', 'φ': 'f', 'χ': 'h', 'ψ': 'ps',
};
const VOWEL_DIGRAPHS = { 'ου': 'u', 'αι': 'e', 'ει': 'i', 'οι': 'i', 'υι': 'i' };
const CONS_DIGRAPHS = { 'μπ': 'b', 'ντ': 'd', 'γκ': 'g', 'γγ': 'ng', 'τσ': 'ts', 'τζ': 'dz' };
const ONSETS = new Set([
  'pr', 'tr', 'kr', 'br', 'dr', 'gr', 'fr', 'vr', 'thr', 'hr', 'dhr',
  'pl', 'kl', 'fl', 'gl', 'bl', 'vl', 'hl', 'sp', 'st', 'sk', 'sm', 'sf', 'sh',
  'ks', 'ps', 'ts', 'dz', 'pn', 'kn', 'mn', 'vg', 'zv',
]);

// Letters with their stress flag, accents removed.
function letters(word) {
  return [...word.toLowerCase()].map(ch => ({ ch: ACCENTED[ch] || ch, stressed: ch in ACCENTED }));
}

// Turn letters into phoneme units: { v: 'a'|'e'|'i'|'o'|'u', stressed } or { c: 'k' }.
function phonemes(word) {
  const L = letters(word);
  const units = [];
  for (let i = 0; i < L.length; i++) {
    const a = L[i].ch, b = L[i + 1]?.ch, pair = a + (b || '');
    const stressed = L[i].stressed || !!L[i + 1]?.stressed;

    if ((a === 'α' || a === 'ε' || a === 'η') && b === 'υ') {
      const next = L[i + 2]?.ch;
      units.push({ v: VOWEL[a], stressed });
      units.push({ c: !next || VOICELESS.has(next) ? 'f' : 'v' });
      i++; continue;
    }
    if (VOWEL_DIGRAPHS[pair]) { units.push({ v: VOWEL_DIGRAPHS[pair], stressed }); i++; continue; }
    if (pair === 'γχ') { units.push({ c: 'n' }, { c: 'h' }); i++; continue; }
    if (CONS_DIGRAPHS[pair]) { units.push({ c: CONS_DIGRAPHS[pair] }); i++; continue; }
    if (a === b && CONS[a]) continue; // λλ, σσ, ττ... sound like one letter
    if (VOWEL[a]) { units.push({ v: VOWEL[a], stressed: L[i].stressed }); continue; }
    if (a === 'γ') { units.push({ c: '?γ' }); continue; } // resolved below
    if (CONS[a]) { units.push({ c: CONS[a] }); continue; }
    units.push({ c: a }); // anything else (digits, latin letters) passes through
  }

  // γ is "y" before e/i sounds, otherwise "g". χ is a breathy "h" before vowels, "kh" elsewhere (νύχτα -> neekh-tah).
  units.forEach((u, i) => {
    if (u.c === '?γ') u.c = FRONT.has(units[i + 1]?.v) ? 'y' : 'g';
    if (u.c === 'h' && !units[i + 1]?.v) u.c = 'kh';
  });

  // Unstressed i after a consonant and before a vowel glides into "y": καρδιά -> kar-DYAH.
  const out = [];
  units.forEach((u, i) => {
    const prev = out[out.length - 1], next = units[i + 1];
    if (u.v === 'i' && !u.stressed && prev?.c && next?.v) {
      if (prev.c !== 'y') out.push({ c: 'y' });
      return;
    }
    out.push(u);
  });
  return out;
}

function syllables(units) {
  const vowelIdx = units.map((u, i) => (u.v ? i : -1)).filter(i => i >= 0);
  if (vowelIdx.length === 0) return [{ onset: units.map(u => u.c), v: null, coda: [] }];

  const syl = vowelIdx.map(i => ({ onset: [], v: units[i].v, stressed: units[i].stressed, coda: [] }));
  syl[0].onset = units.slice(0, vowelIdx[0]).map(u => u.c);
  syl[syl.length - 1].coda = units.slice(vowelIdx[vowelIdx.length - 1] + 1).map(u => u.c);

  for (let k = 0; k < vowelIdx.length - 1; k++) {
    const between = units.slice(vowelIdx[k] + 1, vowelIdx[k + 1]).map(u => u.c);
    let split = between.length <= 1 ? 0 : between.length - 1;
    if (between.length >= 2) {
      const lastTwo = between.slice(-2).join('');
      if (ONSETS.has(lastTwo) || between[between.length - 1] === 'y') split = between.length - 2;
    }
    syl[k].coda = between.slice(0, split);
    syl[k + 1].onset = between.slice(split);
  }
  return syl;
}

const OPEN = { a: 'ah', e: 'eh', i: 'ee', o: 'oh', u: 'oo' };
const CLOSED = { a: 'a', e: 'e', i: 'ee', o: 'o', u: 'oo' };
const GREEK = /[\u0370-\u03ff\u1f00-\u1fff]/;

// [{ text: 'kah', stressed: false }, { text: 'lee', ... }, { text: 'meh', stressed: true }, ...]
export function syllabify(word) {
  if (!GREEK.test(word)) return [{ text: word, stressed: false }];
  const syl = syllables(phonemes(word));
  const multi = syl.length > 1;
  return syl.map(s => {
    const vowel = s.v ? (s.coda.length ? CLOSED : OPEN)[s.v] : '';
    return { text: s.onset.join('') + vowel + s.coda.join(''), stressed: multi && !!s.stressed };
  });
}

// Plain-text form with the stressed syllable in capitals: kah-lee-MEH-rah
export function pronounce(word) {
  return syllabify(word).map(s => (s.stressed ? s.text.toUpperCase() : s.text)).join('-');
}
