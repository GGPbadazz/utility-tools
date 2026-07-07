<template>
  <div class="application-detail-container">
    <!-- Database Connection Status -->
    <div class="connection-status">
      <el-alert
        :title="dbStatus.connected ? '数据库连接正常' : '数据库连接失败'"
        :type="dbStatus.connected ? 'success' : 'error'"
        :description="dbStatus.message"
        show-icon
        :closable="false"
      />
    </div>

    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">申请详情</h1>
        <p class="work-order-number">工单号: {{ application.work_order_number || '加载中...' }}</p>
      </div>
      
      <div class="header-actions">
        <!-- Status and Action Buttons for Analysts -->
        <div v-if="showActionPanel" class="status-actions-group">
          <el-tag 
            :type="getStatusType(application.status)" 
            size="large" 
            :effect="application.status === 'cancelled' ? 'light' : 'dark'"
          >
            {{ formatStatus(application.status) }}
          </el-tag>
          
          <el-button 
            v-if="application.status === 'waiting_sample'"
            type="warning" 
            size="default"
            @click="updateApplicationStatus('analyzing')"
            :loading="updatingStatus"
            class="action-button-header"
          >
            <el-icon><edit /></el-icon>
            开始分析
          </el-button>
          
          <el-button 
            v-if="['waiting_sample', 'analyzing'].includes(application.status)"
            type="danger" 
            size="default"
            @click="showCancelDialog"
            :loading="updatingStatus"
            class="action-button-header"
          >
            <el-icon><close /></el-icon>
            取消申请
          </el-button>
        </div>
        
        <el-button 
          size="large"
          @click="goBack"
          class="back-button"
        >
          <el-icon><back /></el-icon>
          返回列表
        </el-button>
        <el-button 
          type="primary" 
          size="large"
          @click="refreshData"
          :loading="loading"
          class="refresh-button"
        >
          <el-icon><refresh /></el-icon>
          {{ loading ? '刷新中...' : '刷新数据' }}
        </el-button>
      </div>
    </div>
    
    <el-card v-loading="loading" shadow="hover" class="detail-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">基本信息</span>
          <el-tag 
            :type="getStatusType(application.status)" 
            size="large" 
            :effect="application.status === 'cancelled' ? 'light' : 'dark'"
          >
            {{ formatStatus(application.status) }}
          </el-tag>
        </div>
      </template>
      
      <div class="info-grid">
        <div class="info-item">
          <span class="label">申请人:</span>
          <span class="value">{{ application.applicant || '无' }}</span>
        </div>
        
        <div class="info-item">
          <span class="label">取样人:</span>
          <span class="value">{{ application.sampler || '无' }}</span>
        </div>
        
        <div class="info-item">
          <span class="label">部门:</span>
          <span class="value">{{ formatDepartment(application.department) }}</span>
        </div>
        
        <div class="info-item">
          <span class="label">项目:</span>
          <span class="value">{{ application.project || '无' }}</span>
        </div>
        
        <div class="info-item">
          <span class="label">联系电话:</span>
          <span class="value">{{ application.phone || '无' }}</span>
        </div>
        
        <div class="info-item">
          <span class="label">紧急程度:</span>
          <el-tag :type="getUrgencyType(application.urgency)" size="large" effect="dark">
            {{ formatUrgency(application.urgency) }}
          </el-tag>
        </div>
        
        <div class="info-item">
          <span class="label">期望完成日期:</span>
          <span class="value">{{ application.expected_date || '无特定要求' }}</span>
        </div>
        
        <div class="info-item">
          <span class="label">申请时间:</span>
          <span class="value">{{ formatDate(application.created_at) }}</span>
        </div>
        
        <!-- 显示拒绝理由 -->
        <div v-if="application.status === 'cancelled' && application.reject_reason" class="info-item full-width">
          <span class="label">拒绝理由:</span>
          <div class="reject-reason">
            <el-alert 
              :title="application.reject_reason" 
              type="error" 
              :closable="false"
              show-icon
            />
          </div>
        </div>
      </div>
    </el-card>
    
    <el-card shadow="hover" class="detail-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">样品信息</span>
          <el-tag type="info">{{ (application.samples || []).length }} 个样品</el-tag>
        </div>
      </template>
      
      <div v-if="!application.samples || application.samples.length === 0" class="empty-state">
        <el-empty description="暂无样品信息" />
      </div>
      
      <el-table v-else :data="application.samples" border stripe>
        <el-table-column prop="name" label="样品名称" min-width="120" />
        <el-table-column prop="type" label="类型" width="100" />
        <el-table-column label="数量" width="120">
          <template #default="scope">
            <span class="quantity-info">
              {{ scope.row.quantity }} {{ scope.row.unit }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="storage_condition" label="储存条件" min-width="120" />
        <el-table-column prop="description" label="描述" min-width="150" show-overflow-tooltip />
      </el-table>
    </el-card>
    
    <el-card shadow="hover" class="detail-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">分析需求</span>
          <el-tag type="primary">{{ (application.analysisTypes || []).length }} 项分析</el-tag>
        </div>
      </template>
      
      <div class="info-grid">
        <div class="info-item full-width">
          <span class="label">分析类型:</span>
          <div class="analysis-types">
            <el-tag 
              v-for="type in application.analysisTypes" 
              :key="type"
              type="primary"
              class="analysis-tag"
            >
              {{ type }}
            </el-tag>
            <span v-if="!application.analysisTypes || application.analysisTypes.length === 0" class="value">
              无
            </span>
          </div>
        </div>
        
        <div class="info-item">
          <span class="label">检测方法:</span>
          <span class="value">{{ application.detection_method || '无特定要求' }}</span>
        </div>
        
        <div class="info-item">
          <span class="label">报告要求:</span>
          <span class="value">{{ formatReportRequirement(application.report_requirement) }}</span>
        </div>
        
        <div class="info-item full-width">
          <span class="label">目标化合物/成分:</span>
          <p class="multiline-text">{{ application.target_compounds || '无' }}</p>
        </div>
        
        <div class="info-item full-width">
          <span class="label">特殊要求:</span>
          <p class="multiline-text">{{ application.special_requirements || '无' }}</p>
        </div>
      </div>
    </el-card>

    <!-- Analysis Results and Input Form -->
    <el-card shadow="hover" class="detail-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">分析结果</span>
          <div class="header-actions">
            <el-tag v-if="application.status === 'completed'" type="success">已完成</el-tag>
            <el-tag v-else-if="application.status === 'analyzing'" type="warning">分析中</el-tag>
            <el-tag v-else type="info">等待分析</el-tag>
          </div>
        </div>
      </template>
      
      <!-- Display existing results if any -->
      <div v-if="hasAnalysisResults && !canEditAnalysis" class="analysis-results">
        <div v-if="application.analysis_conclusion" class="result-item">
          <span class="label">分析结论:</span>
          <p class="result-content">{{ application.analysis_conclusion }}</p>
        </div>
        
        <div v-if="application.analysis_data" class="result-item">
          <span class="label">检测数据:</span>
          <p class="result-content">{{ application.analysis_data }}</p>
        </div>
        
        <div v-if="application.analyst_name" class="result-item">
          <span class="label">分析员:</span>
          <p class="result-content">{{ application.analyst_name }}</p>
        </div>
        
        <div v-if="application.analysis_notes" class="result-item">
          <span class="label">备注:</span>
          <p class="result-content">{{ application.analysis_notes }}</p>
        </div>
      </div>

      <!-- Analysis Form - Always show for analysts who can edit -->
      <div v-if="canEditAnalysis" class="analysis-form">
        <el-form :model="analysisForm" label-position="top" @submit.prevent="saveAnalysisResults">
          <el-form-item label="分析结论" required>
            <el-input
              v-model="analysisForm.analysis_conclusion"
              type="textarea"
              :rows="4"
              placeholder="请输入分析结论..."
              show-word-limit
              maxlength="1000"
            />
          </el-form-item>
          
          <el-form-item label="检测数据" required>
            <el-input
              v-model="analysisForm.analysis_data"
              type="textarea"
              :rows="6"
              placeholder="请输入检测数据和具体数值..."
              show-word-limit
              maxlength="2000"
            />
          </el-form-item>
          
          <el-form-item label="分析员姓名" required>
            <el-input
              v-model="analysisForm.analyst_name"
              placeholder="请输入分析员姓名"
              maxlength="50"
            />
          </el-form-item>
          
          <el-form-item label="备注">
            <el-input
              v-model="analysisForm.analysis_notes"
              type="textarea"
              :rows="3"
              placeholder="其他备注信息（可选）"
              show-word-limit
              maxlength="500"
            />
          </el-form-item>
          
          <el-form-item>
            <el-button type="primary" @click="saveAnalysisResults" :loading="savingAnalysis" size="large">
              <el-icon><check /></el-icon>
              保存分析结果
            </el-button>
          </el-form-item>
        </el-form>
      </div>
      
      <!-- Empty state for non-analysts when no results -->
      <div v-if="!hasAnalysisResults && !canEditAnalysis" class="empty-analysis">
        <el-empty description="暂无分析结果" />
      </div>
    </el-card>
    
    <!-- Cancel Reason Dialog -->
    <el-dialog 
      v-model="cancelDialogVisible" 
      title="取消申请" 
      width="600px"
      :before-close="closeCancelDialog"
    >
      <p style="margin-bottom: 20px;">请输入取消申请的原因：</p>
      <el-input
        v-model="cancelReason"
        type="textarea"
        :rows="4"
        placeholder="请详细说明取消原因..."
        show-word-limit
        maxlength="500"
      />
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="closeCancelDialog">取消</el-button>
          <el-button 
            type="danger" 
            @click="confirmCancelApplication"
            :loading="updatingStatus"
          >
            确认取消
          </el-button>
        </div>
      </template>
    </el-dialog>
    
    <el-card v-if="application.attachments && application.attachments.length > 0" shadow="hover" class="detail-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">附件</span>
          <el-tag type="info">{{ application.attachments.length }} 个文件</el-tag>
        </div>
      </template>
      
      <el-table :data="application.attachments" border stripe>
        <el-table-column prop="original_name" label="文件名" min-width="200" />
        <el-table-column prop="mime_type" label="文件类型" width="150">
          <template #default="scope">
            <el-tag size="small" :type="getFileTypeColor(scope.row.mime_type)">
              {{ getFileTypeDisplay(scope.row.mime_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="file_size" label="大小" width="120">
          <template #default="scope">
            <span class="file-size">{{ formatFileSize(scope.row.file_size) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="uploaded_at" label="上传时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.uploaded_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <div class="action-buttons">
              <el-button 
                type="primary" 
                size="small"
                @click="downloadFile(scope.row)"
                class="download-button"
              >
                <el-icon><download /></el-icon>
                下载
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <!-- 生产线自定义功能 -->
    <el-card v-if="isProductionDepartment" shadow="hover" class="detail-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">生产线自定义功能</span>
          <el-tag type="warning">生产部专用</el-tag>
        </div>
      </template>
      
      <div class="production-customization">
        <div class="custom-features">
          <el-checkbox-group v-model="selectedFeatures">
            <el-checkbox v-for="feature in availableFeatures" :key="feature.id" :label="feature.id">
              {{ feature.name }}
            </el-checkbox>
          </el-checkbox-group>
        </div>
        
        <div class="custom-feature-form" v-if="selectedFeatures.length > 0">
          <h4>配置选中功能</h4>
          
          <div v-for="featureId in selectedFeatures" :key="featureId" class="feature-config">
            <h5>{{ getFeatureName(featureId) }}</h5>
            
            <el-form :model="featureConfigs[featureId]" label-position="top">
              <el-form-item v-for="(option, key) in getFeatureOptions(featureId)" 
                :key="key" 
                :label="option.label"
              >
                <el-input 
                  v-if="option.type === 'text'" 
                  v-model="featureConfigs[featureId][key]" 
                  :placeholder="option.placeholder || ''"
                />
                <el-select 
                  v-else-if="option.type === 'select'" 
                  v-model="featureConfigs[featureId][key]" 
                  :placeholder="option.placeholder || '请选择'"
                  style="width: 100%"
                >
                  <el-option 
                    v-for="item in option.options" 
                    :key="item.value" 
                    :label="item.label" 
                    :value="item.value"
                  />
                </el-select>
                <el-switch 
                  v-else-if="option.type === 'switch'" 
                  v-model="featureConfigs[featureId][key]"
                />
              </el-form-item>
            </el-form>
          </div>
        </div>
        
        <div class="feature-actions" v-if="selectedFeatures.length > 0">
          <el-button type="primary" @click="saveFeatureConfigs">保存配置</el-button>
          <el-button @click="resetFeatureConfigs">重置</el-button>
        </div>
      </div>
    </el-card>

    <!-- Action Panel -->
    <div class="action-panel">
      <el-card shadow="hover">
        <div class="action-content">
          <div class="action-info">
            <h3>快速操作</h3>
            <p>对此申请进行操作或返回列表查看其他申请</p>
          </div>
          <div class="action-buttons-group">
            <el-button 
              size="large"
              @click="goBack"
              class="action-button"
            >
              <el-icon><back /></el-icon>
              返回申请列表
            </el-button>
            <el-button 
              type="primary"
              size="large"
              @click="printPage"
              class="action-button"
            >
              <el-icon><printer /></el-icon>
              打印详情
            </el-button>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from '../utils/axios'
import { ElMessage } from 'element-plus'
import { Back, Refresh, Download, Printer, Check, Edit, Close } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const application = ref({})
const loading = ref(true)

// Analysis form state
const savingAnalysis = ref(false)
const analysisForm = ref({
  analysis_conclusion: '',
  analysis_data: '',
  analyst_name: '',
  analysis_notes: ''
})

// Status update state
const updatingStatus = ref(false)
const cancelDialogVisible = ref(false)
const cancelReason = ref('')

// Database connection status
const dbStatus = ref({
  connected: false,
  message: '正在检查数据库连接...',
  lastCheck: null
})

// Check database connection
const checkDatabaseConnection = async () => {
  try {
    await axios.get('/api/health', { timeout: 5000 })
    dbStatus.value = {
      connected: true,
      message: '数据库连接正常，所有功能可用',
      lastCheck: new Date()
    }
  } catch (error) {
    console.error('Database connection failed:', error)
    dbStatus.value = {
      connected: false,
      message: error.code === 'ECONNREFUSED' 
        ? '无法连接到数据库服务器 (端口 3002)' 
        : '数据库连接失败，请检查服务器状态',
      lastCheck: new Date()
    }
  }
}

// Mock data for development
const getMockData = (id) => {
  const mockApplications = {
    '1': {
      id: 1,
      work_order_number: 'WO20240101',
      applicant: '示例申请人A',
      department: '示例部门A',
      project: '示例项目A',
      phone: '000-0000-0000',
      email: 'applicant-a@example.com',
      urgency: 'high',
      status: 'waiting_sample',
      expected_date: '2024-01-15',
      created_at: '2024-01-01T09:00:00Z',
      samples: [
        {
          name: '样品A',
          type: '固体',
          quantity: 100,
          unit: 'g',
          hazard_level: 'low',
          storage_condition: '室温',
          description: '演示用固体样品'
        },
        {
          name: '样品B',
          type: '液体',
          quantity: 50,
          unit: 'ml',
          hazard_level: 'medium',
          storage_condition: '冷藏',
          description: '演示用液体样品'
        }
      ],
      analysisTypes: ['成分分析', '纯度检测', '杂质分析'],
      detection_method: 'HPLC-MS',
      target_compounds: '示例指标A，检测要求按演示标准执行',
      report_requirement: 'detailed',
      special_requirements: '需要加急处理，要求48小时内完成分析',
      attachments: [
        {
          id: 1,
          original_name: '样品说明书.pdf',
          filename: 'sample_desc_1.pdf',
          mime_type: 'application/pdf',
          file_size: 1024000,
          uploaded_at: '2024-01-01T09:30:00Z'
        }
      ]
    },
    '2': {
      id: 2,
      work_order_number: 'WO20240102',
      applicant: '示例申请人B',
      department: '实验室',
      project: '示例项目B',
      phone: '000-0000-0001',
      email: 'applicant-b@example.com',
      urgency: 'normal',
      status: 'processing',
      expected_date: '2024-01-20',
      created_at: '2024-01-02T10:30:00Z',
      samples: [
        {
          name: '样品B',
          type: '液体',
          quantity: 50,
          unit: 'ml',
          hazard_level: 'medium',
          storage_condition: '冷藏',
          description: '透明液体样品'
        }
      ],
      analysisTypes: ['杂质检测'],
      detection_method: 'GC-MS',
      target_compounds: '有机杂质检测',
      report_requirement: 'standard',
      special_requirements: '无',
      attachments: []
    },
    '3': {
      id: 3,
      work_order_number: 'WO20240103',
      applicant: '示例申请人C',
      department: '示例部门B',
      project: '示例项目C',
      phone: '000-0000-0002',
      email: 'applicant-c@example.com',
      urgency: 'urgent',
      status: 'completed',
      expected_date: '2024-01-10',
      created_at: '2024-01-03T14:15:00Z',
      samples: [
        {
          name: '样品C',
          type: '气体',
          quantity: 1,
          unit: 'L',
          hazard_level: 'high',
          storage_condition: '加压容器',
          description: '易燃气体样品'
        }
      ],
      analysisTypes: ['含量测定'],
      detection_method: 'ICP-MS',
      target_compounds: '金属离子含量检测',
      report_requirement: 'certificate',
      special_requirements: '需要复核确认',
      attachments: [],
      analysis_conclusion: '样品符合演示标准',
      analysis_data: '示例指标A: 99.5%\n示例指标B: 0.5%\n示例指标C: 0.1%',
      analysis_notes: '演示数据，仅用于界面预览'
    }
  }
  
  return mockApplications[id] || null
}

// 获取申请详情
const fetchApplicationDetail = async () => {
  const id = route.params.id
  loading.value = true
  
  try {
    if (dbStatus.value.connected) {
      const response = await axios.get(`/api/applications/${id}`)
      application.value = response.data
      
      // 自动填充分析表单，如果有现有数据
      if (canEditAnalysis.value) {
        analysisForm.value = {
          analysis_conclusion: application.value.analysis_conclusion || '',
          analysis_data: application.value.analysis_data || '',
          analyst_name: application.value.analyst_name || '',
          analysis_notes: application.value.analysis_notes || ''
        }
      }
    } else {
      // Use mock data when database is not connected
      const mockData = getMockData(id)
      if (mockData) {
        application.value = mockData
        ElMessage.info('使用模拟数据显示申请详情')
        
        // 自动填充分析表单，如果有现有数据
        if (canEditAnalysis.value) {
          analysisForm.value = {
            analysis_conclusion: application.value.analysis_conclusion || '',
            analysis_data: application.value.analysis_data || '',
            analyst_name: application.value.analyst_name || '',
            analysis_notes: application.value.analysis_notes || ''
          }
        }
      } else {
        throw new Error('申请不存在')
      }
    }
  } catch (error) {
    console.error('获取申请详情失败:', error)
    ElMessage.error('获取申请详情失败，请稍后重试')
    // Try mock data as fallback
    const mockData = getMockData(id)
    if (mockData) {
      application.value = mockData
      ElMessage.warning('数据库连接失败，显示模拟数据')
    } else {
      router.push('/applications')
    }
  } finally {
    loading.value = false
  }
}

// Refresh data
const refreshData = async () => {
  await checkDatabaseConnection()
  await fetchApplicationDetail()
  ElMessage.success('数据已刷新')
}

// Go back
const goBack = () => {
  const from = route.query.from
  if (from === 'analyst') {
    router.push('/analyst')
  } else {
    router.push('/applications')
  }
}

// Print page
const printPage = () => {
  window.print()
}

// 格式化部门
const formatDepartment = (dept) => {
  // 现在数据库中直接存储中文部门名称，无需转换
  return dept || '无'
}

// 格式化紧急程度
const formatUrgency = (urgency) => {
  const urgencyMap = {
    'urgent': '紧急',
    'high': '高',
    'normal': '普通',
    'low': '低'
  }
  return urgencyMap[urgency] || urgency || '普通'
}

// 获取紧急程度标签类型
const getUrgencyType = (urgency) => {
  const typeMap = {
    'urgent': 'danger',
    'high': 'warning',
    'normal': 'primary',       // 普通 - 蓝色/主色调 (更醒目)
    'low': 'success'           // 低 - 绿色/成功色 (更明显)
  }
  return typeMap[urgency] || 'primary'
}

// 格式化状态
const formatStatus = (status) => {
  const statusMap = {
    'waiting_sample': '等待样品',
    'analyzing': '分析中',
    'completed': '已完成',
    'cancelled': '已取消'
  }
  return statusMap[status] || status || '未知'
}

// 获取状态标签类型
const getStatusType = (status) => {
  const typeMap = {
    'waiting_sample': 'danger',     // 等待样品 - 红色/危险色
    'analyzing': 'warning',         // 分析中 - 橙色/警告色  
    'completed': 'success',         // 已完成 - 绿色/成功色
    'cancelled': 'info'             // 已取消 - 灰色/信息色
  }
  return typeMap[status] || 'info'
}

// 格式化报告要求
const formatReportRequirement = (requirement) => {
  const requirementMap = {
    'standard': '标准报告',
    'detailed': '详细报告',
    'simple': '简化报告',
    'certificate': '检测证书'
  }
  return requirementMap[requirement] || requirement || '标准报告'
}

// Get file type display name
const getFileTypeDisplay = (mimeType) => {
  const typeMap = {
    'application/pdf': 'PDF',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.ms-excel': 'XLS',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'image/jpeg': 'JPG',
    'image/png': 'PNG',
    'image/gif': 'GIF'
  }
  return typeMap[mimeType] || mimeType || '未知'
}

// Get file type color
const getFileTypeColor = (mimeType) => {
  if (mimeType?.includes('pdf')) return 'danger'
  if (mimeType?.includes('word')) return 'primary'
  if (mimeType?.includes('excel')) return 'success'
  if (mimeType?.includes('image')) return 'warning'
  return 'info'
}

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '无'
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (!bytes) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 下载文件
const downloadFile = (file) => {
  try {
    window.open(`/uploads/${file.filename}`, '_blank')
    ElMessage.success('开始下载文件')
  } catch {
    ElMessage.error('下载文件失败')
  }
}

// Analysis form computed properties and methods
const canEditAnalysis = computed(() => {
  // Allow editing if application is in analyzing or waiting_sample status
  // In a real app, you'd also check user role/permissions here
  return application.value.status === 'analyzing' || application.value.status === 'waiting_sample'
})

const hasAnalysisResults = computed(() => {
  return application.value.analysis_conclusion || 
         application.value.analysis_data || 
         application.value.analyst_name
})

const saveAnalysisResults = async () => {
  // Validate required fields
  if (!analysisForm.value.analysis_conclusion?.trim()) {
    ElMessage.error('请输入分析结论')
    return
  }
  if (!analysisForm.value.analysis_data?.trim()) {
    ElMessage.error('请输入检测数据')
    return
  }
  if (!analysisForm.value.analyst_name?.trim()) {
    ElMessage.error('请输入分析员姓名')
    return
  }

  savingAnalysis.value = true
  
  try {
    const response = await axios.patch(`/api/applications/${application.value.id}/analysis`, {
      analysis_conclusion: analysisForm.value.analysis_conclusion.trim(),
      analysis_result: analysisForm.value.analysis_data.trim(),
      analyst_name: analysisForm.value.analyst_name.trim()
    })
    
    // Update application data with response
    Object.assign(application.value, response.data)
    
    ElMessage.success('分析结果保存成功')
    
    // Refresh data to get updated status
    await fetchApplicationDetail()
    
  } catch (error) {
    console.error('保存分析结果失败:', error)
    ElMessage.error(error.response?.data?.error || '保存分析结果失败，请稍后重试')
  } finally {
    savingAnalysis.value = false
  }
}

// Status update computed properties and methods
const showActionPanel = computed(() => {
  // Show action panel for analysts when application is in actionable states
  const from = route.query.from
  return from === 'analyst' && 
         ['waiting_sample', 'analyzing'].includes(application.value.status)
})

const updateApplicationStatus = async (newStatus) => {
  updatingStatus.value = true
  
  try {
    const response = await axios.put(`/api/applications/${application.value.id}`, {
      status: newStatus
    })
    
    application.value.status = newStatus
    ElMessage.success(`状态已更新为: ${formatStatus(newStatus)}`)
    
  } catch (error) {
    console.error('更新状态失败:', error)
    ElMessage.error(error.response?.data?.error || '状态更新失败，请稍后重试')
  } finally {
    updatingStatus.value = false
  }
}

const showCancelDialog = () => {
  cancelReason.value = ''
  cancelDialogVisible.value = true
}

const closeCancelDialog = () => {
  cancelDialogVisible.value = false
  cancelReason.value = ''
}

const confirmCancelApplication = async () => {
  if (!cancelReason.value.trim()) {
    ElMessage.error('请输入取消原因')
    return
  }
  
  updatingStatus.value = true
  
  try {
    await axios.put(`/api/applications/${application.value.id}`, {
      status: 'cancelled',
      reject_reason: cancelReason.value.trim()
    })
    
    application.value.status = 'cancelled'
    application.value.reject_reason = cancelReason.value.trim()
    
    cancelDialogVisible.value = false
    ElMessage.success('申请已取消')
    
  } catch (error) {
    console.error('取消申请失败:', error)
    ElMessage.error(error.response?.data?.error || '取消申请失败，请稍后重试')
  } finally {
    updatingStatus.value = false
  }
}

// 生产线自定义功能相关
const isProductionDepartment = computed(() => {
  return application.value.department === 'production'
})

const selectedFeatures = ref([])

const availableFeatures = [
  { id: 'quality_control', name: '质量控制' },
  { id: 'process_optimization', name: '工艺优化' },
  { id: 'equipment_monitoring', name: '设备监控' },
  { id: 'material_tracking', name: '物料追踪' },
  { id: 'custom_reporting', name: '自定义报告' }
]

const featureConfigs = ref({
  quality_control: {
    threshold: 95,
    autoAlert: true,
    checkFrequency: 'hourly'
  },
  process_optimization: {
    targetEfficiency: 85,
    optimizationMethod: 'automatic',
    parameters: ''
  },
  equipment_monitoring: {
    devices: '',
    alertThreshold: 'medium',
    monitoringInterval: 5
  },
  material_tracking: {
    trackingMethod: 'barcode',
    materials: '',
    updateFrequency: 'realtime'
  },
  custom_reporting: {
    reportType: 'daily',
    includeCharts: true,
    recipients: ''
  }
})

// 获取功能名称
const getFeatureName = (featureId) => {
  const feature = availableFeatures.find(f => f.id === featureId)
  return feature ? feature.name : featureId
}

// 获取功能配置选项
const getFeatureOptions = (featureId) => {
  const options = {
    quality_control: {
      threshold: {
        type: 'text',
        label: '质量阈值 (%)',
        placeholder: '输入质量控制阈值'
      },
      autoAlert: {
        type: 'switch',
        label: '自动告警'
      },
      checkFrequency: {
        type: 'select',
        label: '检查频率',
        options: [
          { value: 'hourly', label: '每小时' },
          { value: 'daily', label: '每天' },
          { value: 'weekly', label: '每周' }
        ]
      }
    },
    process_optimization: {
      targetEfficiency: {
        type: 'text',
        label: '目标效率 (%)',
        placeholder: '输入目标效率'
      },
      optimizationMethod: {
        type: 'select',
        label: '优化方法',
        options: [
          { value: 'automatic', label: '自动优化' },
          { value: 'manual', label: '手动优化' },
          { value: 'hybrid', label: '混合模式' }
        ]
      },
      parameters: {
        type: 'text',
        label: '优化参数',
        placeholder: '输入需要优化的参数，用逗号分隔'
      }
    },
    equipment_monitoring: {
      devices: {
        type: 'text',
        label: '监控设备',
        placeholder: '输入需要监控的设备ID，用逗号分隔'
      },
      alertThreshold: {
        type: 'select',
        label: '告警阈值',
        options: [
          { value: 'low', label: '低' },
          { value: 'medium', label: '中' },
          { value: 'high', label: '高' }
        ]
      },
      monitoringInterval: {
        type: 'text',
        label: '监控间隔 (分钟)',
        placeholder: '输入监控间隔时间'
      }
    },
    material_tracking: {
      trackingMethod: {
        type: 'select',
        label: '追踪方法',
        options: [
          { value: 'barcode', label: '条形码' },
          { value: 'qrcode', label: '二维码' },
          { value: 'rfid', label: 'RFID' }
        ]
      },
      materials: {
        type: 'text',
        label: '追踪物料',
        placeholder: '输入需要追踪的物料，用逗号分隔'
      },
      updateFrequency: {
        type: 'select',
        label: '更新频率',
        options: [
          { value: 'realtime', label: '实时' },
          { value: 'hourly', label: '每小时' },
          { value: 'daily', label: '每天' }
        ]
      }
    },
    custom_reporting: {
      reportType: {
        type: 'select',
        label: '报告类型',
        options: [
          { value: 'daily', label: '日报' },
          { value: 'weekly', label: '周报' },
          { value: 'monthly', label: '月报' }
        ]
      },
      includeCharts: {
        type: 'switch',
        label: '包含图表'
      },
      recipients: {
        type: 'text',
        label: '接收人',
        placeholder: '输入报告接收人邮箱，用逗号分隔'
      }
    }
  }
  
  return options[featureId] || {}
}

// 保存功能配置
const saveFeatureConfigs = async () => {
  try {
    loading.value = true
    
    const configsToSave = {}
    selectedFeatures.value.forEach(featureId => {
      configsToSave[featureId] = featureConfigs.value[featureId]
    })
    
    if (dbStatus.value.connected) {
      await axios.post(`/api/applications/${application.value.id}/production-configs`, {
        configs: configsToSave
      })
      ElMessage.success('生产线功能配置已保存')
    } else {
      // 模拟保存
      setTimeout(() => {
        ElMessage.info('模拟保存成功，实际功能需要数据库连接')
      }, 1000)
    }
  } catch (error) {
    console.error('保存配置失败:', error)
    ElMessage.error('保存配置失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

// 重置功能配置
const resetFeatureConfigs = () => {
  featureConfigs.value = {
    quality_control: {
      threshold: 95,
      autoAlert: true,
      checkFrequency: 'hourly'
    },
    process_optimization: {
      targetEfficiency: 85,
      optimizationMethod: 'automatic',
      parameters: ''
    },
    equipment_monitoring: {
      devices: '',
      alertThreshold: 'medium',
      monitoringInterval: 5
    },
    material_tracking: {
      trackingMethod: 'barcode',
      materials: '',
      updateFrequency: 'realtime'
    },
    custom_reporting: {
      reportType: 'daily',
      includeCharts: true,
      recipients: ''
    }
  }
  
  selectedFeatures.value = []
  ElMessage.info('配置已重置')
}

onMounted(async () => {
  await checkDatabaseConnection()
  await fetchApplicationDetail()
  
  // Check database connection every 30 seconds
  setInterval(checkDatabaseConnection, 30000)
})
</script>

<style scoped>
.application-detail-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.connection-status {
  margin-bottom: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  border-bottom: 2px solid #ebeef5;
  padding-bottom: 20px;
}

.header-content {
  display: flex;
  flex-direction: column;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  margin: 0 0 8px 0;
}

.work-order-number {
  color: #909399;
  font-size: 16px;
  margin: 0;
  font-weight: 500;
}

.header-actions {
  display: flex;
  gap: 16px;
}

.back-button, .refresh-button {
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 8px;
  min-width: 120px;
  transition: all 0.3s;
}

.back-button {
  background: #f5f7fa;
  border: 1px solid #dcdfe6;
  color: #606266;
}

.back-button:hover {
  background: #ecf5ff;
  border-color: #b3d8ff;
  color: #409eff;
  transform: translateY(-2px);
}

.refresh-button {
  background: linear-gradient(135deg, #409eff 0%, #3788d8 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

.refresh-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(64, 158, 255, 0.4);
}

.detail-card {
  margin-bottom: 24px;
  border-radius: 12px;
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-weight: 700;
  font-size: 18px;
  color: #303133;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
}

.full-width {
  grid-column: span 2;
}

.label {
  font-weight: 600;
  color: #606266;
  font-size: 14px;
}

.value {
  color: #303133;
  font-size: 15px;
  line-height: 1.5;
}

.analysis-types {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.analysis-tag {
  margin: 0;
}

.quantity-info {
  font-weight: 600;
  color: #303133;
}

.file-size {
  font-weight: 500;
  color: #606266;
}

.multiline-text {
  white-space: pre-line;
  margin: 8px 0 0;
  line-height: 1.6;
  color: #303133;
}

.reject-reason {
  margin-top: 8px;
}

.reject-reason .el-alert {
  background-color: #fef0f0;
  border: 1px solid #fbc4c4;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.analysis-results {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.result-item {
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #67c23a;
}

.result-content {
  margin: 8px 0 0;
  line-height: 1.6;
  color: #303133;
  white-space: pre-line;
}

.action-buttons {
  display: flex;
  justify-content: center;
}

.download-button {
  padding: 8px 16px;
  font-weight: 600;
  border-radius: 6px;
  transition: all 0.3s;
}

.download-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(64, 158, 255, 0.3);
}

.action-panel {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 2px solid #ebeef5;
}

.action-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
}

.action-info h3 {
  margin: 0 0 8px 0;
  font-size: 20px;
  color: #303133;
  font-weight: 600;
}

.action-info p {
  margin: 0;
  color: #606266;
  font-size: 14px;
}

.action-buttons-group {
  display: flex;
  gap: 16px;
}

.action-button {
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 8px;
  min-width: 140px;
  height: 48px;
  transition: all 0.3s;
}

.action-button:not(.el-button--primary) {
  background: #f5f7fa;
  border: 1px solid #dcdfe6;
  color: #606266;
}

.action-button:not(.el-button--primary):hover {
  background: #ecf5ff;
  border-color: #b3d8ff;
  color: #409eff;
  transform: translateY(-2px);
}

.action-button.el-button--primary {
  background: linear-gradient(135deg, #409eff 0%, #3788d8 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

.action-button.el-button--primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(64, 158, 255, 0.4);
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .header-actions {
    justify-content: center;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
  
  .full-width {
    grid-column: span 1;
  }
  
  .action-content {
    flex-direction: column;
    gap: 20px;
    text-align: center;
  }
  
  .action-buttons-group {
    flex-direction: column;
    width: 100%;
  }
  
  .action-button {
    width: 100%;
  }
}

/* 分析结果表单样式 */
.analysis-form {
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.analysis-form .el-form-item {
  margin-bottom: 24px;
}

.analysis-form .el-form-item__label {
  font-weight: 600;
  color: #303133;
  font-size: 14px;
}

.analysis-form .el-textarea__inner {
  resize: vertical;
  min-height: 100px;
}

.analysis-results .result-item {
  margin-bottom: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid #409eff;
}

.analysis-results .result-item:last-child {
  margin-bottom: 0;
}

.analysis-results .label {
  font-weight: 600;
  color: #303133;
  display: block;
  margin-bottom: 8px;
}

.analysis-results .result-content {
  color: #606266;
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.empty-analysis {
  text-align: center;
  padding: 40px 20px;
}

.card-header .header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 页面头部状态和操作按钮组 */
.status-actions-group {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-right: 16px;
  padding: 8px 16px;
  background: rgba(64, 158, 255, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(64, 158, 255, 0.2);
}

.action-button-header {
  font-size: 14px;
  padding: 8px 16px;
  min-width: 100px;
}

/* 操作面板样式 */
.action-panel {
  border: 2px solid #409eff;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
}

.action-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 20px;
  text-align: center;
}

.current-status {
  font-size: 16px;
  color: #303133;
}

.current-status strong {
  color: #409eff;
}

.action-buttons-group {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
}

.action-button {
  min-width: 120px;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
}

/* 生产线自定义功能样式 */
.production-customization {
  padding: 20px;
}

.custom-features {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 24px;
}

.custom-feature-form {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 24px;
}

.custom-feature-form h4 {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 18px;
  color: #303133;
}

.feature-config {
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #ebeef5;
}

.feature-config:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.feature-config h5 {
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 16px;
  color: #409eff;
}

.feature-actions {
  display: flex;
  gap: 16px;
}

@media print {
  .page-header .header-actions,
  .action-panel,
  .connection-status,
  .production-customization {
    display: none;
  }
  
  .detail-card {
    box-shadow: none;
    border: 1px solid #ddd;
  }
}
</style>
