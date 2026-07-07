import axios from 'axios'
import { ElMessage } from 'element-plus'

// Create axios instance with base URL
const instance = axios.create({
  baseURL: 'http://localhost:3002',
  timeout: 10000
})

// Add request interceptor to handle different content types
instance.interceptors.request.use(
  config => {
    // Don't set Content-Type for FormData (multipart/form-data)
    if (!(config.data instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json'
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// Add response interceptor
instance.interceptors.response.use(
  response => {
    return response
  },
  error => {
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
