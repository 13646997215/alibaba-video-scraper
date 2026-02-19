function resolveApiBase() {
  const params = new URLSearchParams(window.location.search);
  const customApi = params.get("api");
  if (customApi) {
    return customApi.replace(/\/$/, "");
  }

  if (window.location.protocol === "file:") {
    return "http://127.0.0.1:5000/api";
  }

  return "/api";
}

const API_BASE = resolveApiBase();

const urlInput = document.getElementById("urlInput");
const scrapeBtn = document.getElementById("scrapeBtn");
const statusSection = document.getElementById("statusSection");
const statusIcon = document.getElementById("statusIcon");
const statusText = document.getElementById("statusText");
const progressFill = document.getElementById("progressFill");
const statusMessage = document.getElementById("statusMessage");
const videosSection = document.getElementById("videosSection");
const videosList = document.getElementById("videosList");
const downloadAllBtn = document.getElementById("downloadAllBtn");
const videoCountPill = document.getElementById("videoCountPill");
const runtimeHint = document.getElementById("runtimeHint");

let currentVideos = [];

scrapeBtn.addEventListener("click", handleScrape);
downloadAllBtn.addEventListener("click", handlePackageDownload);
urlInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter") {
    handleScrape();
  }
});

bootstrapRuntimeDiagnostics();

function showToast(message) {
  window.alert(message);
}

function setSectionVisible(element, visible) {
  element.hidden = !visible;
}

function updateStatus(type, icon, title, message, progress) {
  statusSection.classList.remove("status-success", "status-error");
  if (type === "success") {
    statusSection.classList.add("status-success");
  }
  if (type === "error") {
    statusSection.classList.add("status-error");
  }

  statusIcon.textContent = icon;
  statusText.textContent = title;
  statusMessage.textContent = message;
  progressFill.style.width = `${Math.max(0, Math.min(progress, 100))}%`;
  setSectionVisible(statusSection, true);
}

function ensureValidUrl(url) {
  if (!url) {
    return false;
  }
  return /alibaba\.com|1688\.com/i.test(url);
}

function buildVideoRow(videoUrl, index) {
  const item = document.createElement("div");
  item.className = "video-item";

  const info = document.createElement("div");
  info.className = "video-info";

  const title = document.createElement("div");
  title.className = "video-title";
  title.textContent = `视频 ${index + 1}`;

  const urlText = document.createElement("div");
  urlText.className = "video-url";
  urlText.textContent = videoUrl;
  urlText.title = videoUrl;

  info.appendChild(title);
  info.appendChild(urlText);

  const actions = document.createElement("div");
  actions.className = "video-actions";

  const copyBtn = document.createElement("button");
  copyBtn.className = "btn btn-soft";
  copyBtn.textContent = "复制链接";
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(videoUrl);
      showToast("✓ 已复制链接");
    } catch {
      showToast("✗ 复制失败，请手动复制");
    }
  });

  const downloadBtn = document.createElement("button");
  downloadBtn.className = "btn btn-primary";
  downloadBtn.textContent = "下载";
  downloadBtn.addEventListener("click", () => {
    window.open(videoUrl, "_blank", "noopener,noreferrer");
  });

  actions.appendChild(copyBtn);
  actions.appendChild(downloadBtn);

  item.appendChild(info);
  item.appendChild(actions);

  return item;
}

function renderVideos(videos) {
  videosList.innerHTML = "";

  videos.forEach((videoUrl, index) => {
    videosList.appendChild(buildVideoRow(videoUrl, index));
  });

  videoCountPill.textContent = `${videos.length} 个视频`;
  setSectionVisible(videosSection, videos.length > 0);
  setSectionVisible(downloadAllBtn, videos.length > 0);
}

async function requestJson(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error(getNetworkErrorMessage());
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.error || data.message || "请求失败";
    throw new Error(message);
  }

  return data;
}

function getNetworkErrorMessage() {
  if (window.location.protocol === "file:") {
    return `接口不可达。请先启动本地 API：${API_BASE}/health`;
  }
  return "接口不可达，请检查网络或后端服务状态";
}

async function bootstrapRuntimeDiagnostics() {
  if (!runtimeHint) {
    return;
  }

  const envLabel =
    window.location.protocol === "file:" ? "本地文件模式" : "网页模式";
  runtimeHint.textContent = ` 当前模式：${envLabel} · API：${API_BASE}`;

  try {
    await requestJson(`${API_BASE}/health`, { method: "GET" });
    runtimeHint.textContent += " · 连接正常 ✓";
  } catch {
    runtimeHint.textContent += " · API 未连接";
  }
}

async function handleScrape() {
  const url = urlInput.value.trim();

  if (!url) {
    showToast("请输入商品页面 URL");
    return;
  }

  if (!ensureValidUrl(url)) {
    showToast("请粘贴阿里巴巴或 1688 商品链接");
    return;
  }

  scrapeBtn.disabled = true;
  setSectionVisible(videosSection, false);
  setSectionVisible(downloadAllBtn, false);
  currentVideos = [];

  updateStatus(
    "loading",
    "⏳",
    "正在爬取",
    "正在抓取并解析页面视频资源...",
    28,
  );

  try {
    const data = await requestJson(`${API_BASE}/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    const videos = Array.isArray(data.videos) ? data.videos : [];
    currentVideos = videos;
    renderVideos(videos);

    updateStatus(
      "success",
      "✓",
      "解析完成",
      `找到 ${videos.length} 个视频，点击右下角可一键打包下载。`,
      100,
    );
  } catch (error) {
    updateStatus("error", "✗", "爬取失败", error.message, 0);
  } finally {
    scrapeBtn.disabled = false;
  }
}

async function handlePackageDownload() {
  if (currentVideos.length === 0) {
    showToast("没有可打包的视频");
    return;
  }

  downloadAllBtn.disabled = true;
  downloadAllBtn.textContent = "⏳ 正在打包...";
  updateStatus(
    "loading",
    "⏳",
    "正在打包",
    "服务器正在下载并压缩视频，请稍候...",
    60,
  );

  try {
    const data = await requestJson(`${API_BASE}/package`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ videos: currentVideos }),
    });

    if (!data.zip_data) {
      throw new Error("未生成可下载压缩包");
    }

    const link = document.createElement("a");
    link.href = `data:application/zip;base64,${data.zip_data}`;
    link.download = data.filename || "alibaba_videos.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    updateStatus(
      "success",
      "✓",
      "打包完成",
      data.message || "压缩包下载已开始",
      100,
    );
    showToast("✓ ZIP 下载已开始，请查看浏览器下载列表");
  } catch (error) {
    updateStatus("error", "✗", "打包失败", error.message, 0);
    showToast(`✗ ${error.message}`);
  } finally {
    downloadAllBtn.disabled = false;
    downloadAllBtn.textContent = "📦 打包下载全部";
  }
}
