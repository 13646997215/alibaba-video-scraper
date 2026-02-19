import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

import requests

from api._common import read_json_body, safe_requests_get, send_json, set_cors_headers

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.resource_extractor import extract_resources_from_html


def normalize_input_url(url: str) -> str:
    value = (url or "").strip()
    if not value:
        return ""
    if not value.startswith(("http://", "https://")):
        value = "https://" + value
    return value


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        set_cors_headers(self)
        self.end_headers()

    def do_POST(self):
        try:
            payload = read_json_body(self)
        except (ValueError, TypeError, UnicodeDecodeError, json.JSONDecodeError):
            send_json(self, 400, {"status": "error", "error": "请求体不是有效 JSON"})
            return

        page_url = normalize_input_url(payload.get("url", ""))
        if not page_url:
            send_json(self, 400, {"status": "error", "error": "URL 不能为空"})
            return

        try:
            response = safe_requests_get(page_url, timeout=25)
            response.raise_for_status()
            html = response.text
            final_url = response.url or page_url
            resources = extract_resources_from_html(html, final_url)
            counts = {key: len(value) for key, value in resources.items()}
            send_json(
                self,
                200,
                {
                    "status": "success",
                    "message": "资源提取完成",
                    "url": final_url,
                    "resources": resources,
                    "counts": counts,
                    "total": sum(counts.values()),
                    "debug": {"environment": "vercel-serverless"},
                },
            )
        except requests.RequestException as error:
            send_json(self, 500, {"status": "error", "error": f"提取失败: {str(error)}"})
