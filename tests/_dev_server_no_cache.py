#!/usr/bin/env python3
"""
Servidor local para probar el prototipo a mano en el navegador, igual que
`python -m http.server 8791 --directory ../frontend` (el que usa Playwright),
pero mandando `Cache-Control: no-store` en cada respuesta — así el navegador
nunca guarda una versión vieja de un .css/.js mientras estamos iterando.
No lo usa la suite de tests (esa sigue con el comando normal en
playwright.config.js): esto es solo para revisar cambios a mano sin
pelearse con el cache del navegador.
"""
import http.server
import functools

class SinCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

if __name__ == '__main__':
    handler = functools.partial(SinCacheHandler, directory='../frontend')
    with http.server.ThreadingHTTPServer(('localhost', 8791), handler) as httpd:
        print('Sirviendo frontend/ en http://localhost:8791 (sin cache)')
        httpd.serve_forever()
