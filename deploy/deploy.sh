#!/bin/bash
# 示例部署脚本 - 通过 SSH 上传文件并重启服务。

set -euo pipefail

HOST="${LABEL_HOST:-example.local}"
PORT="${LABEL_SSH_PORT:-22}"
USER="${LABEL_SSH_USER:-labeluser}"
REMOTE_DIR="${LABEL_REMOTE_DIR:-/opt/label_printer}"
SERVICE_NAME="${LABEL_SERVICE_NAME:-label-printer.service}"

SSH_OPTS=(-p "$PORT" -o StrictHostKeyChecking=accept-new)

upload_file() {
    local src="$1"
    local dst="$2"
    scp -P "$PORT" -o StrictHostKeyChecking=accept-new "$src" "${USER}@${HOST}:${dst}"
}

# 远程执行命令
remote_cmd() {
    ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" "$1"
}

echo "=== 开始部署 ==="

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 上传后端文件
echo "上传 batch_manager.py..."
upload_file "$PROJECT_ROOT/src/batch_manager.py" "$REMOTE_DIR/src/"

echo "上传 app.py..."
upload_file "$PROJECT_ROOT/src/app.py" "$REMOTE_DIR/src/"

# 上传前端文件
echo "上传 index.html..."
upload_file "$PROJECT_ROOT/templates/index.html" "$REMOTE_DIR/templates/"

echo "上传 workshop.css..."
upload_file "$PROJECT_ROOT/static/css/workshop.css" "$REMOTE_DIR/static/css/"

echo "上传 workshop.js..."
upload_file "$PROJECT_ROOT/static/js/workshop.js" "$REMOTE_DIR/static/js/"

# 重启服务
echo "重启 Flask 服务..."
remote_cmd "sudo systemctl restart $SERVICE_NAME"

echo "=== 部署完成 ==="
echo "访问: http://$HOST:${LABEL_PRINTER_PORT:-5001}"
