// Edge cases for readings beyond the gold set: punctuation, elision, digits, Latin words.
//   node tests/translit.test.mjs
import { readLine } from '../translit.js';

const cases = [
  ['«Έλα», μου είπε — και έφυγε…', '“EH-la”, moo EE-peh — keh EH-fee-yeh…'],
  ['Θέλω 2 μπύρες και ένα wifi.', 'THEH-lo 2 BEE-res keh EH-na wifi.'],
  ['Μ’ αρέσει πολύ!', "m'a-REH-see po-LEE!"],
  ["Σ' αγαπώ", "s'a-ga-POH"],
  ['Πάμε απ’ το σπίτι;', "PAH-meh ap' toh SPEE-tee?"],
  ['Το όνομά μου είναι Jack.', 'toh OH-no-MAH moo EE-neh Jack.'],
  ['Ναι, ναι... εντάξει!', 'neh, neh... en-DAH-ksee!'],
  ['Κι εγώ σ’ αγαπώ', "kee eh-GOH s'a-ga-POH"],
  ['Τι ώρα είναι;', 'tee OH-ra EE-neh?'],
  ['Τσάι ή καφέ;', 'TSAH-ee ee ka-FEH?'],
  ['Θα ήθελα έναν φρέντο εσπρέσο', 'thah EE-theh-la EH-nan FREN-do es-PREH-so'],
  ['Γεια σου, Μαρία!', 'YAH soo, ma-REE-a!'],
  ['Να σου πω', 'nah soo poh'],
  ['κόσμος', 'KOZ-mos'],
  ['παιδιά', 'peh-DHYAH'],
  ['όχι', 'OH-hee'],
  ['Συγγνώμη', 'seeg-NOH-mee'],
  ['Αγγλικά', 'an-glee-KAH'],
];
let fail = 0;
for (const [greek, want] of cases) {
  const got = readLine(greek).plain;
  if (got !== want) { fail++; console.log(`FAIL ${greek}\n  want ${want}\n  got  ${got}`); }
}
console.log(`${cases.length - fail}/${cases.length} reading edge cases pass`);
process.exit(fail ? 1 : 0);
