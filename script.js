function resolveApiBase() {
  const params = new URLSearchParams(window.location.search);
  const customApi = params.get("api");
  if (customApi) return customApi.replace(/\/$/, "");
  if (window.location.protocol === "file:") return "http://127.0.0.1:5000/api";
  return "/api";
}

let API_BASE = resolveApiBase();
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
const modeSelect = document.getElementById("modeSelect");
const sortSelect = document.getElementById("sortSelect");
const selectAllBtn = document.getElementById("selectAllBtn");
const invertSelectBtn = document.getElementById("invertSelectBtn");
const deselectAllBtn = document.getElementById("deselectAllBtn");
const copyAllBtn = document.getElementById("copyAllBtn");
const copySelectedBtn = document.getElementById("copySelectedBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const exportTxtBtn = document.getElementById("exportTxtBtn");
const resultStats = document.getElementById("resultStats");
const resourceTypeStats = document.getElementById("resourceTypeStats");

const previewModal = document.getElementById("previewModal");
const previewPlayer = document.getElementById("previewPlayer");
const previewUrl = document.getElementById("previewUrl");
const closePreviewBtn = document.getElementById("closePreviewBtn");

let currentItems = [];
let lastSummary = { time: "-", title: "", counts: {} };

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

filterInput.addEventListener("input", renderItems);
modeSelect.addEventListener("change", () => {
  setSectionVisible(videosSection, false);
  currentItems = [];
  renderItems();
});
sortSelect.addEventListener("change", renderItems);

selectAllBtn.addEventListener("click", () => {
  currentItems.forEach((item) => {
    if (isVisibleByFilter(item)) item.selected = true;
  });
  renderItems();
});

invertSelectBtn.addEventListener("click", () => {
  currentItems.forEach((item) => {
    if (isVisibleByFilter(item)) item.selected = !item.selected;
  });
  renderItems();
});

deselectAllBtn.addEventListener("click", () => {
  currentItems.forEach((item) => (item.selected = false));
  renderItems();
});

copyAllBtn.addEventListener("click", () => copyLinks(currentItems));
copySelectedBtn.addEventListener("click", () => copyLinks(selectedItems()));
exportJsonBtn.addEventListener("click", exportJsonReport);
exportTxtBtn.addEventListener("click", exportTxtReport);
closePreviewBtn.addEventListener("click", closePreview);
previewModal.addEventListener("click", (event) => {
  if (event.target === previewModal) closePreview();
});

setSectionVisible(previewModal, false);
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

function sanitizeUrl(value) {
  const raw = (value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function ensureValidUrl(url) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
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

function normalizeType(type) {
  if (["videos", "video"].includes(type)) return "video";
  if (["images", "image"].includes(type)) return "image";
  if (["audios", "audio"].includes(type)) return "audio";
  if (["files", "file"].includes(type)) return "file";
  if (["folders", "folder"].includes(type)) return "folder";
  return "other";
}

function createItem(url, type, index, name = "") {
  return {
    id: `${type}-${index}-${Date.now()}`,
    index,
    url,
    type: normalizeType(type),
    name,
    selected: true,
  };
}

function isVisibleByFilter(item) {
  const keyword = filterInput.value.trim().toLowerCase();
  if (!keyword) return true;
  return (
    item.url.toLowerCase().includes(keyword) ||
    item.type.toLowerCase().includes(keyword) ||
    item.name.toLowerCase().includes(keyword)
  );
}

function getSortedItems(items) {
  const sorted = [...items];
  const mode = sortSelect.value;
  if (mode === "url") sorted.sort((a, b) => a.url.localeCompare(b.url));
  if (mode === "length") sorted.sort((a, b) => a.url.length - b.url.length);
  if (mode === "type") sorted.sort((a, b) => a.type.localeCompare(b.type));
  return sorted;
}

function selectedItems() {
  return currentItems.filter((item) => item.selected);
}

function updateStats() {
  const visible = currentItems.filter((item) => isVisibleByFilter(item)).length;
  const selected = selectedItems().length;
  resultStats.textContent = `总数 ${currentItems.length} · 已选 ${selected} · 当前筛选 ${visible} · 最近解析 ${lastSummary.time}`;

  const counts = { video: 0, image: 0, audio: 0, file: 0, folder: 0, other: 0 };
  currentItems.forEach((item) => (counts[item.type] += 1));
  resourceTypeStats.textContent = `视频 ${counts.video} · 图片 ${counts.image} · 音频 ${counts.audio} · 文件 ${counts.file} · 文件夹 ${counts.folder} · 其他 ${counts.other}`;
}

function buildRow(item) {
  const row = document.createElement("div");
  row.className = `video-item${item.selected ? " selected" : ""}`;

  const main = document.createElement("div");
  main.className = "video-main";

  const check = document.createElement("input");
  check.type = "checkbox";
  check.className = "video-check";
  check.checked = item.selected;
  check.addEventListener("change", () => {
    item.selected = check.checked;
    renderItems();
  });

  const info = document.createElement("div");
  info.className = "video-info";

  const title = document.createElement("div");
  title.className = "video-title";
  title.textContent = `资源 ${item.index + 1}`;

  const typePill = document.createElement("span");
  typePill.className = "type-pill";
  typePill.textContent = item.type;
  title.appendChild(typePill);

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
  previewBtn.addEventListener("click", () => openPreview(item));

  const copyBtn = document.createElement("button");
  copyBtn.className = "btn btn-soft";
  copyBtn.textContent = "复制";
  copyBtn.addEventListener("click", () => copyText(item.url));

  const openBtn = document.createElement("button");
  openBtn.className = "btn btn-primary";
  openBtn.textContent = "打开";
  openBtn.addEventListener("click", () => window.open(item.url, "_blank", "noopener,noreferrer"));

  actions.appendChild(previewBtn);
  actions.appendChild(copyBtn);
  actions.appendChild(openBtn);

  row.appendChild(main);
  row.appendChild(actions);
  return row;
}

function renderItems() {
  videosList.innerHTML = "";
  const visible = getSortedItems(currentItems.filter((item) => isVisibleByFilter(item)));
  visible.forEach((item) => videosList.appendChild(buildRow(item)));
  videoCountPill.textContent = `${currentItems.length} 个资源`;
  setSectionVisible(videosSection, currentItems.length > 0);
  setSectionVisible(downloadAllBtn, currentItems.length > 0);
  updateStats();
}

async function requestJson(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error("接口不可达，请检查网络或后端服务状态");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || "请求失败");
  }
  return data;
}

async function detectLocalFallback() {
  const isLocalHost = ["127.0.0.1", "localhost"].includes(window.location.hostname);
  if (!isLocalHost || API_BASE !== "/api") return;
  try {
    await requestJson(`${API_BASE}/health`, { method: "GET" });
  } catch {
    API_BASE = "http://127.0.0.1:5000/api";
  }
}

async function bootstrapRuntimeDiagnostics() {
  await detectLocalFallback();
  setSectionVisible(previewModal, false);
  const envLabel = window.location.protocol === "file:" ? "本地文件模式" : "网页模式";
  runtimeHint.textContent = ` 当前模式：${envLabel} · API：${API_BASE}`;
  try {
    await requestJson(`${API_BASE}/health`, { method: "GET" });
    runtimeHint.textContent += " · 连接正常 ✓";
  } catch {
    runtimeHint.textContent += " · API 未连接";
  }
}

function mapScrapeVideos(data) {
  const arr = Array.isArray(data.videos) ? data.videos : [];
  return arr.map((url, index) => createItem(url, "video", index));
}

function mapExtractResources(data) {
  const resources = data.resources || {};
  const items = [];
  let index = 0;
  ["videos", "images", "audios", "files", "folders"].forEach((key) => {
    const list = Array.isArray(resources[key]) ? resources[key] : [];
    list.forEach((item) => {
      const url = typeof item === "string" ? item : item.url;
      const name = typeof item === "string" ? "" : item.name || "";
      if (url) {
        items.push(createItem(url, key, index, name));
        index += 1;
      }
    });
  });
  return items;
}

async function handleScrape() {
  const url = sanitizeUrl(urlInput.value);
  urlInput.value = url;
  if (!url || !ensureValidUrl(url)) {
    showToast("请输入有效的 http/https 链接");
    return;
  }

  scrapeBtn.disabled = true;
  currentItems = [];
  renderItems();
  updateStatus("loading", "⏳", "正在解析", "正在抓取页面资源，请稍候...", 28);

  try {
    const mode = modeSelect.value;
    const endpoint = mode === "all" ? "/extract" : "/scrape";
    const data = await requestJson(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    saveRecentUrl(url);
    currentItems = mode === "all" ? mapExtractResources(data) : mapScrapeVideos(data);

    lastSummary = {
      time: new Date().toLocaleString(),
      title: data.page_title || "",
      counts: data.counts || {},
    };

    renderItems();

    if (currentItems.length === 0) {
      updateStatus("error", "⚠", "未找到资源", data.message || "页面可访问但未提取到可下载资源", 100);
      return;
    }

    updateStatus("success", "✓", "解析完成", `找到 ${currentItems.length} 个资源`, 100);
  } catch (error) {
    updateStatus("error", "✗", "解析失败", error.message, 0);
  } finally {
    scrapeBtn.disabled = false;
  }
}

async function handlePackageDownload(onlySelected) {
  const targets = onlySelected ? selectedItems() : currentItems;
  if (targets.length === 0) {
    showToast(onlySelected ? "请先勾选要打包的资源" : "没有可打包的资源");
    return;
  }

  downloadAllBtn.disabled = true;
  downloadSelectedBtn.disabled = true;
  updateStatus("loading", "⏳", "正在打包", `正在打包 ${targets.length} 个资源...`, 60);

  try {
    const data = await requestJson(`${API_BASE}/package`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videos: targets.map((item) => ({ url: item.url })) }),
    });

    if (!data.zip_data) throw new Error("未生成可下载压缩包");

    const link = document.createElement("a");
    link.href = `data:application/zip;base64,${data.zip_data}`;
    link.download = data.filename || "resources.zip";
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

function copyLinks(items) {
  if (!items.length) {
    showToast("没有可复制的资源");
    return;
  }
  copyText(items.map((item) => item.url).join("\n"));
}

function exportJsonReport() {
  if (!currentItems.length) {
    showToast("没有可导出的资源");
    return;
  }
  const payload = {
    generated_at: new Date().toISOString(),
    api_base: API_BASE,
    mode: modeSelect.value,
    total: currentItems.length,
    selected: selectedItems().length,
    resources: currentItems,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  downloadBlob(blob, "resource_report.json");
}

function exportTxtReport() {
  if (!currentItems.length) {
    showToast("没有可导出的资源");
    return;
  }
  const content = currentItems.map((item) => `[${item.type}] ${item.url}`).join("\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  downloadBlob(blob, "resource_links.txt");
}

function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function openPreview(item) {
  const lower = item.url.toLowerCase();
  const isVideo = /\.(mp4|webm|ogg|mov|m3u8)(\?|$)/.test(lower) || item.type === "video";
  if (!isVideo) {
    window.open(item.url, "_blank", "noopener,noreferrer");
    return;
  }
  previewPlayer.src = item.url;
  previewUrl.textContent = item.url;
  setSectionVisible(previewModal, true);
}

function closePreview() {
  previewPlayer.pause();
  previewPlayer.src = "";
  previewUrl.textContent = "";
  setSectionVisible(previewModal, false);
}
