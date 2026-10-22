"""English -> natural spoken Greek, line by line, via Gemini.

GET /api/translate?q=<english, lines separated by \\n>&v=<prompt version>
-> {"lines": [{"el": "Γεια σου", "formal": "Γεια σας"}, ...], "model": "..."}

One output line per input line (blank lines stay blank) so song lyrics keep their shape.
"formal" is the polite εσείς version when it differs, otherwise "".

The response is a cacheable GET: the CDN keeps it for a year, so each distinct text costs
one model call ever. The prompt version (PROMPT_VERSION) is part of the URL the app builds,
so changing the prompt naturally misses the old cache entries.
"""
import json
import os
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

PROMPT_VERSION = "5"
MAX_CHARS = 2500
DEADLINE = 25  # seconds; the function itself is allowed 30

# Tried in order. The free tier sheds load per model with 503/429, so a busy model falls
# through to the next. Thinking is kept minimal: translation doesn't benefit from it and
# it multiplies latency (34s vs 4s in testing).
MODELS = [
    ("gemini-3.5-flash", {"thinkingLevel": "minimal"}),
    ("gemini-3.8-flash", {"thinkingLevel": "low"}),
    ("gemini-3.5-flash-lite", None),
    ("gemini-flash-lite-latest", None),
]

SYSTEM = """You translate English into natural, everyday spoken Greek: what a native Greek speaker in their 20s or 30s would actually say out loud. The reader is an English speaker who will read your Greek aloud to Greek friends, waiters, shopkeepers, or sing it.

Register
- Default to the casual singular "εσύ" form: Γεια σου, Τι κάνεις;, Σ’ αγαπώ, Μπορείς να...;
- "formal" is the polite "εσείς" version, for a stranger, an older person, or shop staff. Fill it only when the line speaks to someone as "you" (or is a greeting/goodbye) AND the polite version uses different words. Otherwise "formal" must be "". Never give a formal version for song lyrics, romantic or intimate lines, or lines that don't address anyone.

Naturalness
- Translate meaning, not words. Use the phrase a Greek would really use, not a dictionary rendering.
- Never calque English structures. Requests like "can I have / can we get / could I get" become what a Greek says: just the thing plus παρακαλώ, or "Θα μου φέρεις...;" (never "Μπορώ να έχω"). Keep the exact meaning: a farewell like "take care" is not "see you", "delicious" is about taste, not "perfect".
- Match the tone of the English: neutral English gets neutral everyday Greek; slang gets natural Greek slang (ρε φίλε, τι λέει, τέλεια, πεθαίνω της πείνας). Don't add slang that isn't there, and don't add words, emojis or explanations.
- Song lyrics and poetry: keep each line as its own line, keep the feeling and imagery, prefer short, natural, singable phrasing over literal accuracy.
- Keep names, brands and numbers written with digits as they are.

Spelling
- Modern monotonic Greek. Every word of two or more syllables has its accent mark (τόνος) on the correct syllable; this is essential because readers rely on it for stress. Use final ς.
- Use the Greek question mark ";" for questions.
- Write the way people speak: κι before a vowel (Κι εσύ;), elisions with ’ (Σ’ αγαπώ, μ’ αρέσει, Τα λέμε), "μια" not "μία" for "a/one" before a noun.

Output: JSON {"lines": [{"el": "...", "formal": "..."}]} with exactly one item per input line, in the same order.

Examples
hello -> {"el": "Γεια σου", "formal": "Γεια σας"}
hi -> {"el": "Γεια", "formal": ""}
how are you? -> {"el": "Τι κάνεις;", "formal": "Τι κάνετε;"}
thank you -> {"el": "Ευχαριστώ", "formal": ""}
you're welcome -> {"el": "Παρακαλώ", "formal": ""}
the bill, please -> {"el": "Τον λογαριασμό, παρακαλώ", "formal": ""}
cheers! -> {"el": "Γεια μας!", "formal": ""}
I love you -> {"el": "Σ’ αγαπώ", "formal": ""}
what's up dude -> {"el": "Τι λέει, ρε φίλε;", "formal": ""}
can you tell me where the beach is? -> {"el": "Μπορείς να μου πεις πού είναι η παραλία;", "formal": "Μπορείτε να μου πείτε πού είναι η παραλία;"}"""

SCHEMA = {
    "type": "object",
    "properties": {
        "lines": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"el": {"type": "string"}, "formal": {"type": "string"}},
                "required": ["el", "formal"],
            },
        }
    },
    "required": ["lines"],
}

GREEK = range(0x0370, 0x0400)


class Unavailable(Exception):
    """Every model refused or failed; the app falls back to its basic translator."""


def has_greek(s):
    return any(ord(c) in GREEK for c in s)


def tidy(s):
    s = " ".join(s.split())
    s = s.replace("'", "’").replace("?", ";").replace(";", ";")
    return s


def ask(model, thinking, lines, key, timeout):
    config = {"responseMimeType": "application/json", "responseSchema": SCHEMA, "temperature": 0.2}
    if thinking:
        config["thinkingConfig"] = thinking
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM}]},
        "contents": [{"role": "user", "parts": [{"text": json.dumps({"lines": lines}, ensure_ascii=False)}]}],
        "generationConfig": config,
    }
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        data = json.load(res)
    text = "".join(p.get("text", "") for p in data["candidates"][0]["content"]["parts"] if not p.get("thought"))
    out = json.loads(text)["lines"]
    if len(out) != len(lines):
        raise ValueError(f"{len(lines)} lines in, {len(out)} out")
    if not any(has_greek(item.get("el", "")) for item in out):
        raise ValueError("no Greek in the answer")
    result = []
    for item in out:
        el, formal = tidy(item.get("el", "")), tidy(item.get("formal", ""))
        result.append({"el": el, "formal": formal if formal and formal != el else ""})
    return result


def translate(lines):
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise Unavailable("GEMINI_API_KEY is not set")
    # Only non-blank lines go to the model; blank ones are put back afterwards.
    filled = [i for i, l in enumerate(lines) if l.strip()]
    asked = [lines[i] for i in filled]
    start, errors = time.monotonic(), []
    for model, thinking in MODELS:
        left = DEADLINE - (time.monotonic() - start)
        if left < 3:
            break
        try:
            got = ask(model, thinking, asked, key, timeout=min(left, 18))
        except urllib.error.HTTPError as e:
            errors.append(f"{model}: HTTP {e.code}")
            continue
        except Exception as e:  # timeout, bad JSON, wrong line count
            errors.append(f"{model}: {e}")
            continue
        out = [{"el": "", "formal": ""} for _ in lines]
        for i, item in zip(filled, got):
            out[i] = item
        return out, model
    raise Unavailable("; ".join(errors) or "out of time")


ALLOWED_ORIGINS = ("https://jcorrea510.github.io", "http://localhost", "http://127.0.0.1", "https://greek-speech.vercel.app")


def respond(handler, status, body, cache=False):
    data = json.dumps(body, ensure_ascii=False).encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    if cache:
        handler.send_header("Cache-Control", "public, max-age=604800, s-maxage=31536000, stale-while-revalidate=86400")
    else:
        handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(data)))
    handler.end_headers()
    handler.wfile.write(data)


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Keep other sites from spending this app's model quota from their pages.
        origin = self.headers.get("Origin") or ""
        if origin and not origin.startswith(ALLOWED_ORIGINS):
            return respond(self, 403, {"error": "origin not allowed"})
        query = parse_qs(urlparse(self.path).query, keep_blank_values=True)
        text = (query.get("q") or [""])[0].replace("\r\n", "\n").strip()
        if not text or len(text) > MAX_CHARS:
            return respond(self, 400, {"error": "q must be 1-%d characters" % MAX_CHARS})
        try:
            lines, model = translate(text.split("\n"))
        except Unavailable as e:
            return respond(self, 503, {"error": str(e)})
        respond(self, 200, {"lines": lines, "model": model, "v": PROMPT_VERSION}, cache=True)
