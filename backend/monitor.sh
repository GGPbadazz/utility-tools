#!/bin/bash

# 服务器监控脚本
# 用于监控后端服务器的运行状态

LOG_FILE="./logs/monitor.log"
PID_FILE="./server.pid"
PORT=3002

# 创建日志目录
mkdir -p logs

# 记录日志函数
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 检查服务器是否运行
check_server() {
    if curl -s http://localhost:$PORT/api/health > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# 监控循环
monitor_server() {
    log_message "开始监控服务器 (端口: $PORT)"
    
    while true; do
        if check_server; then
            log_message "服务器正常运行"
        else
            log_message "警告: 服务器无响应!"
            
            # 检查进程是否存在
            if ps aux | grep "node server.js" | grep -v grep > /dev/null; then
                log_message "进程存在但无响应，可能出现死锁"
            else
                log_message "进程已终止"
            fi
            
            # 记录系统资源使用情况
            log_message "系统资源使用情况:"
            echo "内存使用:" >> "$LOG_FILE"
            free -h >> "$LOG_FILE" 2>/dev/null || vm_stat >> "$LOG_FILE"
            echo "磁盘使用:" >> "$LOG_FILE"
            df -h >> "$LOG_FILE"
        fi
        
        sleep 30  # 每30秒检查一次
    done
}

# 启动监控
case "$1" in
    start)
        monitor_server &
        echo $! > "$PID_FILE"
        echo "监控已启动，PID: $(cat $PID_FILE)"
        ;;
    stop)
        if [ -f "$PID_FILE" ]; then
            kill $(cat "$PID_FILE")
            rm "$PID_FILE"
            echo "监控已停止"
        else
            echo "监控未运行"
        fi
        ;;
    status)
        if check_server; then
            echo "服务器正常运行"
        else
            echo "服务器无响应"
        fi
        ;;
    *)
        echo "用法: $0 {start|stop|status}"
        exit 1
        ;;
esac
