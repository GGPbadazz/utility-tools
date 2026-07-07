import axios from 'axios'
import { ElMessage } from 'element-plus'

// 动态获取后端地址
const getBaseURL = () => {
  const hostname = window.location.hostname;
  
  // 使用当前主机地址的3002端口
  return `http://${hostname}:3002`;
}

// Create axios instance with base URL
const instance = axios.create({
  baseURL: getBaseURL(),
  timeout: 10000
})

// Add request interceptor to handle different content types
instance.interceptors.request.use(
  config => {
    console.log('Axios request interceptor - url:', config.url)
    console.log('Axios request interceptor - method:', config.method)
    
    // Don't set Content-Type for FormData (multipart/form-data)
    if (!(config.data instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json'
    }
    return config
  },
  error => {
    console.error('Axios request interceptor error:', error)
    return Promise.reject(error)
  }
)

// Add response interceptor
instance.interceptors.response.use(
  response => {
    console.log('Axios response interceptor - success:', response.status, response.config.url)
    return response
  },
  error => {
    console.error('Axios response interceptor - error:', error)
    console.error('Axios response interceptor - error status:', error.response?.status)
    console.error('Axios response interceptor - error data:', error.response?.data)
    console.error('Axios response interceptor - error url:', error.config?.url)
    
    let message = '请求失败'
    if (error.response) {
      switch (error.response.status) {
        case 400:
          message = '请求参数错误'
          break
        case 404:
          message = '请求的资源不存在'
          break
        case 500:
          message = '服务器内部错误'
          break
        default:
          message = error.response.data?.message || error.response.data?.error || '未知错误'
      }
    } else if (error.message.includes('timeout')) {
      message = '请求超时'
    } else if (error.message.includes('Network Error')) {
      message = '网络连接失败'
    }
    
    ElMessage.error(message)
    return Promise.reject(error)
  }
)

export default instance
