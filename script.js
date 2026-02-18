const API_BASE = "/api";

// DOM 元素
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

let currentVideos = [];

// 事件监听
scrapeBtn.addEventListener("click", handleScrape);
downloadAllBtn.addEventListener("click", handlePackageDownload);
urlInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleScrape();
});

// 爬取视频
async function handleScrape() {
  const url = urlInput.value.trim();

  if (!url) {
    alert("请输入商品页面 URL");
    return;
  }

  scrapeBtn.disabled = true;
  statusSection.style.display = "block";
  videosSection.style.display = "none";

  updateStatus("scraping", "⏳", "正在爬取...", "正在获取页面...", 0);

  try {
    const response = await fetch(`${API_BASE}/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

    if (data.status === "success") {
      currentVideos = data.videos;
      updateStatus(
        "completed",
        "✓",
        "爬取完成",
        `找到 ${data.videos.length} 个视频`,
        100,
      );
      displayVideos(data.videos);
      videosSection.style.display = "block";
    } else {
      updateStatus("error", "✗", "爬取失败", data.error || data.message, 0);
    }
  } catch (error) {
    updateStatus("error", "✗", "爬取失败", `错误: ${error.message}`, 0);
  } finally {
    scrapeBtn.disabled = false;
  }
}

// 打包下载所有视频
async function handlePackageDownload() {
  if (currentVideos.length === 0) {
    alert("没有可下载的视频");
    return;
  }

  downloadAllBtn.disabled = true;
  downloadAllBtn.textContent = "⏳ 打包中...";

  updateStatus(
    "scraping",
    "⏳",
    "正在打包...",
    "正在下载并打包视频，请稍候...",
    50,
  );

  try {
    const response = await fetch(`${API_BASE}/package`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ videos: currentVideos }),
    });

    const data = await response.json();

    if (data.status === "success") {
      // 下载 ZIP 文件
      const link = document.createElement("a");
      link.href = "data:application/zip;base64," + data.zip_data;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      updateStatus("completed", "✓", "打包完成", "视频已打包下载", 100);
      alert("✓ 视频已打包下载，请检查浏览器下载文件夹");
    } else {
      updateStatus("error", "✗", "打包失败", data.error, 0);
      alert("✗ " + data.error);
    }
  } catch (error) {
    updateStatus("error", "✗", "打包失败", error.message, 0);
    alert("✗ 打包失败: " + error.message);
  } finally {
    downloadAllBtn.disabled = false;
    downloadAllBtn.textContent = "📦 打包下载全部";
  }
}

// 下载单个视频
function downloadVideo(url, index) {
  const a = document.createElement("a");
  a.href = url;
  a.download = `video_${index + 1}.mp4`;
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  alert("✓ 视频下载已开始");
}

// 复制 URL
function copyUrl(url) {
  navigator.clipboard
    .writeText(url)
    .then(() => {
      alert("✓ URL 已复制到剪贴板");
    })
    .catch(() => {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      alert("✓ URL 已复制到剪贴板");
    });
}

// 更新状态
function updateStatus(status, icon, text, message, progress) {
  statusIcon.textContent = icon;
  statusText.textContent = text;
  statusMessage.textContent = message;
  progressFill.style.width = progress + "%";

  if (status === "completed") {
    statusIcon.style.animation = "none";
  } else if (status === "error") {
    statusIcon.style.animation = "none";
  }
}

// 显示视频列表
function displayVideos(videos) {
  videosList.innerHTML = videos
    .map(
      (url, index) => `
        <div class="video-item">
            <div class="video-info">
                <div class="video-title">视频 ${index + 1}</div>
                <div class="video-url" title="${url}">${url.substring(0, 60)}...</div>
            </div>
            <div class="video-actions">
                <button class="btn btn-secondary" onclick="copyUrl('${url.replace(/'/g, "\\'")}')">复制</button>
                <button class="btn btn-primary" onclick="downloadVideo('${url.replace(/'/g, "\\'")}', ${index})">下载</button>
            </div>
        </div>
    `,
    )
    .join("");
}
