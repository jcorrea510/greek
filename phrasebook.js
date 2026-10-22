// Everyday phrases the way Greeks actually say them to someone their own age: casual singular
// (εσύ) first. Where the polite form (εσείς, for strangers, elders, shop staff) is different,
// the entry is [casual, formal] and the app offers it as an alternative.
// These answer instantly and win over the translator, which often picks the literal or formal
// reading ("hello" -> "Γεια σας", "you're welcome" -> "Καλώς ήρθες").
// Keys are matched after normalizeEnglish(); a Greek entry ending in ";" is a question.

const PHRASES = {
  // Greetings
  'hello': ['Γεια σου', 'Γεια σας'],
  'hello there': ['Γεια σου', 'Γεια σας'],
  'hi': 'Γεια',
  'hey': 'Γεια',
  'hi there': 'Γεια',
  'hey there': 'Γεια',
  'good morning': 'Καλημέρα',
  'morning': 'Καλημέρα',
  'good afternoon': 'Καλησπέρα',
  'good evening': 'Καλησπέρα',
  'good night': 'Καληνύχτα',
  'goodnight': 'Καληνύχτα',
  'night night': 'Καληνύχτα',
  'welcome': ['Καλώς ήρθες', 'Καλώς ήρθατε'],

  // How are you
  'how are you': ['Τι κάνεις;', 'Τι κάνετε;'],
  'how are you doing': ['Τι κάνεις;', 'Τι κάνετε;'],
  'how are you today': ['Τι κάνεις σήμερα;', 'Τι κάνετε σήμερα;'],
  'how is it going': ['Πώς πάει;'],
  'how are things': ['Πώς πάνε τα πράγματα;'],
  'how have you been': ['Πώς τα πας;', 'Πώς τα πάτε;'],
  'what is up': 'Τι λέει;',
  'whats up': 'Τι λέει;',
  'sup': 'Τι λέει;',
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
  'and you': ['Εσύ;', 'Εσείς;'],
  'and yourself': ['Εσύ;', 'Εσείς;'],
  'how about you': ['Εσύ;', 'Εσείς;'],
  'what about you': ['Εσύ;', 'Εσείς;'],

  // Introductions
  'nice to meet you': 'Χάρηκα',
  'pleased to meet you': 'Χάρηκα',
  'it is nice to meet you': 'Χάρηκα',
  'it was nice to meet you': 'Χάρηκα πολύ',
  'nice to meet you too': 'Κι εγώ χάρηκα',
  'what is your name': ['Πώς σε λένε;', 'Πώς σας λένε;'],
  'where are you from': ['Από πού είσαι;', 'Από πού είστε;'],
  'i am from america': 'Είμαι από την Αμερική',
  'i am from the us': 'Είμαι από την Αμερική',
  'i am american': 'Είμαι Αμερικανός',

  // Goodbyes
  'goodbye': ['Γεια σου', 'Γεια σας'],
  'good bye': ['Γεια σου', 'Γεια σας'],
  'bye': 'Γεια',
  'bye bye': 'Γεια γεια',
  'see you': 'Τα λέμε',
  'see ya': 'Τα λέμε',
  'see you later': 'Τα λέμε αργότερα',
  'see you soon': 'Τα λέμε σύντομα',
  'see you tomorrow': 'Τα λέμε αύριο',
  'have a nice day': ['Καλή σου μέρα', 'Καλή σας μέρα'],
  'have a good day': ['Καλή σου μέρα', 'Καλή σας μέρα'],
  'have a great day': ['Καλή σου μέρα', 'Καλή σας μέρα'],
  'have a nice evening': 'Καλό βράδυ',
  'have a good evening': 'Καλό βράδυ',
  'have a good night': 'Καληνύχτα',
  'have a nice trip': 'Καλό ταξίδι',
  'have a good trip': 'Καλό ταξίδι',
  'have fun': ['Να περάσεις καλά', 'Να περάσετε καλά'],
  'take care': ['Να προσέχεις', 'Να προσέχετε'],

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
  'i am so sorry': 'Χίλια συγγνώμη',
  'pardon': 'Ορίστε;',
  'pardon me': 'Ορίστε;',
  'no problem': 'Κανένα πρόβλημα',
  'no worries': 'Κανένα πρόβλημα',
  'it is okay': 'Δεν πειράζει',
  'it is ok': 'Δεν πειράζει',
  'never mind': 'Δεν πειράζει',
  'of course': 'Φυσικά',
  'sure': 'Σίγουρα',
  'yes': 'Ναι',
  'yeah': 'Ναι',
  'no': 'Όχι',
  'nope': 'Όχι',
  'maybe': 'Ίσως',

  // Understanding
  'do you speak english': ['Μιλάς αγγλικά;', 'Μιλάτε αγγλικά;'],
  'i do not speak greek': 'Δεν μιλάω ελληνικά',
  'i only speak a little greek': 'Μιλάω λίγα ελληνικά',
  'i speak a little greek': 'Μιλάω λίγα ελληνικά',
  'i do not understand': 'Δεν καταλαβαίνω',
  'i understand': 'Καταλαβαίνω',
  'i do not know': 'Δεν ξέρω',
  'slowly please': 'Πιο αργά, παρακαλώ',
  'more slowly please': 'Πιο αργά, παρακαλώ',
  'slower please': 'Πιο αργά, παρακαλώ',
  'can you speak more slowly': ['Μπορείς να μιλάς πιο αργά;', 'Μπορείτε να μιλάτε πιο αργά;'],
  'can you speak slower': ['Μπορείς να μιλάς πιο αργά;', 'Μπορείτε να μιλάτε πιο αργά;'],
  'can you speak slowly': ['Μπορείς να μιλάς πιο αργά;', 'Μπορείτε να μιλάτε πιο αργά;'],
  'can you repeat that': ['Μπορείς να το ξαναπείς;', 'Μπορείτε να το ξαναπείτε;'],
  'can you say that again': ['Μπορείς να το ξαναπείς;', 'Μπορείτε να το ξαναπείτε;'],
  'what does this mean': 'Τι σημαίνει αυτό;',
  'what does that mean': 'Τι σημαίνει αυτό;',
  'how do you say this in greek': 'Πώς λέγεται αυτό στα ελληνικά;',
  'how do you say that in greek': 'Πώς λέγεται αυτό στα ελληνικά;',

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
  'a beer please': 'Μια μπύρα, παρακαλώ',
  'two beers please': 'Δύο μπύρες, παρακαλώ',
  'water please': 'Νερό, παρακαλώ',
  'a coffee please': 'Έναν καφέ, παρακαλώ',
  'i would like a coffee': 'Θα ήθελα έναν καφέ',
  'another one please': 'Άλλο ένα, παρακαλώ',
  'one more please': 'Άλλο ένα, παρακαλώ',
  'enjoy your meal': 'Καλή όρεξη',
  'bon appetit': 'Καλή όρεξη',
  'it is delicious': 'Είναι πολύ νόστιμο',
  'it was delicious': 'Ήταν πολύ νόστιμο',
  'this is delicious': 'Είναι πολύ νόστιμο',
  'i am vegetarian': 'Είμαι χορτοφάγος',
  'cheers': 'Γεια μας',
  'keep the change': ['Κράτα τα ρέστα', 'Κρατήστε τα ρέστα'],

  // Getting around and shopping
  'where is the bathroom': 'Πού είναι η τουαλέτα;',
  'where is the restroom': 'Πού είναι η τουαλέτα;',
  'where is the toilet': 'Πού είναι η τουαλέτα;',
  'where are the toilets': 'Πού είναι οι τουαλέτες;',
  'where is the beach': 'Πού είναι η παραλία;',
  'on the left': 'Αριστερά',
  'on the right': 'Δεξιά',
  'straight ahead': 'Ευθεία',
  'how much': 'Πόσο κάνει;',
  'how much is it': 'Πόσο κάνει;',
  'how much is this': 'Πόσο κάνει αυτό;',
  'how much is that': 'Πόσο κάνει αυτό;',
  'how much does it cost': 'Πόσο κάνει;',
  'how much does this cost': 'Πόσο κάνει αυτό;',
  'do you have wifi': ['Έχεις wifi;', 'Έχετε wifi;'],
  'what is the wifi password': 'Ποιος είναι ο κωδικός του wifi;',
  'can you help me': ['Μπορείς να με βοηθήσεις;', 'Μπορείτε να με βοηθήσετε;'],
  'help': 'Βοήθεια!',
  'i need help': 'Χρειάζομαι βοήθεια',
  'call an ambulance': 'Καλέστε ασθενοφόρο',

  // Numbers
  'one': 'Ένα', 'two': 'Δύο', 'three': 'Τρία', 'four': 'Τέσσερα', 'five': 'Πέντε',
  'six': 'Έξι', 'seven': 'Εφτά', 'eight': 'Οχτώ', 'nine': 'Εννιά', 'ten': 'Δέκα',

  // Occasions
  'happy birthday': 'Χρόνια πολλά',
  'merry christmas': 'Καλά Χριστούγεννα',
  'happy new year': 'Καλή χρονιά',
  'happy easter': 'Καλό Πάσχα',
  'get well soon': 'Περαστικά',
  'good luck': 'Καλή τύχη',
  'congratulations': 'Συγχαρητήρια',

  // Feelings
  'i love you': 'Σ’ αγαπώ',
  'i love you too': 'Κι εγώ σ’ αγαπώ',
  'i miss you': 'Μου λείπεις',

  // Small words
  'let us go': 'Πάμε',
  'come on': 'Έλα',
  'come here': 'Έλα εδώ',
  'wait a minute': 'Μια στιγμή',
  'one moment': 'Μια στιγμή',
  'just a moment': 'Μια στιγμή',
  'great': 'Τέλεια',
  'perfect': 'Τέλεια',
  'awesome': 'Τέλεια',
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
  [/\bthx\b/g, 'thanks'], [/\bty\b/g, 'thank you'], [/\bu\b/g, 'you'], [/\bur\b/g, 'your'],
];

export function normalizeEnglish(s) {
  let t = s.toLowerCase().replace(/[’‘`]/g, "'");
  for (const [re, rep] of CONTRACTIONS) t = t.replace(re, rep);
  return t.replace(/[^a-z0-9' ]+/g, ' ').replace(/'/g, '').replace(/\s+/g, ' ').trim();
}

const entry = v => (Array.isArray(v) ? { el: v[0], formal: v[1] || '' } : { el: v, formal: '' });

function matchPattern(sentence) {
  const plain = sentence.replace(/[.!?…]+$/, '').trim();
  for (const [re, make] of PATTERNS) {
    const m = plain.match(new RegExp(re.source, 'i')); // keep the user's casing for the name
    if (m) return { el: make(m), formal: '' };
  }
  return null;
}

function lookupOne(part) {
  const v = PHRASES[normalizeEnglish(part)];
  return v ? entry(v) : matchPattern(part);
}

const lowerFirst = g => (/^Με λένε/.test(g) ? g : g[0].toLowerCase() + g.slice(1));

// { el, formal } for one English sentence, or null if it isn't a known phrase.
// Also handles comma-joined phrases like "Hi, how are you?" -> "Γεια, τι κάνεις;".
export function phrase(sentence) {
  const end = (sentence.trim().match(/[.!?…]+$/) || [''])[0];
  let found = lookupOne(sentence);
  if (!found) {
    const parts = sentence.split(/,\s*/).filter(p => normalizeEnglish(p));
    if (parts.length < 2) return null;
    const each = parts.map(lookupOne);
    if (each.some(g => !g)) return null;
    const glue = key => each
      .map((g, i) => (i ? lowerFirst(g[key] || g.el) : g[key] || g.el))
      .map((g, i, all) => (i < all.length - 1 ? g.replace(/[;!]$/, '') : g))
      .join(', ');
    const el = glue('el'), formal = glue('formal');
    found = { el, formal: formal !== el ? formal : '' };
  }
  const finish = g => {
    if (!g || /[;!]$/.test(g)) return g;
    // Statements keep their own shape: "Can I have the bill?" -> "Τον λογαριασμό, παρακαλώ."
    return g + (end.includes('!') ? '!' : '');
  };
  return { el: finish(found.el), formal: finish(found.formal) };
}
