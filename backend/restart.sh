#!/bin/bash

# 服务器重启脚本
# 当服务器崩溃时用于快速重启

PORT=3002
APP_NAME="analysis-workflow-backend"

echo "检查端口 $PORT 上的进程..."

# 查找并杀死占用端口的进程
PID=$(lsof -ti:$PORT)
if [ ! -z "$PID" ]; then
    echo "发现进程 $PID 占用端口 $PORT，正在终止..."
    kill -9 $PID
    sleep 2
fi

echo "启动服务器..."

# 检查是否安装了 PM2
if command -v pm2 &> /dev/null; then
    echo "使用 PM2 启动服务器..."
    pm2 start ecosystem.config.js
    pm2 logs $APP_NAME --lines 20
else
    echo "使用 npm 启动服务器..."
    npm start &
    SERVER_PID=$!
    echo "服务器已启动，PID: $SERVER_PID"
    
    # 等待几秒钟让服务器启动
    sleep 3
    
    # 检查服务器是否正常启动
    if curl -s http://localhost:$PORT/api/health > /dev/null; then
        echo "服务器启动成功！健康检查通过。"
    else
        echo "警告：服务器可能启动失败，健康检查未通过。"
    fi
fi
