#!/usr/bin/env python3
"""Dev static server that disables caching so ES modules always reload fresh."""
import http.server, socketserver

PORT = 4599

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Dev server (no-cache) on http://localhost:{PORT}")
    httpd.serve_forever()
