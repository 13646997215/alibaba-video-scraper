import json


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
