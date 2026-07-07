<template>
  <div class="quick-submit-container">
    <div class="form-header">
      <div class="header-content">
        <div>
          <h1 class="form-title">快速分析申请</h1>
          <p class="form-description">用于生产线常规分析的快速提交表单</p>
        </div>
      </div>
    </div>

    <!-- 数据库状态指示器 -->
    <DatabaseStatus />

    <el-form :model="formData" :rules="formRules" ref="formRef" label-width="140px">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <el-form-item label="批号" prop="batchNumber" required>
          <el-input 
            v-model="formData.batchNumber" 
            placeholder="请输入批号（字母、数字、连字符）"
          />
        </el-form-item>
        
        <el-form-item label="取样人" prop="sampler" required>
          <el-input 
            v-model="formData.sampler" 
            placeholder="请输入取样人姓名"
          />
        </el-form-item>
        
        <el-form-item label="紧急程度" required>
          <el-select v-model="formData.urgency" style="width: 100%">
            <el-option 
              v-for="level in urgencyLevels" 
              :key="level.value" 
              :label="level.label" 
              :value="level.value" 
            />
          </el-select>
        </el-form-item>
      </div>

      <!-- 生产线选择 -->
      <el-form-item label="生产线" prop="productionLine" required>
        <div class="production-line-selector">
          <div class="production-line-grid">
            <div 
              v-for="line in productionLines" 
              :key="line.id"
              :class="['production-line-item', { 'selected': formData.productionLine === line.name }]"
              @click="selectProductionLine(line.name)"
            >
              <div class="line-name">{{ line.name }}</div>
              <div v-if="line.description" class="line-description">{{ line.description }}</div>
            </div>
          </div>
        </div>
      </el-form-item>

      <!-- 反应环节/待测物 -->
      <el-form-item label="反应环节/待测物" prop="reflectionStep" required>
        <el-input 
          v-model="formData.reflectionStep" 
          placeholder="请输入反应环节或待测物信息"
        />
      </el-form-item>
      
      <el-form-item label="特殊要求">
        <el-input 
          v-model="formData.specialRequirements" 
          type="textarea" 
          placeholder="请描述任何特殊的技术要求或注意事项"
          :rows="4"
        />
      </el-form-item>
      
      <div class="form-actions">
        <el-button 
          type="primary" 
          size="large"
          :loading="submitting"
          @click="quickSubmit"
        >
          快速提交
        </el-button>
      </div>
    </el-form>

    <!-- 帮助信息 -->
    <div class="help-section">
      <h3>快速申请说明：</h3>
      <ul>
        <li>此表单适用于生产线常规分析申请</li>
        <li>填写必要信息后可直接提交，系统将自动分配工单号</li>
        <li>紧急申请将优先处理</li>
        <li>如需详细的样品信息配置，请使用标准申请表单</li>
      </ul>
    </div>

    <!-- 数据库连接错误提示 -->
    <el-dialog
      v-model="showDbErrorDialog"
      title="数据库连接错误"
      width="30%"
      center
    >
      <span>数据库连接失败，无法提交申请。请检查网络连接或联系系统管理员。</span>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showDbErrorDialog = false">关闭</el-button>
          <el-button type="primary" @click="retryDatabaseConnection">
            重试连接
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import DatabaseStatus from './DatabaseStatus.vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import axios from '../utils/axios'

const router = useRouter()

// 表单数据
const formData = reactive({
  batchNumber: '',
  sampler: '',
  reflectionStep: '',
  urgency: 'normal',
  specialRequirements: '',
  productionLine: ''
})

const submitting = ref(false)
const formRef = ref()
const showDbErrorDialog = ref(false)
const productionLines = ref([])

// 配置数据
const urgencyLevels = [
  { value: 'urgent', label: '紧急' },
  { value: 'high', label: '高' },
  { value: 'normal', label: '普通' },
]

// 表单验证规则
const formRules = {
  batchNumber: [
    { required: true, message: '请输入批号', trigger: 'blur' }
  ],
  sampler: [
    { required: true, message: '请输入取样人姓名', trigger: 'blur' }
  ],
  reflectionStep: [
    { required: true, message: '请输入反应环节/待测物', trigger: 'blur' }
  ],
  productionLine: [
    { required: true, message: '请选择生产线', trigger: 'change' }
  ]
}

// 快速提交
const quickSubmit = async () => {
  if (!formRef.value) return
  
  try {
    const valid = await formRef.value.validate()
    if (!valid) return
    
    submitting.value = true
    
    // 准备提交数据
    const submitData = {
      batchNumber: formData.batchNumber,
      applicant: '', // 留空
      sampler: formData.sampler,
      department: '生产部', // 默认设置为生产部
      project: '', // 留空
      phone: '', // 留空
      urgency: formData.urgency,
      expectedDate: '', // 留空
      targetCompounds: '', // 留空
      detectionMethod: '', // 留空
      reportRequirement: '', // 留空
      specialRequirements: formData.specialRequirements,
      reflectionStep: formData.reflectionStep,
      productionLine: formData.productionLine,
      analysisTypes: [], // 留空数组
      samples: [{
        name: '快速申请样品',
        type: '常规样品',
        description: '快速申请自动创建',
        quantity: 1,
        unit: 'g',
        storageCondition: '室温'
      }]
    }
    
    console.log('快速提交申请数据:', submitData)
    
    const response = await axios.post('/api/applications', submitData)
    
    if (response.data.success) {
      ElMessage({
        type: 'success',
        message: '快速申请提交成功！',
        duration: 3000
      })
      
      // 重置表单
      resetForm()
      
      // 跳转到申请列表
      setTimeout(() => {
        router.push('/applications')
      }, 1500)
    } else {
      throw new Error(response.data.message || '提交失败')
    }
    
  } catch (error) {
    console.error('快速提交失败:', error)
    
    if (error.response?.status === 500) {
      showDbErrorDialog.value = true
    } else {
      ElMessage({
        type: 'error',
        message: `提交失败: ${error.response?.data?.message || error.message}`,
        duration: 5000
      })
    }
  } finally {
    submitting.value = false
  }
}

// 重置表单
const resetForm = () => {
  formRef.value?.resetFields()
  Object.assign(formData, {
    batchNumber: '',
    sampler: '',
    reflectionStep: '',
    urgency: 'normal',
    specialRequirements: '',
    productionLine: ''
  })
}

// 重试数据库连接
const retryDatabaseConnection = async () => {
  try {
    await axios.get('/api/health')
    showDbErrorDialog.value = false
    ElMessage.success('数据库连接恢复正常')
  } catch (error) {
    ElMessage.error('数据库仍然无法连接，请联系系统管理员')
  }
}

// 选择生产线
const selectProductionLine = (lineName) => {
  formData.productionLine = lineName
}

// 加载生产线数据
const loadProductionLines = async () => {
  try {
    const response = await axios.get('/api/production-lines')
    productionLines.value = response.data.filter(line => line.is_active)
  } catch (error) {
    console.error('加载生产线失败:', error)
    ElMessage.error('加载生产线数据失败')
  }
}

// 初始化
onMounted(async () => {
  // 加载生产线数据
  await loadProductionLines()
})
</script>

<style scoped>
.quick-submit-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  background: #f8f9fa;
}

.form-header {
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
  padding: 30px;
  border-radius: 8px;
  margin-bottom: 30px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-title {
  font-size: 28px;
  margin: 0 0 8px 0;
  font-weight: 600;
}

.form-description {
  margin: 0;
  opacity: 0.9;
  font-size: 16px;
}

.el-form {
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  margin-bottom: 20px;
}

.grid {
  display: grid;
  gap: 16px;
  margin-bottom: 20px;
}

.grid-cols-1 {
  grid-template-columns: 1fr;
}

.grid-cols-2 {
  grid-template-columns: repeat(2, 1fr);
}

@media (max-width: 768px) {
  .grid-cols-2 {
    grid-template-columns: 1fr;
  }
}

/* 生产线选择器样式 */
.production-line-selector {
  width: 100%;
}

.production-line-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  max-height: 300px;
  overflow-y: auto;
}

.production-line-item {
  border: 2px solid #e4e7ed;
  border-radius: 6px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #f8f9fa;
  text-align: center;
}

.production-line-item:hover {
  border-color: #409eff;
  background: #ecf5ff;
}

.production-line-item.selected {
  border-color: #409eff;
  background: #409eff;
  color: white;
}

.line-name {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
}

.line-description {
  font-size: 12px;
  opacity: 0.8;
  color: #666;
}

.production-line-item.selected .line-description {
  color: rgba(255, 255, 255, 0.9);
}

.form-actions {
  text-align: center;
  padding: 20px 0;
  border-top: 1px solid #e9ecef;
  margin-top: 20px;
}

.help-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.help-section h3 {
  margin-top: 0;
  color: #495057;
  font-size: 16px;
}

.help-section ul {
  margin: 10px 0;
  padding-left: 20px;
}

.help-section li {
  margin-bottom: 5px;
  color: #6c757d;
}
</style>
