# 阿里巴巴商品视频爬虫（最终稳定版）

这个项目已经重构为：

- 前端静态页面（`index.html`、`script.js`、`style.css`）
- Vercel 原生文件路由 API（`api/health.py`、`api/scrape.py`、`api/package.py`）

目标：**访客只需打开你的网站网址即可直接使用，无需安装任何环境。**

---

## 一、访客怎么用（零安装）

访客只需要：

1. 打开你的网站网址
2. 粘贴阿里巴巴商品链接
3. 点击「开始爬取」
4. 点击「打包下载全部」

到这里结束，访客不需要安装 Python、Node.js 或插件。

---

## 二、仓库维护者保姆级部署教程（Vercel）

### 第 1 步：上传代码到 GitHub

```bash
git add .
git commit -m "feat: stable vercel file-routed api"
git push origin main
```

### 第 2 步：在 Vercel 导入仓库

1. 打开 Vercel 控制台
2. New Project
3. 选择该 GitHub 仓库
4. Import

### 第 3 步：部署设置（关键）

- Framework Preset：`Other`
- Root Directory：`.`（项目根目录）
- Build Command：留空
- Output Directory：留空
- Install Command：留空

然后点击 Deploy。

### 第 4 步：部署后 30 秒验证

按顺序访问：

1. 首页：
   - `https://你的域名.vercel.app/`
2. 健康接口：
   - `https://你的域名.vercel.app/api/health`

如果第 2 步返回 JSON：

```json
{"status":"ok","message":"Alibaba Video Scraper API is running"}
```

说明后端已正常在线，访客可直接使用。

---

## 三、这次为啥能比之前稳定

本次已做以下架构调整：

1. 去掉单 Flask 入口 + 重写依赖路径，改用 Vercel 文件路由 API
2. 去掉高风险 `vercel.json` 重写配置，交给 Vercel 默认静态托管
3. API 拆分为独立函数，互不影响：
   - `api/health.py`
   - `api/scrape.py`
   - `api/package.py`
4. 补上 `api/__init__.py`，避免包导入异常
5. 下载目录改为 serverless 兼容（优先 `/tmp`）

---

## 四、常见故障排查（必看）

### 场景 A：`/api/health` 返回 500

请在 Vercel 项目中查看该次部署的 Function Logs，重点看：

- `ModuleNotFoundError`
- `ImportError`
- `SyntaxError`

如果有日志，把完整报错贴出来即可继续精准修复。

### 场景 B：`/api/health` 返回 404

通常是项目导入目录不对：

- 确认 Root Directory 是 `.`
- 确认仓库中存在 `api/health.py`
- 点击 Redeploy（清缓存）

### 场景 C：页面能开但点击按钮报接口不可达

- 打开浏览器控制台看请求 URL
- 正常线上应请求：`/api/scrape`
- 再手动访问：`https://你的域名.vercel.app/api/health`

---

## 五、本地调试（开发者可选）

仅开发者需要，访客不需要。

```bash
pip install -r requirements.txt
python run_local_api.py
```

然后打开 `index.html` 或本地静态服务测试。

---

## 六、合规说明

本工具仅用于学习与技术研究，请遵守目标网站条款与当地法律法规，不要用于侵权用途。
