from http.server import BaseHTTPRequestHandler
import json
import sys
from pathlib import Path
import requests
from bs4 import BeautifulSoup
import re

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.scraper import AlibabaVideoScraper

# 全局存储
scraper_cache = {}


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """处理 POST 请求"""
        # 设置 CORS 头
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
        # 解析请求体
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        
        try:
            data = json.loads(body)
            action = self.path.split('/')[-1]
            
            if action == 'scrape':
                response = self.handle_scrape(data)
            elif action == 'download':
                response = self.handle_download(data)
            else:
                response = {"error": "未知操作"}
            
            self.wfile.write(json.dumps(response).encode('utf-8'))
        
        except Exception as e:
            error_response = {"error": str(e)}
            self.wfile.write(json.dumps(error_response).encode('utf-8'))
    
    def do_GET(self):
        """处理 GET 请求"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        path = self.path.split('/')[-1]
        
        if path == 'status':
            response = {"status": "ok", "message": "服务运行中"}
        else:
            response = {"error": "未知请求"}
        
        self.wfile.write(json.dumps(response).encode('utf-8'))
    
    def do_OPTIONS(self):
        """处理 OPTIONS 请求（CORS 预检）"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def handle_scrape(self, data):
        """处理爬取请求"""
        url = data.get('url', '').strip()
        
        if not url:
            return {"error": "URL 不能为空"}
        
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        
        try:
            # 创建爬虫实例
            scraper = AlibabaVideoScraper()
            
            # 获取页面
            html = scraper.fetch_page(url)
            if not html:
                return {"error": "页面获取失败"}
            
            # 提取视频
            if not scraper.extract_videos_from_html(html):
                return {"error": "未找到视频"}
            
            # 缓存爬虫实例
            session_id = str(hash(url))
            scraper_cache[session_id] = scraper
            
            return {
                "status": "success",
                "message": f"找到 {len(scraper.video_urls)} 个视频",
                "videos": scraper.video_urls,
                "session_id": session_id
            }
        
        except Exception as e:
            return {"error": f"爬取失败: {str(e)}"}
    
    def handle_download(self, data):
        """处理下载请求"""
        video_url = data.get('video_url', '')
        
        if not video_url:
            return {"error": "视频 URL 不能为空"}
        
        try:
            # 由于 Vercel 无法保存文件，返回下载链接
            return {
                "status": "success",
                "message": "视频链接已获取",
                "download_url": video_url,
                "filename": f"video_{hash(video_url) % 10000}.mp4"
            }
        
        except Exception as e:
            return {"error": f"处理失败: {str(e)}"}
