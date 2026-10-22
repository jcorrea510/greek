"""Greek neural speech with per-word timings.

GET /api/tts?text=<greek>&rate=<-50..0>
-> {"audio": <base64 mp3>, "words": [[text, start_seconds, duration_seconds], ...]}

The word timings let the app clip a single word out of the spoken sentence.
"""
import asyncio
import base64
import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

import edge_tts

VOICE = "el-GR-AthinaNeural"
MAX_CHARS = 1200


async def synthesize(text, rate=0):
    rate = max(-50, min(0, int(rate)))
    communicate = edge_tts.Communicate(text, VOICE, rate=f"{rate:+d}%", boundary="WordBoundary")
    audio, words = bytearray(), []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
        elif chunk["type"] == "WordBoundary":
            words.append([chunk["text"], chunk["offset"] / 1e7, chunk["duration"] / 1e7])
    return {"audio": base64.b64encode(bytes(audio)).decode(), "words": words}


def respond(handler, status, body, cache=False):
    data = json.dumps(body, ensure_ascii=False).encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    if cache:
        handler.send_header("Cache-Control", "public, max-age=86400, s-maxage=31536000")
    handler.send_header("Content-Length", str(len(data)))
    handler.end_headers()
    handler.wfile.write(data)


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        text = (query.get("text") or [""])[0].strip()
        if not text or len(text) > MAX_CHARS:
            return respond(self, 400, {"error": "text must be 1-%d characters" % MAX_CHARS})
        try:
            result = asyncio.run(synthesize(text, (query.get("rate") or ["0"])[0]))
        except Exception as e:  # upstream speech service failed
            return respond(self, 502, {"error": str(e)})
        respond(self, 200, result, cache=True)
