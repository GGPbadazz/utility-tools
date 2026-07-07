<template>
  <div class="analyst-dashboard">
    <div class="page-header">
      <h2>分析师工作台</h2>
      <p>管理和处理分析申请</p>
    </div>

    <!-- Statistics Cards -->
    <div class="statistics-cards">
      <div 
        class="stat-card" 
        :class="{ active: statusFilter === 'waiting_sample' }"
        @click="toggleStatusFilter('waiting_sample')"
      >
        <div class="stat-icon waiting">
          <el-icon><Clock /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ getStatusCount('waiting_sample') }}</div>
          <div class="stat-label">等待样品</div>
        </div>
      </div>
      
      <div 
        class="stat-card" 
        :class="{ active: statusFilter === 'analyzing' }"
        @click="toggleStatusFilter('analyzing')"
      >
        <div class="stat-icon processing">
          <el-icon><Loading /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ getStatusCount('analyzing') }}</div>
          <div class="stat-label">分析中</div>
        </div>
      </div>
      
      <div 
        class="stat-card" 
        :class="{ active: statusFilter === 'completed' }"
        @click="toggleStatusFilter('completed')"
      >
        <div class="stat-icon completed">
          <el-icon><Check /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ getStatusCount('completed') }}</div>
          <div class="stat-label">已完成</div>
        </div>
      </div>
      
      <div 
        class="stat-card" 
        :class="{ active: statusFilter === 'cancelled' }"
        @click="toggleStatusFilter('cancelled')"
      >
        <div class="stat-icon cancelled">
          <el-icon><Close /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ getStatusCount('cancelled') }}</div>
          <div class="stat-label">已取消</div>
        </div>
      </div>
      
      <div 
        class="stat-card" 
        :class="{ active: statusFilter === '' }"
        @click="toggleStatusFilter('')"
      >
        <div class="stat-icon total">
          <el-icon><List /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ applications.length }}</div>
          <div class="stat-label">全部</div>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="loading">
      <p>正在加载数据...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="error">
      <p>加载失败: {{ error }}</p>
      <el-button @click="fetchApplications">重试</el-button>
    </div>

    <!-- Applications table -->
    <div v-else>
      <el-card>
        <template #header>
          <div class="card-header">
            <span>申请列表</span>
            <div class="header-actions">
              <el-input
                v-model="searchKeyword"
                placeholder="搜索工单号、申请人等"
                @input="handleSearch"
                clearable
                style="width: 250px; margin-right: 12px;"
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
              <el-select 
                v-model="urgencyFilter" 
                placeholder="紧急程度" 
                @change="handleFilter" 
                style="width: 120px; margin-right: 12px;"
                clearable
              >
                <el-option label="全部" value="" />
                <el-option label="低" value="low" />
                <el-option label="中" value="normal" />
                <el-option label="高" value="high" />
                <el-option label="紧急" value="urgent" />
              </el-select>
              <el-button @click="fetchApplications" :loading="loading">
                <el-icon><Refresh /></el-icon>
                刷新
              </el-button>
            </div>
          </div>
        </template>
        
        <el-table
          :data="paginatedApplications"
          style="width: 100%"
          border
          stripe
          @row-click="handleRowClick"
        >
          <el-table-column prop="work_order_number" label="工单号" width="150">
            <template #default="scope">
              <el-tag type="info" size="small">{{ scope.row.work_order_number }}</el-tag>
            </template>
          </el-table-column>
          
          <el-table-column prop="applicant" label="申请人" width="70" />
          
          <el-table-column prop="department" label="部门" width="80">
            <template #default="scope">
              <el-tag size="small">{{ formatDepartment(scope.row.department) }}</el-tag>
            </template>
          </el-table-column>
          
           <el-table-column label="样品名称" min-width="100" show-overflow-tooltip>
            <template #default="{ row }">
              <div v-if="row.samples && row.samples.length > 0">
                <el-tag 
                  v-for="(sample, index) in row.samples.slice(0, 2)" 
                  :key="sample.id || index"
                  size="small"
                  style="margin-right: 4px; margin-bottom: 2px;"
                >
                  {{ sample.name }}
                </el-tag>
                <span v-if="row.samples.length > 2" class="more-samples">
                  +{{ row.samples.length - 2 }}
                </span>
              </div>
              <span v-else class="no-samples">无样品信息</span>
            </template>
          </el-table-column>
          
          <el-table-column label="分析类型" min-width="80" show-overflow-tooltip>
            <template #default="{ row }">
              <div v-if="row.analysisTypes && row.analysisTypes.length > 0">
                <el-tag 
                  v-for="(type, index) in row.analysisTypes.slice(0, 2)" 
                  :key="index"
                  type="warning"
                  size="small"
                  style="margin-right: 4px; margin-bottom: 2px;"
                >
                  {{ type }}
                </el-tag>
                <span v-if="row.analysisTypes.length > 2" class="more-types">
                  +{{ row.analysisTypes.length - 2 }}
                </span>
              </div>
              <span v-else class="no-types">无分析类型</span>
            </template>
          </el-table-column>
          
          <el-table-column label="目标化合物/反应环节/待测物" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">
              <div v-if="row.production_line">
                <!-- 快速申请：显示反应环节/待测物 -->
                <div class="production-info">
                  <el-tag type="warning" size="small" v-if="row.reflection_step">
                    {{ row.reflection_step }}
                  </el-tag>
                  <span v-else class="no-reflection">无反应环节信息</span>
                </div>
              </div>
              <div v-else>
                <!-- 标准申请：显示目标化合物 -->
                <span v-if="row.target_compounds" class="target-compounds">
                  {{ row.target_compounds }}
                </span>
                <span v-else class="no-target">无目标化合物信息</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="urgency" label="紧急程度" width="90">
            <template #default="scope">
              <el-tag :type="getUrgencyType(scope.row.urgency)" size="small">
                {{ getUrgencyText(scope.row.urgency) }}
              </el-tag>
            </template>
          </el-table-column>
          
          <el-table-column prop="expected_date" label="期望完成" width="100">
            <template #default="scope">
              <span v-if="scope.row.expected_date" :class="getDueDateClass(scope.row.expected_date)">
                {{ formatDueDate(scope.row.expected_date) }}
              </span>
              <span v-else class="no-date">无要求</span>
            </template>
          </el-table-column>
          
          <el-table-column prop="status" label="状态" width="100">
            <template #default="scope">
              <el-tag :type="getStatusType(scope.row.status)" size="small">
                {{ formatStatus(scope.row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          
          <el-table-column prop="created_at" label="申请时间" width="160">
            <template #default="scope">
              {{ formatDate(scope.row.created_at) }}
            </template>
          </el-table-column>
          
          <el-table-column label="操作" width="280" fixed="right">
            <template #default="scope">
              <el-button 
                type="primary" 
                size="small"
                @click.stop="viewDetail(scope.row.id)"
              >
                查看详情
              </el-button>
              <el-button 
                v-if="scope.row.status === 'waiting_sample'"
                type="success" 
                size="small"
                @click.stop="updateStatus(scope.row.id, 'analyzing')"
              >
                开始分析
              </el-button>
              <el-button 
                v-if="scope.row.status === 'analyzing'"
                type="warning" 
                size="small"
                @click.stop="openAnalysisResultDialog(scope.row)"
              >
                提交结果
              </el-button>
              <el-button 
                v-if="['waiting_sample', 'analyzing'].includes(scope.row.status)"
                type="danger" 
                size="small"
                @click.stop="cancelApplication(scope.row)"
              >
                取消申请
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
      
      <!-- Pagination -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="filteredApplications.length"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>
  </div>
  
  <!-- Analysis Result Dialog -->
  <el-dialog
    v-model="analysisResultDialogVisible"
    title="提交分析结果"
    width="600px"
    :before-close="closeAnalysisResultDialog"
  >
    <p style="margin-bottom: 16px;">
      工单号：<strong>{{ currentAnalysisApplication?.work_order_number }}</strong>
    </p>
    <el-form :model="analysisResultForm" label-width="90px">
      <el-form-item label="分析师姓名" required>
        <el-input v-model="analysisResultForm.analyst_name" placeholder="请输入分析师姓名" />
      </el-form-item>
      <el-form-item label="分析结论" required>
        <el-select v-model="analysisResultForm.analysis_conclusion" placeholder="请选择分析结论" style="width:100%">
          <el-option label="合格" value="合格" />
          <el-option label="不合格" value="不合格" />
          <el-option label="需复检" value="需复检" />
          <el-option label="无法判定" value="无法判定" />
        </el-select>
      </el-form-item>
      <el-form-item label="检测数据">
        <el-input
          v-model="analysisResultForm.analysis_result"
          type="textarea"
          :rows="5"
          placeholder="请输入详细的检测数据和分析结果..."
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="closeAnalysisResultDialog">取消</el-button>
        <el-button
          type="primary"
          :loading="submittingResult"
          @click="submitAnalysisResult"
        >
          提交结果
        </el-button>
      </div>
    </template>
  </el-dialog>

  <!-- Cancel Application Dialog -->
  <el-dialog 
    v-model="cancelDialogVisible" 
    title="取消申请" 
    width="600px"
    :before-close="closeCancelDialog"
  >
    <p style="margin-bottom: 20px;">
      确定要取消申请 <strong>{{ currentCancelApplication?.work_order_number }}</strong> 吗？
    </p>
    <p style="margin-bottom: 20px;">请输入取消原因：</p>
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
        >
          确认取消
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { 
  Clock, 
  Loading, 
  Check, 
  List, 
  Refresh, 
  Search,
  Close
} from '@element-plus/icons-vue'
import axios from '../utils/axios'

const router = useRouter()
const applications = ref([])
const loading = ref(true)
const error = ref('')

// 搜索和筛选
const searchKeyword = ref('')
const statusFilter = ref('')
const urgencyFilter = ref('')

// 分页
const currentPage = ref(1)
const pageSize = ref(20)

// 取消申请相关
const cancelDialogVisible = ref(false)
const currentCancelApplication = ref(null)
const cancelReason = ref('')

// 分析结果提交相关
const analysisResultDialogVisible = ref(false)
const currentAnalysisApplication = ref(null)
const submittingResult = ref(false)
const analysisResultForm = ref({
  analyst_name: '',
  analysis_conclusion: '',
  analysis_result: ''
})

const openAnalysisResultDialog = (application) => {
  currentAnalysisApplication.value = application
  analysisResultForm.value = {
    analyst_name: '',
    analysis_conclusion: '',
    analysis_result: ''
  }
  analysisResultDialogVisible.value = true
}

const closeAnalysisResultDialog = () => {
  analysisResultDialogVisible.value = false
  currentAnalysisApplication.value = null
}

const submitAnalysisResult = async () => {
  const form = analysisResultForm.value
  if (!form.analyst_name.trim()) {
    ElMessage.error('请输入分析师姓名')
    return
  }
  if (!form.analysis_conclusion) {
    ElMessage.error('请选择分析结论')
    return
  }

  try {
    submittingResult.value = true
    await axios.patch(`/api/applications/${currentAnalysisApplication.value.id}/analysis`, {
      analyst_name: form.analyst_name.trim(),
      analysis_conclusion: form.analysis_conclusion,
      analysis_result: form.analysis_result.trim()
    })
    ElMessage.success('分析结果提交成功，工单已完成')
    closeAnalysisResultDialog()
    fetchApplications()
  } catch (err) {
    console.error('提交分析结果失败:', err)
    ElMessage.error('提交失败：' + (err.response?.data?.message || err.message))
  } finally {
    submittingResult.value = false
  }
}

// 计算属性 - 筛选后的数据
const filteredApplications = computed(() => {
  let filtered = applications.value

  // 搜索过滤
  if (searchKeyword.value) {
    filtered = filtered.filter(app => 
      app.applicant?.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
      app.department?.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
      app.work_order_number?.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
      app.project?.toLowerCase().includes(searchKeyword.value.toLowerCase())
    )
  }

  // 状态过滤
  if (statusFilter.value) {
    filtered = filtered.filter(app => app.status === statusFilter.value)
  }

  // 紧急程度过滤
  if (urgencyFilter.value) {
    filtered = filtered.filter(app => app.urgency === urgencyFilter.value)
  }

  return filtered
})

// 分页数据
const paginatedApplications = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredApplications.value.slice(start, end)
})

// 获取申请列表
const fetchApplications = async () => {
  loading.value = true
  error.value = ''
  
  try {
    console.log('Fetching applications from API...')
    const response = await axios.get('/api/applications')
    console.log('API Response:', response.data)
    
    applications.value = response.data || []
    console.log('Applications loaded:', applications.value.length)
    
  } catch (err) {
    console.error('获取申请列表失败:', err)
    error.value = err.message || '获取数据失败'
    ElMessage.error('获取申请列表失败')
  } finally {
    loading.value = false
  }
}

// 获取状态计数
const getStatusCount = (status) => {
  return applications.value.filter(app => app.status === status).length
}

// 状态筛选切换
const toggleStatusFilter = (status) => {
  if (statusFilter.value === status) {
    statusFilter.value = ''
  } else {
    statusFilter.value = status
  }
  currentPage.value = 1
}

// 搜索处理
const handleSearch = () => {
  currentPage.value = 1
}

// 筛选处理
const handleFilter = () => {
  currentPage.value = 1
}

// 分页处理
const handleSizeChange = (val) => {
  pageSize.value = val
  currentPage.value = 1
}

const handleCurrentChange = (val) => {
  currentPage.value = val
}

// Handle row click
const handleRowClick = (row) => {
  viewDetail(row.id)
}

// 查看详情 - 添加来源标识
const viewDetail = (id) => {
  router.push({ 
    path: `/applications/${id}`, 
    query: { from: 'analyst' } 
  })
}

// 更新状态
const updateStatus = async (id, newStatus) => {
  try {
    await axios.put(`/api/applications/${id}`, { status: newStatus })
    ElMessage.success('状态更新成功')
    fetchApplications()
  } catch (err) {
    console.error('更新状态失败:', err)
    ElMessage.error('更新状态失败')
  }
}

// 取消申请
const cancelApplication = (application) => {
  currentCancelApplication.value = application
  cancelReason.value = ''
  cancelDialogVisible.value = true
}

const confirmCancelApplication = async () => {
  if (!cancelReason.value.trim()) {
    ElMessage.error('请输入取消原因')
    return
  }
  
  try {
    await axios.put(`/api/applications/${currentCancelApplication.value.id}`, {
      status: 'cancelled',
      reject_reason: cancelReason.value.trim()
    })
    
    ElMessage.success('申请已取消')
    cancelDialogVisible.value = false
    fetchApplications()
    
  } catch (err) {
    console.error('取消申请失败:', err)
    ElMessage.error('取消申请失败')
  }
}

const closeCancelDialog = () => {
  cancelDialogVisible.value = false
  cancelReason.value = ''
  currentCancelApplication.value = null
}

// 格式化期望完成日期
const formatDueDate = (dateString) => {
  if (!dateString) return '无要求'
  
  const today = new Date()
  const expectedDate = new Date(dateString)
  const timeDiff = expectedDate.getTime() - today.getTime()
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24))
  
  if (daysDiff > 0) {
    return `还剩${daysDiff}天`
  } else if (daysDiff === 0) {
    return '今天到期'
  } else {
    return `逾期${Math.abs(daysDiff)}天`
  }
}

// 获取期望完成日期的样式类
const getDueDateClass = (dateString) => {
  if (!dateString) return ''
  
  const today = new Date()
  const expectedDate = new Date(dateString)
  const timeDiff = expectedDate.getTime() - today.getTime()
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24))
  
  if (daysDiff > 3) {
    return 'due-normal'
  } else if (daysDiff > 0) {
    return 'due-warning'
  } else {
    return 'due-overdue'
  }
}

// 格式化部门
const formatDepartment = (dept) => {
  return dept || '未知部门'
}

// 格式化状态
const formatStatus = (status) => {
  const statusMap = {
    'waiting_sample': '等待样品',
    'analyzing': '分析中',
    'completed': '已完成',
    'cancelled': '已取消'
  }
  return statusMap[status] || status || '未知状态'
}

// 获取状态标签类型
const getStatusType = (status) => {
  const typeMap = {
    'waiting_sample': 'warning',
    'analyzing': 'primary',
    'completed': 'success',
    'cancelled': 'info'
  }
  return typeMap[status] || 'info'
}

// 获取紧急程度标签类型
const getUrgencyType = (urgency) => {
  const types = {
    low: 'info',
    normal: 'success',
    high: 'warning',
    urgent: 'danger'
  }
  return types[urgency] || 'info'
}

// 获取紧急程度文本
const getUrgencyText = (urgency) => {
  const texts = {
    low: '低',
    normal: '中',
    high: '高',
    urgent: '紧急'
  }
  return texts[urgency] || '未知'
}

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '无日期'
  try {
    const date = new Date(dateString)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (error) {
    return dateString
  }
}

onMounted(() => {
  console.log('AnalystDashboardNew mounted')
  fetchApplications()
})
</script>

<style scoped>
.analyst-dashboard {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0 0 8px 0;
  color: #303133;
}

.page-header p {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.statistics-cards {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.stat-card.active {
  border: 2px solid #409eff;
  background: #f0f8ff;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: white;
}

.stat-icon.waiting {
  background: #e6a23c;
}

.stat-icon.processing {
  background: #409eff;
}

.stat-icon.completed {
  background: #67c23a;
}

.stat-icon.cancelled {
  background: #909399;
}

.stat-icon.total {
  background: #303133;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #606266;
}

.loading {
  text-align: center;
  padding: 50px;
  color: #909399;
}

.error {
  text-align: center;
  padding: 50px;
  color: #f56c6c;
}

.error p {
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.header-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.pagination-container {
  display: flex;
  justify-content: center;
  padding: 24px 0;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-top: 20px;
}

@media (max-width: 1200px) {
  .statistics-cards {
    grid-template-columns: repeat(3, 1fr);
  }
  
  .header-actions {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 768px) {
  .statistics-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .header-actions {
    flex-direction: column;
    width: 100%;
  }
  
  .header-actions > * {
    width: 100% !important;
    margin-right: 0 !important;
    margin-bottom: 8px;
  }
}

@media (max-width: 480px) {
  .statistics-cards {
    grid-template-columns: 1fr;
  }
}

/* 期望完成日期样式 */
.due-normal {
  color: #67c23a;
  font-weight: 500;
}

.due-warning {
  color: #e6a23c;
  font-weight: 600;
}

.due-overdue {
  color: #f56c6c;
  font-weight: 600;
}

.no-date {
  color: #c0c4cc;
  font-style: italic;
}
</style>
