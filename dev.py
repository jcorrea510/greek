"""Local dev server: static files plus /api/tts and /api/translate.

Run: .venv/bin/python dev.py [port]   (the venv needs edge-tts; GEMINI_API_KEY comes from .env.local)
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


def load_env(path=".env.local"):
    if not os.path.exists(path):
        return
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"'))


load_env()
sys.path.insert(0, "api")
from translate import handler as TranslateHandler  # noqa: E402
from tts import handler as TTSHandler  # noqa: E402


class Dev(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/tts"):
            return TTSHandler.do_GET(self)
        if self.path.startswith("/api/translate"):
            return TranslateHandler.do_GET(self)
        super().do_GET()

    def end_headers(self):
        # Always serve fresh files locally so edits show up on reload.
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()


ThreadingHTTPServer(("", int(sys.argv[1]) if len(sys.argv) > 1 else 8765), Dev).serve_forever()
