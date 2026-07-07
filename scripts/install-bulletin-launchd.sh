#!/bin/zsh
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.rolling-screen.fetch-bulletin"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
NPM_BIN="$(command -v npm)"
LOG_DIR="$PROJECT_DIR/logs"

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>cd '$PROJECT_DIR' &amp;&amp; '$NPM_BIN' run fetch:bulletin:daily</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>10</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/fetch-bulletin.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/fetch-bulletin.err.log</string>
</dict>
</plist>
PLIST

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "已安装每日 10:00 自动获取公告图片任务：$LABEL"
echo "日志：$LOG_DIR/fetch-bulletin.log"
echo "错误日志：$LOG_DIR/fetch-bulletin.err.log"
