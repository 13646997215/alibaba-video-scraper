import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from api._common import read_json_body, safe_requests_get, send_json, set_cors_headers

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.scraper import AlibabaVideoScraper
from src.resource_extractor import extract_resources_from_html


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
            page_title = ""
            try:
                title_node = BeautifulSoup(html, "html.parser").title
                page_title = (title_node.get_text(strip=True) if title_node else "")
            except (TypeError, ValueError, AttributeError):
                page_title = ""

            if scraper.detect_anti_bot_page(html):
                send_json(
                    self,
                    423,
                    {
                        "status": "error",
                        "error": "目标站触发反爬校验页（Captcha/Punish），当前请求环境无法直接提取视频。",
                        "code": "ANTI_BOT_BLOCKED",
                        "tips": [
                            "请稍后重试，或更换网络出口",
                            "可先用全资源模式确认页面是否仅返回校验内容",
                            "若 Vercel 失败但浏览器可看视频，通常是机房 IP 被风控",
                        ],
                        "debug": {
                            "environment": "vercel-serverless",
                            "page_title": page_title,
                        },
                    },
                )
                return

            videos = []
            for item in scraper.video_urls:
                normalized = normalize_video_url(item, page_url)
                if normalized.startswith("http") and normalized not in videos:
                    videos.append(normalized)

            if not videos:
                extracted = extract_resources_from_html(html, page_url)
                videos = [item["url"] for item in extracted.get("videos", []) if isinstance(item, dict)]

            if not videos:
                try:
                    fallback_response = safe_requests_get(page_url, timeout=25)
                    fallback_response.raise_for_status()
                    fallback_resources = extract_resources_from_html(
                        fallback_response.text,
                        fallback_response.url or page_url,
                    )
                    videos = [
                        item["url"]
                        for item in fallback_resources.get("videos", [])
                        if isinstance(item, dict)
                    ]
                except requests.RequestException:
                    pass

            if not videos:
                send_json(
                    self,
                    200,
                    {
                        "status": "success",
                        "message": "页面已解析，但未找到可下载视频",
                        "videos": [],
                        "count": 0,
                        "page_title": page_title,
                        "tips": [
                            "请确认链接是商品详情页，而不是搜索页或店铺首页",
                            "请尝试更换其他商品链接",
                            "部分商品视频可能由前端动态加密加载",
                            "如仅 Vercel 失败，通常是目标站点对机房 IP 有风控限制",
                        ],
                        "debug": {
                            "environment": "vercel-serverless",
                            "hint": "可优先尝试全资源模式，或使用其他商品链接",
                        },
                    },
                )
                return

            send_json(
                self,
                200,
                {
                    "status": "success",
                    "message": f"找到 {len(videos)} 个视频",
                    "videos": videos,
                    "count": len(videos),
                    "page_title": page_title,
                    "debug": {"environment": "vercel-serverless"},
                },
            )
        except (requests.RequestException, ValueError, TypeError, RuntimeError, OSError) as error:
            send_json(self, 500, {"status": "error", "error": f"爬取失败: {str(error)}"})
