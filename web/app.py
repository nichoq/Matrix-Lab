"""Run a local-only browser interface with python -m web.app."""
import json
import subprocess
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from benchmarks.run_benchmarks import run_case, run_demo, ROOT

PAGES = {"/": "index.html", "/how": "how.html", "/lab": "lab.html"}
LOCK = threading.Lock()
HISTORY_LOCK = threading.Lock()
HISTORY = ROOT / "results/data/experiments.jsonl"
ASSETS = {"/lab.css": ("lab.css", "text/css; charset=utf-8"),
          "/shared.css": ("shared.css", "text/css; charset=utf-8"),
          "/logo.svg": ("logo.svg", "image/svg+xml"),
          "/lab.js": ("lab.js", "text/javascript; charset=utf-8")}


def read_history():
    with HISTORY_LOCK:
        if not HISTORY.exists():
            return []
        return [json.loads(line) for line in HISTORY.read_text(encoding="utf-8").splitlines() if line.strip()]


def save_experiment(result):
    with HISTORY_LOCK:
        HISTORY.parent.mkdir(parents=True, exist_ok=True)
        with HISTORY.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(result) + "\n")


class Handler(BaseHTTPRequestHandler):
    def respond(self, status, body, content_type="application/json; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def get_allowed_origin(self):
        port = self.server.server_port
        return {f"http://127.0.0.1:{port}", f"http://localhost:{port}"}

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/favicon.ico":
            return self.respond(204, b"", "image/x-icon")
        if path == "/api/history":
            try:
                return self.respond(200, json.dumps(read_history()).encode())
            except (OSError, ValueError):
                return self.respond(500, b'{"error":"Saved experiments could not be read."}')
        if path in ASSETS:
            asset, mime = ASSETS[path]
            return self.respond(200, Path(__file__).with_name(asset).read_bytes(), mime)
        page = PAGES.get(path)
        if page is None:
            return self.respond(404, b"Not found", "text/plain; charset=utf-8")
        self.respond(200, Path(__file__).with_name(page).read_bytes(), "text/html; charset=utf-8")

    def do_POST(self):
        if self.path not in ("/api/run", "/api/demo") or self.headers.get("Origin") not in self.get_allowed_origin():
            return self.respond(403, b'{"error":"Request not allowed."}')
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > 1024:
                raise ValueError("Invalid request size.")
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError("Request must be a JSON object.")
            demo = self.path == "/api/demo"
            if demo:
                data["repeats"] = 1
            size, processes, repeats = (data.get(key) for key in ("size", "processes", "repeats"))
            if any(type(value) is not int for value in (size, processes, repeats)):
                raise ValueError("All fields must be whole numbers.")
            if not (1 <= size <= 5000 and 1 <= processes <= 32 and 1 <= repeats <= 20):
                raise ValueError("Use size 1–5000, processes 1–32, and trials 1–20.")
            seed = data.get("seed", 42)
            if type(seed) is not int or not 0 <= seed <= 4294967295:
                raise ValueError("Seed must be a whole number between 0 and 4294967295.")
            if demo and not (2 <= size <= 5 and processes <= 8):
                raise ValueError("Use demonstration size 2–5 and processes 1–8.")
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            return self.respond(400, json.dumps({"error": str(exc)}).encode())
        if not LOCK.acquire(blocking=False):
            return self.respond(409, b'{"error":"A benchmark is already running."}')
        try:
            result = run_demo(size, processes) if demo else run_case(size, processes, repeats, seed)
            if not demo:
                save_experiment(result)
            self.respond(200, json.dumps(result).encode())
        except Exception as exc:
            detail = exc.stderr if isinstance(exc, subprocess.CalledProcessError) else str(exc)
            self.respond(500, json.dumps({"error": detail or str(exc)}).encode())
        finally:
            LOCK.release()


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 5000), Handler)
    url = f"http://127.0.0.1:{server.server_port}/"
    print(f"Open {url} in your browser. Press Ctrl+C to stop.", flush=True)
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
