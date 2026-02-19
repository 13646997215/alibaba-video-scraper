from http.server import BaseHTTPRequestHandler

from api._common import send_json, set_cors_headers


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        set_cors_headers(self)
        self.end_headers()

    def do_GET(self):
        send_json(
            self,
            200,
            {
                "status": "ok",
                "message": "Alibaba Video Scraper API is running",
            },
        )
