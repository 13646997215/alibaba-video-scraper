import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urljoin

import requests

from api._common import read_json_body, send_json, set_cors_headers

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.scraper import AlibabaVideoScraper


def normalize_input_url(url: str) -> str:
    value = (url or "").strip()
    if not value:
        return ""
    if not value.startswith(("http://", "https://")):
        value = "https://" + value
    return value


def normalize_video_url(video_url: str, page_url: str) -> str:
    value = (video_url or "").strip()
    if not value:
        return ""
    if value.startswith("//"):
        return "https:" + value
    if value.startswith("/"):
        return urljoin(page_url, value)
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
            scraper = AlibabaVideoScraper()
            html = scraper.fetch_page(page_url)
            if not html:
                send_json(self, 400, {"status": "error", "error": "页面获取失败，请检查链接是否可访问"})
                return

            scraper.extract_videos_from_html(html)
            videos = []
            for item in scraper.video_urls:
                normalized = normalize_video_url(item, page_url)
                if normalized.startswith("http") and normalized not in videos:
                    videos.append(normalized)

            if not videos:
                send_json(self, 404, {"status": "error", "error": "未找到可下载视频，请尝试其他商品页"})
                return

            send_json(
                self,
                200,
                {
                    "status": "success",
                    "message": f"找到 {len(videos)} 个视频",
                    "videos": videos,
                    "count": len(videos),
                },
            )
        except (requests.RequestException, ValueError, TypeError, RuntimeError, OSError) as error:
            send_json(self, 500, {"status": "error", "error": f"爬取失败: {str(error)}"})
