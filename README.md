# Rolling Screen Dashboard

一个基于 Node.js + Express 的四宫格滚动大屏系统，适合在局域网展示滚动文字、视频、图片轮播、人工编辑内容、设备上传图片，以及可选的远程公告图片同步。

本仓库是脱密后的公开版本：不包含真实账号、密码、服务器地址、运行日志、上传素材或历史发布包。

## 功能

- 四宫格大屏展示页，支持模块位置分配
- 管理页远程编辑滚动文字、视频、图片轮播和展示内容
- 文件上传接口，支持图片、视频、设备最新图片
- LED 小屏页面，固定显示最新公告图
- 可选 Playwright 自动登录远程站点并抓取公告图片
- JSON 本地配置，适合轻量部署和离线局域网使用

## 页面入口

启动后访问：

```text
http://localhost:18765/screen
http://localhost:18765/admin
http://localhost:18765/led
http://localhost:18765/led-test
```

局域网访问时，把 `localhost` 换成部署机器 IP。

## 快速开始

```bash
npm install
cp .env.example .env
npm run start
```

开发时可使用：

```bash
npm run dev
```

## 环境变量

`.env.example` 中只保留占位配置。需要远程公告同步时，复制为 `.env` 后填写真实值：

```text
BULLETIN_USERNAME=your_username
BULLETIN_PASSWORD=your_password
BULLETIN_LOGIN_URL=https://example.com/login
BULLETIN_LIST_URL=https://example.com/bulletins
```

`.env` 已加入 `.gitignore`，不要提交真实账号、密码、Cookie、Token 或内部地址。

## 常用命令

```bash
npm run start
npm run dev
npm run fetch:bulletin
npm run fetch:bulletin:daily
npm run install:playwright:cn
npm run schedule:bulletin:mac
npm run unschedule:bulletin:mac
```

说明：

- `npm run start`：启动大屏服务
- `npm run fetch:bulletin`：立即同步一次远程公告图
- `npm run fetch:bulletin:daily`：按每日任务规则同步，失败后重试
- `npm run install:playwright:cn`：使用国内镜像安装 Playwright Chromium
- `npm run schedule:bulletin:mac`：安装 macOS 每日同步任务
- `npm run unschedule:bulletin:mac`：移除 macOS 每日同步任务

## 目录结构

```text
.
├── data/config.json
├── docs/
├── public/
├── scripts/
├── uploads/
├── .env.example
├── package.json
└── server.js
```

运行时会写入：

- `data/config.json`：大屏配置
- `uploads/`：上传图片、视频和同步公告图
- `logs/`：定时任务日志
- `.env`：本地私有环境变量

以上运行数据应按实际部署环境备份，但不应提交到公开仓库。

## 上传 Git 前检查

```bash
git status --short
rg -n --hidden -S "(password|secret|token|ssh|BEGIN PRIVATE KEY|[0-9]{1,3}(\\.[0-9]{1,3}){3})" -g '!node_modules/**'
```

确认只提交源码、示例配置和文档，不提交 `.env`、`uploads/`、`logs/`、`release/`、`debug/`、真实服务器信息或历史打包文件。

## 部署

通用 Linux 部署示例见 [docs/服务器部署说明.md](docs/服务器部署说明.md)。

远程公告图片同步说明见 [docs/公告图片同步说明.md](docs/公告图片同步说明.md)。
