<template>
  <div class="settings-container">
    <div class="settings-header">
      <h1 class="settings-title">系统设置</h1>
      <p class="settings-description">管理系统基础配置和数据</p>
    </div>

    <div class="settings-content">
      <el-row :gutter="20">
        <!-- 基础设置 -->
        <el-col :xs="24" :sm="12" :lg="8">
          <el-card class="setting-card basic-settings">
            <template #header>
              <div class="card-header">
                <el-icon class="header-icon"><setting /></el-icon>
                <span>基础配置</span>
              </div>
            </template>
            <div class="setting-list">
              <div class="setting-item">
                <span class="setting-label">系统名称</span>
                <span class="setting-value">实验室工单系统</span>
              </div>
              <div class="setting-item">
                <span class="setting-label">版本号</span>
                <span class="setting-value">v1.0.0</span>
              </div>
              <div class="setting-item">
                <span class="setting-label">运行模式</span>
                <span class="setting-value">生产环境</span>
              </div>
            </div>
          </el-card>
        </el-col>

        <!-- 数据管理 -->
        <el-col :xs="24" :sm="12" :lg="8">
          <el-card class="setting-card data-management">
            <template #header>
              <div class="card-header">
                <el-icon class="header-icon"><setting /></el-icon>
                <span>数据管理</span>
              </div>
            </template>
            <div class="setting-actions">
              <el-button 
                type="primary" 
                @click="exportData"
                :loading="exporting"
                class="action-button"
              >
                <el-icon><download /></el-icon>
                导出数据
              </el-button>
              <el-button 
                type="success" 
                @click="triggerImportData"
                :loading="importing"
                class="action-button"
              >
                <el-icon><upload /></el-icon>
                导入数据
              </el-button>
              <el-button 
                type="info" 
                @click="downloadTemplate"
                class="action-button template-button"
              >
                <el-icon><download /></el-icon>
                下载模板
              </el-button>
              <el-button 
                type="danger" 
                @click="confirmClearAllWorkOrders"
                class="action-button clear-button"
              >
                <el-icon><warning /></el-icon>
                清除所有工单
              </el-button>
            </div>
            <!-- 隐藏的文件输入框 -->
            <input 
              ref="fileInput" 
              type="file" 
              accept=".xlsx,.xls,.csv" 
              @change="handleFileImport" 
              style="display: none;"
            />
          </el-card>
        </el-col>

        <!-- 系统状态 -->
        <el-col :xs="24" :sm="12" :lg="8">
          <el-card class="setting-card system-status">
            <template #header>
              <div class="card-header">
                <el-icon class="header-icon"><setting /></el-icon>
                <span>系统状态</span>
              </div>
            </template>
            <div class="setting-list">
              <div class="setting-item">
                <span class="setting-label">数据库状态</span>
                <el-tag :type="dbStatus.type" size="small">{{ dbStatus.text }}</el-tag>
              </div>
              <div class="setting-item">
                <span class="setting-label">总申请数</span>
                <span class="setting-value">{{ stats.totalApplications }}</span>
              </div>
              <div class="setting-item">
                <span class="setting-label">已完成</span>
                <span class="setting-value" style="color:#67c23a">{{ stats.completed }}</span>
              </div>
              <div class="setting-item">
                <span class="setting-label">分析中</span>
                <span class="setting-value" style="color:#409eff">{{ stats.analyzing }}</span>
              </div>
              <div class="setting-item">
                <span class="setting-label">等待样品</span>
                <span class="setting-value" style="color:#e6a23c">{{ stats.waiting }}</span>
              </div>
              <div class="setting-item">
                <span class="setting-label">本月完成</span>
                <span class="setting-value">{{ stats.monthCompleted }}</span>
              </div>
              <div class="setting-item">
                <span class="setting-label">紧急待处理</span>
                <span class="setting-value" style="color:#f56c6c">{{ stats.urgentPending }}</span>
              </div>
            </div>
            <el-button 
              type="info" 
              @click="refreshStats"
              :loading="refreshing"
              size="small"
              class="refresh-button"
            >
              <el-icon><refresh /></el-icon>
              刷新状态
            </el-button>
          </el-card>
        </el-col>
      </el-row>

      <!-- 部门管理 -->
      <el-row :gutter="20" style="margin-top: 20px;">
        <el-col :span="24">
          <el-card class="setting-card management-card">
            <template #header>
              <div class="card-header">
                <el-icon class="header-icon"><setting /></el-icon>
                <span>部门管理</span>
                <el-button 
                  type="primary" 
                  size="small" 
                  @click="showAddDepartment = true"
                  class="header-button"
                >
                  <el-icon><plus /></el-icon>
                  添加部门
                </el-button>
              </div>
            </template>
            <div class="table-container">
              <el-table :data="departments" stripe class="management-table">
                <el-table-column prop="name" label="部门名称" min-width="120" />
                <el-table-column prop="description" label="描述" min-width="150" show-overflow-tooltip />
                <el-table-column label="创建时间" width="180" class-name="date-column">
                  <template #default="{ row }">
                    {{ formatDate(row.created_at) }}
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="160" fixed="right">
                  <template #default="{ row }">
                    <el-button 
                      type="primary" 
                      size="small" 
                      @click="editDepartment(row)"
                      style="margin-right: 8px;"
                    >
                      编辑
                    </el-button>
                    <el-button 
                      type="danger" 
                      size="small" 
                      @click="deleteDepartment(row.id)"
                    >
                      删除
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 生产线管理 -->
      <el-row :gutter="20" style="margin-top: 20px;">
        <el-col :span="24">
          <el-card class="setting-card management-card">
            <template #header>
              <div class="card-header">
                <el-icon class="header-icon"><setting /></el-icon>
                <span>生产线管理</span>
                <el-button 
                  type="primary" 
                  size="small" 
                  @click="openAddProductionLineDialog"
                  class="header-button"
                >
                  <el-icon><plus /></el-icon>
                  添加生产线
                </el-button>
              </div>
            </template>
            <div class="table-container">
              <el-table :data="productionLines" stripe class="management-table">
                <el-table-column prop="name" label="生产线名称" min-width="120" />
                <el-table-column prop="description" label="描述" min-width="150" show-overflow-tooltip />
                <el-table-column prop="is_active" label="状态" width="100">
                  <template #default="{ row }">
                    <el-tag :type="row.is_active ? 'success' : 'danger'">
                      {{ row.is_active ? '启用' : '禁用' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="180" fixed="right">
                  <template #default="{ row }">
                    <el-button 
                      type="primary" 
                      size="small" 
                      @click="editProductionLine(row)"
                    >
                      编辑
                    </el-button>
                    <el-button 
                      :type="row.is_active ? 'warning' : 'success'" 
                      size="small" 
                      @click="toggleProductionLine(row)"
                    >
                      {{ row.is_active ? '禁用' : '启用' }}
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 添加/编辑部门对话框 -->
    <el-dialog 
      v-model="showAddDepartment" 
      :title="editingDepartment ? '编辑部门' : '添加部门'" 
      width="400px"
    >
      <el-form :model="newDepartment" label-width="80px">
        <el-form-item label="部门名称" required>
          <el-input v-model="newDepartment.name" placeholder="请输入部门名称" />
        </el-form-item>
        <el-form-item label="部门描述">
          <el-input 
            v-model="newDepartment.description" 
            type="textarea" 
            :rows="3"
            placeholder="请输入部门描述（可选）" 
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cancelDepartmentEdit">取消</el-button>
        <el-button 
          type="primary" 
          @click="saveDepartment"
          :loading="adding"
        >
          {{ editingDepartment ? '保存' : '添加' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 添加/编辑生产线对话框 -->
    <el-dialog 
      v-model="showProductionLineDialog" 
      :title="editingProductionLine ? '编辑生产线' : '添加生产线'" 
      width="400px"
    >
      <el-form :model="currentProductionLine" label-width="100px">
        <el-form-item label="生产线名称" required>
          <el-input v-model="currentProductionLine.name" placeholder="请输入生产线名称" />
        </el-form-item>
        <el-form-item label="生产线描述">
          <el-input 
            v-model="currentProductionLine.description" 
            type="textarea" 
            :rows="3"
            placeholder="请输入生产线描述（可选）" 
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeProductionLineDialog">取消</el-button>
        <el-button 
          type="primary" 
          @click="saveProductionLine"
          :loading="saving"
        >
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 隐藏的文件输入框 -->
    <input 
      ref="fileInput" 
      type="file" 
      accept=".xlsx,.xls,.csv" 
      @change="handleFileImport"
      style="display: none"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Setting, Download, Upload, Warning, Refresh, 
  OfficeBuilding, Plus 
} from '@element-plus/icons-vue'
import axios from '../utils/axios'
import * as XLSX from 'xlsx'

// 状态数据
const stats = reactive({
  totalApplications: 0,
  completed: 0,
  analyzing: 0,
  waiting: 0,
  monthCompleted: 0,
  urgentPending: 0
})

const dbStatus = ref({
  type: 'success',
  text: '正常'
})

const departments = ref([])
const showAddDepartment = ref(false)
const editingDepartment = ref(null)
const newDepartment = reactive({
  name: '',
  description: ''
})

// 生产线管理
const productionLines = ref([])
const showAddProductionLine = ref(false)
const showProductionLineDialog = ref(false)
const editingProductionLine = ref(false)
const currentProductionLine = reactive({
  id: null,
  name: '',
  description: ''
})

// 加载状态
const exporting = ref(false)
const importing = ref(false)
const refreshing = ref(false)
const adding = ref(false)
const saving = ref(false)

// 获取系统统计
const getStats = async () => {
  try {
    const res = await axios.get('/api/system/stats')
    const d = res.data
    stats.totalApplications = d.total ?? 0
    stats.completed = d.completed ?? 0
    stats.analyzing = d.analyzing ?? 0
    stats.waiting = d.waiting ?? 0
    stats.monthCompleted = d.monthCompleted ?? 0
    stats.urgentPending = d.urgentPending ?? 0
  } catch (error) {
    console.error('获取统计数据失败:', error)
    // 降级：直接统计列表长度
    try {
      const appsResponse = await axios.get('/api/applications')
      stats.totalApplications = appsResponse.data.length
    } catch (_) {}
  }
}

// 获取部门列表
const getDepartments = async () => {
  try {
    const response = await axios.get('/api/departments')
    departments.value = response.data
  } catch (error) {
    console.error('获取部门列表失败:', error)
  }
}

// 检查数据库状态
const checkDatabaseStatus = async () => {
  try {
    await axios.get('/api/health')
    dbStatus.value = { type: 'success', text: '正常' }
  } catch (error) {
    dbStatus.value = { type: 'danger', text: '异常' }
  }
}

// 导出数据
const exportData = async () => {
  try {
    exporting.value = true
    const response = await axios.get('/api/export/applications', {
      responseType: 'blob'
    })
    
    const blob = new Blob([response.data])
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `applications_export_${new Date().toISOString().split('T')[0]}.xlsx`
    a.click()
    window.URL.revokeObjectURL(url)
    
    ElMessage.success('数据导出成功')
  } catch (error) {
    ElMessage.error('数据导出失败')
  } finally {
    exporting.value = false
  }
}

// 导入数据
const fileInput = ref(null)

const triggerImportData = () => {
  fileInput.value.click()
}

const downloadTemplate = () => {
  // 创建与导出格式完全一致的空白模板
  const templateData = [
    {
      '工单号': '',
      '申请人': '',
      '部门': '',
      '项目': '',
      '联系电话': '',
      '紧急程度': '',
      '期望完成日期': '',
      '样品名称': '',
      '样品类型': '',
      '样品数量': '',
      '目标化合物': '',
      '检测方法': '',
      '报告要求': '',
      '特殊要求': '',
      '状态': '',
      '分析结论': '',
      '检测数据': '',
      '分析备注': '',
      '申请时间': '',
      '更新时间': ''
    }
  ]
  
  // 创建工作簿
  const ws = XLSX.utils.json_to_sheet(templateData)
  
  // 设置列宽（与导出格式一致）
  const colWidths = [
    { wch: 12 }, // 工单号
    { wch: 10 }, // 申请人
    { wch: 10 }, // 部门
    { wch: 20 }, // 项目
    { wch: 15 }, // 联系电话
    { wch: 10 }, // 紧急程度
    { wch: 15 }, // 期望完成日期
    { wch: 20 }, // 样品名称
    { wch: 15 }, // 样品类型
    { wch: 15 }, // 样品数量
    { wch: 30 }, // 目标化合物
    { wch: 15 }, // 检测方法
    { wch: 15 }, // 报告要求
    { wch: 30 }, // 特殊要求
    { wch: 10 }, // 状态
    { wch: 30 }, // 分析结论
    { wch: 30 }, // 检测数据
    { wch: 30 }, // 分析备注
    { wch: 20 }, // 申请时间
    { wch: 20 }  // 更新时间
  ]
  ws['!cols'] = colWidths
  
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '申请数据')
  
  // 下载文件
  XLSX.writeFile(wb, '申请数据导入模板.xlsx')
}

const handleFileImport = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  try {
    importing.value = true
    
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await axios.post('/api/import/applications', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    
    ElMessage.success(response.data.message)
    if (response.data.errors && response.data.errors.length > 0) {
      console.warn('导入警告:', response.data.errors)
      ElMessage.warning(`导入完成，但有${response.data.errors.length}个警告，请查看控制台`)
    }
    
    await getStats()
  } catch (error) {
    ElMessage.error('数据导入失败: ' + (error.response?.data?.error || error.message))
  } finally {
    importing.value = false
    // 重置文件输入框
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
}

// 确认清除所有工单
const confirmClearAllWorkOrders = async () => {
  try {
    await ElMessageBox.confirm(
      '警告：此操作将删除所有工单历史记录，包括申请记录、样品数据和分析结果，且不可恢复。请确认是否继续？',
      '清除所有工单',
      {
        type: 'error',
        confirmButtonText: '确认清除',
        cancelButtonText: '取消'
      }
    )
    
    // 执行工单清除
    await axios.post('/api/system/clear-workorders')
    ElMessage.success('所有工单已清除完成')
    await getStats()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('工单清除失败: ' + (error.response?.data?.error || error.message))
    }
  }
}

// 刷新统计
const refreshStats = async () => {
  refreshing.value = true
  await Promise.all([
    getStats(),
    checkDatabaseStatus(),
    getDepartments()
  ])
  refreshing.value = false
  ElMessage.success('状态已刷新')
}

// 添加部门
// 保存部门（添加或编辑）
const saveDepartment = async () => {
  if (!newDepartment.name.trim()) {
    ElMessage.error('请输入部门名称')
    return
  }
  
  try {
    adding.value = true
    
    if (editingDepartment.value) {
      // 编辑模式
      await axios.put(`/api/departments/${editingDepartment.value.id}`, {
        name: newDepartment.name,
        description: newDepartment.description
      })
      ElMessage.success('部门更新成功')
    } else {
      // 添加模式
      await axios.post('/api/departments', {
        name: newDepartment.name,
        description: newDepartment.description
      })
      ElMessage.success('部门添加成功')
    }
    
    cancelDepartmentEdit()
    await getDepartments()
  } catch (error) {
    ElMessage.error(editingDepartment.value ? '部门更新失败' : '部门添加失败')
  } finally {
    adding.value = false
  }
}

// 编辑部门
const editDepartment = (department) => {
  editingDepartment.value = department
  newDepartment.name = department.name
  newDepartment.description = department.description || ''
  showAddDepartment.value = true
}

// 取消编辑
const cancelDepartmentEdit = () => {
  showAddDepartment.value = false
  editingDepartment.value = null
  newDepartment.name = ''
  newDepartment.description = ''
}

// 删除部门
const deleteDepartment = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除此部门吗？', '确认删除', {
      type: 'warning'
    })
    
    await axios.delete(`/api/departments/${id}`)
    ElMessage.success('部门删除成功')
    await getDepartments()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('部门删除失败')
    }
  }
}

// 获取生产线列表
const getProductionLines = async () => {
  try {
    const response = await axios.get('/api/production-lines')
    productionLines.value = response.data
  } catch (error) {
    console.error('获取生产线列表失败:', error)
    ElMessage.error('获取生产线列表失败')
  }
}

// 打开添加生产线对话框
const openAddProductionLineDialog = () => {
  editingProductionLine.value = false
  currentProductionLine.id = null
  currentProductionLine.name = ''
  currentProductionLine.description = ''
  showProductionLineDialog.value = true
}

// 编辑生产线
const editProductionLine = (line) => {
  editingProductionLine.value = true
  currentProductionLine.id = line.id
  currentProductionLine.name = line.name
  currentProductionLine.description = line.description
  showProductionLineDialog.value = true
}

// 关闭生产线对话框
const closeProductionLineDialog = () => {
  showProductionLineDialog.value = false
  editingProductionLine.value = false
}

// 保存生产线
const saveProductionLine = async () => {
  if (!currentProductionLine.name.trim()) {
    ElMessage.error('请输入生产线名称')
    return
  }

  try {
    saving.value = true
    
    if (editingProductionLine.value) {
      // 更新生产线
      await axios.put(`/api/production-lines/${currentProductionLine.id}`, {
        name: currentProductionLine.name.trim(),
        description: currentProductionLine.description
      })
      ElMessage.success('生产线更新成功')
    } else {
      // 新增生产线
      await axios.post('/api/production-lines', {
        name: currentProductionLine.name.trim(),
        description: currentProductionLine.description
      })
      ElMessage.success('生产线添加成功')
    }
    
    closeProductionLineDialog()
    await getProductionLines()
  } catch (error) {
    ElMessage.error(editingProductionLine.value ? '生产线更新失败' : '生产线添加失败')
  } finally {
    saving.value = false
  }
}

// 切换生产线状态
const toggleProductionLine = async (line) => {
  try {
    const action = line.is_active ? '禁用' : '启用'
    await ElMessageBox.confirm(`确定要${action}生产线"${line.name}"吗？`, `确认${action}`, {
      type: 'warning'
    })
    
    await axios.put(`/api/production-lines/${line.id}`, {
      name: line.name,
      description: line.description,
      is_active: !line.is_active
    })
    
    ElMessage.success(`生产线${action}成功`)
    await getProductionLines()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败')
    }
  }
}

// 监听添加生产线按钮
// 当showAddProductionLine改变时打开对话框
const handleAddProductionLine = () => {
  openAddProductionLineDialog()
}

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '未知'
  return new Date(dateString).toLocaleString('zh-CN')
}

// 初始化
onMounted(async () => {
  await Promise.all([
    getStats(),
    checkDatabaseStatus(),
    getDepartments(),
    getProductionLines()
  ])
})
</script>

<style scoped>
.settings-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.settings-header {
  margin-bottom: 30px;
  text-align: center;
}

.settings-title {
  font-size: 28px;
  color: #2c3e50;
  margin-bottom: 8px;
}

.settings-description {
  color: #606266;
  font-size: 14px;
  margin: 0;
}

.setting-card {
  margin-bottom: 20px;
  min-height: 240px;
  transition: all 0.3s ease;
}

.setting-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.basic-settings {
  border-top: 3px solid #409eff;
}

.data-management {
  border-top: 3px solid #67c23a;
  min-height: 320px;
}

.system-status {
  border-top: 3px solid #e6a23c;
}

.management-card {
  border-top: 3px solid #909399;
  min-height: auto;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  justify-content: space-between;
}

.header-button {
  margin-left: auto;
}

.table-container {
  overflow-x: auto;
}

.management-table {
  width: 100%;
}

.header-icon {
  color: #409eff;
}

.setting-list {
  margin-bottom: 20px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-label {
  color: #606266;
  font-size: 14px;
}

.setting-value {
  color: #2c3e50;
  font-weight: 500;
}

.setting-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding: 10px 0;
}

.action-button {
  width: 100%;
  height: 44px;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.template-button {
  margin-top: 0 !important;
}

.clear-button {
  margin-top: auto;
}

.refresh-button {
  width: 100%;
  margin-top: 16px;
}

/* 响应式设计优化 */
@media (max-width: 1200px) {
  .settings-container {
    padding: 15px;
  }
  
  .setting-card {
    min-height: 200px;
  }
}

@media (max-width: 768px) {
  .settings-container {
    padding: 10px;
  }
  
  .setting-card {
    min-height: auto;
    margin-bottom: 15px;
  }
  
  .settings-title {
    font-size: 24px;
  }
  
  .action-button {
    height: 40px;
    font-size: 13px;
  }
  
  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .header-button {
    margin-left: 0;
    width: 100%;
  }
  
  .date-column {
    display: none;
  }
  
  .management-table .el-table__cell {
    padding: 8px 5px;
  }
  
  .table-container {
    margin: -10px;
    padding: 10px;
  }
}
</style>
