# Analysis Workflow Template

一个前后端分离的实验室工单演示模板。仓库已移除本地数据库、上传附件、导出报表、日志、依赖目录、构建产物和旧 git 元数据，默认数据也替换为中性示例。

## 目录

- `frontend/`: Vue 3 + Vite 前端
- `backend/`: Express + SQLite 后端

## 本地运行

后端：

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

前端：

```bash
cd frontend
npm install
npm run dev
```

默认后端端口是 `3002`，默认前端开发端口由 Vite 分配。

## 上传前检查

```bash
find . -name node_modules -o -name dist -o -name ".env" -o -name "*.db" -o -name uploads -o -name logs
```

如果命令仍输出本地数据或依赖目录，请在提交前删除。
