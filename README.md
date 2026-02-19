# 阿里巴巴商品视频爬虫工具（Vercel 一键在线版）

这是一个已经做成在线网页的项目。

## 你最终会得到什么

- 一个可公开访问的网址
- 任何人打开网址就能使用
- 访客不需要安装 Python、Node.js、插件或任何环境

---

## 先确认：访客怎么用

访客只做这 5 步：

1. 打开你的网站网址
2. 粘贴阿里巴巴商品链接
3. 点击「开始爬取」
4. 等待解析完成
5. 点击「打包下载全部」

到这里，访客全程都不需要安装任何软件。

---

## 项目结构（给仓库维护者）

- api/index.py：后端 API（Vercel Python Function）
- src/scraper.py：页面抓取与视频提取逻辑
- index.html：前端页面
- style.css：前端样式
- script.js：前端交互
- vercel.json：Vercel 路由重写配置
- requirements.txt：Python 依赖

---

## 保姆级部署教程（确保 100% 可跑）

### 第 0 步：准备账号

你需要：

- GitHub 账号
- Vercel 账号（可直接用 GitHub 登录）

### 第 1 步：把代码放到 GitHub

在本地项目目录执行：

```bash
git init
git add .
git commit -m "feat: deploy-ready alibaba video scraper"
git branch -M main
git remote add origin 你的仓库地址
git push -u origin main
```

### 第 2 步：在 Vercel 导入仓库

1. 打开 Vercel 控制台
2. 点击 New Project
3. 选择你的 GitHub 仓库
4. 点击 Import

### 第 3 步：部署参数要这样填（重点）

在 Project Settings / Build and Output Settings 中确认：

- Framework Preset：Other
- Root Directory：.（项目根目录）
- Build Command：留空
- Output Directory：留空
- Install Command：留空（Vercel 会按 Python 项目自动处理）

然后点击 Deploy。

### 第 4 步：部署成功后立即自检

打开线上网址，验证以下接口：

- 首页：
  - https://你的域名.vercel.app/
- 健康检查：
  - https://你的域名.vercel.app/api/health

如果健康检查返回 status=ok，说明后端正常。

---

## 常见错误与对应修复

### 错误 A：线上打开就是 404（你截图中的问题）

现象：

- 访问 / 返回 404
- 日志中出现 /index.html 404

原因通常是：

- Vercel 项目导入时选错了 Root Directory
- 旧部署缓存未更新
- vercel.json 路由写法不兼容

修复步骤：

1. 进入 Vercel 项目 Settings
2. 把 Root Directory 改为项目根目录（.）
3. 点击 Redeploy（建议勾选清除缓存）
4. 确认仓库中存在 index.html 且在根目录

本项目已经使用最稳的重写配置：

- /api/\* -> /api/index.py
- 静态文件由 Vercel 自动托管

### 错误 B：页面打开了，但点击开始爬取报错

先访问：

- https://你的域名.vercel.app/api/health

如果你开启了自定义重写且路径前缀被改写，再访问：

- https://你的域名.vercel.app/health

如果不通，说明后端函数未正常部署；重新部署并检查 requirements.txt。

### 错误 C：本地打开 index.html 报 Failed to fetch

这是本地调试问题，不影响线上访客。

本地调试请先启动 API：

```bash
python run_local_api.py
```

然后再打开页面。

---

## 线上质量检查清单（部署后 1 分钟完成）

- [ ] 打开首页不报 404
- [ ] /api/health 返回正常 JSON
- [ ] 输入真实商品链接可解析视频
- [ ] 「打包下载全部」可下载 ZIP
- [ ] 手机端可正常使用

---

## 声明

本工具仅用于学习与技术研究。请遵守目标网站使用条款及当地法律法规，不要用于侵权或非法用途。
