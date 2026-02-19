# Alibaba Video Scraper

阿里巴巴商品视频/资源提取工具，支持本地运行与 Vercel 部署，提供现代化前端界面、批量链接解析、资源筛选导出与打包下载。

## 功能概览

- 视频模式：提取商品页视频链接
- 全资源模式：提取视频、图片、音频、文件、文件夹链接
- 批量解析：输入框支持多链接（换行/空格/逗号分隔）
- 结果管理：筛选、排序、全选/反选、复制、JSON/TXT 导出
- 打包下载：将选中资源由后端打包成 ZIP
- 主题切换（3 套）：
  - 柔雾莫兰迪（默认）
  - 深色商务（你提供的专业暗色方案）
  - 海盐薄雾（清爽浅色方案）
- 运行诊断：一键检测 API 连通性

## 项目结构

- `index.html`：前端页面结构
- `style.css`：主题与样式系统
- `script.js`：前端交互逻辑（API 请求、批量解析、导出、主题）
- `run_local_api.py`：本地 Flask API
- `api/`：Vercel 文件路由 API（serverless）
- `src/`：抓取与资源提取核心逻辑

## 本地运行（Windows）

### 1) 安装依赖

```bash
pip install -r requirements.txt
```

### 2) 启动本地 API

```bash
python run_local_api.py
```

默认监听：`http://127.0.0.1:5000`

### 3) 打开前端页面

可直接双击 `index.html`，或用本地静态服务（如 Live Server）。

前端会自动识别本地环境，优先连接 `http://127.0.0.1:5000/api`。

## API 端点

- `GET /api/health`：健康检查
- `POST /api/scrape`：视频提取
- `POST /api/extract`：全资源提取
- `POST /api/package`：资源打包

## 已完成的关键稳定性修复

1. 修复本地跨域失败（CORS）
   - 已为 `/api/*` 启用跨域与预检响应头
2. 修复本地静态服务下 API 404/不可连问题
   - 前端本地端口自动回退到 `127.0.0.1:5000`
3. 修复 HTTPS 证书链缺失导致的抓取失败
   - 抓取层加入受控重试：先正常校验，失败后兼容重试
4. 优化无资源场景返回
   - `scrape` 在未找到视频时返回友好提示而非硬错误

## 调试与排障

### 浏览器报 `API 未连接`

先确认本地 API 进程正在运行：

```bash
python run_local_api.py
```

再访问：

```bash
http://127.0.0.1:5000/api/health
```

应返回 `status=ok`。

### 控制台出现 CORS 报错

当前版本已默认开启 CORS；若仍报错，通常是后端未重启。重启 `run_local_api.py` 后再试。

### 商品页解析不到视频

部分链接不是商品详情页，或视频由前端动态加密加载。可切换“全资源模式”并尝试其他商品链接。

## Vercel 部署

本仓库包含 `api/*.py` 文件路由，可直接部署到 Vercel：

1. 推送仓库到 GitHub
2. Vercel 导入该仓库
3. Framework 选 `Other`
4. Root Directory 保持项目根目录

部署后验证：

- 首页：`https://<your-domain>/`
- 健康接口：`https://<your-domain>/api/health`

## 合规说明

本工具仅用于学习、测试与技术研究。请遵守目标网站服务条款及所在地法律法规。
