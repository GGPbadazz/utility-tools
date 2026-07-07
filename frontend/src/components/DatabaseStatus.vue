<template>
  <div class="database-status" :class="{ 'status-error': !isConnected }">
    <div class="status-indicator" :class="{ 'connected': isConnected }"></div>
    <span class="status-text">{{ statusText }}</span>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from '../utils/axios'

const isConnected = ref(false)
const statusText = ref('检查数据库连接...')

const checkDatabaseConnection = async () => {
  try {
    await axios.get('/api/health')
    isConnected.value = true
    statusText.value = '数据库已连接'
  } catch {
    isConnected.value = false
    statusText.value = '数据库连接失败'
  }
}

onMounted(() => {
  checkDatabaseConnection()
  // Check connection every 30 seconds
  setInterval(checkDatabaseConnection, 30000)
})
</script>

<style scoped>
.database-status {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: #f0f9eb;
  border-radius: 4px;
  margin-bottom: 16px;
}

.status-error {
  background-color: #fef0f0;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #f56c6c;
  margin-right: 8px;
}

.status-indicator.connected {
  background-color: #67c23a;
}

.status-text {
  font-size: 14px;
  color: #606266;
}
</style>
