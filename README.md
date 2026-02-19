# 阿里巴巴商品视频爬虫工具

一个基于 **Python + Flask Serverless + 原生 JavaScript** 的视频解析与打包下载工具。

## 最终目标（给终端用户）

- 终端用户只需要打开你部署后的网页 URL 就能直接使用
- 不需要安装 Python、依赖或任何开发环境
- 这些安装步骤仅用于你本地开发调试

## 功能

- 输入阿里巴巴/1688 商品链接，一键解析页面视频
- 支持单个视频下载与复制链接
- 支持全部视频打包为 ZIP 下载
- 自动适配运行环境（Vercel、本地服务器、`file://`）

## 项目结构

```text
api/                 # 后端 API（Vercel + 本地通用）
src/                 # 爬虫核心逻辑
index.html           # 前端页面
style.css            # 前端样式
script.js            # 前端交互与 API 调用
run_local_api.py     # 本地 API 启动入口
vercel.json          # Vercel 路由配置
requirements.txt     # Python 依赖
```

## 本地调试（推荐）

### 1) 安装依赖

```bash
pip install -r requirements.txt
```

### 2) 启动本地 API（5000）

```bash
python run_local_api.py
```

健康检查：

- http://127.0.0.1:5000/api/health

### 3) 打开前端页面

你有两种方式：

- 直接双击 `index.html`（`file://` 模式）
  - 前端会自动请求 `http://127.0.0.1:5000/api`
- 或用静态服务器打开（例如 VS Code Live Server）
  - 默认请求同域 `/api`
  - 若静态服务器和 API 不同域，可在 URL 增加参数：

```text
index.html?api=http://127.0.0.1:5000/api
```

## 常见问题

### 1) 控制台报错：

`Access to fetch at 'file:///C:/api/scrape' has been blocked by CORS policy`

原因：页面是 `file://` 直接打开，但请求走成了本地文件路径。

解决：

1. 启动 `python run_local_api.py`
2. 刷新页面，确认页面辅助文案中显示 `API：http://127.0.0.1:5000/api`

### 2) 报错 `Failed to fetch`

- 检查本地 API 是否已启动
- 打开健康检查地址确认：
  - http://127.0.0.1:5000/api/health

### 3) Vercel 部署后接口 404

- 确认 `vercel.json` 路由已将 `/api/*` 指向 `api/index.py`
- 确认依赖已在 `requirements.txt` 中

## 一键线上使用（部署后）

部署成功后，访问：

- `https://你的域名.vercel.app`

即可直接使用完整功能：

- 粘贴商品链接
- 点击开始爬取
- 点击打包下载全部

## 部署说明（你自己执行）

1. 上传项目到 GitHub 仓库
2. 在 Vercel 导入该仓库
3. 点击 Deploy
4. 完成后将域名分享给用户，用户无需安装任何环境
