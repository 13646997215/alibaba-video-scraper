from http.server import BaseHTTPRequestHandler
import json
import sys
from pathlib import Path
import io
import zipfile
import base64
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.scraper import AlibabaVideoScraper

# 全局缓存
scraper_cache = {}


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """处理 POST 请求"""
        self._set_cors_headers()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        
        try:
            data = json.loads(body)
            action = self.path.split('/')[-1]
            
            if action == 'scrape':
                response = self.handle_scrape(data)
            elif action == 'package':
                response = self.handle_package(data)
            else:
                response = {"error": "未知操作"}
            
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
        
        except Exception as e:
            error_response = {"error": str(e)}
            self.wfile.write(json.dumps(error_response, ensure_ascii=False).encode('utf-8'))
    
    def do_GET(self):
        """处理 GET 请求"""
        self._set_cors_headers()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        response = {"status": "ok", "message": "服务运行中"}
        self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
    
    def do_OPTIONS(self):
        """处理 OPTIONS 请求"""
        self._set_cors_headers()
        self.send_response(200)
        self.end_headers()
    
    def _set_cors_headers(self):
        """设置 CORS 头"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
    
    def handle_scrape(self, data):
        """处理爬取请求"""
        url = data.get('url', '').strip()
        
        if not url:
            return {"error": "URL 不能为空"}
        
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        
        try:
            scraper = AlibabaVideoScraper()
            
            # 获取页面
            html = scraper.fetch_page(url)
            if not html:
                return {"error": "页面获取失败，请检查 URL 是否正确"}
            
            # 提取视频
            if not scraper.extract_videos_from_html(html):
                return {"error": "未找到视频，请确保页面包含视频内容"}
            
            # 缓存爬虫实例
            session_id = str(hash(url))
            scraper_cache[session_id] = scraper
            
            return {
                "status": "success",
                "message": f"找到 {len(scraper.video_urls)} 个视频",
                "videos": scraper.video_urls,
                "session_id": session_id,
                "count": len(scraper.video_urls)
            }
        
        except Exception as e:
            return {"error": f"爬取失败: {str(e)}"}
    
    def handle_package(self, data):
        """处理打包下载请求"""
        videos = data.get('videos', [])
        
        if not videos:
            return {"error": "没有视频可打包"}
        
        try:
            # 创建内存中的 ZIP 文件
            zip_buffer = io.BytesIO()
            
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for idx, video_url in enumerate(videos, 1):
                    try:
                        # 下载视频
                        import requests
                        response = requests.get(video_url, timeout=30, stream=True)
                        response.raise_for_status()
                        
                        # 添加到 ZIP
                        filename = f"video_{idx}.mp4"
                        zip_file.writestr(filename, response.content)
                    
                    except Exception as e:
                        print(f"下载视频 {idx} 失败: {e}")
                        continue
            
            # 转换为 base64
            zip_buffer.seek(0)
            zip_data = base64.b64encode(zip_buffer.getvalue()).decode('utf-8')
            
            return {
                "status": "success",
                "message": "打包完成",
                "zip_data": zip_data,
                "filename": "videos.zip"
            }
        
        except Exception as e:
            return {"error": f"打包失败: {str(e)}"}
