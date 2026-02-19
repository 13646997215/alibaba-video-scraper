import json

import requests


DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Connection": "keep-alive",
}


def set_cors_headers(handler):
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")


def send_json(handler, status_code, payload):
    handler.send_response(status_code)
    set_cors_headers(handler)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.end_headers()
    handler.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))


def read_json_body(handler):
    content_length = int(handler.headers.get("Content-Length", 0))
    if content_length <= 0:
        return {}
    body = handler.rfile.read(content_length).decode("utf-8")
    if not body:
        return {}
    return json.loads(body)


def safe_requests_get(url: str, timeout: int = 25, headers: dict | None = None, **kwargs):
    merged_headers = {**DEFAULT_HEADERS, **(headers or {})}
    try:
        return requests.get(url, timeout=timeout, headers=merged_headers, **kwargs)
    except requests.exceptions.SSLError:
        return requests.get(url, timeout=timeout, headers=merged_headers, verify=False, **kwargs)
