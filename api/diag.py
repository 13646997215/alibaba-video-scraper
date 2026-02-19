import json
import re
from http.server import BaseHTTPRequestHandler

import requests

from api._common import read_json_body, safe_requests_get, send_json, set_cors_headers


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

        target = str(payload.get("url", "")).strip()
        if not target:
            send_json(self, 400, {"status": "error", "error": "url 不能为空"})
            return
        if not target.startswith(("http://", "https://")):
            target = "https://" + target

        try:
            response = safe_requests_get(target, timeout=20, allow_redirects=True)
            html = response.text or ""
            video_tokens = {
                "videoUrl": len(re.findall(r'"videoUrl"\s*:\s*"([^"]+)"', html)),
                "escapedVideoUrl": len(re.findall(r'\\"videoUrl\\"\s*:\s*\\"([^\\"]+)\\"', html)),
                "directMp4": len(re.findall(r'https?://[^\s"\'<>]+\.(?:mp4|webm|ogg|mov)', html)),
                "escapedMp4": len(re.findall(r'https?:\\/\\/[^\s"\'<>]+\.(?:mp4|webm|ogg|mov)', html)),
            }
            send_json(
                self,
                200,
                {
                    "status": "success",
                    "message": "诊断完成",
                    "target": target,
                    "final_url": response.url or target,
                    "status_code": response.status_code,
                    "content_type": response.headers.get("Content-Type", ""),
                    "server": response.headers.get("Server", ""),
                    "content_length": response.headers.get("Content-Length", ""),
                    "environment": "vercel-serverless",
                    "html_length": len(html),
                    "video_tokens": video_tokens,
                },
            )
        except (requests.RequestException, ValueError, TypeError, OSError) as error:
            send_json(self, 500, {"status": "error", "error": f"诊断失败: {str(error)}"})
