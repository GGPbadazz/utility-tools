<template>
  <div class="analysis-form-container">
    <div class="form-header">
      <div class="header-content">
        <div>
          <h1 class="form-title">化学分析申请</h1>
          <p class="form-description">请填写完整的分析申请信息，我们将尽快为您安排分析</p>
        </div>
      </div>
    </div>

    <!-- 数据库状态指示器 -->
    <DatabaseStatus />

    <el-form :model="formData" :rules="formRules" ref="formRef" label-width="120px">
      <!-- 基本信息区块 -->
      <div class="form-section">
        <h3 class="section-title">基本信息</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <el-form-item label="申请人" prop="applicant" required>
            <el-input v-model="formData.applicant" placeholder="请输入申请人姓名" />
          </el-form-item>
          
          <el-form-item label="取样人" prop="sampler" required>
            <el-input v-model="formData.sampler" placeholder="请输入取样人姓名" />
          </el-form-item>
          
          <el-form-item label="部门" prop="department" required>
            <el-select v-model="formData.department" placeholder="请选择部门" style="width: 100%" :loading="loadingDepartments">
              <el-option
                v-for="dept in departments"
                :key="dept.id"
                :label="dept.name"
                :value="dept.name"
              />
            </el-select>
          </el-form-item>
          
          <el-form-item label="项目名称">
            <el-input v-model="formData.project" placeholder="请输入项目名称" />
          </el-form-item>
          
          <el-form-item label="联系电话" prop="phone">
            <el-input v-model="formData.phone" placeholder="请输入联系电话（可选）" />
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
          
          <el-form-item label="期望完成日期">
            <el-date-picker
              v-model="formData.expectedDate"
              type="date"
              placeholder="选择日期"
              style="width: 100%"
            />
          </el-form-item>
        </div>
      </div>

      <!-- 样品信息区块 -->
      <div class="form-section">
        <div class="section-header">
          <h3 class="section-title">样品信息</h3>
          <el-button type="primary" @click="addSample" :icon="Plus">
            添加样品
          </el-button>
        </div>

        <div v-for="(sample, index) in formData.samples" :key="sample.id" class="sample-card">
          <div class="sample-header">
            <h4>样品 {{ index + 1 }}</h4>
            <el-button 
              v-if="formData.samples.length > 1"
              type="danger" 
              size="small" 
              @click="removeSample(index)"
              :icon="Minus"
            >
              删除
            </el-button>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <el-form-item :label="`样品名称`" required>
              <el-input v-model="sample.name" placeholder="输入样品名称" />
            </el-form-item>
            
            <el-form-item :label="`样品类型`">
              <el-input v-model="sample.type" placeholder="输入样品类型" />
            </el-form-item>
            
            <el-form-item :label="`样品描述`">
              <el-input v-model="sample.description" placeholder="输入样品描述" />
            </el-form-item>
            
            <el-form-item :label="`数量`">
              <div class="quantity-input">
                <el-input-number 
                  v-model="sample.quantity" 
                  :min="1" 
                  :step="1"
                  style="width: 70%"
                />
                <el-select v-model="sample.unit" style="width: 30%">
                  <el-option label="g" value="g" />
                  <el-option label="kg" value="kg" />
                  <el-option label="ml" value="ml" />
                  <el-option label="L" value="L" />
                  <el-option label="片" value="piece" />
                </el-select>
              </div>
            </el-form-item>
            
            <el-form-item :label="`存储条件`">
              <el-input v-model="sample.storageCondition" placeholder="如：室温、冷藏等" />
            </el-form-item>
          </div>
        </div>
      </div>

      <!-- 分析要求区块 -->
      <div class="form-section">
        <h3 class="section-title">分析要求</h3>
        
        <div class="grid grid-cols-1 gap-4">
          <el-form-item label="分析类型" required>
            <el-select 
              v-model="formData.analysisType" 
              multiple 
              placeholder="请选择分析类型"
              style="width: 100%"
            >
              <el-option 
                v-for="type in analysisTypes" 
                :key="type" 
                :label="type" 
                :value="type" 
              />
            </el-select>
          </el-form-item>
          
          <el-form-item label="目标化合物">
            <el-input 
              v-model="formData.targetCompounds" 
              type="textarea" 
              placeholder="请描述需要检测的目标化合物或成分"
              :rows="3"
            />
          </el-form-item>
          
          <el-form-item label="检测方法">
            <el-input 
              v-model="formData.detectionMethod" 
              type="textarea" 
              placeholder="请说明期望的检测方法或技术要求"
              :rows="3"
            />
          </el-form-item>
          
          <el-form-item label="报告要求">
            <el-radio-group v-model="formData.reportRequirement">
              <el-radio value="standard">标准报告</el-radio>
              <el-radio value="detailed">详细报告</el-radio>
              <el-radio value="summary">简要报告</el-radio>
            </el-radio-group>
          </el-form-item>
          
          <el-form-item label="特殊要求">
            <el-input 
              v-model="formData.specialRequirements" 
              type="textarea" 
              placeholder="请描述任何特殊的技术要求或注意事项"
              :rows="4"
            />
          </el-form-item>
        </div>
      </div>

      <!-- 附件上传区块 -->
      <div class="form-section">
        <h3 class="section-title">附件上传</h3>
        <el-form-item label="相关文件">
          <el-upload
            v-model:file-list="fileList"
            action="/api/upload"
            multiple
            :before-upload="beforeUpload"
            :on-success="handleUploadSuccess"
            :on-error="handleUploadError"
          >
            <el-button type="primary" :icon="UploadFilled">
              选择文件
            </el-button>
            <template #tip>
              <div class="el-upload__tip">
                支持上传图片、PDF、Word等格式文件，单个文件不超过10MB
              </div>
            </template>
          </el-upload>
        </el-form-item>
      </div>

      <!-- 提交按钮 -->
      <div class="form-actions">
        <el-button 
          type="primary" 
          size="large"
          :loading="submitting"
          @click="submitForm"
        >
          提交申请
        </el-button>
      </div>
    </el-form>

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
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Minus, UploadFilled } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import axios from '../utils/axios'

const router = useRouter()

// 表单数据
const formData = reactive({
  applicant: '',
  sampler: '',
  department: '',
  project: '',
  phone: '',
  urgency: 'normal',
  expectedDate: '',
  samples: [{
    id: 1,
    name: '',
    type: '',
    description: '',
    quantity: 0,
    unit: 'g',
    storageCondition: ''
  }],
  analysisType: [],
  targetCompounds: '',
  detectionMethod: '',
  reportRequirement: 'standard',
  specialRequirements: ''
})

const submitting = ref(false)
const fileList = ref([])
const formRef = ref()
const showDbErrorDialog = ref(false)

// 部门列表（从 API 动态加载）
const departments = ref([])
const loadingDepartments = ref(false)

const loadDepartments = async () => {
  loadingDepartments.value = true
  try {
    const res = await axios.get('/api/departments')
    departments.value = res.data
  } catch (error) {
    console.error('加载部门列表失败:', error)
    ElMessage.warning('部门列表加载失败，请刷新页面重试')
  } finally {
    loadingDepartments.value = false
  }
}

// 分析类型（从 API 动态加载）
const analysisTypes = ref([])
const loadingAnalysisTypes = ref(false)

const loadAnalysisTypes = async () => {
  loadingAnalysisTypes.value = true
  try {
    const res = await axios.get('/api/analysis-types')
    analysisTypes.value = res.data.map(item => item.name || item)
  } catch (error) {
    console.error('加载分析类型失败:', error)
    // 降级使用静态列表
    analysisTypes.value = ['定性分析', '定量分析', '成分分析', '纯度检测', '质量检测', '杂质分析', '含量测定']
  } finally {
    loadingAnalysisTypes.value = false
  }
}

const urgencyLevels = [
  { value: 'urgent', label: '紧急' },
  { value: 'high', label: '高' },
  { value: 'normal', label: '普通' },

]

// 表单验证规则
const formRules = {
  applicant: [
    { required: true, message: '请输入申请人姓名', trigger: 'blur' }
  ],
  sampler: [
    { required: true, message: '请输入取样人姓名', trigger: 'blur' }
  ],
  department: [
    { required: true, message: '请选择部门', trigger: 'change' }
  ]
}

// 样品管理
const addSample = () => {
  const newId = Math.max(...formData.samples.map(s => s.id)) + 1
  formData.samples.push({
    id: newId,
    name: '',
    type: '',
    description: '',
    quantity: 0,
    unit: 'g',
    storageCondition: ''
  })
}

const removeSample = (index) => {
  if (formData.samples.length > 1) {
    formData.samples.splice(index, 1)
  }
}

// 文件上传
const beforeUpload = (file) => {
  const isLt10M = file.size / 1024 / 1024 < 10
  if (!isLt10M) {
    ElMessage.error('文件大小不能超过 10MB!')
  }
  return isLt10M
}

const handleUploadSuccess = (response, file) => {
  ElMessage.success(`${file.name} 上传成功!`)
}

const handleUploadError = (error, file) => {
  ElMessage.error(`${file.name} 上传失败!`)
}

// 表单提交
const submitForm = async () => {
  if (!formRef.value) return
  
  try {
    const valid = await formRef.value.validate()
    if (!valid) return
    
    // 验证至少有一个样品且样品名称不为空
    const validSamples = formData.samples.filter(sample => sample.name.trim())
    if (validSamples.length === 0) {
      ElMessage.error('请至少添加一个有效的样品')
      return
    }
    
    // 验证至少选择了一种分析类型
    if (formData.analysisType.length === 0) {
      ElMessage.error('请选择至少一种分析类型')
      return
    }
    
    submitting.value = true
    
    // 准备提交数据
    const submitData = {
      applicant: formData.applicant,
      sampler: formData.sampler,
      department: formData.department,
      project: formData.project,
      phone: formData.phone,
      urgency: formData.urgency,
      expectedDate: formData.expectedDate,
      targetCompounds: formData.targetCompounds,
      detectionMethod: formData.detectionMethod,
      reportRequirement: formData.reportRequirement,
      specialRequirements: formData.specialRequirements,
      analysisTypes: formData.analysisType, // 修正字段名
      samples: validSamples,
      attachments: fileList.value
    }
    
    console.log('提交申请数据:', submitData)
    
    const response = await axios.post('/api/applications', submitData)
    
    if (response.data.success) {
      ElMessage({
        type: 'success',
        message: '申请提交成功！',
        duration: 3000
      })
      
      // 重置表单
      resetForm()
      
      // 跳转到成功页面或申请列表
      setTimeout(() => {
        router.push('/applications')
      }, 1500)
    } else {
      throw new Error(response.data.message || '提交失败')
    }
    
  } catch (error) {
    console.error('提交申请失败:', error)
    
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
  formData.samples = [{
    id: 1,
    name: '',
    type: '',
    description: '',
    quantity: 0,
    unit: 'g',
    storageCondition: ''
  }]
  formData.analysisType = []
  fileList.value = []
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

// 日期格式化
const formatDate = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleString('zh-CN')
}

// 初始化
onMounted(async () => {
  loadDepartments()
  loadAnalysisTypes()
})
</script>

<style scoped>
.analysis-form-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  background: #f8f9fa;
}

.form-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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

.form-section {
  background: white;
  padding: 25px;
  margin-bottom: 25px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0 0 20px 0;
  padding-bottom: 10px;
  border-bottom: 2px solid #e9ecef;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.sample-card {
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 20px;
  margin-bottom: 15px;
  background: #f8f9fa;
}

.sample-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.sample-header h4 {
  margin: 0;
  color: #495057;
  font-weight: 500;
}

.grid {
  display: grid;
  gap: 16px;
}

.grid-cols-1 {
  grid-template-columns: 1fr;
}

.grid-cols-2 {
  grid-template-columns: repeat(2, 1fr);
}

.grid-cols-3 {
  grid-template-columns: repeat(3, 1fr);
}

@media (max-width: 768px) {
  .grid-cols-2,
  .grid-cols-3 {
    grid-template-columns: 1fr;
  }
}

.quantity-input {
  display: flex;
  gap: 8px;
}

.form-actions {
  text-align: center;
  padding: 30px 0;
}

.el-button + .el-button {
  margin-left: 12px;
}
</style>
