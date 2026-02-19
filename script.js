function resolveApiBase() {
  const params = new URLSearchParams(window.location.search);
  const customApi = params.get("api");
  if (customApi) return customApi.replace(/\/$/, "");
  if (window.location.protocol === "file:") return "http://127.0.0.1:5000/api";
  const isLocalHost = ["127.0.0.1", "localhost"].includes(
    window.location.hostname,
  );
  if (isLocalHost && window.location.port && window.location.port !== "5000") {
    return "http://127.0.0.1:5000/api";
  }
  return "/api";
}

let API_BASE = resolveApiBase();
const STORAGE_KEY = "alibaba_video_scraper_recent_urls";
const STORAGE_HISTORY_KEY = "alibaba_video_scraper_history_tabs";
const STORAGE_THEME_KEY = "alibaba_video_scraper_theme";
const STORAGE_PREFS_KEY = "alibaba_video_scraper_prefs";

const urlInput = document.getElementById("urlInput");
const scrapeBtn = document.getElementById("scrapeBtn");
const clearUrlBtn = document.getElementById("clearUrlBtn");
const pasteUrlBtn = document.getElementById("pasteUrlBtn");
const sampleUrlBtn = document.getElementById("sampleUrlBtn");
const formatUrlsBtn = document.getElementById("formatUrlsBtn");
const copyInputBtn = document.getElementById("copyInputBtn");
const removeInvalidBtn = document.getElementById("removeInvalidBtn");
const themeSelect = document.getElementById("themeSelect");
const checkApiBtn = document.getElementById("checkApiBtn");
const inputMeta = document.getElementById("inputMeta");
const browserAssistCard = document.getElementById("browserAssistCard");
const htmlPasteInput = document.getElementById("htmlPasteInput");
const parseHtmlBtn = document.getElementById("parseHtmlBtn");
const importHtmlBtn = document.getElementById("importHtmlBtn");
const htmlFileInput = document.getElementById("htmlFileInput");
const clearHtmlBtn = document.getElementById("clearHtmlBtn");

const historyTabs = document.getElementById("historyTabs");
const historySearchInput = document.getElementById("historySearchInput");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const exportHistoryBtn = document.getElementById("exportHistoryBtn");
const importHistoryBtn = document.getElementById("importHistoryBtn");
const importHistoryInput = document.getElementById("importHistoryInput");
const historyLabelInput = document.getElementById("historyLabelInput");
const historyNoteInput = document.getElementById("historyNoteInput");
const saveHistoryMetaBtn = document.getElementById("saveHistoryMetaBtn");
const pinHistoryBtn = document.getElementById("pinHistoryBtn");
const deleteHistoryBtn = document.getElementById("deleteHistoryBtn");

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
const filterInput = document.getElementById("filterInput");
const domainFilterInput = document.getElementById("domainFilterInput");
const maxResultsInput = document.getElementById("maxResultsInput");
const selectedOnlyToggle = document.getElementById("selectedOnlyToggle");
const dedupeToggle = document.getElementById("dedupeToggle");
const retryFailedBtn = document.getElementById("retryFailedBtn");
const typeAllBtn = document.getElementById("typeAllBtn");
const typeNoneBtn = document.getElementById("typeNoneBtn");
const typeFilterPanel = document.getElementById("typeFilterPanel");
const typeFilterCheckboxes = Array.from(
  document.querySelectorAll(".type-filter"),
);
const modeSelect = document.getElementById("modeSelect");
const sortSelect = document.getElementById("sortSelect");
const selectAllBtn = document.getElementById("selectAllBtn");
const invertSelectBtn = document.getElementById("invertSelectBtn");
const deselectAllBtn = document.getElementById("deselectAllBtn");
const copyAllBtn = document.getElementById("copyAllBtn");
const copySelectedBtn = document.getElementById("copySelectedBtn");
const copyFailedBtn = document.getElementById("copyFailedBtn");
const openSelectedBtn = document.getElementById("openSelectedBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const exportTxtBtn = document.getElementById("exportTxtBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const resultStats = document.getElementById("resultStats");
const resourceTypeStats = document.getElementById("resourceTypeStats");

const previewModal = document.getElementById("previewModal");
const previewPlayer = document.getElementById("previewPlayer");
const previewUrl = document.getElementById("previewUrl");
const closePreviewBtn = document.getElementById("closePreviewBtn");

let currentItems = [];
let lastSummary = { time: "-", title: "", counts: {} };
let historyTabsData = [];
let activeHistoryId = "";
let lastFailedUrls = [];

scrapeBtn.addEventListener("click", handleScrape);
downloadAllBtn.addEventListener("click", () => handlePackageDownload(false));
downloadSelectedBtn.addEventListener("click", () =>
  handlePackageDownload(true),
);
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
  urlInput.value =
    "https://www.alibaba.com/product-detail/Custom-Wholesale-Metal-Rimless-Sunglasses-wi_1601333000000.html";
});

formatUrlsBtn.addEventListener("click", () => {
  const urls = parseInputUrls(urlInput.value);
  if (!urls.length) {
    showToast("没有可格式化的有效链接");
    return;
  }
  urlInput.value = urls.join("\n");
  showToast(`✓ 已格式化 ${urls.length} 个链接`);
});

copyInputBtn.addEventListener("click", () => {
  const value = urlInput.value.trim();
  if (!value) {
    showToast("当前输入为空");
    return;
  }
  copyText(value);
});

removeInvalidBtn.addEventListener("click", () => {
  const raw = (urlInput.value || "").trim();
  if (!raw) {
    showToast("当前输入为空");
    return;
  }
  const tokens = raw.split(/[\n,;\s]+/).filter(Boolean);
  const valid = tokens
    .map((item) => sanitizeUrl(item))
    .filter((item) => ensureValidUrl(item));
  urlInput.value = [...new Set(valid)].join("\n");
  updateInputMeta();
  showToast(`✓ 已保留 ${valid.length} 个有效链接`);
});

parseHtmlBtn.addEventListener("click", () => {
  const html = (htmlPasteInput.value || "").trim();
  if (!html) {
    showToast("请先粘贴 HTML 源代码");
    return;
  }
  currentItems = parseResourcesFromHtml(html);
  lastSummary = {
    time: new Date().toLocaleString(),
    title: "browser-assisted",
    counts: {},
  };
  renderItems();
  if (!currentItems.length) {
    updateStatus(
      "error",
      "⚠",
      "未找到资源",
      "HTML 中未匹配到可识别的资源链接",
      100,
    );
    return;
  }
  updateStatus(
    "success",
    "✓",
    "解析完成",
    `从 HTML 提取到 ${currentItems.length} 个资源`,
    100,
  );
});

clearHtmlBtn.addEventListener("click", () => {
  htmlPasteInput.value = "";
  showToast("✓ 已清空");
});

importHtmlBtn.addEventListener("click", () => htmlFileInput.click());

htmlFileInput.addEventListener("change", () => {
  const file = htmlFileInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    htmlPasteInput.value = String(reader.result || "");
    showToast("✓ HTML 文件已导入");
  };
  reader.readAsText(file, "utf-8");
  htmlFileInput.value = "";
});

window.addEventListener("message", (event) => {
  const payload = event.data;
  if (!payload || payload.type !== "IMPORT_HTML") return;
  if (typeof payload.html !== "string") return;
  const html = payload.html.slice(0, 4_000_000);
  htmlPasteInput.value = html;
  if (typeof payload.url === "string" && payload.url.trim()) {
    urlInput.value = payload.url.trim();
  }
  showToast("✓ 已接收页面HTML，正在自动解析");
  parseHtmlBtn.click();
});

themeSelect.addEventListener("change", () => {
  applyTheme(themeSelect.value);
});

checkApiBtn.addEventListener("click", () => {
  bootstrapRuntimeDiagnostics(true).then(async () => {
    const firstUrl = parseInputUrls(urlInput.value)[0];
    if (!firstUrl) return;
    try {
      const diag = await requestJson(`${API_BASE}/diag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: firstUrl }),
      });
      if (diag?.status_code) {
        showToast(`✓ 目标诊断成功：HTTP ${diag.status_code}`);
      }
    } catch {
      // 忽略诊断失败，仅保留健康检查提示
    }
  });
});

urlInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter") handleScrape();
});

urlInput.addEventListener("input", updateInputMeta);

window.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key === "Enter") handleScrape();
});

filterInput.addEventListener("input", renderItems);
domainFilterInput.addEventListener("input", renderItems);
maxResultsInput.addEventListener("input", renderItems);
selectedOnlyToggle.addEventListener("change", renderItems);
typeFilterCheckboxes.forEach((checkbox) =>
  checkbox.addEventListener("change", renderItems),
);

typeAllBtn.addEventListener("click", () => {
  typeFilterCheckboxes.forEach((checkbox) => (checkbox.checked = true));
  renderItems();
});

typeNoneBtn.addEventListener("click", () => {
  typeFilterCheckboxes.forEach((checkbox) => (checkbox.checked = false));
  renderItems();
});

retryFailedBtn.addEventListener("click", retryFailedUrls);

historySearchInput.addEventListener("input", renderHistoryTabs);
clearHistoryBtn.addEventListener("click", clearHistoryTabs);
exportHistoryBtn.addEventListener("click", exportHistoryTabs);
importHistoryBtn.addEventListener("click", () => importHistoryInput.click());
importHistoryInput.addEventListener("change", importHistoryTabs);
saveHistoryMetaBtn.addEventListener("click", saveActiveHistoryMeta);
pinHistoryBtn.addEventListener("click", toggleActiveHistoryPin);
deleteHistoryBtn.addEventListener("click", deleteActiveHistory);
modeSelect.addEventListener("change", () => {
  syncModeUi();
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
copyFailedBtn.addEventListener("click", () => {
  if (!lastFailedUrls.length) {
    showToast("当前没有失败链接");
    return;
  }
  copyText(lastFailedUrls.join("\n"));
});
openSelectedBtn.addEventListener("click", () => {
  const selected = selectedItems();
  if (!selected.length) {
    showToast("请先勾选资源");
    return;
  }
  selected.slice(0, 12).forEach((item) => {
    window.open(item.url, "_blank", "noopener,noreferrer");
  });
});
exportJsonBtn.addEventListener("click", exportJsonReport);
exportTxtBtn.addEventListener("click", exportTxtReport);
exportCsvBtn.addEventListener("click", exportCsvReport);
closePreviewBtn.addEventListener("click", closePreview);
previewModal.addEventListener("click", (event) => {
  if (event.target === previewModal) closePreview();
});

setSectionVisible(previewModal, false);
initTheme();
loadUserPrefs();
loadHistoryTabs();
syncModeUi();
bootstrapRuntimeDiagnostics();
renderHistoryTabs();
updateInputMeta();
consumeBootstrapImport();

function showToast(message) {
  window.alert(message);
}

function consumeBootstrapImport() {
  const params = new URLSearchParams(window.location.search);
  const htmlParam = params.get("html");
  const urlParam = params.get("url");
  const hash = window.location.hash || "";
  const hashMatch = hash.startsWith("#html=") ? hash.slice(6) : "";
  const packed = htmlParam || hashMatch;
  if (!packed) return;

  try {
    const decoded = decodeURIComponent(packed);
    const html = decodeBase64Utf8(decoded);
    if (urlParam) urlInput.value = urlParam;
    htmlPasteInput.value = html;
    parseHtmlBtn.click();
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch {
    // ignore
  }
}

function decodeBase64Utf8(base64Text) {
  const binary = atob(base64Text);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function setSectionVisible(element, visible) {
  element.hidden = !visible;
}

function syncModeUi() {
  setSectionVisible(typeFilterPanel, modeSelect.value === "all");
}

function initTheme() {
  const stored = localStorage.getItem(STORAGE_THEME_KEY) || "morandi";
  const supported = ["morandi", "dark-pro", "ocean-mist"];
  const finalTheme = supported.includes(stored) ? stored : "morandi";
  themeSelect.value = finalTheme;
  applyTheme(finalTheme, false);
}

function applyTheme(theme, persist = true) {
  document.documentElement.setAttribute("data-theme", theme);
  if (persist) localStorage.setItem(STORAGE_THEME_KEY, theme);
}

function updateInputMeta() {
  const raw = (urlInput.value || "").trim();
  if (!raw) {
    inputMeta.textContent = "";
    return;
  }
  const tokens = raw.split(/[\n,;\s]+/).filter(Boolean);
  let validCount = 0;
  tokens.forEach((token) => {
    if (ensureValidUrl(sanitizeUrl(token))) validCount += 1;
  });
  inputMeta.textContent = ` · 输入 ${tokens.length} 项，合法 ${validCount} 项`;
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

function parseInputUrls(value) {
  const raw = (value || "").trim();
  if (!raw) return [];
  const parts = raw.split(/[\n,;\s]+/).filter(Boolean);
  const normalized = parts
    .map((item) => sanitizeUrl(item))
    .filter((item) => ensureValidUrl(item));
  return [...new Set(normalized)];
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

function saveUserPrefs() {
  const payload = {
    selectedOnly: selectedOnlyToggle.checked,
    dedupe: dedupeToggle.checked,
    maxResults: maxResultsInput.value,
    domainFilter: domainFilterInput.value,
    typeFilters: typeFilterCheckboxes
      .filter((item) => item.checked)
      .map((item) => item.value),
  };
  localStorage.setItem(STORAGE_PREFS_KEY, JSON.stringify(payload));
}

function loadUserPrefs() {
  try {
    const prefs = JSON.parse(localStorage.getItem(STORAGE_PREFS_KEY) || "{}");
    selectedOnlyToggle.checked = Boolean(prefs.selectedOnly);
    dedupeToggle.checked = prefs.dedupe !== false;
    maxResultsInput.value = prefs.maxResults || "";
    domainFilterInput.value = prefs.domainFilter || "";
    const selected = new Set(
      Array.isArray(prefs.typeFilters)
        ? prefs.typeFilters
        : ["video", "image", "audio", "file", "folder", "other"],
    );
    typeFilterCheckboxes.forEach((item) => {
      item.checked = selected.has(item.value);
    });
  } catch {
    dedupeToggle.checked = true;
  }
}

function loadHistoryTabs() {
  let tabs = [];
  try {
    const parsed = JSON.parse(
      localStorage.getItem(STORAGE_HISTORY_KEY) || "[]",
    );
    tabs = Array.isArray(parsed) ? parsed : [];
  } catch {
    tabs = [];
  }

  if (!tabs.length) {
    const legacyUrls = getRecentUrls();
    tabs = legacyUrls.map((url, index) =>
      createHistoryTab(url, { label: `历史 ${index + 1}` }),
    );
  }
  historyTabsData = sanitizeHistoryTabs(tabs);
  if (!activeHistoryId && historyTabsData[0]) {
    activeHistoryId = historyTabsData[0].id;
  }
}

function sanitizeHistoryTabs(tabs) {
  return tabs
    .filter((item) => item && typeof item.url === "string")
    .map((item, index) => ({
      id: item.id || `history-${Date.now()}-${index}`,
      url: sanitizeUrl(item.url),
      label: (item.label || "").trim(),
      note: (item.note || "").trim(),
      pinned: Boolean(item.pinned),
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
      useCount: Number(item.useCount || 0),
      lastUsedAt: item.lastUsedAt || item.updatedAt || new Date().toISOString(),
    }))
    .filter((item) => item.url && ensureValidUrl(item.url));
}

function createHistoryTab(url, patch = {}) {
  const now = new Date().toISOString();
  return {
    id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    url,
    label: patch.label || "",
    note: patch.note || "",
    pinned: Boolean(patch.pinned),
    createdAt: now,
    updatedAt: now,
    useCount: 1,
    lastUsedAt: now,
  };
}

function persistHistoryTabs() {
  historyTabsData.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
  });
  localStorage.setItem(
    STORAGE_HISTORY_KEY,
    JSON.stringify(historyTabsData.slice(0, 80)),
  );
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(historyTabsData.slice(0, 8).map((item) => item.url)),
  );
}

function saveRecentUrl(url) {
  const normalized = sanitizeUrl(url);
  if (!normalized || !ensureValidUrl(normalized)) return;

  const now = new Date().toISOString();
  const existing = historyTabsData.find((item) => item.url === normalized);
  if (existing) {
    existing.lastUsedAt = now;
    existing.updatedAt = now;
    existing.useCount += 1;
    activeHistoryId = existing.id;
  } else {
    const tab = createHistoryTab(normalized);
    historyTabsData.push(tab);
    activeHistoryId = tab.id;
  }

  persistHistoryTabs();
  renderHistoryTabs();
}

function getActiveHistoryItem() {
  return historyTabsData.find((item) => item.id === activeHistoryId) || null;
}

function renderHistoryTabs() {
  historyTabs.innerHTML = "";
  const keyword = historySearchInput.value.trim().toLowerCase();
  const filtered = historyTabsData.filter((item) => {
    if (!keyword) return true;
    return (
      item.url.toLowerCase().includes(keyword) ||
      item.label.toLowerCase().includes(keyword) ||
      item.note.toLowerCase().includes(keyword)
    );
  });

  filtered.forEach((item) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = `history-tab${item.id === activeHistoryId ? " active" : ""}`;
    tab.title = item.url;
    tab.textContent = `${item.pinned ? "📌 " : ""}${item.label || item.url}`;
    tab.addEventListener("click", () => {
      activeHistoryId = item.id;
      urlInput.value = item.url;
      item.lastUsedAt = new Date().toISOString();
      persistHistoryTabs();
      syncHistoryEditor();
      renderHistoryTabs();
    });
    historyTabs.appendChild(tab);
  });

  syncHistoryEditor();
}

function syncHistoryEditor() {
  const active = getActiveHistoryItem();
  historyLabelInput.value = active?.label || "";
  historyNoteInput.value = active?.note || "";
}

function saveActiveHistoryMeta() {
  const active = getActiveHistoryItem();
  if (!active) {
    showToast("请先选择一个历史标签");
    return;
  }
  active.label = historyLabelInput.value.trim();
  active.note = historyNoteInput.value.trim();
  active.updatedAt = new Date().toISOString();
  persistHistoryTabs();
  renderHistoryTabs();
  showToast("✓ 标签信息已保存");
}

function toggleActiveHistoryPin() {
  const active = getActiveHistoryItem();
  if (!active) {
    showToast("请先选择一个历史标签");
    return;
  }
  active.pinned = !active.pinned;
  active.updatedAt = new Date().toISOString();
  persistHistoryTabs();
  renderHistoryTabs();
}

function deleteActiveHistory() {
  const active = getActiveHistoryItem();
  if (!active) {
    showToast("请先选择一个历史标签");
    return;
  }
  historyTabsData = historyTabsData.filter((item) => item.id !== active.id);
  activeHistoryId = historyTabsData[0]?.id || "";
  persistHistoryTabs();
  renderHistoryTabs();
}

function clearHistoryTabs() {
  historyTabsData = [];
  activeHistoryId = "";
  persistHistoryTabs();
  renderHistoryTabs();
  showToast("✓ 历史标签已清空");
}

function exportHistoryTabs() {
  const blob = new Blob([JSON.stringify(historyTabsData, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  downloadBlob(blob, "history_tabs.json");
}

function importHistoryTabs(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "[]"));
      const imported = sanitizeHistoryTabs(Array.isArray(parsed) ? parsed : []);
      const mergedMap = new Map(
        historyTabsData.map((item) => [item.url, item]),
      );
      imported.forEach((item) => mergedMap.set(item.url, item));
      historyTabsData = [...mergedMap.values()];
      activeHistoryId = historyTabsData[0]?.id || "";
      persistHistoryTabs();
      renderHistoryTabs();
      showToast(`✓ 已导入 ${imported.length} 条历史标签`);
    } catch {
      showToast("✗ 导入失败，文件格式无效");
    }
  };
  reader.readAsText(file, "utf-8");
  importHistoryInput.value = "";
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

function parseResourcesFromHtml(html) {
  const text = String(html || "");
  const items = [];
  const seen = new Set();
  let index = 0;

  const candidates = [];
  const patterns = [
    /https?:\/\/[^\s"'<>]+\.(?:mp4|webm|ogg|mov|m3u8)(?:\?[^\s"'<>]*)?/gi,
    /"videoUrl"\s*:\s*"([^"]+)"/gi,
    /"playUrl"\s*:\s*"([^"]+)"/gi,
    /"previewVideoUrl"\s*:\s*"([^"]+)"/gi,
    /"mediaUrl"\s*:\s*"([^"]+)"/gi,
    /https?:\\\/\\\/[^\s"'<>]+\.(?:mp4|webm|ogg|mov|m3u8)(?:\?[^\s"'<>]*)?/gi,
    /\\"videoUrl\\"\s*:\s*\\"([^\\"]+)\\"/gi,
  ];

  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = match[1] || match[0];
      candidates.push(value);
    }
  });

  const urlPattern = /https?:\/\/[^\s"'<>]+/gi;
  let urlMatch;
  while ((urlMatch = urlPattern.exec(text)) !== null) {
    candidates.push(urlMatch[0]);
  }

  candidates.forEach((raw) => {
    const normalized = String(raw)
      .replace(/\\u002F/gi, "/")
      .replace(/\\\//g, "/")
      .trim();
    if (!normalized.startsWith("http")) return;

    const lower = normalized.toLowerCase();
    let type = "other";
    if (/(\.mp4|\.webm|\.ogg|\.mov|\.m3u8)(\?|$)/.test(lower)) type = "video";
    else if (/(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.svg|\.avif)(\?|$)/.test(lower))
      type = "image";
    else if (/(\.mp3|\.wav|\.m4a|\.aac|\.flac)(\?|$)/.test(lower))
      type = "audio";
    else if (
      /(\.pdf|\.docx?|\.xlsx?|\.pptx?|\.zip|\.rar|\.7z|\.csv|\.json|\.txt)(\?|$)/.test(
        lower,
      )
    )
      type = "file";

    const key = `${type}::${normalized}`;
    if (dedupeToggle.checked && seen.has(key)) return;
    seen.add(key);
    items.push(createItem(normalized, type, index, ""));
    index += 1;
  });

  return items;
}

function isVisibleByFilter(item) {
  const enabledTypes = new Set(
    typeFilterCheckboxes
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value),
  );
  if (!enabledTypes.has(item.type)) return false;

  if (selectedOnlyToggle.checked && !item.selected) return false;

  const domainKeyword = domainFilterInput.value.trim().toLowerCase();
  if (domainKeyword) {
    try {
      const host = new URL(item.url).hostname.toLowerCase();
      if (!host.includes(domainKeyword)) return false;
    } catch {
      return false;
    }
  }

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
  if (mode === "domain") {
    sorted.sort((a, b) => {
      const hostA = new URL(a.url).hostname;
      const hostB = new URL(b.url).hostname;
      return hostA.localeCompare(hostB);
    });
  }
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
  openBtn.addEventListener("click", () =>
    window.open(item.url, "_blank", "noopener,noreferrer"),
  );

  actions.appendChild(previewBtn);
  actions.appendChild(copyBtn);
  actions.appendChild(openBtn);

  row.appendChild(main);
  row.appendChild(actions);
  return row;
}

function renderItems() {
  videosList.innerHTML = "";
  let visible = getSortedItems(
    currentItems.filter((item) => isVisibleByFilter(item)),
  );
  const maxResults = Number(maxResultsInput.value || 0);
  if (Number.isFinite(maxResults) && maxResults > 0) {
    visible = visible.slice(0, maxResults);
  }
  visible.forEach((item) => videosList.appendChild(buildRow(item)));
  videoCountPill.textContent = `${currentItems.length} 个资源`;
  setSectionVisible(videosSection, currentItems.length > 0);
  setSectionVisible(downloadAllBtn, currentItems.length > 0);
  saveUserPrefs();
  updateStats();
}

async function requestJson(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(url, { ...options, signal: controller.signal });
  } catch {
    clearTimeout(timer);
    throw new Error("接口不可达，请检查网络或后端服务状态");
  }
  clearTimeout(timer);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || data.message || "请求失败");
    err.status = response.status;
    err.code = data.code || "";
    err.details = data;
    throw err;
  }
  return data;
}

async function detectLocalFallback() {
  const isLocalHost = ["127.0.0.1", "localhost"].includes(
    window.location.hostname,
  );
  if (!isLocalHost || API_BASE !== "/api") return;
  try {
    await requestJson(`${API_BASE}/health`, { method: "GET" });
  } catch {
    API_BASE = "http://127.0.0.1:5000/api";
  }
}

async function bootstrapRuntimeDiagnostics(showToastResult = false) {
  await detectLocalFallback();
  setSectionVisible(previewModal, false);
  const envLabel =
    window.location.protocol === "file:" ? "本地文件模式" : "网页模式";
  runtimeHint.textContent = ` 当前模式：${envLabel} · API：${API_BASE}`;
  try {
    await requestJson(`${API_BASE}/health`, { method: "GET" });
    runtimeHint.textContent += " · 连接正常 ✓";
    if (showToastResult) showToast("✓ API 连接正常");
  } catch {
    runtimeHint.textContent += " · API 未连接";
    if (showToastResult) showToast("✗ API 未连接，请先启动本地后端");
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

async function requestResources(url, mode) {
  const endpoint = mode === "all" ? "/extract" : "/scrape";
  const data = await requestJson(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const items =
    mode === "all" ? mapExtractResources(data) : mapScrapeVideos(data);
  return { data, items };
}

async function scrapeUrls(urls) {
  const mode = modeSelect.value;
  const merged = [];
  const seen = new Set();
  const failed = [];
  let lastData = {};

  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    const progress = Math.min(
      90,
      20 + Math.round(((index + 1) / urls.length) * 70),
    );
    updateStatus(
      "loading",
      "⏳",
      "正在解析",
      `正在处理第 ${index + 1}/${urls.length} 个链接...`,
      progress,
    );
    try {
      const { data, items } = await requestResources(url, mode);
      lastData = data;
      saveRecentUrl(url);
      items.forEach((item) => {
        if (!dedupeToggle.checked) {
          merged.push(item);
          return;
        }
        const key = `${item.type}::${item.url}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(item);
        }
      });
    } catch (error) {
      failed.push({
        url,
        reason: error.message,
        status: error.status || 0,
        code: error.code || "",
      });
    }
  }

  return { merged, failed, lastData };
}

async function handleScrape() {
  const urls = parseInputUrls(urlInput.value);
  if (!urls.length) {
    showToast("请输入有效的 http/https 链接");
    return;
  }
  urlInput.value = urls.join("\n");

  scrapeBtn.disabled = true;
  currentItems = [];
  renderItems();
  updateStatus("loading", "⏳", "正在解析", "正在抓取页面资源，请稍候...", 28);

  try {
    const { merged, failed, lastData } = await scrapeUrls(urls);
    lastFailedUrls = failed.map((item) => item.url);

    currentItems = merged;

    lastSummary = {
      time: new Date().toLocaleString(),
      title: lastData.page_title || "",
      counts: lastData.counts || {},
    };

    renderItems();

    if (currentItems.length === 0) {
      const antiBotCount = failed.filter((item) => item.code === "ANTI_BOT_BLOCKED").length;
      if (antiBotCount > 0) {
        updateStatus(
          "error",
          "⚠",
          "检测到反爬校验",
          `有 ${antiBotCount} 个链接被目标站拦截。请使用下方“浏览器辅助解析”（可用书签脚本或导入HTML文件）。`,
          100,
        );
        browserAssistCard.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      const message = failed.length
        ? `全部链接处理失败（${failed.length}/${urls.length}），请检查网络或目标页面可访问性`
        : "页面可访问但未提取到可下载资源";
      updateStatus("error", "⚠", "未找到资源", message, 100);
      return;
    }

    const suffix = failed.length ? `（失败 ${failed.length} 个链接）` : "";
    updateStatus(
      "success",
      "✓",
      "解析完成",
      `找到 ${currentItems.length} 个资源${suffix}`,
      100,
    );
  } catch (error) {
    updateStatus("error", "✗", "解析失败", error.message, 0);
  } finally {
    scrapeBtn.disabled = false;
  }
}

async function retryFailedUrls() {
  if (!lastFailedUrls.length) {
    showToast("当前没有可重试的失败链接");
    return;
  }
  scrapeBtn.disabled = true;
  try {
    const { merged, failed } = await scrapeUrls(lastFailedUrls);
    const map = new Map(
      currentItems.map((item) => [`${item.type}::${item.url}`, item]),
    );
    merged.forEach((item) => map.set(`${item.type}::${item.url}`, item));
    currentItems = [...map.values()];
    lastFailedUrls = failed.map((item) => item.url);
    renderItems();
    updateStatus(
      "success",
      "✓",
      "重试完成",
      `重试成功新增 ${merged.length} 个资源，剩余失败 ${lastFailedUrls.length} 个链接`,
      100,
    );
  } catch (error) {
    updateStatus("error", "✗", "重试失败", error.message, 0);
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
  updateStatus(
    "loading",
    "⏳",
    "正在打包",
    `正在打包 ${targets.length} 个资源...`,
    60,
  );

  try {
    const data = await requestJson(`${API_BASE}/package`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videos: targets.map((item) => ({ url: item.url })),
      }),
    });

    if (!data.zip_data) throw new Error("未生成可下载压缩包");

    const link = document.createElement("a");
    link.href = `data:application/zip;base64,${data.zip_data}`;
    link.download = data.filename || "resources.zip";
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
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  downloadBlob(blob, "resource_report.json");
}

function exportTxtReport() {
  if (!currentItems.length) {
    showToast("没有可导出的资源");
    return;
  }
  const content = currentItems
    .map((item) => `[${item.type}] ${item.url}`)
    .join("\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  downloadBlob(blob, "resource_links.txt");
}

function exportCsvReport() {
  if (!currentItems.length) {
    showToast("没有可导出的资源");
    return;
  }
  const rows = ["type,url,name,selected"];
  currentItems.forEach((item) => {
    const values = [
      item.type,
      item.url,
      item.name || "",
      item.selected ? "1" : "0",
    ];
    rows.push(
      values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
    );
  });
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, "resource_links.csv");
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
  const isVideo =
    /\.(mp4|webm|ogg|mov|m3u8)(\?|$)/.test(lower) || item.type === "video";
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
