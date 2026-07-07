# Analysis Label Printer

这是一个已脱敏的样品标签自动打印工具，保留 Flask 后端、触屏 Web 界面、批号管理、送样人管理、签名记录和标签打印流程。真实服务器、人员、生产物料、历史批号、日志、备份包和厂商二进制 SDK 已移除或替换为中性示例。

## 内容

- `src/`: Flask 服务、样品配置、批号状态管理和打印接口封装。
- `templates/`: 触屏页面模板。
- `static/`: 前端交互脚本和样式。
- `deploy/`: 脱敏后的 systemd、kiosk 和 SSH 部署示例。
- `src/data/*.example.json`: 示例送样人和批号状态数据。
- `requirements.txt`: Python 依赖。

## 本地运行

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cd src
LABEL_PRINTER_PORT=5001 FLASK_DEBUG=1 python app.py
```

浏览器打开 `http://127.0.0.1:5001`。

如果要连接 DTPWeb SDK，可使用已安装的 Python 包，或通过环境变量指定本机 SDK 路径：

```bash
export DTPWEB_LIB_PATH=/opt/dtpweb_lib
export LPAPI_LIB_DIR=/opt/lpapi/lib
```

## 数据文件

运行时会自动在 `src/data/` 下生成本地 JSON：

- `senders.json`
- `used_batches.json`

这些文件包含现场人员和历史批号，默认被 `.gitignore` 排除。需要初始化示例数据时，可参考：

```bash
cp src/data/senders.example.json src/data/senders.json
cp src/data/used_batches.example.json src/data/used_batches.json
```

## 部署示例

`deploy/deploy.sh` 不保存密码，默认读取环境变量：

```bash
export LABEL_HOST=example.local
export LABEL_SSH_PORT=22
export LABEL_SSH_USER=labeluser
export LABEL_REMOTE_DIR=/opt/label_printer
export LABEL_SERVICE_NAME=label-printer.service

bash deploy/deploy.sh
```

建议使用 SSH key、系统凭据管理或 CI secret，不要把服务器地址、用户名、密码或内网拓扑写入仓库。

## 脱敏说明

此分支未包含：

- 真实服务器信息、路由器信息、SSH 密码、MAC 地址和内网 IP。
- 真实送样人、历史批号、签名记录和日志。
- 厂商 SDK 安装包、`.whl`、`.deb`、`.exe`、`.nupkg` 等二进制文件。
- `.venv`、`__pycache__`、备份压缩包和本地文档。
- 原始生产物料、工艺名称和车间配置。

提交前可再次检查：

```bash
rg -n "password|passwd|secret|token|api[_-]?key|sshpass|192\\.168\\.|10\\.|172\\.|BEGIN RSA|BEGIN OPENSSH|真实项目关键词"
find . -name ".venv" -o -name "__pycache__" -o -name "logs" -o -name "records"
```
