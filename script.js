function resolveApiBase() {
  const params = new URLSearchParams(window.location.search);
  const customApi = params.get("api");
  if (customApi) return customApi.replace(/\/$/, "");
  if (window.location.protocol === "file:") return "http://127.0.0.1:5000/api";
  return "/api";
}

const API_BASE = resolveApiBase();
const STORAGE_KEY = "alibaba_video_scraper_recent_urls";

const urlInput = document.getElementById("urlInput");
const scrapeBtn = document.getElementById("scrapeBtn");
const clearUrlBtn = document.getElementById("clearUrlBtn");
const pasteUrlBtn = document.getElementById("pasteUrlBtn");
const sampleUrlBtn = document.getElementById("sampleUrlBtn");

const statusSection = document.getElementById("statusSection");
const statusIcon = document.getElementById("statusIcon");
const statusText = document.getElementById("statusText");
const progressFill = document.getElementById("progressFill");
const statusMessage = document.getElementById("statusMessage");

const videosSection = document.getElementById("videosSection");
const videosList = document.getElementById("videosList");
const downloadAllBtn = document.getElementById("downloadAllBtn");
const downloadSelectedBtn = document.getElementById("downloadSelectedBtn");
const videoCountPill = document.getElementById("videoCountPill");
const runtimeHint = document.getElementById("runtimeHint");
const recentUrls = document.getElementById("recentUrls");
const filterInput = document.getElementById("filterInput");
const selectAllBtn = document.getElementById("selectAllBtn");
const invertSelectBtn = document.getElementById("invertSelectBtn");
const copyAllBtn = document.getElementById("copyAllBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const resultStats = document.getElementById("resultStats");

const previewModal = document.getElementById("previewModal");
const previewPlayer = document.getElementById("previewPlayer");
const previewUrl = document.getElementById("previewUrl");
const closePreviewBtn = document.getElementById("closePreviewBtn");

let currentVideos = [];
let lastScrapePayload = null;

scrapeBtn.addEventListener("click", handleScrape);
downloadAllBtn.addEventListener("click", () => handlePackageDownload(false));
downloadSelectedBtn.addEventListener("click", () => handlePackageDownload(true));
clearUrlBtn.addEventListener("click", () => {
  urlInput.value = "";
  urlInput.focus();
});

pasteUrlBtn.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) urlInput.value = text.trim();
  } catch {
    showToast("✗ 无法读取剪贴板，请手动粘贴");
  }
});

sampleUrlBtn.addEventListener("click", () => {
  urlInput.value = "https://www.alibaba.com/product-detail/Custom-Wholesale-Metal-Rimless-Sunglasses-wi_1601333000000.html";
});

urlInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter") handleScrape();
});

window.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key === "Enter") handleScrape();
});

filterInput.addEventListener("input", renderVideos);
selectAllBtn.addEventListener("click", () => {
  currentVideos.forEach((item) => {
    if (isVisibleByFilter(item)) item.selected = true;
  });
  renderVideos();
});
invertSelectBtn.addEventListener("click", () => {
  currentVideos.forEach((item) => {
    if (isVisibleByFilter(item)) item.selected = !item.selected;
  });
  renderVideos();
});
copyAllBtn.addEventListener("click", copyAllLinks);
exportJsonBtn.addEventListener("click", exportJsonReport);
closePreviewBtn.addEventListener("click", closePreview);
previewModal.addEventListener("click", (event) => {
  if (event.target === previewModal) closePreview();
});

bootstrapRuntimeDiagnostics();
renderRecentUrls();

function showToast(message) {
  window.alert(message);
}

function setSectionVisible(element, visible) {
  element.hidden = !visible;
}

function updateStatus(type, icon, title, message, progress) {
  statusSection.classList.remove("status-success", "status-error");
  if (type === "success") statusSection.classList.add("status-success");
  if (type === "error") statusSection.classList.add("status-error");

  statusIcon.textContent = icon;
  statusText.textContent = title;
  statusMessage.textContent = message;
  progressFill.style.width = `${Math.max(0, Math.min(progress, 100))}%`;
  setSectionVisible(statusSection, true);
}

function ensureValidUrl(url) {
  if (!url) return false;
  return /alibaba\.com|1688\.com/i.test(url);
}

function sanitizeUrl(value) {
  const raw = (value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function getRecentUrls() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecentUrl(url) {
  const list = getRecentUrls().filter((item) => item !== url);
  list.unshift(url);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 8)));
  renderRecentUrls();
}

function renderRecentUrls() {
  const list = getRecentUrls();
  recentUrls.innerHTML = "";
  setSectionVisible(recentUrls, list.length > 0);
  list.forEach((url) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "recent-chip";
    chip.textContent = url;
    chip.title = url;
    chip.addEventListener("click", () => {
      urlInput.value = url;
      urlInput.focus();
    });
    recentUrls.appendChild(chip);
  });
}

function buildVideoObject(url, index) {
  return {
    id: `${index + 1}-${Date.now()}`,
    index,
    url,
    selected: true,
    length: url.length,
  };
}

function isVisibleByFilter(item) {
  const keyword = filterInput.value.trim().toLowerCase();
  if (!keyword) return true;
  return item.url.toLowerCase().includes(keyword);
}

function updateResultStats() {
  const selectedCount = currentVideos.filter((item) => item.selected).length;
  const visibleCount = currentVideos.filter((item) => isVisibleByFilter(item)).length;
  const lastTime = lastScrapePayload?.time || "-";
  resultStats.textContent = `总数 ${currentVideos.length} · 已选 ${selectedCount} · 当前筛选 ${visibleCount} · 最近解析 ${lastTime}`;
}

function buildVideoRow(item) {
  const wrapper = document.createElement("div");
  wrapper.className = `video-item${item.selected ? " selected" : ""}`;

  const main = document.createElement("div");
  main.className = "video-main";

  const check = document.createElement("input");
  check.type = "checkbox";
  check.className = "video-check";
  check.checked = !!item.selected;
  check.addEventListener("change", () => {
    item.selected = check.checked;
    renderVideos();
  });

  const info = document.createElement("div");
  info.className = "video-info";

  const title = document.createElement("div");
  title.className = "video-title";
  title.textContent = `视频 ${item.index + 1}`;

  const urlText = document.createElement("div");
  urlText.className = "video-url";
  urlText.textContent = item.url;
  urlText.title = item.url;

  info.appendChild(title);
  info.appendChild(urlText);

  main.appendChild(check);
  main.appendChild(info);

  const actions = document.createElement("div");
  actions.className = "video-actions";

  const previewBtn = document.createElement("button");
  previewBtn.className = "btn btn-soft";
  previewBtn.textContent = "预览";
  previewBtn.addEventListener("click", () => openPreview(item.url));

  const copyBtn = document.createElement("button");
  copyBtn.className = "btn btn-soft";
  copyBtn.textContent = "复制";
  copyBtn.addEventListener("click", () => copyText(item.url));

  const downloadBtn = document.createElement("button");
  downloadBtn.className = "btn btn-primary";
  downloadBtn.textContent = "下载";
  downloadBtn.addEventListener("click", () => {
    window.open(item.url, "_blank", "noopener,noreferrer");
  });

  actions.appendChild(previewBtn);
  actions.appendChild(copyBtn);
  actions.appendChild(downloadBtn);

  wrapper.appendChild(main);
  wrapper.appendChild(actions);
  return wrapper;
}

function renderVideos() {
  videosList.innerHTML = "";
  const visibleItems = currentVideos.filter((item) => isVisibleByFilter(item));
  visibleItems.forEach((item) => videosList.appendChild(buildVideoRow(item)));

  videoCountPill.textContent = `${currentVideos.length} 个视频`;
  setSectionVisible(videosSection, currentVideos.length > 0);
  setSectionVisible(downloadAllBtn, currentVideos.length > 0);
  updateResultStats();
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
  const envLabel = window.location.protocol === "file:" ? "本地文件模式" : "网页模式";
  runtimeHint.textContent = ` 当前模式：${envLabel} · API：${API_BASE}`;
  try {
    await requestJson(`${API_BASE}/health`, { method: "GET" });
    runtimeHint.textContent += " · 连接正常 ✓";
  } catch {
    runtimeHint.textContent += " · API 未连接";
  }
}

async function handleScrape() {
  const url = sanitizeUrl(urlInput.value);
  urlInput.value = url;

  if (!url) {
    showToast("请输入商品页面 URL");
    return;
  }
  if (!ensureValidUrl(url)) {
    showToast("请粘贴阿里巴巴或 1688 商品链接");
    return;
  }

  scrapeBtn.disabled = true;
  currentVideos = [];
  renderVideos();

  updateStatus("loading", "⏳", "正在爬取", "正在抓取并解析页面视频资源...", 30);

  try {
    const data = await requestJson(`${API_BASE}/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    saveRecentUrl(url);
    const videos = Array.isArray(data.videos) ? data.videos : [];
    currentVideos = videos.map((item, index) => buildVideoObject(item, index));
    lastScrapePayload = {
      time: new Date().toLocaleString(),
      pageTitle: data.page_title || "",
      count: currentVideos.length,
    };

    renderVideos();

    if (currentVideos.length === 0) {
      updateStatus("error", "⚠", "未找到视频", data.message || "该页面没有可下载视频", 100);
      return;
    }

    updateStatus("success", "✓", "解析完成", `找到 ${currentVideos.length} 个视频，支持筛选、选择、预览和打包。`, 100);
  } catch (error) {
    updateStatus("error", "✗", "爬取失败", error.message, 0);
  } finally {
    scrapeBtn.disabled = false;
  }
}

function selectedVideos() {
  return currentVideos.filter((item) => item.selected);
}

async function handlePackageDownload(onlySelected) {
  const target = onlySelected ? selectedVideos() : currentVideos;
  if (target.length === 0) {
    showToast(onlySelected ? "请先勾选要打包的视频" : "没有可打包的视频");
    return;
  }

  downloadAllBtn.disabled = true;
  downloadSelectedBtn.disabled = true;
  updateStatus("loading", "⏳", "正在打包", `服务器正在打包 ${target.length} 个视频，请稍候...`, 65);

  try {
    const data = await requestJson(`${API_BASE}/package`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videos: target }),
    });

    if (!data.zip_data) throw new Error("未生成可下载压缩包");

    const link = document.createElement("a");
    link.href = `data:application/zip;base64,${data.zip_data}`;
    link.download = data.filename || "alibaba_videos.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    updateStatus("success", "✓", "打包完成", data.message || "压缩包下载已开始", 100);
  } catch (error) {
    updateStatus("error", "✗", "打包失败", error.message, 0);
  } finally {
    downloadAllBtn.disabled = false;
    downloadSelectedBtn.disabled = false;
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("✓ 已复制");
  } catch {
    showToast("✗ 复制失败");
  }
}

function copyAllLinks() {
  if (currentVideos.length === 0) {
    showToast("没有可复制的视频链接");
    return;
  }
  const content = currentVideos.map((item) => item.url).join("\n");
  copyText(content);
}

function exportJsonReport() {
  if (currentVideos.length === 0) {
    showToast("没有可导出的结果");
    return;
  }

  const payload = {
    generated_at: new Date().toISOString(),
    api_base: API_BASE,
    total: currentVideos.length,
    selected: selectedVideos().length,
    page_title: lastScrapePayload?.pageTitle || "",
    videos: currentVideos,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "video_report.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function openPreview(url) {
  previewPlayer.src = url;
  previewUrl.textContent = url;
  setSectionVisible(previewModal, true);
}

function closePreview() {
  previewPlayer.pause();
  previewPlayer.src = "";
  setSectionVisible(previewModal, false);
}
