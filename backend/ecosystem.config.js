module.exports = {
  apps: [{
    name: 'analysis-workflow-backend',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 3002
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm Z',
    merge_logs: true,
    // 自动重启配置
    min_uptime: '10s',
    max_restarts: 10,
    // 监控配置
    monitoring: false,
    // 集群模式配置
    exec_mode: 'fork'
  }]
}
