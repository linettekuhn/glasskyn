"""Local review server for the auto-labeling manual-review step.

Serves two things:
1. The review app at  /review  (backend/review/review.html) plus static files
   relative to the backend directory, so product images under data/unlabeled/
   resolve at /data/unlabeled/<code>.jpg.
2. POST /save-review — persists labels assigned in the browser back to
   data/manifests/manual_review_<batch>_annotated.csv.

Run standalone from a terminal:

    python review/review_server.py --port 8787

or launch from the notebook (background thread). URLs:

    http://127.0.0.1:8787/review?batch=loose
    http://127.0.0.1:8787/review?batch=conservative
"""

import argparse
import csv
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

BACKEND_DIR = Path(__file__).resolve().parent.parent
MANIFESTS_DIR = BACKEND_DIR / "data" / "manifests"
REVIEW_HTML = BACKEND_DIR / "review" / "review.html"

VALID_BATCHES = ("loose", "conservative")
VALID_CLASSES = ("skincare", "haircare", "makeup")
DEFAULT_PORT = 8787


class ReviewHandler(SimpleHTTPRequestHandler):
    """Static file server rooted at BACKEND_DIR with a save-review POST endpoint."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BACKEND_DIR), **kwargs)

    def log_message(self, fmt, *args):
        pass  # quiet by default; run with --verbose to see requests

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path.rstrip("/")
        if path in ("", "/review", "/review.html"):
            try:
                data = REVIEW_HTML.read_bytes()
            except FileNotFoundError:
                self.send_error(404, "review.html not found")
                return
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        return super().do_GET()

    def do_POST(self):
        if self.path != "/save-review":
            self._send_json(404, {"ok": False, "error": "unknown endpoint"})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self._send_json(400, {"ok": False, "error": "bad request body"})
            return
        batch = payload.get("batch")
        rows = payload.get("rows")
        if batch not in VALID_BATCHES or not isinstance(rows, list):
            self._send_json(400, {"ok": False, "error": "invalid batch or rows"})
            return
        cleaned = []
        for r in rows:
            code = str(r.get("code", "")).strip()
            label = str(r.get("manual_label", "") or "").strip().lower()
            if not code:
                continue
            if label and label not in VALID_CLASSES:
                self._send_json(400, {"ok": False, "error": "bad label for code %s: %r" % (code, label)})
                return
            cleaned.append({"code": code, "manual_label": label})
        MANIFESTS_DIR.mkdir(parents=True, exist_ok=True)
        out = MANIFESTS_DIR / f"manual_review_{batch}_annotated.csv"
        with open(out, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["code", "manual_label"])
            writer.writeheader()
            writer.writerows(cleaned)
        n_labeled = sum(1 for r in cleaned if r["manual_label"])
        self._send_json(200, {
            "ok": True,
            "n_labeled": n_labeled,
            "total": len(cleaned),
            "saved_to": str(out),
        })


def start_server(port=DEFAULT_PORT, verbose=False):
    httpd = ThreadingHTTPServer(("127.0.0.1", port), ReviewHandler)
    return httpd


def main():
    parser = argparse.ArgumentParser(description="Local review server for manual labeling.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    if args.verbose:
        ReviewHandler.log_message = lambda self, fmt, *a: print(">", fmt % a)

    httpd = start_server(args.port)
    url = f"http://127.0.0.1:{args.port}/review"
    print(f"Review server running at {url}")
    print(f"  loose:          {url}?batch=loose")
    print(f"  conservative:   {url}?batch=conservative")
    print("  Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()