"""Local dev server: static files plus /api/tts. Run: python dev.py [port]"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, "api")
from tts import handler as TTSHandler  # noqa: E402


class Dev(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/tts"):
            return TTSHandler.do_GET(self)
        super().do_GET()


ThreadingHTTPServer(("", int(sys.argv[1]) if len(sys.argv) > 1 else 8765), Dev).serve_forever()
