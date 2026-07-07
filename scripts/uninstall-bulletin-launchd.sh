#!/bin/zsh
set -euo pipefail

LABEL="com.rolling-screen.fetch-bulletin"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl unload "$PLIST" 2>/dev/null || true
rm -f "$PLIST"

echo "已移除每日公告图片自动获取任务：$LABEL"
