"""Serve the game locally and open it in the browser:  python tools/serve.py
(python -m http.server resets connections when the browser loads many modules at once — its queue is only 5.)"""
import http.server, os, webbrowser

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PORT = int(os.environ.get('PORT', 8765))

class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 128
    def handle_error(self, request, addr):   # browser dropping idle keep-alive sockets on reload/close: harmless
        import sys
        if not isinstance(sys.exception(), ConnectionError): super().handle_error(request, addr)

class Quiet(http.server.SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'   # keep-alive: Windows may reset a closing HTTP/1.0 socket mid-transfer
    def log_message(self, *a): pass

with Server(('127.0.0.1', PORT), Quiet) as s:
    url = f'http://127.0.0.1:{PORT}/'
    print(f'Karmiel: A Way Out -> {url}  (Ctrl+C to stop)')
    if not os.environ.get('NO_BROWSER'): webbrowser.open(url)
    try: s.serve_forever()
    except KeyboardInterrupt: pass
