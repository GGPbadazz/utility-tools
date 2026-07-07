#!/bin/bash
# SSH 连接示例。建议使用 SSH key 或本地凭据管理，不要在脚本中写密码。

set -euo pipefail

HOST="${LABEL_HOST:-example.local}"
PORT="${LABEL_SSH_PORT:-22}"
USER="${LABEL_SSH_USER:-labeluser}"

exec ssh -o StrictHostKeyChecking=accept-new -p "$PORT" "${USER}@${HOST}"
