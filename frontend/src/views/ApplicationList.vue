<template>
  <div class="application-list">
    <!-- Compact Header with Database Status -->
    <div class="compact-header">
      <div class="header-left">
        <DatabaseStatus />
        <div class="page-title">
          <h2>我的申请列表</h2>
          <p>查看和跟踪您的化学分析申请状态</p>
        </div>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="refreshList">
          <el-icon><Refresh /></el-icon>
          刷新列表
        </el-button>
      </div>
    </div>

    <!-- Statistics Cards -->
    <div class="statistics-cards">
      <div 
        class="stat-card" 
        :class="{ active: statusFilter === '' }"
        @click="toggleStatusFilter('')"
      >
        <div class="stat-icon total">
          <el-icon><List /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.total }}</div>
          <div class="stat-label">全部申请</div>
        </div>
      </div>
      
      <div 
        class="stat-card" 
        :class="{ active: statusFilter === 'waiting_sample' }"
        @click="toggleStatusFilter('waiting_sample')"
      >
        <div class="stat-icon waiting_sample">
          <el-icon><Clock /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.waiting_sample }}</div>
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
          <div class="stat-value">{{ stats.analyzing }}</div>
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
          <div class="stat-value">{{ stats.completed }}</div>
          <div class="stat-label">完成</div>
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
          <div class="stat-value">{{ stats.cancelled }}</div>
          <div class="stat-label">已取消</div>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      <p>正在加载申请列表...</p>
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
            <div class="header-filters">
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
              <el-select v-model="statusFilter" placeholder="状态筛选" @change="handleFilter" style="width: 120px; margin-right: 12px;">
                <el-option label="全部" value="" />
                <el-option label="等待样品" value="waiting_sample" />
                <el-option label="分析中" value="analyzing" />
                <el-option label="完成" value="completed" />
                <el-option label="取消" value="cancelled" />
              </el-select>
              <el-select v-model="urgencyFilter" placeholder="紧急程度" @change="handleFilter" style="width: 120px;">
                <el-option label="全部" value="" />
                <el-option label="低" value="low" />
                <el-option label="中" value="normal" />
                <el-option label="高" value="high" />
                <el-option label="紧急" value="urgent" />
              </el-select>
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
            <template #default="{ row }">
              <el-tag type="info" size="small">{{ row.work_order_number || '无' }}</el-tag>
            </template>
          </el-table-column>
          
          <el-table-column prop="batch_number" label="批号" width="130" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="batch-number">{{ row.batch_number || '-' }}</span>
            </template>
          </el-table-column>
          
          <el-table-column prop="applicant" label="申请人" width="70" />
          
          <el-table-column prop="sampler" label="取样人" width="70" />
          
          <el-table-column prop="department" label="部门" width="80">
            <template #default="{ row }">
              <el-tag size="small">{{ row.department }}</el-tag>
            </template>
          </el-table-column>
          
          <el-table-column label="样品名称" min-width="150" show-overflow-tooltip>
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
            <template #default="{ row }">
              <el-tag :type="getUrgencyType(row.urgency)" size="small">
                {{ getUrgencyText(row.urgency) }}
              </el-tag>
            </template>
          </el-table-column>
          
          <el-table-column prop="status" label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)" size="small">
                {{ getStatusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          
          <el-table-column prop="created_at" label="申请时间" width="160">
            <template #default="{ row }">
              {{ formatDate(row.created_at) }}
            </template>
          </el-table-column>
          
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button 
                type="primary" 
                size="small" 
                @click.stop="viewDetails(row)"
              >
                查看详情
              </el-button>
              <el-button 
                v-if="canCancelApplication(row)"
                type="danger" 
                size="small" 
                @click.stop="showCancelConfirm(row)"
                style="margin-left: 8px;"
              >
                取消
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

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

    <!-- 工单详情窗口 -->
    <el-dialog
      v-model="detailDialogVisible"
      :title="isEditMode ? '编辑工单' : (isAnalysisMode ? '填写分析结果' : '工单详情')"
      width="90%"
      :close-on-click-modal="!isEditMode && !isAnalysisMode"
      :close-on-press-escape="!isEditMode && !isAnalysisMode"
      @close="handleDialogClose"
    >
      <div v-if="currentApplication" class="application-detail">
        <!-- 基本信息 -->
        <el-card class="detail-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <span class="card-title">基本信息</span>
              <div class="header-actions">
                <el-tag 
                  :type="getStatusType(currentApplication.status)" 
                  size="large"
                >
                  {{ getStatusText(currentApplication.status) }}
                </el-tag>
              </div>
            </div>
          </template>
          
          <el-row :gutter="24">
            <el-col :span="8">
              <div class="info-item">
                <label>工单号：</label>
                <span>{{ currentApplication.work_order_number || '无' }}</span>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="info-item">
                <label>申请人：</label>
                <el-input 
                  v-if="isEditMode && canEdit" 
                  v-model="editForm.applicant"
                  size="small"
                />
                <span v-else>{{ currentApplication.applicant }}</span>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="info-item">
                <label>取样人：</label>
                <el-input 
                  v-if="isEditMode && canEdit" 
                  v-model="editForm.sampler"
                  size="small"
                />
                <span v-else>{{ currentApplication.sampler || '未指定' }}</span>
              </div>
            </el-col>
          </el-row>
          
          <el-row :gutter="24">
            <el-col :span="8">
              <div class="info-item">
                <label>部门：</label>
                <el-input 
                  v-if="isEditMode && canEdit" 
                  v-model="editForm.department"
                  size="small"
                />
                <span v-else>{{ currentApplication.department }}</span>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="info-item">
                <label>项目：</label>
                <el-input 
                  v-if="isEditMode && canEdit" 
                  v-model="editForm.project"
                  size="small"
                />
                <span v-else>{{ currentApplication.project || '无' }}</span>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="info-item">
                <label>紧急程度：</label>
                <el-select 
                  v-if="isEditMode && canEdit" 
                  v-model="editForm.urgency"
                  size="small"
                  style="width: 100%"
                >
                  <el-option label="低" value="low" />
                  <el-option label="中" value="normal" />
                  <el-option label="高" value="high" />
                  <el-option label="紧急" value="urgent" />
                </el-select>
                <el-tag v-else :type="getUrgencyType(currentApplication.urgency)">
                  {{ getUrgencyText(currentApplication.urgency) }}
                </el-tag>
              </div>
            </el-col>
          </el-row>
          
          <el-row :gutter="24">
            <el-col :span="12">
              <div class="info-item">
                <label>申请时间：</label>
                <span>{{ formatDate(currentApplication.created_at) }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="info-item">
                <label>更新时间：</label>
                <span>{{ formatDate(currentApplication.updated_at) }}</span>
              </div>
            </el-col>
          </el-row>
          
          <div v-if="currentApplication.cancel_reason" class="info-item">
            <label>取消原因：</label>
            <span class="cancel-reason">{{ currentApplication.cancel_reason }}</span>
          </div>
        </el-card>

        <!-- 检测信息 -->
        <el-card class="detail-card" shadow="hover">
          <template #header>
            <span class="card-title">检测信息</span>
          </template>
          
          <el-row :gutter="24">
            <el-col :span="12">
              <div class="info-item">
                <label>批号：</label>
                <el-input 
                  v-if="isEditMode && canEdit" 
                  v-model="editForm.batch_number"
                  size="small"
                />
                <span v-else class="batch-number">{{ currentApplication.batch_number || '无' }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="info-item">
                <label>取样时间：</label>
                <el-date-picker 
                  v-if="isEditMode && canEdit" 
                  v-model="editForm.sampling_date"
                  type="datetime"
                  size="small"
                  style="width: 100%"
                />
                <span v-else>{{ formatDate(currentApplication.sampling_date) || '未指定' }}</span>
              </div>
            </el-col>
          </el-row>
          
          <div class="info-item">
            <label>检测类型：</label>
            <div class="analysis-types">
              <el-tag 
                v-for="type in currentApplication.analysisTypes" 
                :key="type"
                style="margin-right: 8px; margin-bottom: 8px;"
              >
                {{ type }}
              </el-tag>
            </div>
          </div>
          
          <div v-if="currentApplication.notes" class="info-item">
            <label>备注：</label>
            <el-input 
              v-if="isEditMode && canEdit" 
              v-model="editForm.notes"
              type="textarea"
              :rows="3"
              size="small"
            />
            <div v-else class="notes-content">{{ currentApplication.notes }}</div>
          </div>
        </el-card>

        <!-- 样品信息 -->
        <el-card v-if="currentApplication.samples && currentApplication.samples.length > 0" class="detail-card" shadow="hover">
          <template #header>
            <span class="card-title">样品信息</span>
          </template>
          
          <el-table :data="currentApplication.samples" border>
            <el-table-column prop="name" label="样品编号" width="150" />
            <el-table-column prop="type" label="样品类型" width="120" />
            <el-table-column prop="quantity" label="数量" width="100" />
            <el-table-column prop="unit" label="单位" width="80" />
            <el-table-column prop="storage_condition" label="存储条件" show-overflow-tooltip />
            <el-table-column prop="description" label="备注" show-overflow-tooltip />
          </el-table>
        </el-card>

        <!-- 分析结果 -->
        <el-card v-if="hasAnalysisData || isAnalysisMode" class="detail-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <span class="card-title">分析结果</span>
              <div class="header-actions" v-if="canAnalyze && !isAnalysisMode">
                <el-button 
                  type="primary" 
                  size="small"
                  @click="enterAnalysisMode"
                >
                  填写分析结果
                </el-button>
              </div>
            </div>
          </template>
          
          <div class="analysis-results">
            <!-- 分析结论 -->
            <div class="info-item">
              <label>分析结论：</label>
              <el-input 
                v-if="isAnalysisMode" 
                v-model="analysisForm.conclusion"
                type="textarea"
                :rows="3"
                placeholder="请输入分析结论"
                maxlength="500"
                show-word-limit
              />
              <div v-else-if="currentApplication.analysis_conclusion" class="conclusion">
                {{ currentApplication.analysis_conclusion }}
              </div>
              <span v-else class="empty-text">暂无分析结论</span>
            </div>
            
            <!-- 分析结果 -->
            <div class="info-item">
              <label>分析结果：</label>
              <el-input 
                v-if="isAnalysisMode" 
                v-model="analysisForm.result"
                type="textarea"
                :rows="4"
                placeholder="请输入详细的分析结果数据"
                maxlength="1000"
                show-word-limit
              />
              <div v-else-if="currentApplication.analysis_result" class="data-content">
                {{ currentApplication.analysis_result }}
              </div>
              <span v-else class="empty-text">暂无分析结果</span>
            </div>
            
            <!-- 分析员 -->
            <div class="info-item">
              <label>分析员：</label>
              <el-input 
                v-if="isAnalysisMode" 
                v-model="analysisForm.analyst"
                placeholder="请输入分析员姓名"
                maxlength="50"
              />
              <span v-else-if="currentApplication.analyst_name">
                {{ currentApplication.analyst_name }}
              </span>
              <span v-else class="empty-text">暂未指定</span>
            </div>
            
            <!-- 分析完成时间 -->
            <div v-if="currentApplication.analysis_completed_at" class="info-item">
              <label>分析完成时间：</label>
              <span>{{ formatDate(currentApplication.analysis_completed_at) }}</span>
            </div>
            
            <!-- 分析模式下的操作按钮 -->
            <div v-if="isAnalysisMode" class="analysis-actions">
              <el-button @click="cancelAnalysis">取消</el-button>
              <el-button 
                type="primary" 
                :loading="analysisLoading"
                @click="saveAnalysisResult"
              >
                保存分析结果
              </el-button>
            </div>
          </div>
        </el-card>

        <!-- 附件 -->
        <el-card v-if="currentApplication.attachments && currentApplication.attachments.length > 0" class="detail-card" shadow="hover">
          <template #header>
            <span class="card-title">附件</span>
          </template>
          
          <div class="attachments-list">
            <div 
              v-for="attachment in currentApplication.attachments" 
              :key="attachment.id"
              class="attachment-item"
            >
              <el-icon><Document /></el-icon>
              <span class="attachment-name">{{ attachment.original_name }}</span>
              <el-button 
                type="text" 
                size="small"
                @click="downloadAttachment(attachment)"
              >
                下载
              </el-button>
            </div>
          </div>
        </el-card>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <div class="footer-left">
            <!-- 取消申请按钮 -->
            <el-button 
              v-if="canCancel && !isEditMode"
              type="danger"
              @click="showCancelDialog"
            >
              取消申请
            </el-button>
          </div>
          
          <div class="footer-right">
            <el-button @click="closeDetailDialog">
              {{ isEditMode ? '取消编辑' : '关闭' }}
            </el-button>
            
            <el-button 
              v-if="canEdit && !isEditMode"
              type="primary"
              @click="enterEditMode"
            >
              编辑工单
            </el-button>
            
            <el-button 
              v-if="isEditMode"
              type="primary"
              :loading="saveLoading"
              @click="saveChanges"
            >
              保存修改
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <!-- 取消申请确认对话框 -->
    <el-dialog
      v-model="cancelDialogVisible"
      title="取消申请"
      width="500px"
      :close-on-click-modal="false"
    >
      <div class="cancel-form">
        <p class="cancel-warning">
          <el-icon color="#E6A23C"><Warning /></el-icon>
          确定要取消这个申请吗？取消后申请状态将变为"取消"，无法恢复。
        </p>
        
        <el-form :model="cancelForm" label-width="80px">
          <el-form-item label="取消原因">
            <el-input
              v-model="cancelForm.reason"
              type="textarea"
              :rows="3"
              placeholder="请输入取消原因（可选）"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="cancelDialogVisible = false">取消</el-button>
        <el-button 
          type="danger"
          :loading="cancelLoading"
          @click="confirmCancel"
        >
          确认取消申请
        </el-button>
      </template>
    </el-dialog>

    <!-- 列表页面取消申请确认对话框 -->
    <el-dialog
      v-model="listCancelDialogVisible"
      title="取消工单"
      width="500px"
      :close-on-click-modal="false"
    >
      <div class="cancel-form">
        <p class="cancel-warning">
          <el-icon color="#E6A23C"><Warning /></el-icon>
          确定要取消工单 "{{ currentCancelApplication?.work_order_number }}" 吗？取消后工单状态将变为"已取消"，无法恢复。
        </p>
        
        <el-form :model="listCancelForm" label-width="80px">
          <el-form-item label="取消原因">
            <el-input
              v-model="listCancelForm.reason"
              type="textarea"
              :rows="3"
              placeholder="请输入取消原因（可选）"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="listCancelDialogVisible = false">取消</el-button>
        <el-button 
          type="danger"
          :loading="listCancelLoading"
          @click="confirmListCancel"
        >
          确认取消工单
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Refresh, 
  Search, 
  Clock, 
  Loading, 
  Check, 
  List,
  Document,
  Warning,
  Close
} from '@element-plus/icons-vue'
import axios from '../utils/axios'
import DatabaseStatus from '../components/DatabaseStatus.vue'

const router = useRouter()
const route = useRoute()

// 角色控制：只有从分析师视角进入才能填写分析结果
const isAnalystView = computed(() => route.query?.from === 'analyst')

// 数据状态
const applications = ref([])
const loading = ref(false)
const error = ref('')
const searchKeyword = ref('')
const statusFilter = ref('')
const urgencyFilter = ref('')

// 详情窗口相关
const detailDialogVisible = ref(false)
const currentApplication = ref(null)
const isEditMode = ref(false)
const saveLoading = ref(false)

// 取消申请相关
const cancelDialogVisible = ref(false)
const cancelLoading = ref(false)
const cancelForm = reactive({
  reason: ''
})

// 列表页面取消申请相关
const listCancelDialogVisible = ref(false)
const listCancelLoading = ref(false)
const currentCancelApplication = ref(null)
const listCancelForm = reactive({
  reason: ''
})

// 分析结果相关
const isAnalysisMode = ref(false)
const analysisLoading = ref(false)
const analysisForm = reactive({
  conclusion: '',
  result: '',
  analyst: ''
})

// 编辑表单
const editForm = reactive({
  applicant: '',
  sampler: '',
  department: '',
  project: '',
  urgency: '',
  batch_number: '',
  sampling_date: '',
  notes: ''
})

// 统计数据
const stats = reactive({
  total: 0,
  waiting_sample: 0,
  analyzing: 0,
  completed: 0,
  cancelled: 0
})

// 分页
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

// 计算属性
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

// 权限计算
const canEdit = computed(() => {
  if (!currentApplication.value) return false
  return ['waiting_sample'].includes(currentApplication.value.status)
})

const canCancel = computed(() => {
  if (!currentApplication.value) return false
  return ['waiting_sample'].includes(currentApplication.value.status)
})

const canAnalyze = computed(() => {
  if (!currentApplication.value) return false
  return ['analyzing'].includes(currentApplication.value.status) && isAnalystView.value
})

const hasAnalysisData = computed(() => {
  if (!currentApplication.value) return false
  return currentApplication.value.analysis_conclusion || 
         currentApplication.value.analysis_result || 
         currentApplication.value.analyst_name
})

// 方法
const fetchApplications = async () => {
  loading.value = true
  error.value = ''
  
  try {
    console.log('Fetching applications from API...')
    const response = await axios.get('/api/applications')
    console.log('API Response:', response.data)

    if (response.data && Array.isArray(response.data)) {
      applications.value = response.data
      total.value = response.data.length
      console.log('Applications loaded:', applications.value.length)
      
      // 计算统计数据
      calculateStats()
    } else {
      throw new Error('Invalid response format')
    }
  } catch (err) {
    console.error('获取申请列表失败:', err)
    error.value = err.message || '获取数据失败'
    ElMessage.error('获取申请列表失败')
  } finally {
    loading.value = false
  }
}

const calculateStats = () => {
  stats.total = applications.value.length
  stats.waiting_sample = applications.value.filter(app => app.status === 'waiting_sample').length
  stats.analyzing = applications.value.filter(app => app.status === 'analyzing').length
  stats.completed = applications.value.filter(app => app.status === 'completed').length
  stats.cancelled = applications.value.filter(app => app.status === 'cancelled').length
}

const refreshList = () => {
  fetchApplications()
}

const handleSearch = () => {
  // 搜索在computed中处理，这里可以添加防抖逻辑
}

const handleFilter = () => {
  // 过滤在computed中处理
}

const toggleStatusFilter = (status) => {
  if (statusFilter.value === status) {
    statusFilter.value = ''
  } else {
    statusFilter.value = status
  }
  currentPage.value = 1
}

const handleRowClick = (row) => {
  viewDetails(row)
}

const viewDetails = (row) => {
  router.push(`/applications/${row.id}`)
}

const handleDialogClose = () => {
  // 如果在编辑或分析模式下，需要确认关闭
  if (isEditMode.value || isAnalysisMode.value) {
    ElMessageBox.confirm(
      '您正在编辑中，确定要关闭窗口吗？未保存的更改将丢失。',
      '确认关闭',
      {
        confirmButtonText: '确定关闭',
        cancelButtonText: '继续编辑',
        type: 'warning'
      }
    ).then(() => {
      closeDetailDialog()
    }).catch(() => {
      // 用户选择继续编辑，重新打开对话框
      detailDialogVisible.value = true
    })
  } else {
    closeDetailDialog()
  }
}

const closeDetailDialog = () => {
  detailDialogVisible.value = false
  isEditMode.value = false
  isAnalysisMode.value = false
  currentApplication.value = null
  resetEditForm()
  // 重置分析表单
  analysisForm.conclusion = ''
  analysisForm.result = ''
  analysisForm.analyst = ''
}

const enterEditMode = () => {
  if (!currentApplication.value) return
  
  // 填充编辑表单
  editForm.applicant = currentApplication.value.applicant || ''
  editForm.sampler = currentApplication.value.sampler || ''
  editForm.department = currentApplication.value.department || ''
  editForm.project = currentApplication.value.project || ''
  editForm.urgency = currentApplication.value.urgency || ''
  editForm.batch_number = currentApplication.value.batch_number || ''
  editForm.sampling_date = currentApplication.value.sampling_date ? new Date(currentApplication.value.sampling_date) : null
  editForm.notes = currentApplication.value.notes || ''
  
  isEditMode.value = true
}

const resetEditForm = () => {
  Object.keys(editForm).forEach(key => {
    editForm[key] = ''
  })
  editForm.sampling_date = null
}

const saveChanges = async () => {
  if (!currentApplication.value) return
  
  try {
    saveLoading.value = true
    
    // 构建更新数据
    const updateData = {
      applicant: editForm.applicant,
      sampler: editForm.sampler,
      department: editForm.department,
      project: editForm.project,
      urgency: editForm.urgency,
      batch_number: editForm.batch_number,
      sampling_date: editForm.sampling_date ? editForm.sampling_date.toISOString() : null,
      notes: editForm.notes
    }
    
    await axios.put(`/api/applications/${currentApplication.value.id}`, updateData)
    
    ElMessage.success('工单修改成功')
    
    // 更新当前数据
    Object.assign(currentApplication.value, updateData)
    
    // 刷新列表
    await fetchApplications()
    
    isEditMode.value = false
  } catch (error) {
    console.error('保存修改失败:', error)
    ElMessage.error('保存修改失败')
  } finally {
    saveLoading.value = false
  }
}

const showCancelDialog = () => {
  cancelForm.reason = ''
  cancelDialogVisible.value = true
}

const confirmCancel = async () => {
  if (!currentApplication.value) return
  
  try {
    cancelLoading.value = true
    
    await axios.patch(`/api/applications/${currentApplication.value.id}/cancel`, {
      cancel_reason: cancelForm.reason
    })
    
    ElMessage.success('申请已取消')
    
    // 更新当前申请状态
    currentApplication.value.status = 'cancelled'
    currentApplication.value.cancel_reason = cancelForm.reason
    
    // 刷新列表
    await fetchApplications()
    
    cancelDialogVisible.value = false
  } catch (error) {
    console.error('取消申请失败:', error)
    ElMessage.error(error.response?.data?.error || '取消申请失败')
  } finally {
    cancelLoading.value = false
  }
}

const enterAnalysisMode = () => {
  // 重置分析表单
  analysisForm.conclusion = ''
  analysisForm.result = ''
  analysisForm.analyst = ''
  isAnalysisMode.value = true
}

const cancelAnalysis = () => {
  isAnalysisMode.value = false
  analysisForm.conclusion = ''
  analysisForm.result = ''
  analysisForm.analyst = ''
}

const saveAnalysisResult = async () => {
  if (!currentApplication.value) return
  
  // 验证必填字段
  if (!analysisForm.conclusion.trim()) {
    ElMessage.error('请填写分析结论')
    return
  }
  
  if (!analysisForm.result.trim()) {
    ElMessage.error('请填写分析结果')
    return
  }
  
  if (!analysisForm.analyst.trim()) {
    ElMessage.error('请填写分析员姓名')
    return
  }
  
  try {
    analysisLoading.value = true
    
    await axios.patch(`/api/applications/${currentApplication.value.id}/analysis`, {
      analysis_conclusion: analysisForm.conclusion.trim(),
      analysis_result: analysisForm.result.trim(),
      analyst_name: analysisForm.analyst.trim()
    })
    
    ElMessage.success('分析结果保存成功，申请状态已更新为完成')
    
    // 更新当前申请数据
    currentApplication.value.analysis_conclusion = analysisForm.conclusion.trim()
    currentApplication.value.analysis_result = analysisForm.result.trim()
    currentApplication.value.analyst_name = analysisForm.analyst.trim()
    currentApplication.value.analysis_completed_at = new Date().toISOString()
    currentApplication.value.status = 'completed'
    
    // 刷新列表
    await fetchApplications()
    
    // 退出分析模式
    isAnalysisMode.value = false
  } catch (error) {
    console.error('保存分析结果失败:', error)
    ElMessage.error(error.response?.data?.error || '保存分析结果失败')
  } finally {
    analysisLoading.value = false
  }
}

const downloadAttachment = (attachment) => {
  // 构建下载链接
  const downloadUrl = `/api/download/${attachment.filename}`
  
  // 创建临时链接进行下载
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = attachment.original_name
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const handleSizeChange = (val) => {
  pageSize.value = val
  currentPage.value = 1
}

const handleCurrentChange = (val) => {
  currentPage.value = val
}

// 判断是否可以取消申请
const canCancelApplication = (application) => {
  // 只有等待样品、分析中状态的申请可以取消
  return ['waiting_sample', 'analyzing'].includes(application.status)
}

// 显示取消确认对话框
const showCancelConfirm = (application) => {
  currentCancelApplication.value = application
  listCancelForm.reason = ''
  listCancelDialogVisible.value = true
}

// 确认取消申请
const confirmListCancel = async () => {
  if (!currentCancelApplication.value) return
  
  try {
    listCancelLoading.value = true
    
    await axios.patch(`/api/applications/${currentCancelApplication.value.id}/cancel`, {
      cancel_reason: listCancelForm.reason
    })
    
    ElMessage.success('工单已取消')
    
    // 刷新列表
    await fetchApplications()
    
    listCancelDialogVisible.value = false
    currentCancelApplication.value = null
  } catch (error) {
    console.error('取消工单失败:', error)
    ElMessage.error(error.response?.data?.error || '取消工单失败')
  } finally {
    listCancelLoading.value = false
  }
}

// 辅助方法
const getUrgencyType = (urgency) => {
  const types = {
    low: 'info',
    normal: 'success',
    high: 'warning',
    urgent: 'danger'
  }
  return types[urgency] || 'info'
}

const getUrgencyText = (urgency) => {
  const texts = {
    low: '低',
    normal: '中',
    high: '高',
    urgent: '紧急'
  }
  return texts[urgency] || '未知'
}

const getStatusType = (status) => {
  const types = {
    waiting_sample: 'warning',
    analyzing: 'primary',
    completed: 'success',
    cancelled: 'danger'
  }
  return types[status] || 'info'
}

const getStatusText = (status) => {
  const texts = {
    waiting_sample: '等待样品',
    analyzing: '分析中',
    completed: '完成',
    cancelled: '取消'
  }
  return texts[status] || '未知'
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleString('zh-CN')
}

// 生命周期
onMounted(() => {
  fetchApplications()
})
</script>

<style scoped>
.application-list {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
  background-color: #f5f7fa;
  min-height: 100vh;
}

/* Compact Header */
.compact-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.page-title h2 {
  margin: 0 0 4px 0;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.page-title p {
  margin: 0;
  color: #909399;
  font-size: 13px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* Statistics Cards */
.statistics-cards {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  cursor: pointer;
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
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: white;
}

.stat-icon.total {
  background: #303133;
}

.stat-icon.waiting_sample {
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

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 2px;
}

.stat-label {
  font-size: 12px;
  color: #606266;
}

/* Loading and Error States */
.loading {
  text-align: center;
  padding: 50px;
  color: #909399;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.loading .el-icon {
  font-size: 24px;
  margin-bottom: 16px;
}

.loading p {
  margin: 0;
  font-size: 16px;
}

.error {
  text-align: center;
  padding: 50px;
  color: #f56c6c;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.error p {
  margin-bottom: 16px;
  font-size: 16px;
}

/* Card Header */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.header-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

/* Table Styles */
:deep(.el-table__row) {
  cursor: pointer;
}

:deep(.el-table__row:hover) {
  background-color: #f5f7fa;
}

/* Pagination */
.pagination-container {
  display: flex;
  justify-content: center;
  padding: 24px 0;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-top: 20px;
}

/* 批号样式 */
.batch-number {
  font-family: 'Courier New', monospace;
  font-weight: 500;
  color: #2c3e50;
  background: #f8f9fa;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

/* 样品名称样式 */
.more-samples {
  font-size: 12px;
  color: #909399;
  font-style: italic;
}

.no-samples {
  color: #c0c4cc;
  font-style: italic;
  font-size: 12px;
}

/* 分析类型样式 */
.more-types {
  font-size: 12px;
  color: #909399;
  font-style: italic;
}

.no-types {
  color: #c0c4cc;
  font-style: italic;
  font-size: 12px;
}

/* 目标化合物/生产信息样式 */
.production-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.target-compounds {
  color: #303133;
  font-size: 12px;
  line-height: 1.4;
}

.no-target {
  color: #c0c4cc;
  font-style: italic;
  font-size: 12px;
}

.no-reflection {
  color: #c0c4cc;
  font-style: italic;
  font-size: 12px;
}

/* 详情窗口样式 */
.application-detail {
  max-height: 70vh;
  overflow-y: auto;
}

.detail-card {
  margin-bottom: 16px;
}

.detail-card:last-child {
  margin-bottom: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-weight: 600;
  font-size: 16px;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.info-item {
  margin-bottom: 16px;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-item label {
  display: inline-block;
  width: 100px;
  font-weight: 500;
  color: #606266;
  margin-bottom: 4px;
}

.info-item span, .info-item div {
  color: #303133;
}

.cancel-reason {
  color: #f56c6c;
  font-style: italic;
}

.analysis-types {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.notes-content, .data-content, .conclusion {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 4px;
  border-left: 4px solid #409eff;
  white-space: pre-wrap;
  line-height: 1.6;
}

.conclusion {
  border-left-color: #67c23a;
}

.attachments-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 4px;
}

.attachment-name {
  flex: 1;
  color: #303133;
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-left, .footer-right {
  display: flex;
  gap: 8px;
}

.cancel-form {
  padding: 0 8px;
}

.cancel-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #e6a23c;
  margin-bottom: 16px;
  padding: 12px;
  background: #fdf6ec;
  border-radius: 4px;
  border: 1px solid #f5dab1;
}

/* 编辑模式样式 */
.info-item .el-input,
.info-item .el-select,
.info-item .el-date-picker {
  width: 100%;
}

:deep(.el-dialog__body) {
  padding: 16px 20px;
}

:deep(.el-card__header) {
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
}

:deep(.el-card__body) {
  padding: 20px;
}

/* 分析结果样式 */
.empty-text {
  color: #c0c4cc;
  font-style: italic;
}

.analysis-actions {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.analysis-actions .el-button {
  min-width: 80px;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .statistics-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .header-filters {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 768px) {
  .application-list {
    padding: 16px;
  }
  
  .compact-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .header-left {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
  }
  
  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }
  
  .statistics-cards {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .stat-card {
    padding: 12px;
  }
  
  .stat-icon {
    width: 36px;
    height: 36px;
    font-size: 16px;
  }
  
  .stat-value {
    font-size: 18px;
  }
  
  .card-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .header-filters {
    flex-direction: column;
    width: 100%;
  }
  
  .header-filters > * {
    width: 100% !important;
    margin-right: 0 !important;
    margin-bottom: 8px;
  }
}

@media (max-width: 480px) {
  .page-title h2 {
    font-size: 20px;
  }
  
  .page-title p {
    font-size: 12px;
  }
  
  .stat-value {
    font-size: 16px;
  }
  
  .stat-label {
    font-size: 11px;
  }
}
</style>
