<template>
  <div id="app">
    <!-- Always show navigation -->
    <AppNavigation />
    <div class="main-content">
      <RouterView />
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppNavigation from './components/AppNavigation.vue'

onMounted(() => {
  console.log('App mounted - no authentication required')
})
</script>

<style>
#app {
  min-height: 100vh;
  width: 100%;
  max-width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  background-color: #f5f5f5;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  padding: 20px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.full-content {
  flex: 1;
  padding: 0;
  width: 100%;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #f5f5f5;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #409eff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-container p {
  color: #606266;
  font-size: 14px;
  margin: 0;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
