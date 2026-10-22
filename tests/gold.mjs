// Gold set for translations and readings.
//
//   node tests/gold.mjs                 readings + translations through the app's pipeline (local dev server)
//   node tests/gold.mjs --live          same, against https://greek-speech.vercel.app
//   node tests/gold.mjs --model-only    skip the phrasebook: grade the LLM on its own
//   node tests/gold.mjs --readings      readings only (offline)
//
// Expected Greek is a list of accepted answers. Lines that can be phrased many ways
// (slang, lyrics, long sentences) instead list words that must appear: each inner list is
// "any of these", and every inner list must match.

import { readFileSync } from 'node:fs';

const args = new Set(process.argv.slice(2));
globalThis.GREEK_API = args.has('--live') ? 'https://greek-speech.vercel.app' : 'http://localhost:8765';
const { readLine } = await import('../translit.js');
const { translate } = await import('../translate.js');

const gold = JSON.parse(readFileSync(new URL('./gold.json', import.meta.url)));
const canon = s => s.normalize('NFC').toLowerCase().replace(/[’'ʼ]/g, '’').replace(/;/g, ';').replace(/[.,!]/g, '').replace(/\s+/g, ' ').trim();
const has = (el, any) => any.some(w => canon(el).includes(canon(w)));
const clean = plain => !/[Ͱ-Ͽ]/.test(plain) && !/\s{2,}|\s[,.!?;]|^\s|\s$/.test(plain);

let pass = 0, fail = 0;
const failures = [];
function check(ok, label, detail) {
  if (ok) pass++;
  else { fail++; failures.push(`${label}\n      ${detail}`); }
}

// ---- Readings (deterministic) ----
let readPass = 0, readTotal = 0;
for (const g of gold) {
  if (!g.read) continue;
  readTotal++;
  const got = readLine(g.el[0]).plain;
  if (got === g.read) readPass++;
  check(got === g.read, `reading  ${g.el[0]}`, `expected ${g.read}\n      got      ${got}`);
}

// ---- Translations ----
let trPass = 0, trTotal = 0;
const rows = [];
if (!args.has('--readings')) {
  const modelOnly = args.has('--model-only');
  const run = async g => {
    if (modelOnly) {
      const lines = g.en.split('\n');
      const res = await fetch(`${globalThis.GREEK_API}/api/translate?v=5&q=${encodeURIComponent(g.en)}`);
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()));
      const data = await res.json();
      return { lines: data.lines.map((l, i) => ({ en: lines[i], ...l })), model: data.model };
    }
    return translate(g.en);
  };
  // A few at a time: the free tier allows only a handful of requests per minute per model.
  const queue = [...gold];
  // --model-only sends every phrase to the model, so go one at a time under the per-minute quota.
  const gap = modelOnly ? 4500 : 0;
  const workers = Array.from({ length: modelOnly ? 1 : 4 }, async () => {
    for (let g; (g = queue.shift());) {
      if (gap) await new Promise(r => setTimeout(r, gap));
      let out;
      try { out = await run(g); } catch (e) { out = { error: e.message }; }
      rows.push({ g, out });
    }
  });
  await Promise.all(workers);
  rows.sort((a, b) => gold.indexOf(a.g) - gold.indexOf(b.g));

  for (const { g, out } of rows) {
    trTotal++;
    const label = `translate "${g.en.replace(/\n/g, ' / ')}"`;
    if (out.error) { check(false, label, out.error); continue; }
    if (out.basic) { check(false, label, 'fell back to basic machine translation'); continue; }
    const lines = out.lines;
    const el = lines.map(l => l.el).join('\n');
    const problems = [];
    if (g.lines) {
      if (lines.length !== g.lines.length) problems.push(`expected ${g.lines.length} lines, got ${lines.length}`);
      g.lines.forEach((must, i) => {
        if (must === null) { if (lines[i]?.el) problems.push(`line ${i + 1} should be blank`); return; }
        for (const any of must) if (!has(lines[i]?.el || '', any)) problems.push(`line ${i + 1} lacks one of ${any.join('/')}`);
      });
    } else if (g.must) {
      for (const any of g.must) if (!has(el, any)) problems.push(`lacks one of ${any.join('/')}`);
    } else if (!g.el.some(e => canon(e) === canon(el))) {
      problems.push(`expected ${g.el.join(' | ')}`);
    }
    if (g.formal && !g.formal.some(f => canon(f) === canon(lines[0].formal || ''))) problems.push(`formal: expected ${g.formal.join(' | ')}, got "${lines[0].formal}"`);
    if (g.noFormal && lines.some(l => l.formal)) problems.push(`should have no formal variant, got "${lines.map(l => l.formal).join(' / ')}"`);
    for (const l of lines) if (l.el && !clean(readLine(l.el).plain)) problems.push(`messy reading: "${readLine(l.el).plain}"`);
    if (!problems.length) trPass++;
    check(!problems.length, label, `got ${el.replace(/\n/g, ' / ')}${lines[0].formal ? `  (formal: ${lines[0].formal})` : ''}\n      ${problems.join('\n      ')}`);
  }
}

// ---- Report ----
const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
if (rows.length) {
  console.log('\nEnglish                                  Greek                                         Reading');
  for (const { g, out } of rows) {
    if (out.error || g.lines) continue;
    const l = out.lines[0];
    console.log(`${pad(g.en, 40)} ${pad(l.el + (l.formal ? `  [${l.formal}]` : ''), 45)} ${readLine(l.el).plain}`);
  }
}
if (failures.length) console.log('\nFailures:\n  ' + failures.join('\n  '));
console.log(`\nReadings:     ${readPass}/${readTotal}`);
if (trTotal) console.log(`Translations: ${trPass}/${trTotal}  (${args.has('--model-only') ? 'model only' : 'app pipeline'}, ${globalThis.GREEK_API})`);
console.log(`Total:        ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
