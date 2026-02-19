import base64
import io
import re
import zipfile
from urllib.parse import urljoin

import requests
from flask import Flask, jsonify, request

from src.scraper import AlibabaVideoScraper

app = Flask(__name__)


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


def filename_from_url(video_url: str, index: int) -> str:
    match = re.search(r"([^/?#]+)(?:\?.*)?$", video_url)
    filename = match.group(1) if match else f"video_{index}.mp4"
    if "." not in filename:
        filename = f"{filename}.mp4"
    filename = re.sub(r"[^a-zA-Z0-9._-]", "_", filename)
    return f"{index:02d}_{filename}"


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "message": "Alibaba Video Scraper API is running"})


@app.post("/api/scrape")
def scrape():
    payload = request.get_json(silent=True) or {}
    page_url = normalize_input_url(payload.get("url", ""))
    if not page_url:
        return jsonify({"status": "error", "error": "URL 不能为空"}), 400

    scraper = AlibabaVideoScraper()
    html = scraper.fetch_page(page_url)
    if not html:
        return jsonify({"status": "error", "error": "页面获取失败，请检查链接是否可访问"}), 400

    scraper.extract_videos_from_html(html)
    videos = []
    for item in scraper.video_urls:
        normalized = normalize_video_url(item, page_url)
        if normalized.startswith("http") and normalized not in videos:
            videos.append(normalized)

    if not videos:
        return jsonify({"status": "error", "error": "未找到可下载视频，请尝试其他商品页"}), 404

    return jsonify(
        {
            "status": "success",
            "message": f"找到 {len(videos)} 个视频",
            "videos": videos,
            "count": len(videos),
        }
    )


@app.post("/api/package")
def package():
    payload = request.get_json(silent=True) or {}
    videos = payload.get("videos", [])
    if not isinstance(videos, list) or len(videos) == 0:
        return jsonify({"status": "error", "error": "没有视频可打包"}), 400

    zip_buffer = io.BytesIO()
    success_count = 0

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for index, video_url in enumerate(videos, start=1):
            if not isinstance(video_url, str) or not video_url.startswith(("http://", "https://")):
                continue
            try:
                response = requests.get(video_url, timeout=30)
                response.raise_for_status()
                zip_file.writestr(filename_from_url(video_url, index), response.content)
                success_count += 1
            except requests.RequestException:
                continue

    if success_count == 0:
        return jsonify({"status": "error", "error": "所有视频下载失败，无法打包"}), 500

    zip_buffer.seek(0)
    zip_base64 = base64.b64encode(zip_buffer.getvalue()).decode("utf-8")
    return jsonify(
        {
            "status": "success",
            "message": f"打包完成，成功 {success_count}/{len(videos)}",
            "zip_data": zip_base64,
            "filename": "alibaba_videos.zip",
            "success_count": success_count,
            "total_count": len(videos),
        }
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
