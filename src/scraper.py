import json
import re
import time
from html import unescape

import requests
from bs4 import BeautifulSoup

from src.config import CHUNK_SIZE, DOWNLOAD_DIR, REQUEST_TIMEOUT, USER_AGENT


class AlibabaVideoScraper:
    def __init__(self):
        self.video_urls = []
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                "Connection": "keep-alive",
                "Referer": "https://www.alibaba.com/",
            }
        )

    @staticmethod
    def _normalize_video_url(url):
        value = (url or "").strip().replace("\\/", "/")
        if not value:
            return ""
        if value.startswith("//"):
            return f"https:{value}"
        return value

    def _append_video_url(self, url):
        normalized = self._normalize_video_url(url)
        if not normalized:
            return
        if normalized.startswith("http") and normalized not in self.video_urls:
            self.video_urls.append(normalized)

    def _append_candidate(self, candidate: str):
        if not candidate:
            return
        value = unescape(candidate).strip().replace("\\u002F", "/").replace("\\/", "/")
        self._append_video_url(value)

    @staticmethod
    def detect_anti_bot_page(html: str) -> bool:
        content = (html or "").lower()
        signals = [
            "punish-component",
            "sufei-punish",
            "awsc.js",
            "captcha",
            "x5sec",
            "lib-windvane",
            "deny",
        ]
        return sum(1 for signal in signals if signal in content) >= 3

    def fetch_page(self, url):
        print(f"正在获取页面: {url}")
        try:
            response = self._safe_get(url, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            response.encoding = "utf-8"
            html = response.text

            if self.detect_anti_bot_page(html):
                print("! 检测到反爬校验页，尝试预热会话并重试一次")
                self._warm_up_session()
                retry_response = self._safe_get(url, timeout=REQUEST_TIMEOUT)
                retry_response.raise_for_status()
                retry_response.encoding = "utf-8"
                html = retry_response.text

            print("✓ 页面获取成功")
            return html
        except requests.RequestException as error:
            print(f"✗ 页面获取失败: {error}")
            return None

    def _warm_up_session(self):
        warmup_urls = [
            "https://www.alibaba.com/",
            "https://www.alibaba.com/trade/search?fsb=y&IndexArea=product_en&SearchText=sunglasses",
        ]
        for warmup_url in warmup_urls:
            try:
                resp = self._safe_get(warmup_url, timeout=min(12, REQUEST_TIMEOUT))
                _ = resp.text
            except requests.RequestException:
                continue

    def _safe_get(self, url, **kwargs):
        try:
            return self.session.get(url, **kwargs)
        except requests.exceptions.SSLError:
            print("! 证书校验失败，已切换兼容模式重试")
            return self.session.get(url, verify=False, **kwargs)

    def extract_videos_from_html(self, html):
        print("正在提取视频 URL...")
        self.video_urls = []
        soup = BeautifulSoup(html, "html.parser")

        videos = soup.find_all("video")
        print(f"找到 {len(videos)} 个 <video> 标签")
        for video in videos:
            src = video.get("src")
            if src:
                self._append_video_url(src)
            for source in video.find_all("source"):
                source_src = source.get("src")
                if source_src:
                    self._append_video_url(source_src)

        print("\n正在从页面 JSON 中提取视频...")
        script_tags = soup.find_all("script", type="application/json")
        for script in script_tags:
            try:
                if not script.string:
                    continue
                data = json.loads(script.string)
                self._extract_from_json(data)
            except (TypeError, ValueError, json.JSONDecodeError):
                continue

        print("\n正在用正则表达式查找视频...")
        patterns = [
            r'https?://[^\s"\'<>]+\.(?:mp4|webm|ogg|mov)',
            r'"videoUrl"\s*:\s*"([^"]+)"',
            r'"video"\s*:\s*"([^"]+)"',
            r'"playUrl"\s*:\s*"([^"]+)"',
            r'"previewVideoUrl"\s*:\s*"([^"]+)"',
            r'"mediaUrl"\s*:\s*"([^"]+)"',
            r'src=[\'\"](https?://[^\'\"]+\.(?:mp4|webm|ogg|mov))[\'\"]',
            r'https?:\\/\\/[^\s"\'<>]+\.(?:mp4|webm|ogg|mov)',
            r'\\"videoUrl\\"\s*:\s*\\"([^\\"]+)\\"',
            r'\\"playUrl\\"\s*:\s*\\"([^\\"]+)\\"',
            r'\\"previewVideoUrl\\"\s*:\s*\\"([^\\"]+)\\"',
            r'\\"mediaUrl\\"\s*:\s*\\"([^\\"]+)\\"',
        ]

        for pattern in patterns:
            for match in re.findall(pattern, html):
                candidate = match if isinstance(match, str) else match[0]
                self._append_candidate(candidate)

        compact = html.replace("\\n", " ")
        for key in ["videoUrl", "playUrl", "previewVideoUrl", "mediaUrl"]:
            quoted_pattern = rf"{key}\\u0022:\\u0022([^\\u0022]+(?:\\.mp4|\\.webm|\\.ogg|\\.mov)[^\\u0022]*)"
            for match in re.findall(quoted_pattern, compact):
                self._append_candidate(match)

        if not self.video_urls:
            print("✗ 未找到视频 URL")
            return False

        print(f"\n✓ 共找到 {len(self.video_urls)} 个视频")
        return True

    def _extract_from_json(self, obj, depth=0):
        if depth > 10:
            return

        if isinstance(obj, dict):
            for key, value in obj.items():
                if key.lower() in ["video", "videourl", "url", "src", "source", "playurl"]:
                    if isinstance(value, str):
                        normalized = self._normalize_video_url(value)
                        if normalized.endswith((".mp4", ".webm", ".ogg", ".mov")):
                            self._append_video_url(normalized)
                self._extract_from_json(value, depth + 1)
        elif isinstance(obj, list):
            for item in obj:
                self._extract_from_json(item, depth + 1)

    def download_video(self, video_url, filename):
        try:
            print(f"\n正在下载: {filename}")
            response = self._safe_get(video_url, timeout=REQUEST_TIMEOUT, stream=True)
            response.raise_for_status()

            total_size = int(response.headers.get("content-length", 0))
            downloaded_size = 0
            filepath = DOWNLOAD_DIR / filename

            with open(filepath, "wb") as file_handler:
                for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
                    if chunk:
                        file_handler.write(chunk)
                        downloaded_size += len(chunk)
                        if total_size > 0:
                            progress = (downloaded_size / total_size) * 100
                            print(f"  进度: {progress:.1f}% ({downloaded_size}/{total_size} bytes)", end="\r")

            print(f"\n✓ 下载完成: {filepath}")
            return True
        except requests.RequestException as error:
            print(f"\n✗ 下载失败: {error}")
            return False

    def download_all_videos(self):
        if not self.video_urls:
            print("没有可下载的视频")
            return False

        print(f"\n{'=' * 60}")
        print(f"开始下载 {len(self.video_urls)} 个视频...")
        print(f"{'=' * 60}\n")

        success_count = 0
        for index, video_url in enumerate(self.video_urls, 1):
            if self.download_video(video_url, f"video_{index}.mp4"):
                success_count += 1
            time.sleep(1)

        print(f"\n{'=' * 60}")
        print(f"下载完成！成功: {success_count}/{len(self.video_urls)}")
        print(f"{'=' * 60}")

        return success_count > 0

    def scrape(self, url):
        try:
            html = self.fetch_page(url)
            if not html:
                return False

            if not self.extract_videos_from_html(html):
                return False

            if not self.download_all_videos():
                return False

            return True
        except (requests.RequestException, RuntimeError, OSError, ValueError) as error:
            print(f"爬取过程出错: {error}")
            return False