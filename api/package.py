import base64
import io
import json
import re
import zipfile
from http.server import BaseHTTPRequestHandler

import requests

from api._common import read_json_body, safe_requests_get, send_json, set_cors_headers


def filename_from_url(video_url: str, index: int) -> str:
    match = re.search(r"([^/?#]+)(?:\?.*)?$", video_url)
    filename = match.group(1) if match else f"video_{index}.mp4"
    if "." not in filename:
        filename = f"{filename}.mp4"
    filename = re.sub(r"[^a-zA-Z0-9._-]", "_", filename)
    return f"{index:02d}_{filename}"


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

        videos = payload.get("videos", [])
        if not isinstance(videos, list) or len(videos) == 0:
            send_json(self, 400, {"status": "error", "error": "没有视频可打包"})
            return

        normalized_videos = []
        for item in videos:
            if isinstance(item, str):
                normalized_videos.append(item)
            elif isinstance(item, dict) and isinstance(item.get("url"), str):
                normalized_videos.append(item.get("url"))

        if len(normalized_videos) == 0:
            send_json(self, 400, {"status": "error", "error": "没有有效视频链接可打包"})
            return

        try:
            zip_buffer = io.BytesIO()
            success_count = 0

            with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
                for index, video_url in enumerate(normalized_videos, start=1):
                    if not isinstance(video_url, str) or not video_url.startswith(("http://", "https://")):
                        continue
                    try:
                        response = safe_requests_get(video_url, timeout=30)
                        response.raise_for_status()
                        zip_file.writestr(filename_from_url(video_url, index), response.content)
                        success_count += 1
                    except requests.RequestException:
                        continue

            if success_count == 0:
                send_json(self, 500, {"status": "error", "error": "所有视频下载失败，无法打包"})
                return

            zip_buffer.seek(0)
            zip_base64 = base64.b64encode(zip_buffer.getvalue()).decode("utf-8")
            send_json(
                self,
                200,
                {
                    "status": "success",
                    "message": f"打包完成，成功 {success_count}/{len(normalized_videos)}",
                    "zip_data": zip_base64,
                    "filename": "alibaba_videos.zip",
                    "success_count": success_count,
                    "total_count": len(normalized_videos),
                },
            )
        except (requests.RequestException, ValueError, TypeError, RuntimeError, OSError) as error:
            send_json(self, 500, {"status": "error", "error": f"打包失败: {str(error)}"})
