const API_BASE = window.location.origin + '/api';

// DOM 元素
const urlInput = document.getElementById('urlInput');
const scrapeBtn = document.getElementById('scrapeBtn');
const statusSection = document.getElementById('statusSection');
const statusIcon = document.getElementById('statusIcon');
const statusText = document.getElementById('statusText');
const progressFill = document.getElementById('progressFill');
const statusMessage = document.getElementById('statusMessage');
const videosSection = document.getElementById('videosSection');
const videosList = document.getElementById('videosList');
const downloadsList = document.getElementById('downloadsList');

let currentVideos = [];

// 事件监听
scrapeBtn.addEventListener('click', handleScrape);
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleScrape();
});

// 爬取视频
async function handleScrape() {
    const url = urlInput.value.trim();
    
    if (!url) {
        alert('请输入商品页面 URL');
        return;
    }
    
    scrapeBtn.disabled = true;
    statusSection.style.display = 'block';
    videosSection.style.display = 'none';
    
    updateStatus('scraping', '⏳', '正在爬取...', '正在获取页面...', 0);
    
    try {
        const response = await fetch(`${API_BASE}/scrape`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            currentVideos = data.videos;
            updateStatus('completed', '✓', '爬取完成', `找到 ${data.videos.length} 个视频`, 100);
            displayVideos(data.videos);
            videosSection.style.display = 'block';
        } else {
            updateStatus('error', '✗', '爬取失败', data.error || data.message, 0);
        }
    } catch (error) {
        updateStatus('error', '✗', '爬取失败', `错误: ${error.message}`, 0);
    } finally {
        scrapeBtn.disabled = false;
    }
}

// 下载视频
function downloadVideo(url, index) {
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '准备下载...';
    
    try {
        // 创建隐藏的 a 标签进行下载
        const a = document.createElement('a');
        a.href = url;
        a.download = `video_${index + 1}.mp4`;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        btn.textContent = '已下载';
        btn.disabled = true;
        alert('✓ 视频下载已开始，请检查浏览器下载文件夹');
    } catch (error) {
        alert(`✗ 下载失败: ${error.message}`);
        btn.textContent = '下载';
        btn.disabled = false;
    }
}

// 复制 URL
function copyUrl(url) {
    navigator.clipboard.writeText(url).then(() => {
        alert('✓ URL 已复制到剪贴板');
    }).catch(() => {
        alert('✗ 复制失败');
    });
}

// 更新状态
function updateStatus(status, icon, text, message, progress) {
    statusIcon.textContent = icon;
    statusText.textContent = text;
    statusMessage.textContent = message;
    progressFill.style.width = progress + '%';
    
    if (status === 'completed') {
        statusIcon.style.animation = 'none';
    } else if (status === 'error') {
        statusIcon.textContent = '✗';
        statusIcon.style.animation = 'none';
    } else {
        statusIcon.style.animation = 'spin 1s linear infinite';
    }
}

// 显示视频列表
function displayVideos(videos) {
    videosList.innerHTML = videos.map((url, index) => `
        <div class="video-item">
            <div class="video-info">
                <div class="video-title">视频 ${index + 1}</div>
                <div class="video-url" title="${url}">${url.substring(0, 80)}...</div>
            </div>
            <div class="video-actions">
                <button class="btn btn-secondary" onclick="copyUrl('${url}')">复制链接</button>
                <button class="btn btn-primary" onclick="downloadVideo('${url}', ${index})">下载</button>
            </div>
        </div>
    `).join('');
}

// 页面加载时检查服务状态
window.addEventListener('load', async () => {
    try {
        const response = await fetch(`${API_BASE}/status`);
        const data = await response.json();
        console.log('服务状态:', data);
    } catch (error) {
        console.error('无法连接到服务:', error);
    }
});
