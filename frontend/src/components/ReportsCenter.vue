<template>
  <div class="reports-container">
    <!-- 数据库状态指示器 -->
    <DatabaseStatus />

    <!-- 整合的数据总览与报告生成 -->
    <div class="integrated-section">
      <el-card class="main-card">
        <!-- 报告生成表单 -->
        <el-form :model="reportForm" ref="reportFormRef" label-width="100px" class="report-form">
          <el-row :gutter="20">
            <el-col :span="6">
              <el-form-item label="报告类型" prop="reportType">
                <el-select v-model="reportForm.reportType" style="width: 100%" @change="updateDateRange">
                  <el-option label="周报告" value="weekly" />
                  <el-option label="月报告" value="monthly" />
                  <el-option label="年报告" value="yearly" />
                  <el-option label="自定义" value="custom" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="开始日期" prop="startDate">
                <el-date-picker
                  v-model="reportForm.startDate"
                  type="date"
                  placeholder="选择开始日期"
                  style="width: 100%"
                  @change="loadOverviewData"
                />
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="结束日期" prop="endDate">
                <el-date-picker
                  v-model="reportForm.endDate"
                  type="date"
                  placeholder="选择结束日期"
                  style="width: 100%"
                  @change="loadOverviewData"
                />
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="文件格式" prop="fileType">
                <el-select v-model="reportForm.fileType" style="width: 100%">
                  <el-option label="Excel" value="xlsx" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          
          <!-- 按钮区域 - 重新布局 -->
          <el-row :gutter="20">
            <el-col :span="6">
              <el-form-item>
                <el-button 
                  type="primary" 
                  @click="generateReport"
                  :loading="generating"
                  :disabled="!reportForm.reportType || !reportForm.fileType || !reportForm.startDate || !reportForm.endDate"
                  style="width: 100%"
                >
                  生成Excel报告
                </el-button>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item>
                <el-button 
                  type="success"
                  @click="generateHtmlReport"
                  :disabled="!reportForm.reportType || !reportForm.startDate || !reportForm.endDate"
                  style="width: 100%"
                >
                  生成HTML报告
                </el-button>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item>
                <el-button 
                  type="warning"
                  @click="exportApplicationDetails"
                  :loading="exportingDetails"
                  :disabled="!reportForm.startDate || !reportForm.endDate"
                  style="width: 100%"
                >
                  导出工单明细
                </el-button>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item>
                <el-button 
                  @click="refreshData" 
                  :loading="loading"
                  style="width: 100%"
                >
                  <el-icon><Refresh /></el-icon>
                  刷新数据
                </el-button>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
        
        <!-- 数据总览统计 -->
        <div class="overview-section" v-loading="loading">
          <div class="overview-stats" v-if="overviewData">
            <div class="stat-item">
              <div class="stat-value">{{ overviewData.total || 0 }}</div>
              <div class="stat-label">总申请数</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ overviewData.completed || 0 }}</div>
              <div class="stat-label">已完成</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ overviewData.waiting_sample || 0 }}</div>
              <div class="stat-label">等待样品</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ overviewData.urgent || 0 }}</div>
              <div class="stat-label">紧急申请</div>
            </div>
          </div>

          <!-- 饼状图式的可视化 -->
          <div class="charts-container" v-if="overviewData && overviewData.total > 0">
            <div class="chart-section">
              <h3>状态分布</h3>
              <div class="pie-chart">
                <div class="pie-items">
                  <div 
                    v-for="status in overviewData.statusBreakdown" 
                    :key="status.status"
                    class="pie-item"
                  >
                    <div 
                      class="pie-indicator" 
                      :style="{ backgroundColor: getStatusColor(status.status) }"
                    ></div>
                    <span class="pie-label">
                      {{ formatStatus(status.status) }}: {{ status.count }}
                      <span class="percentage">({{ Math.round((status.count / overviewData.total) * 100) }}%)</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="chart-section">
              <h3>部门分布</h3>
              <div class="pie-chart">
                <div class="pie-items">
                  <div 
                    v-for="dept in overviewData.departmentBreakdown" 
                    :key="dept.department"
                    class="pie-item"
                  >
                    <div 
                      class="pie-indicator" 
                      :style="{ backgroundColor: getRandomColor(dept.department) }"
                    ></div>
                    <span class="pie-label">
                      {{ formatDepartment(dept.department) }}: {{ dept.count }}
                      <span class="percentage">({{ Math.round((dept.count / overviewData.total) * 100) }}%)</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="chart-section">
              <h3>分析类型分布</h3>
              <div class="pie-chart">
                <div class="pie-items">
                  <div 
                    v-for="type in overviewData.analysisTypeBreakdown" 
                    :key="type.analysis_type"
                    class="pie-item"
                  >
                    <div 
                      class="pie-indicator" 
                      :style="{ backgroundColor: getRandomColor(type.analysis_type) }"
                    ></div>
                    <span class="pie-label">
                      {{ formatAnalysisType(type.analysis_type) }}: {{ type.count }}
                      <span class="percentage">({{ Math.round((type.count / overviewData.total) * 100) }}%)</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="chart-section">
              <h3>生产环节分布</h3>
              <div class="pie-chart">
                <div class="pie-items">
                  <div 
                    v-for="stage in overviewData.productionStageBreakdown" 
                    :key="stage.production_stage"
                    class="pie-item"
                  >
                    <div 
                      class="pie-indicator" 
                      :style="{ backgroundColor: getRandomColor(stage.production_stage) }"
                    ></div>
                    <span class="pie-label">
                      {{ stage.production_stage }}: {{ stage.count }}
                      <span class="percentage">({{ Math.round((stage.count / overviewData.total) * 100) }}%)</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="chart-section">
              <h3>产线分布</h3>
              <div class="pie-chart">
                <div class="pie-items">
                  <div 
                    v-for="line in overviewData.productionLineBreakdown" 
                    :key="line.production_line"
                    class="pie-item"
                  >
                    <div 
                      class="pie-indicator" 
                      :style="{ backgroundColor: getRandomColor(line.production_line) }"
                    ></div>
                    <span class="pie-label">
                      {{ line.production_line }}: {{ line.count }}
                      <span class="percentage">({{ Math.round((line.count / overviewData.total) * 100) }}%)</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div v-else-if="!loading" class="empty-data">
            <el-empty description="选择日期范围后将显示数据总览" />
          </div>
        </div>
      </el-card>
    </div>

    <!-- 历史报告 -->
    <div class="historical-reports">
      <el-card>
        <template #header>
          <div class="card-header">
            <span>历史报告</span>
            <el-button @click="loadReportsList" size="small">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>
        </template>
        
        <el-table :data="reports" v-loading="loadingReports" stripe empty-text="暂无报告记录">
          <el-table-column prop="title" label="报告标题" min-width="200" />
          <el-table-column prop="report_type" label="类型" width="120">
            <template #default="{ row }">
              <el-tag :type="getReportTypeColor(row.report_type)" size="default">
                {{ getReportTypeLabel(row.report_type) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="file_type" label="格式" width="80">
            <template #default="{ row }">
              <el-tag :type="row.file_type === 'pdf' ? 'danger' : 'success'" size="default">
                {{ row.file_type.toUpperCase() }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="file_size" label="大小" width="100">
            <template #default="{ row }">
              <span class="file-size">{{ formatFileSize(row.file_size) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="generated_by_name" label="生成者" width="120" />
          <el-table-column prop="created_at" label="生成时间" width="180">
            <template #default="{ row }">
              <span class="date-text">{{ formatDate(row.created_at) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="250" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="downloadReport(row.id)">
                <el-icon><Download /></el-icon>
                下载Excel
              </el-button>
              <el-button 
                size="small" 
                type="success"
                @click="viewHtmlReport(row)"
              >
                <el-icon><View /></el-icon>
                HTML报告
              </el-button>
              <el-button 
                size="small" 
                type="danger" 
                @click="deleteReport(row.id)"
              >
                <el-icon><Delete /></el-icon>
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <el-pagination
          v-if="pagination.total > 0"
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadReportsList"
          @current-change="loadReportsList"
          class="pagination"
        />
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Delete, Refresh, View } from '@element-plus/icons-vue'
import axios from '../utils/axios'
import DatabaseStatus from './DatabaseStatus.vue'

// 数据状态
const overviewData = ref(null)
const reports = ref([])
const loadingReports = ref(false)
const generating = ref(false)
const exportingDetails = ref(false)
const loading = ref(false)

// 表单数据
const reportForm = reactive({
  reportType: '',
  fileType: 'xlsx',
  startDate: '',
  endDate: ''
})

// 分页数据
const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

// 更新日期范围
const updateDateRange = () => {
  if (!reportForm.reportType) return
  
  const now = new Date()
  
  switch (reportForm.reportType) {
    case 'weekly':
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())
      const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 6)
      reportForm.startDate = startOfWeek.toISOString().split('T')[0]
      reportForm.endDate = endOfWeek.toISOString().split('T')[0]
      break
    case 'monthly':
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      reportForm.startDate = startOfMonth.toISOString().split('T')[0]
      reportForm.endDate = endOfMonth.toISOString().split('T')[0]
      break
    case 'yearly':
      const startOfYear = new Date(now.getFullYear(), 0, 1)
      const endOfYear = new Date(now.getFullYear(), 11, 31)
      reportForm.startDate = startOfYear.toISOString().split('T')[0]
      reportForm.endDate = endOfYear.toISOString().split('T')[0]
      break
    case 'custom':
      // 自定义模式下不自动设置日期
      break
  }
  
  // 自动加载数据
  if (reportForm.startDate && reportForm.endDate) {
    loadOverviewData()
  }
}

// 刷新数据
const refreshData = () => {
  if (reportForm.startDate && reportForm.endDate) {
    loadOverviewData()
  } else {
    ElMessage.warning('请先选择日期范围')
  }
}

// 加载总览数据
const loadOverviewData = async () => {
  if (!reportForm.startDate || !reportForm.endDate) {
    return
  }
  
  try {
    loading.value = true
    console.log('加载总览数据, 日期范围:', reportForm.startDate, '至', reportForm.endDate)
    
    // 直接使用自定义日期范围来获取数据
    const response = await axios.get('/api/reports/custom-stats', {
      params: {
        startDate: reportForm.startDate,
        endDate: reportForm.endDate
      }
    })
    
    console.log('API响应:', response)
    
    if (response.data.success) {
      overviewData.value = response.data.data
      console.log('总览数据加载成功:', overviewData.value)
    } else {
      throw new Error(response.data.message || '获取数据失败')
    }
  } catch (error) {
    console.error('加载总览数据失败:', error)
    
    // 提供默认的空数据结构
    overviewData.value = {
      total: 0,
      completed: 0,
      waiting_sample: 0,
      urgent: 0,
      departmentBreakdown: [],
      analysisTypeBreakdown: [],
      statusBreakdown: [],
      urgencyBreakdown: [],
      productionStageBreakdown: [],
      productionLineBreakdown: []
    }
    
    // 如果是404错误，说明接口不存在，尝试使用原有接口
    if (error.response?.status === 404) {
      try {
        const fallbackResponse = await axios.get('/api/reports/stats', {
          params: { period: 'custom' }
        })
        if (fallbackResponse.data.success) {
          overviewData.value = fallbackResponse.data.data
        }
      } catch (fallbackError) {
        console.error('备用接口也失败:', fallbackError)
        ElMessage.error('无法加载数据总览，请检查网络连接')
      }
    } else {
      ElMessage.error(`加载数据失败: ${error.response?.data?.error || error.message}`)
    }
  } finally {
    loading.value = false
  }
}

// 加载报告列表
const loadReportsList = async () => {
  try {
    loadingReports.value = true
    const response = await axios.get(`/api/reports/list?page=${pagination.page}&pageSize=${pagination.pageSize}`)
    if (response.data.success) {
      reports.value = response.data.reports || []
      pagination.total = response.data.pagination?.total || 0
    } else {
      throw new Error(response.data.message || '获取报告列表失败')
    }
  } catch (error) {
    console.error('加载报告列表失败:', error)
    ElMessage.error(`加载报告列表失败: ${error.message || '请检查网络连接'}`)
    reports.value = []
    pagination.total = 0
  } finally {
    loadingReports.value = false
  }
}

// 生成报告
const generateReport = async () => {
  try {
    // 验证表单
    if (!reportForm.reportType) {
      ElMessage.warning('请选择报告类型')
      return
    }
    if (!reportForm.fileType) {
      ElMessage.warning('请选择文件格式')
      return
    }
    if (!reportForm.startDate || !reportForm.endDate) {
      ElMessage.warning('请选择日期范围')
      return
    }
    
    // 验证日期范围
    const startDate = new Date(reportForm.startDate)
    const endDate = new Date(reportForm.endDate)
    if (startDate > endDate) {
      ElMessage.warning('开始日期不能晚于结束日期')
      return
    }
    
    generating.value = true
    
    const response = await axios.post('/api/reports/generate', {
      reportType: reportForm.reportType,
      startDate: reportForm.startDate,
      endDate: reportForm.endDate,
      fileType: reportForm.fileType
    })
    
    if (response.data.success) {
      ElMessage.success('报告生成成功')
      loadReportsList()
    } else {
      throw new Error(response.data.message || '报告生成失败')
    }
  } catch (error) {
    console.error('生成报告失败:', error)
    ElMessage.error(`生成报告失败: ${error.message || '请检查网络连接'}`)
  } finally {
    generating.value = false
  }
}

// 生成HTML报告
const generateHtmlReport = async () => {
  try {
    // 验证表单
    if (!reportForm.reportType) {
      ElMessage.warning('请选择报告类型')
      return
    }
    if (!reportForm.startDate || !reportForm.endDate) {
      ElMessage.warning('请选择日期范围')
      return
    }
    
    // 验证日期范围
    const startDate = new Date(reportForm.startDate)
    const endDate = new Date(reportForm.endDate)
    if (startDate > endDate) {
      ElMessage.warning('开始日期不能晚于结束日期')
      return
    }
    
    // 构建URL
    const params = new URLSearchParams({
      reportType: reportForm.reportType,
      startDate: reportForm.startDate,
      endDate: reportForm.endDate
    });
    
    const url = `/api/reports/generate-html?${params}`;
    
    // 打开新窗口显示HTML报告
    const newWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
    
    if (newWindow) {
      newWindow.document.write('<div style="text-align: center; padding: 50px;">正在生成报告...</div>');
      
      try {
        const response = await axios.post('/api/reports/generate-html', {
          reportType: reportForm.reportType,
          startDate: reportForm.startDate,
          endDate: reportForm.endDate
        }, {
          headers: {
            'Accept': 'text/html'
          }
        });
        
        newWindow.document.open();
        newWindow.document.write(response.data);
        newWindow.document.close();
        
        ElMessage.success('HTML报告生成成功');
      } catch (error) {
        newWindow.document.write('<div style="text-align: center; padding: 50px; color: red;">生成报告失败</div>');
        throw error;
      }
    } else {
      ElMessage.error('无法打开新窗口，请检查浏览器弹窗设置');
    }
  } catch (error) {
    console.error('生成HTML报告失败:', error);
    ElMessage.error(`生成HTML报告失败: ${error.message || '请检查网络连接'}`);
  }
}

// 查看HTML报告
const viewHtmlReport = async (report) => {
  try {
    // 构建URL参数
    const params = new URLSearchParams({
      reportType: report.report_type,
      startDate: report.start_date,
      endDate: report.end_date
    });
    
    // 打开新窗口显示HTML报告
    const newWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
    
    if (newWindow) {
      newWindow.document.write('<div style="text-align: center; padding: 50px;">正在加载报告...</div>');
      
      try {
        const response = await axios.post('/api/reports/generate-html', {
          reportType: report.report_type,
          startDate: report.start_date,
          endDate: report.end_date
        }, {
          headers: {
            'Accept': 'text/html'
          }
        });
        
        newWindow.document.open();
        newWindow.document.write(response.data);
        newWindow.document.close();
        
        ElMessage.success('HTML报告加载成功');
      } catch (error) {
        newWindow.document.write('<div style="text-align: center; padding: 50px; color: red;">加载报告失败</div>');
        throw error;
      }
    } else {
      ElMessage.error('无法打开新窗口，请检查浏览器弹窗设置');
    }
  } catch (error) {
    console.error('查看HTML报告失败:', error);
    ElMessage.error(`查看HTML报告失败: ${error.message || '请检查网络连接'}`);
  }
}

// 下载报告
const downloadReport = async (reportId) => {
  try {
    const response = await axios.get(`/api/reports/download/${reportId}`, {
      responseType: 'blob'
    })
    
    // 从响应头获取文件名
    const contentDisposition = response.headers['content-disposition']
    let filename = `report_${reportId}.xlsx`  // 默认使用.xlsx扩展名
    
    console.log('Content-Disposition:', contentDisposition)
    
    if (contentDisposition) {
      // 优先使用 filename*=UTF-8''encoded-name 格式
      const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/)
      if (filenameStarMatch) {
        filename = decodeURIComponent(filenameStarMatch[1])
        console.log('UTF-8 filename:', filename)
      } else {
        // 回退到普通的filename格式
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
          console.log('Simple filename:', filename)
        }
      }
    }
    
    console.log('Final filename:', filename)
    
    // 创建下载链接
    const contentType = response.headers['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    const url = window.URL.createObjectURL(new Blob([response.data], { type: contentType }))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('下载报告失败:', error)
    let errorMessage = '下载报告失败'
    
    if (error.response) {
      switch (error.response.status) {
        case 404:
          errorMessage = '报告文件不存在'
          break
        case 401:
          errorMessage = '未授权访问'
          break
        case 403:
          errorMessage = '权限不足'
          break
        case 500:
          errorMessage = '服务器内部错误'
          break
        default:
          errorMessage = error.response.data?.message || error.response.data?.error || '下载报告失败'
      }
    } else if (error.message.includes('Network Error')) {
      errorMessage = '网络连接失败，请检查网络连接'
    } else if (error.message.includes('timeout')) {
      errorMessage = '请求超时，请稍后重试'
    }
    
    ElMessage.error(errorMessage)
  }
}

// 删除报告
const deleteReport = async (reportId) => {
  try {
    await ElMessageBox.confirm('确定要删除这个报告吗？', '确认删除', {
      type: 'warning'
    })
    
    await axios.delete(`/api/reports/${reportId}`)
    ElMessage.success('报告删除成功')
    loadReportsList()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除报告失败:', error)
      ElMessage.error('删除报告失败')
    }
  }
}

// 导出工单明细
const exportApplicationDetails = async () => {
  try {
    // 验证表单
    if (!reportForm.startDate || !reportForm.endDate) {
      ElMessage.warning('请选择日期范围')
      return
    }
    
    // 验证日期范围
    const startDate = new Date(reportForm.startDate)
    const endDate = new Date(reportForm.endDate)
    if (startDate > endDate) {
      ElMessage.warning('开始日期不能晚于结束日期')
      return
    }
    
    exportingDetails.value = true
    
    const response = await axios.post('/api/reports/export-details', {
      startDate: reportForm.startDate,
      endDate: reportForm.endDate
    })
    
    if (response.data.success) {
      ElMessage.success('工单明细导出成功')
      // 重新加载报告列表
      await loadReportsList()
    } else {
      throw new Error(response.data.error || '导出失败')
    }
  } catch (error) {
    console.error('导出工单明细失败:', error)
    ElMessage.error(`导出工单明细失败: ${error.message || '请检查网络连接'}`)
  } finally {
    exportingDetails.value = false
  }
}

// 工具函数
const getReportTypeLabel = (type) => {
  const labels = {
    'weekly': '周报告',
    'monthly': '月报告',
    'yearly': '年报告'
  }
  return labels[type] || type
}

const getReportTypeColor = (type) => {
  const colors = {
    'weekly': 'primary',
    'monthly': 'success',
    'yearly': 'warning'
  }
  return colors[type] || 'info'
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString('zh-CN')
}

const getRandomColor = (str) => {
  const colors = [
    '#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399',
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57'
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

const formatDepartment = (dept) => {
  // 现在数据库中直接存储中文部门名称，无需转换
  return dept || '其他'
}

const formatStatus = (status) => {
  const statusMap = {
    'waiting_sample': '等待样品',
    'analyzing': '分析中',
    'completed': '已完成',
    'cancelled': '已取消'
  }
  return statusMap[status] || status || '未知'
}

const formatAnalysisType = (type) => {
  // 如果是JSON字符串，尝试解析
  if (type && type.startsWith('[') && type.endsWith(']')) {
    try {
      const parsed = JSON.parse(type)
      return Array.isArray(parsed) ? parsed.join(', ') : type
    } catch (e) {
      return type
    }
  }
  return type || '未指定'
}

const getStatusColor = (status) => {
  const colorMap = {
    'waiting_sample': '#E6A23C',
    'analyzing': '#409EFF',
    'completed': '#67C23A',
    'cancelled': '#F56C6C'
  }
  return colorMap[status] || '#909399'
}

// 页面加载时初始化
onMounted(async () => {
  console.log('ReportsCenter - 组件已挂载')
  
  // 设置默认日期范围为本月
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  
  reportForm.reportType = 'monthly'
  reportForm.startDate = startOfMonth.toISOString().split('T')[0]
  reportForm.endDate = endOfMonth.toISOString().split('T')[0]
  
  // 加载数据
  await loadOverviewData()
  await loadReportsList()
})
</script>

<style scoped>
.reports-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.integrated-section {
  margin-bottom: 30px;
}

.main-card {
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.report-form {
  margin-bottom: 30px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.overview-section {
  margin-top: 20px;
}

.overview-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-item {
  text-align: center;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 8px;
}

.stat-value {
  font-size: 36px;
  font-weight: bold;
  color: #409EFF;
  margin-bottom: 10px;
}

.stat-label {
  font-size: 14px;
  color: #606266;
}

.charts-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-top: 30px;
}

.chart-section h3 {
  margin-bottom: 15px;
  color: #303133;
  font-size: 15px;
  font-weight: 600;
}

.pie-chart {
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  min-height: 120px;
}

.pie-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pie-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}

.pie-indicator {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
}

.pie-label {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
  line-height: 1.4;
}

.percentage {
  color: #909399;
  font-size: 11px;
  margin-left: 4px;
}

.empty-data {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px dashed #dcdfe6;
  margin-top: 20px;
}

.historical-reports {
  margin-bottom: 30px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.file-size {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  color: #606266;
  font-weight: 500;
}

.date-text {
  font-size: 13px;
  color: #606266;
}

@media (max-width: 768px) {
  .overview-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .charts-container {
    grid-template-columns: 1fr;
  }
  
  .reports-container {
    padding: 16px;
  }
  
  .reports-header h1 {
    font-size: 24px;
  }
  
  .report-form {
    padding: 16px;
  }
}
</style>
