from pathlib import Path

# 项目根目录
BASE_DIR = Path(__file__).parent.parent

# 视频保存目录（Vercel 无服务器环境优先使用 /tmp）
SERVERLESS_TMP_DIR = Path("/tmp/downloads")
LOCAL_DOWNLOAD_DIR = BASE_DIR / "downloads"


def _resolve_download_dir() -> Path:
    for candidate in (SERVERLESS_TMP_DIR, LOCAL_DOWNLOAD_DIR):
        try:
            candidate.mkdir(parents=True, exist_ok=True)
            return candidate
        except OSError:
            continue
    return LOCAL_DOWNLOAD_DIR


DOWNLOAD_DIR = _resolve_download_dir()

# 浏览器配置
BROWSER_TIMEOUT = 10  # 页面加载超时时间（秒）
WAIT_TIME = 5  # 等待视频加载的时间（秒）

# 请求配置
REQUEST_TIMEOUT = 30  # 下载超时时间（秒）
CHUNK_SIZE = 8192  # 下载块大小（字节）

# User-Agent（模拟真实浏览器）
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
