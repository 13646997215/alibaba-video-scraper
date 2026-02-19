import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup


VIDEO_EXT = (".mp4", ".webm", ".ogg", ".mov", ".m3u8")
IMAGE_EXT = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".avif")
AUDIO_EXT = (".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg")
FILE_EXT = (
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".zip",
    ".rar",
    ".7z",
    ".txt",
    ".csv",
    ".json",
)


def _norm(url: str, base_url: str) -> str:
    value = (url or "").strip().replace("\\/", "/")
    if not value:
        return ""
    if value.startswith("//"):
        value = "https:" + value
    elif value.startswith("/"):
        value = urljoin(base_url, value)
    elif not value.startswith(("http://", "https://")):
        value = urljoin(base_url, value)
    return value


def _is_file_type(url: str, suffixes: tuple[str, ...]) -> bool:
    lower = url.lower().split("?")[0]
    return lower.endswith(suffixes)


def _append(result_list: list, seen: set, url: str):
    if url.startswith(("http://", "https://")) and url not in seen:
        seen.add(url)
        name = url.split("/")[-1].split("?")[0] or url
        result_list.append({"url": url, "name": name})


def extract_resources_from_html(html: str, page_url: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")

    videos, images, audios, files, folders = [], [], [], [], []
    seen_v, seen_i, seen_a, seen_f, seen_d = set(), set(), set(), set(), set()

    for video in soup.find_all("video"):
        for src in [video.get("src")] + [s.get("src") for s in video.find_all("source")]:
            url = _norm(src, page_url)
            if url:
                _append(videos, seen_v, url)

    for audio in soup.find_all("audio"):
        for src in [audio.get("src")] + [s.get("src") for s in audio.find_all("source")]:
            url = _norm(src, page_url)
            if url:
                _append(audios, seen_a, url)

    for img in soup.find_all("img"):
        for src in [img.get("src"), img.get("data-src"), img.get("data-original")]:
            url = _norm(src, page_url)
            if url:
                _append(images, seen_i, url)

    for link in soup.find_all("a"):
        href = _norm(link.get("href"), page_url)
        if not href:
            continue
        parsed = urlparse(href)
        if href.endswith("/") and parsed.netloc == urlparse(page_url).netloc:
            _append(folders, seen_d, href)
            continue
        if _is_file_type(href, FILE_EXT):
            _append(files, seen_f, href)
        elif _is_file_type(href, VIDEO_EXT):
            _append(videos, seen_v, href)
        elif _is_file_type(href, IMAGE_EXT):
            _append(images, seen_i, href)
        elif _is_file_type(href, AUDIO_EXT):
            _append(audios, seen_a, href)

    pattern = r'https?://[^\s"\'<>]+'
    for raw in re.findall(pattern, html):
        url = _norm(raw, page_url)
        if _is_file_type(url, VIDEO_EXT):
            _append(videos, seen_v, url)
        elif _is_file_type(url, IMAGE_EXT):
            _append(images, seen_i, url)
        elif _is_file_type(url, AUDIO_EXT):
            _append(audios, seen_a, url)
        elif _is_file_type(url, FILE_EXT):
            _append(files, seen_f, url)

    return {
        "videos": videos,
        "images": images,
        "audios": audios,
        "files": files,
        "folders": folders,
    }
