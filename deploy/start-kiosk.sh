#!/bin/bash
# 标签打印系统 - Kiosk 启动脚本
# 使用 Firefox 全屏模式，强制禁用缓存

# 等待服务启动
sleep 10

# 等待X服务准备好
while [ -z "$DISPLAY" ]; do
    export DISPLAY=:0
    sleep 1
done

# 等待网络和服务就绪（检查首页是否可访问）
until curl -s http://127.0.0.1:5001/ | grep -q "样品标签打印系统" > /dev/null 2>&1; do
    sleep 2
done

# 清除 Firefox 缓存和会话恢复数据
rm -rf ~/.cache/mozilla/firefox/*.default*/cache2/* 2>/dev/null
rm -rf ~/.mozilla/firefox/*.default*/sessionstore* 2>/dev/null
rm -rf ~/.mozilla/firefox/*.default*/startupCache/* 2>/dev/null

# 关闭可能存在的 Firefox 进程
pkill -9 firefox 2>/dev/null
sleep 2

# 启动 Firefox Kiosk 模式
# --kiosk: 全屏 Kiosk 模式（无地址栏、无菜单）
# --private-window: 隐私模式，不使用缓存和 cookie
# 添加时间戳参数强制重新加载页面
firefox --kiosk --private-window "http://127.0.0.1:5001/?nocache=$(date +%s)"
