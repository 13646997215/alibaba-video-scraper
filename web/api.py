from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.scraper import AlibabaVideoScraper
from src.config import DOWNLOAD_DIR

app = Flask(__name__)
CORS(app)

# 存储爬虫实例和状态
scraper_instance = None
scraping_status = {
    "status": "idle",  # idle, scraping, completed, error
    "message": "",
    "progress": 0,
    "videos": []
}


@app.route('/api/scrape', methods=['POST'])
def scrape():
    """爬取视频的 API 端点"""
    global scraper_instance, scraping_status
    
    try:
        data = request.json
        url = data.get('url', '').strip()
        
        if not url:
            return jsonify({"error": "URL 不能为空"}), 400
        
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        
        # 重置状态
        scraping_status = {
            "status": "scraping",
            "message": "正在爬取...",
            "progress": 0,
            "videos": []
        }
        
        # 创建爬虫实例
        scraper_instance = AlibabaVideoScraper()
        
        # 获取页面
        scraping_status["message"] = "正在获取页面..."
        html = scraper_instance.fetch_page(url)
        
        if not html:
            scraping_status["status"] = "error"
            scraping_status["message"] = "页面获取失败"
            return jsonify(scraping_status), 400
        
        scraping_status["progress"] = 30
        scraping_status["message"] = "正在提取视频..."
        
        # 提取视频
        if not scraper_instance.extract_videos_from_html(html):
            scraping_status["status"] = "error"
            scraping_status["message"] = "未找到视频"
            return jsonify(scraping_status), 400
        
        scraping_status["progress"] = 60
        scraping_status["videos"] = scraper_instance.video_urls
        scraping_status["message"] = f"找到 {len(scraper_instance.video_urls)} 个视频"
        
        return jsonify(scraping_status), 200
    
    except Exception as e:
        scraping_status["status"] = "error"
        scraping_status["message"] = f"错误: {str(e)}"
        return jsonify(scraping_status), 500


@app.route('/api/download', methods=['POST'])
def download():
    """下载视频的 API 端点"""
    global scraper_instance, scraping_status
    
    try:
        data = request.json
        video_index = data.get('index', 0)
        
        if not scraper_instance or video_index >= len(scraper_instance.video_urls):
            return jsonify({"error": "无效的视频索引"}), 400
        
        video_url = scraper_instance.video_urls[video_index]
        filename = f"video_{video_index + 1}.mp4"
        
        scraping_status["status"] = "downloading"
        scraping_status["message"] = f"正在下载视频 {video_index + 1}..."
        
        success = scraper_instance.download_video(video_url, filename)
        
        if success:
            scraping_status["message"] = f"视频 {video_index + 1} 下载完成"
            return jsonify({
                "success": True,
                "message": f"视频已保存到 {DOWNLOAD_DIR / filename}",
                "filename": filename
            }), 200
        else:
            scraping_status["status"] = "error"
            scraping_status["message"] = f"视频 {video_index + 1} 下载失败"
            return jsonify({"error": "下载失败"}), 500
    
    except Exception as e:
        scraping_status["status"] = "error"
        scraping_status["message"] = f"错误: {str(e)}"
        return jsonify({"error": str(e)}), 500


@app.route('/api/status', methods=['GET'])
def status():
    """获取爬虫状态"""
    return jsonify(scraping_status), 200


@app.route('/api/downloads', methods=['GET'])
def get_downloads():
    """获取已下载的视频列表"""
    try:
        files = list(DOWNLOAD_DIR.glob('*.mp4'))
        file_list = [
            {
                "name": f.name,
                "size": f.stat().st_size,
                "path": str(f)
            }
            for f in sorted(files, key=lambda x: x.stat().st_mtime, reverse=True)
        ]
        return jsonify({"files": file_list}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
