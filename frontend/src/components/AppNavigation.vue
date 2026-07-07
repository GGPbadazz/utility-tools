<template>
  <div class="app-navigation">
    <div class="nav-container">
      <div class="logo-container">
        <h1 class="logo-text">分析工单系统</h1>
      </div>
      
      <div class="button-container">
        <el-button 
          type="primary" 
          :class="{ 'active-button': activeRoute === '/new-application' }"
          @click="navigateTo('/new-application')"
        >
          <el-icon><document-add /></el-icon>
          标准申请
        </el-button>

        <el-button 
          type="success" 
          :class="{ 'active-button': activeRoute === '/quick-submit' }"
          @click="navigateTo('/quick-submit')"
        >
          <el-icon><clock /></el-icon>
          快速申请
        </el-button>
        
        <el-button 
          type="primary" 
          :class="{ 'active-button': activeRoute === '/applications' || activeRoute.startsWith('/applications/') }"
          @click="navigateTo('/applications')"
        >
          <el-icon><document /></el-icon>
          申请列表
        </el-button>
        
        <el-button 
          type="primary" 
          :class="{ 'active-button': activeRoute === '/analyst' }"
          @click="navigateTo('/analyst')"
        >
          <el-icon><data-analysis /></el-icon>
          分析师工作台
        </el-button>
        
        <el-button 
          type="info" 
          :class="{ 'active-button': activeRoute === '/reports' }"
          @click="navigateTo('/reports')"
        >
          <el-icon><document /></el-icon>
          报告中心
        </el-button>
        
        <el-button 
          type="warning" 
          :class="{ 'active-button': activeRoute === '/settings' }"
          @click="navigateTo('/settings')"
        >
          <el-icon><setting /></el-icon>
          系统设置
        </el-button>
      </div>
      
      <!-- User info (simplified) -->
      <div class="user-info">
        <el-dropdown>
          <span class="user-dropdown">
            <el-avatar :size="32">
              U
            </el-avatar>
            <span class="user-name">用户</span>
            <el-icon class="arrow-down"><arrow-down /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item disabled>
                <div class="user-info-item">
                  <strong>用户</strong>
                  <div class="user-role">{{ getRoleLabel('user') }}</div>
                  <div class="user-dept">通用</div>
                </div>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DocumentAdd, Document, DataAnalysis, Clock, Setting, ArrowDown, User } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

const activeRoute = computed(() => {
  if (route.path.startsWith('/applications/')) {
    return '/applications'
  }
  return route.path
})

const navigateTo = (path) => {
  console.log('Navigation - navigating to:', path)
  console.log('Navigation - current route:', route.path)
  
  try {
    router.push(path)
    console.log('Navigation - router.push called successfully')
  } catch (error) {
    console.error('Navigation - error during navigation:', error)
  }
}

const getRoleLabel = (role) => {
  const roleMap = {
    'admin': '系统管理员',
    'analyst': '分析师',
    'applicant': '申请人',
    'user': '用户'
  }
  return roleMap[role] || '用户'
}
</script>

<style scoped>
.app-navigation {
  background-color: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: relative;
  z-index: 1000;
}

.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 70px;
}

.logo-container {
  flex-shrink: 0;
}

.logo-text {
  font-size: 24px;
  font-weight: bold;
  color: #2c3e50;
  margin: 0;
}

.button-container {
  display: flex;
  gap: 12px;
  flex: 1;
  justify-content: center;
}

.button-container .el-button {
  height: 40px;
  padding: 0 20px;
  font-size: 14px;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.active-button {
  background-color: #409eff !important;
  border-color: #409eff !important;
  color: white !important;
}

.user-info {
  flex-shrink: 0;
}

.user-dropdown {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.user-dropdown:hover {
  background-color: #f5f7fa;
}

.user-name {
  font-weight: 500;
  color: #2c3e50;
}

.arrow-down {
  font-size: 12px;
  color: #909399;
}

.user-info-item {
  padding: 4px 0;
}

.user-role {
  font-size: 12px;
  color: #409eff;
  margin-top: 2px;
}

.user-dept {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

@media (max-width: 768px) {
  .nav-container {
    flex-direction: column;
    height: auto;
    padding: 12px 20px;
  }
  
  .button-container {
    flex-wrap: wrap;
    justify-content: center;
    margin: 12px 0;
  }
  
  .user-info {
    margin-top: 8px;
  }
}
</style>
