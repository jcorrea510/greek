// Everyday phrases the way Greeks actually say them. Machine translation gets many of these
// literally right but idiomatically wrong ("You're welcome" -> "Καλώς ήρθες", which means
// "welcome here"), so these win over the translator. Polite forms (εσείς) are used for anyone
// you don't know, which is what Greeks expect from visitors.
// Keys are matched after normalizeEnglish(); a Greek entry ending in ";" is a question.

const PHRASES = {
  // Greetings
  'hello': 'Γεια σας',
  'hello there': 'Γεια σας',
  'hi': 'Γεια',
  'hey': 'Γεια',
  'hi there': 'Γεια',
  'good morning': 'Καλημέρα',
  'good afternoon': 'Καλησπέρα',
  'good evening': 'Καλησπέρα',
  'good night': 'Καληνύχτα',
  'goodnight': 'Καληνύχτα',
  'welcome': 'Καλώς ήρθατε',

  // How are you
  'how are you': 'Τι κάνετε;',
  'how are you doing': 'Τι κάνετε;',
  'how are you today': 'Τι κάνετε σήμερα;',
  'how is it going': 'Πώς πάει;',
  'how are things': 'Πώς πάει;',
  'how have you been': 'Πώς είστε;',
  'what is up': 'Τι γίνεται;',
  'sup': 'Τι γίνεται;',
  'what is new': 'Τι νέα;',
  'i am fine': 'Είμαι καλά',
  'i am good': 'Είμαι καλά',
  'i am well': 'Είμαι καλά',
  'i am ok': 'Είμαι εντάξει',
  'i am okay': 'Είμαι εντάξει',
  'i am fine thank you': 'Καλά, ευχαριστώ',
  'i am fine thanks': 'Καλά, ευχαριστώ',
  'i am good thank you': 'Καλά, ευχαριστώ',
  'i am good thanks': 'Καλά, ευχαριστώ',
  'fine thank you': 'Καλά, ευχαριστώ',
  'fine thanks': 'Καλά, ευχαριστώ',
  'good thanks': 'Καλά, ευχαριστώ',
  'good thank you': 'Καλά, ευχαριστώ',
  'very well thank you': 'Πολύ καλά, ευχαριστώ',
  'not bad': 'Όχι άσχημα',
  'so so': 'Έτσι κι έτσι',
  'and you': 'Εσείς;',
  'and yourself': 'Εσείς;',
  'how about you': 'Εσείς;',
  'what about you': 'Εσείς;',

  // Introductions
  'nice to meet you': 'Χάρηκα πολύ',
  'pleased to meet you': 'Χάρηκα πολύ',
  'it is nice to meet you': 'Χάρηκα πολύ',
  'it was nice to meet you': 'Χάρηκα πολύ',
  'nice to meet you too': 'Κι εγώ χάρηκα',
  'what is your name': 'Πώς σας λένε;',
  'where are you from': 'Από πού είστε;',

  // Goodbyes
  'goodbye': 'Γεια σας',
  'good bye': 'Γεια σας',
  'bye': 'Γεια',
  'bye bye': 'Γεια γεια',
  'see you': 'Τα λέμε',
  'see ya': 'Τα λέμε',
  'see you later': 'Τα λέμε αργότερα',
  'see you soon': 'Τα λέμε σύντομα',
  'see you tomorrow': 'Τα λέμε αύριο',
  'have a nice day': 'Καλή σας μέρα',
  'have a good day': 'Καλή σας μέρα',
  'have a great day': 'Καλή σας μέρα',
  'have a nice evening': 'Καλό βράδυ',
  'have a good evening': 'Καλό βράδυ',
  'have a good night': 'Καληνύχτα',
  'have a nice trip': 'Καλό ταξίδι',
  'have a good trip': 'Καλό ταξίδι',
  'take care': 'Να προσέχετε',

  // Politeness
  'please': 'Παρακαλώ',
  'thank you': 'Ευχαριστώ',
  'thanks': 'Ευχαριστώ',
  'thank you very much': 'Ευχαριστώ πολύ',
  'thank you so much': 'Ευχαριστώ πολύ',
  'thanks a lot': 'Ευχαριστώ πολύ',
  'thanks so much': 'Ευχαριστώ πολύ',
  'many thanks': 'Ευχαριστώ πολύ',
  'you are welcome': 'Παρακαλώ',
  'you are very welcome': 'Παρακαλώ',
  'my pleasure': 'Παρακαλώ',
  'excuse me': 'Συγγνώμη',
  'sorry': 'Συγγνώμη',
  'i am sorry': 'Συγγνώμη',
  'i am so sorry': 'Συγγνώμη πολύ',
  'pardon': 'Ορίστε;',
  'pardon me': 'Ορίστε;',
  'no problem': 'Κανένα πρόβλημα',
  'no worries': 'Δεν πειράζει',
  'it is okay': 'Δεν πειράζει',
  'it is ok': 'Δεν πειράζει',
  'never mind': 'Δεν πειράζει',
  'of course': 'Φυσικά',
  'sure': 'Βεβαίως',

  // Understanding
  'do you speak english': 'Μιλάτε αγγλικά;',
  'i do not speak greek': 'Δεν μιλάω ελληνικά',
  'i only speak a little greek': 'Μιλάω λίγα ελληνικά',
  'i speak a little greek': 'Μιλάω λίγα ελληνικά',
  'i do not understand': 'Δεν καταλαβαίνω',
  'i understand': 'Καταλαβαίνω',
  'i do not know': 'Δεν ξέρω',
  'slowly please': 'Πιο αργά, παρακαλώ',
  'more slowly please': 'Πιο αργά, παρακαλώ',
  'slower please': 'Πιο αργά, παρακαλώ',
  'can you speak more slowly': 'Μπορείτε να μιλάτε πιο αργά;',
  'can you speak slower': 'Μπορείτε να μιλάτε πιο αργά;',
  'can you speak slowly': 'Μπορείτε να μιλάτε πιο αργά;',
  'can you repeat that': 'Μπορείτε να το επαναλάβετε;',
  'can you say that again': 'Μπορείτε να το ξαναπείτε;',
  'what does this mean': 'Τι σημαίνει αυτό;',
  'what does that mean': 'Τι σημαίνει αυτό;',
  'how do you say this in greek': 'Πώς το λέτε αυτό στα ελληνικά;',
  'how do you say that in greek': 'Πώς το λέτε αυτό στα ελληνικά;',

  // Eating out
  'the check please': 'Τον λογαριασμό, παρακαλώ',
  'check please': 'Τον λογαριασμό, παρακαλώ',
  'the bill please': 'Τον λογαριασμό, παρακαλώ',
  'bill please': 'Τον λογαριασμό, παρακαλώ',
  'can i have the check': 'Τον λογαριασμό, παρακαλώ',
  'can i have the bill': 'Τον λογαριασμό, παρακαλώ',
  'can i have the check please': 'Τον λογαριασμό, παρακαλώ',
  'can i have the bill please': 'Τον λογαριασμό, παρακαλώ',
  'can we have the check': 'Τον λογαριασμό, παρακαλώ',
  'can we have the bill': 'Τον λογαριασμό, παρακαλώ',
  'can we have the check please': 'Τον λογαριασμό, παρακαλώ',
  'can we have the bill please': 'Τον λογαριασμό, παρακαλώ',
  'the menu please': 'Τον κατάλογο, παρακαλώ',
  'can i see the menu': 'Μπορώ να δω τον κατάλογο;',
  'can we see the menu': 'Μπορούμε να δούμε τον κατάλογο;',
  'a table for two': 'Ένα τραπέζι για δύο, παρακαλώ',
  'a table for two please': 'Ένα τραπέζι για δύο, παρακαλώ',
  'another one please': 'Άλλο ένα, παρακαλώ',
  'one more please': 'Άλλο ένα, παρακαλώ',
  'enjoy your meal': 'Καλή όρεξη',
  'bon appetit': 'Καλή όρεξη',
  'it is delicious': 'Είναι πολύ νόστιμο',
  'it was delicious': 'Ήταν πολύ νόστιμο',
  'cheers': 'Γεια μας',
  'keep the change': 'Κρατήστε τα ρέστα',

  // Getting around and shopping
  'where is the bathroom': 'Πού είναι η τουαλέτα;',
  'where is the restroom': 'Πού είναι η τουαλέτα;',
  'where is the toilet': 'Πού είναι η τουαλέτα;',
  'where are the toilets': 'Πού είναι οι τουαλέτες;',
  'how much': 'Πόσο κάνει;',
  'how much is it': 'Πόσο κάνει;',
  'how much is this': 'Πόσο κάνει αυτό;',
  'how much is that': 'Πόσο κάνει αυτό;',
  'how much does it cost': 'Πόσο κάνει;',
  'how much does this cost': 'Πόσο κάνει αυτό;',
  'do you have wifi': 'Έχετε wifi;',
  'what is the wifi password': 'Ποιος είναι ο κωδικός του wifi;',
  'can you help me': 'Μπορείτε να με βοηθήσετε;',
  'i need help': 'Χρειάζομαι βοήθεια',
  'call an ambulance': 'Καλέστε ασθενοφόρο',

  // Occasions
  'happy birthday': 'Χρόνια πολλά',
  'merry christmas': 'Καλά Χριστούγεννα',
  'happy new year': 'Καλή χρονιά',
  'happy easter': 'Καλό Πάσχα',
  'get well soon': 'Περαστικά',
  'good luck': 'Καλή τύχη',
  'congratulations': 'Συγχαρητήρια',

  // Small words
  'let us go': 'Πάμε',
  'come on': 'Έλα',
  'come here': 'Έλα εδώ',
  'wait a minute': 'Μια στιγμή',
  'one moment': 'Μια στιγμή',
  'just a moment': 'Μια στιγμή',
  'great': 'Τέλεια',
  'perfect': 'Τέλεια',
  'very good': 'Πολύ καλά',
  'very nice': 'Πολύ ωραία',
  'okay': 'Εντάξει',
  'ok': 'Εντάξει',
  'all right': 'Εντάξει',
  'alright': 'Εντάξει',
};

// "My name is Jack" -> "Με λένε Jack" (names stay as typed).
const PATTERNS = [
  [/^my name is (.+)$/, m => `Με λένε ${m[1]}`],
  [/^i am called (.+)$/, m => `Με λένε ${m[1]}`],
];

const CONTRACTIONS = [
  [/\bwhat's\b/g, 'what is'], [/\bhow's\b/g, 'how is'], [/\bwhere's\b/g, 'where is'],
  [/\bit's\b/g, 'it is'], [/\bthat's\b/g, 'that is'], [/\bi'm\b/g, 'i am'],
  [/\byou're\b/g, 'you are'], [/\bi'd\b/g, 'i would'], [/\blet's\b/g, 'let us'],
  [/\bdon't\b/g, 'do not'], [/\bdoesn't\b/g, 'does not'], [/\bcan't\b/g, 'cannot'],
  [/\bwhats\b/g, 'what is'], [/\bim\b/g, 'i am'], [/\byoure\b/g, 'you are'], [/\bdont\b/g, 'do not'],
  [/\bthx\b/g, 'thanks'], [/\bty\b/g, 'thank you'], [/\bu\b/g, 'you'],
];

export function normalizeEnglish(s) {
  let t = s.toLowerCase().replace(/[’‘`]/g, "'");
  for (const [re, rep] of CONTRACTIONS) t = t.replace(re, rep);
  return t.replace(/[^a-z0-9' ]+/g, ' ').replace(/'/g, '').replace(/\s+/g, ' ').trim();
}

// Keep the user's original casing for names in patterns.
function matchPattern(sentence) {
  const plain = sentence.replace(/[.!?…]+$/, '').trim();
  for (const [re, make] of PATTERNS) {
    const m = plain.match(new RegExp(re.source, 'i'));
    if (m) return make(m);
  }
  return null;
}

function lookupOne(part) {
  return PHRASES[normalizeEnglish(part)] ?? matchPattern(part);
}

// Greek for one English sentence, or null if it isn't a known phrase.
// Also handles comma-joined greetings like "Hi, how are you?".
export function phrase(sentence) {
  const end = (sentence.trim().match(/[.!?…]+$/) || [''])[0];
  let greek = lookupOne(sentence);
  if (!greek) {
    const parts = sentence.split(/,\s*/).filter(p => normalizeEnglish(p));
    if (parts.length < 2) return null;
    const found = parts.map(lookupOne);
    if (found.some(g => !g)) return null;
    greek = found
      .map((g, i) => (i && !/^Με λένε/.test(g) ? g[0].toLowerCase() + g.slice(1) : g))
      .map((g, i, all) => (i < all.length - 1 ? g.replace(/;$/, '') : g))
      .join(', ');
  }
  if (greek.endsWith(';')) return greek;
  // Statements keep their own shape: "Can I have the bill?" -> "Τον λογαριασμό, παρακαλώ."
  return greek + (end.includes('!') ? '!' : end ? '.' : '');
}
