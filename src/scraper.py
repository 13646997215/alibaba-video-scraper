import os
import re
import json
import time
import requests
from pathlib import Path
from bs4 import BeautifulSoup
from src.config import DOWNLOAD_DIR, REQUEST_TIMEOUT, CHUNK_SIZE, USER_AGENT


class AlibabaVideoScraper:
    def __init__(self):
        """初始化爬虫"""
        self.video_urls = []
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})
    
    def fetch_page(self, url):
        """获取页面内容"""
        print(f"正在获取页面: {url}")
        try:
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            response.encoding = 'utf-8'
            print("✓ 页面获取成功")
            return response.text
        except Exception as e:
            print(f"✗ 页面获取失败: {e}")
            return None
    
    def extract_videos_from_html(self, html):
        """从 HTML 中提取视频 URL"""
        print("正在提取视频 URL...")
        
        soup = BeautifulSoup(html, 'html.parser')
        
        # 方法1：查找 <video> 标签
        videos = soup.find_all('video')
        print(f"找到 {len(videos)} 个 <video> 标签")
        
        for video in videos:
            # 查找 src 属性
            src = video.get('src')
            if src:
                self.video_urls.append(src)
                print(f"  ✓ 视频: {src[:80]}...")
            
            # 查找 <source> 子标签
            sources = video.find_all('source')
            for source in sources:
                src = source.get('src')
                if src and src not in self.video_urls:
                    self.video_urls.append(src)
                    print(f"  ✓ 视频: {src[:80]}...")
        
        # 方法2：从 JavaScript 数据中提取（阿里巴巴常用）
        print("\n正在从页面数据中提取视频...")
        
        # 查找 JSON 数据块
        script_tags = soup.find_all('script', type='application/json')
        for script in script_tags:
            try:
                data = json.loads(script.string)
                self._extract_from_json(data)
            except:
                pass
        
        # 方法3：正则表达式查找视频 URL
        print("\n正在用正则表达式查找视频...")
        
        # 常见视频 URL 模式
        patterns = [
            r'https?://[^\s"\'<>]+\.(?:mp4|webm|ogg|mov)',
            r'"videoUrl"\s*:\s*"([^"]+)"',
            r'"video"\s*:\s*"([^"]+)"',
            r'src=[\'"](https?://[^\'"]+\.(?:mp4|webm|ogg|mov))[\'"]',
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, html)
            for match in matches:
                url = match if isinstance(match, str) else match[0]
                if url not in self.video_urls and url.startswith('http'):
                    self.video_urls.append(url)
                    print(f"  ✓ 视频: {url[:80]}...")
        
        # 去重
        self.video_urls = list(set(self.video_urls))
        
        if not self.video_urls:
            print("✗ 未找到视频 URL")
            return False
        
        print(f"\n✓ 共找到 {len(self.video_urls)} 个视频")
        return True
    
    def _extract_from_json(self, obj, depth=0):
        """递归从 JSON 对象中提取视频 URL"""
        if depth > 10:  # 防止无限递归
            return
        
        if isinstance(obj, dict):
            for key, value in obj.items():
                # 查找包含视频 URL 的键
                if key.lower() in ['video', 'videourl', 'url', 'src', 'source']:
                    if isinstance(value, str) and value.startswith('http'):
                        if value.endswith(('.mp4', '.webm', '.ogg', '.mov')):
                            if value not in self.video_urls:
                                self.video_urls.append(value)
                
                self._extract_from_json(value, depth + 1)
        
        elif isinstance(obj, list):
            for item in obj:
                self._extract_from_json(item, depth + 1)
    
    def download_video(self, video_url, filename):
        """下载单个视频"""
        try:
            print(f"\n正在下载: {filename}")
            print(f"URL: {video_url[:80]}...")
            
            response = self.session.get(video_url, timeout=REQUEST_TIMEOUT, stream=True)
            response.raise_for_status()
            
            # 获取文件大小
            total_size = int(response.headers.get('content-length', 0))
            downloaded_size = 0
            
            filepath = DOWNLOAD_DIR / filename
            
            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
                    if chunk:
                        f.write(chunk)
                        downloaded_size += len(chunk)
                        
                        # 显示下载进度
                        if total_size > 0:
                            progress = (downloaded_size / total_size) * 100
                            print(f"  进度: {progress:.1f}% ({downloaded_size}/{total_size} bytes)", end='\r')
            
            print(f"\n✓ 下载完成: {filepath}")
            return True
        
        except Exception as e:
            print(f"\n✗ 下载失败: {e}")
            return False
    
    def download_all_videos(self):
        """下载所有视频"""
        if not self.video_urls:
            print("没有可下载的视频")
            return False
        
        print(f"\n{'='*60}")
        print(f"开始下载 {len(self.video_urls)} 个视频...")
        print(f"{'='*60}\n")
        
        success_count = 0
        for idx, video_url in enumerate(self.video_urls, 1):
            # 生成文件名
            filename = f"video_{idx}.mp4"
            
            # 下载视频
            if self.download_video(video_url, filename):
                success_count += 1
            
            # 避免频繁请求
            time.sleep(1)
        
        print(f"\n{'='*60}")
        print(f"下载完成！成功: {success_count}/{len(self.video_urls)}")
        print(f"{'='*60}")
        
        return success_count > 0
    
    def scrape(self, url):
        """主爬取流程"""
        try:
            # 获取页面
            html = self.fetch_page(url)
            if not html:
                return False
            
            # 提取视频
            if not self.extract_videos_from_html(html):
                return False
            
            # 下载视频
            if not self.download_all_videos():
                return False
            
            return True
        
        except Exception as e:
            print(f"爬取过程出错: {e}")
            return False
