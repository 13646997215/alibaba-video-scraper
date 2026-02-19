import base64
import io
import re
import zipfile
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, request
from flask_cors import CORS

from src.resource_extractor import extract_resources_from_html
from src.scraper import AlibabaVideoScraper

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})


@app.after_request
def add_common_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    return response


def safe_requests_get(url: str, **kwargs):
    timeout = kwargs.pop("timeout", 30)
    try:
        return requests.get(url, timeout=timeout, **kwargs)
    except requests.exceptions.SSLError:
        return requests.get(url, timeout=timeout, verify=False, **kwargs)


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

    page_title = ""
    try:
        title_node = BeautifulSoup(html, "html.parser").title
        page_title = title_node.get_text(strip=True) if title_node else ""
    except (TypeError, ValueError, AttributeError):
        page_title = ""

    scraper.extract_videos_from_html(html)
    videos = []
    for item in scraper.video_urls:
        normalized = normalize_video_url(item, page_url)
        if normalized.startswith("http") and normalized not in videos:
            videos.append(normalized)

    if not videos:
        resources = extract_resources_from_html(html, page_url)
        videos = [item.get("url") for item in resources.get("videos", []) if isinstance(item, dict)]

    if not videos:
        return jsonify(
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
                ],
            }
        )

    return jsonify(
        {
            "status": "success",
            "message": f"找到 {len(videos)} 个视频",
            "videos": videos,
            "count": len(videos),
            "page_title": page_title,
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
                response = safe_requests_get(video_url, timeout=30)
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


@app.post("/api/extract")
def extract_resources():
    payload = request.get_json(silent=True) or {}
    page_url = normalize_input_url(payload.get("url", ""))
    if not page_url:
        return jsonify({"status": "error", "error": "URL 不能为空"}), 400

    try:
        response = safe_requests_get(page_url, timeout=30)
        response.raise_for_status()
        resources = extract_resources_from_html(response.text, response.url or page_url)
        counts = {key: len(value) for key, value in resources.items()}
        return jsonify(
            {
                "status": "success",
                "message": "资源提取完成",
                "resources": resources,
                "counts": counts,
                "total": sum(counts.values()),
            }
        )
    except requests.RequestException as error:
        return jsonify({"status": "error", "error": f"提取失败: {str(error)}"}), 500


@app.post("/api/diag")
def diag_target():
    payload = request.get_json(silent=True) or {}
    target = normalize_input_url(payload.get("url", ""))
    if not target:
        return jsonify({"status": "error", "error": "url 不能为空"}), 400

    try:
        response = safe_requests_get(target, timeout=20)
        return jsonify(
            {
                "status": "success",
                "message": "诊断完成",
                "target": target,
                "final_url": response.url or target,
                "status_code": response.status_code,
                "content_type": response.headers.get("Content-Type", ""),
                "server": response.headers.get("Server", ""),
                "content_length": response.headers.get("Content-Length", ""),
                "environment": "local-flask",
            }
        )
    except requests.RequestException as error:
        return jsonify({"status": "error", "error": f"诊断失败: {str(error)}"}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
