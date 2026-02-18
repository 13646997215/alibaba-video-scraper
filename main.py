from src.scraper import AlibabaVideoScraper


def main():
    """主函数"""
    print("=" * 60)
    print("阿里巴巴商品视频爬虫")
    print("=" * 60)
    
    # 获取用户输入
    url = input("\n请输入商品页面 URL: ").strip()
    
    if not url:
        print("URL 不能为空")
        return
    
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    
    # 创建爬虫实例
    scraper = AlibabaVideoScraper()
    
    # 开始爬取
    print("\n开始爬取...\n")
    success = scraper.scrape(url)
    
    if success:
        print("\n✓ 爬取成功！视频已保存到 downloads 目录")
    else:
        print("\n✗ 爬取失败，请检查 URL 或网络连接")


if __name__ == "__main__":
    main()
