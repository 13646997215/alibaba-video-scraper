# Alibaba Video Scraper

阿里巴巴商品视频/资源提取工具，支持本地运行与 Vercel 部署，提供现代化前端界面、批量链接解析、资源筛选导出与打包下载。

## 功能概览

- 视频模式与全资源模式（视频/图片/音频/文件/文件夹）
- 多链接批量解析（换行、空格、逗号分隔）
- 历史标签页系统（置顶、搜索、备注、重命名、删除）
- 历史导入/导出（JSON）与一键清空
- 主题切换（柔雾莫兰迪 / 深色商务 / 海盐薄雾）
- API 健康检查 + 目标 URL 诊断
- 资源类型多选筛选（all 模式）
- 域名筛选、仅显示已选、展示上限控制
- 解析去重开关、失败链接重试
- 结果排序增强（含按域名排序）
- 结果导出增强（JSON / TXT / CSV）
- 复制全部/复制所选/复制失败链接
- 一键打开所选资源（上限 12）
- 输入辅助（格式化去重、移除无效、输入统计、复制输入）

### 本次新增的 20+ 便捷能力清单

1. 历史记录改为标签页
2. 历史标签置顶
3. 历史标签搜索
4. 历史标签备注
5. 历史标签重命名
6. 删除当前历史标签
7. 清空全部历史
8. 导出历史 JSON
9. 导入历史 JSON
10. 历史点击回填输入框
11. 全资源模式资源类型多选筛选
12. 资源类型一键全选
13. 资源类型一键清空
14. 域名筛选
15. 仅显示已勾选资源
16. 展示上限控制
17. 解析去重开关
18. 失败链接重试
19. 复制失败链接
20. 按域名排序
21. 导出 CSV
22. 打开所选资源
23. 输入格式化去重
24. 移除无效输入链接
25. 输入项统计显示

## 项目结构

- `index.html`：前端页面结构
- `style.css`：主题与样式系统
- `script.js`：前端交互逻辑（API 请求、批量解析、导出、主题）
- `run_local_api.py`：本地 Flask API
- `api/`：Vercel 文件路由 API（serverless）
- `src/`：抓取与资源提取核心逻辑
- `diagnostics.html`：网页诊断中心
- `help.html`：帮助与排障页面
- `scripts/vercel_e2e_check.py`：线上/本地对比实测脚本

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
- `POST /api/diag`：目标站连通/响应诊断（用于线上失败排查）

## 已完成的关键稳定性修复

1. 修复本地跨域失败（CORS）
   - 已为 `/api/*` 启用跨域与预检响应头
2. 修复本地静态服务下 API 404/不可连问题
   - 前端本地端口自动回退到 `127.0.0.1:5000`
3. 修复 HTTPS 证书链缺失导致的抓取失败
   - 抓取层加入受控重试：先正常校验，失败后兼容重试
4. 优化无资源场景返回
   - `scrape` 在未找到视频时返回友好提示而非硬错误
5. 统一本地与 Vercel API 容错策略
   - `api/*` 与 `run_local_api.py` 均使用一致的请求重试与诊断模型

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

### Vercel 显示 API 正常但爬取失败

这是最常见线上问题：健康检查仅说明函数可运行，不代表目标站允许 Vercel 机房 IP 抓取。

建议排查顺序：

1. 在页面输入目标链接后点击“检测 API”（会自动调用 `/api/diag`）
2. 查看 `status_code` 和 `final_url` 是否异常跳转
3. 切换“全资源模式”验证是否可提取到非视频资源
4. 在 Vercel Function Logs 查看目标请求返回差异（本地 IP 与机房 IP 风控策略可能不同）

说明：本项目已做最大化兼容（请求头、SSL 回退、二次提取），但若目标站对数据中心 IP 强限制，线上结果仍可能少于本地。

当接口返回 `code=ANTI_BOT_BLOCKED` 时，表示目标站返回了校验页（Punish/Captcha），不是 API 路由故障。

## Vercel 线上实测脚本

使用同一测试 URL 同时检测 Vercel 与本地，自动输出差异：

```bash
python scripts/vercel_e2e_check.py --target-url "https://www.alibaba.com/product-detail/..."
```

仅测 Vercel：

```bash
python scripts/vercel_e2e_check.py --target-url "https://www.alibaba.com/product-detail/..." --skip-local
```

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
