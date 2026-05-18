<template>
  <el-main>
    <!-- 搜索区域 -->
    <div class="search-section">
      <div class="search-filters">
        <el-input
          v-model="searchForm.username"
          placeholder="用户名"
          style="width: 150px; margin-right: 10px;"
          clearable
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        />
        <el-select
          v-model="searchForm.actionType"
          placeholder="操作类型"
          style="width: 120px; margin-right: 10px;"
          clearable
          @change="handleSearch"
        >
          <el-option label="全部" value="" />
          <el-option label="创建" value="create" />
          <el-option label="更新" value="update" />
          <el-option label="删除" value="delete" />
          <el-option label="登录" value="login" />
        </el-select>
        <el-select
          v-model="searchForm.module"
          placeholder="模块"
          style="width: 120px; margin-right: 10px;"
          clearable
          @change="handleSearch"
        >
          <el-option label="全部" value="" />
          <el-option label="用户管理" value="users" />
          <el-option label="余额管理" value="balance" />
          <el-option label="应用管理" value="apps" />
          <el-option label="授权管理" value="auths" />
        </el-select>
        <el-select
          v-model="searchForm.status"
          placeholder="状态"
          style="width: 100px; margin-right: 10px;"
          clearable
          @change="handleSearch"
        >
          <el-option label="全部" value="" />
          <el-option label="成功" value="success" />
          <el-option label="失败" value="error" />
        </el-select>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 240px; margin-right: 10px;"
          @change="handleDateChange"
        />
        <el-button type="primary" @click="handleSearch">
          <el-icon><Search /></el-icon>
          搜索
        </el-button>
        <el-button type="warning" @click="clearInvalidParams">
          <el-icon><Refresh /></el-icon>
          清理无效参数
        </el-button>
        <el-button type="danger" @click="showDeleteDialog = true">
          <el-icon><Delete /></el-icon>
          清理日志
        </el-button>
      </div>
    </div>

    <!-- 日志列表 -->
    <div class="table-section">
      <el-table 
        :data="adminLogs.logs || []" 
        v-loading="tableLoading" 
        element-loading-text="加载中..."
        :cell-style="{ 'border-right': '1px solid #EEEEEE' }"
      >
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="action" label="操作" width="100">
          <template #default="{ row }">
            <el-tag :type="getActionType(row.action)" size="small">
              {{ getActionText(row.action) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="module" label="模块" width="120" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="ip_address" label="IP地址" width="130" />
        <el-table-column prop="response_status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.response_status === 'success' ? 'success' : 'danger'" size="small">
              {{ row.response_status === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="时间" width="160" />
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" text @click="showLogDetail(row)">
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页 -->
    <div class="pagination-section">
      <el-pagination
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
        :current-page="pagination.current || 1"
        :page-sizes="[5, 10, 20, 30, 50]"
        :page-size="pagination.pageSize || 20"
        layout="total, sizes, prev, pager, next, jumper"
        :total="pagination.total || 0"
        prev-text="上一页"
        next-text="下一页"
        background
      />
    </div>

    <!-- 日志详情对话框 -->
    <el-dialog
      v-model="detailVisible"
      title="日志详情"
      width="600px"
    >
      <div v-if="selectedLog" class="log-detail">
        <div class="detail-row">
          <span class="detail-label">用户名：</span>
          <span class="detail-value">{{ selectedLog.username }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">操作类型：</span>
          <span class="detail-value">
            <el-tag :type="getActionType(selectedLog.action)" size="small">
              {{ getActionText(selectedLog.action) }}
            </el-tag>
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">模块：</span>
          <span class="detail-value">{{ selectedLog.module }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">描述：</span>
          <span class="detail-value">{{ selectedLog.description }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">IP地址：</span>
          <span class="detail-value">{{ selectedLog.ip_address }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">用户代理：</span>
          <span class="detail-value">{{ selectedLog.user_agent || '未知' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">状态：</span>
          <span class="detail-value">
            <el-tag :type="selectedLog.response_status === 'success' ? 'success' : 'danger'" size="small">
              {{ selectedLog.response_status === 'success' ? '成功' : '失败' }}
            </el-tag>
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">时间：</span>
          <span class="detail-value">{{ selectedLog.created_at }}</span>
        </div>
        <div v-if="selectedLog.details" class="detail-row">
          <span class="detail-label">详细信息：</span>
          <div class="detail-json">
            <pre>{{ formatJson(selectedLog.details) }}</pre>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 删除日志对话框 -->
    <el-dialog
      v-model="showDeleteDialog"
      title="清理日志"
      width="400px"
    >
      <el-form label-width="100px">
        <el-form-item label="清理方式">
          <el-radio-group v-model="deleteType">
            <el-radio label="days">按天数清理</el-radio>
            <el-radio label="all">清理全部</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="deleteType === 'days'" label="保留天数">
          <el-input-number
            v-model="deleteDays"
            :min="1"
            :max="365"
            placeholder="请输入保留天数"
          />
          <div style="font-size: 12px; color: #999; margin-top: 5px;">
            将删除 {{ deleteDays }} 天前的所有日志
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDeleteDialog = false">取消</el-button>
        <el-button type="danger" @click="handleDeleteLogs" :loading="deleteLoading">
          确定删除
        </el-button>
      </template>
    </el-dialog>
  </el-main>
</template>

<script setup>
import { ref, onMounted, onActivated } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Delete, Refresh } from '@element-plus/icons-vue'
import { useBusinessStore } from '@/stores/modules/business'

const store = useBusinessStore()
const { adminLogs } = storeToRefs(store)

// 状态定义
const tableLoading = ref(true)
const deleteLoading = ref(false)
const detailVisible = ref(false)
const showDeleteDialog = ref(false)
const selectedLog = ref(null)
const dateRange = ref([])

// 搜索表单
const searchForm = ref({
  username: '',
  actionType: '',
  module: '',
  status: ''
})

// 删除相关
const deleteType = ref('days')
const deleteDays = ref(30)

// 分页相关
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const pagination = ref({
  current: 1,
  pageSize: 20,
  total: 0
})

// 参数清理函数
const cleanParams = (params) => {
  const cleaned = {}
  
  // 只添加有效的参数
  if (params.page && params.page > 0) cleaned.page = params.page
  if (params.pageSize && params.pageSize > 0) cleaned.pageSize = params.pageSize
  if (params.username && params.username.trim()) cleaned.username = params.username.trim()
  if (params.actionType && params.actionType.trim()) cleaned.actionType = params.actionType.trim()
  if (params.module && params.module.trim()) cleaned.module = params.module.trim()
  if (params.status && params.status.trim()) cleaned.status = params.status.trim()
  if (params.start_date && params.start_date.trim()) cleaned.start_date = params.start_date.trim()
  if (params.end_date && params.end_date.trim()) cleaned.end_date = params.end_date.trim()
  
  return cleaned
}

// 方法定义
const handleSearch = async () => {
  try {
    tableLoading.value = true
    pagination.value.current = 1
    const rawParams = {
      page: pagination.value.current,
      pageSize: pagination.value.pageSize,
      ...searchForm.value
    }
    const params = cleanParams(rawParams)
    const response = await store.fetchAdminLogs(params)
    if (response?.pagination) {
      pagination.value.total = parseInt(response.pagination.total) || 0
    }
  } catch (error) {
    ElMessage.error('搜索失败：' + (error.message || '未知错误'))
  } finally {
    await delay(100)
    tableLoading.value = false
  }
}

const handleCurrentChange = async (val) => {
  try {
    tableLoading.value = true
    pagination.value.current = val
    const rawParams = {
      page: pagination.value.current,
      pageSize: pagination.value.pageSize,
      ...searchForm.value
    }
    const params = cleanParams(rawParams)
    const response = await store.fetchAdminLogs(params)
    if (response?.pagination) {
      pagination.value.total = parseInt(response.pagination.total) || 0
    }
  } catch (error) {
    ElMessage.error('加载失败：' + (error.message || '未知错误'))
  } finally {
    await delay(100)
    tableLoading.value = false
  }
}

const handleSizeChange = async (val) => {
  try {
    tableLoading.value = true
    pagination.value.pageSize = val
    pagination.value.current = 1
    const rawParams = {
      page: pagination.value.current,
      pageSize: pagination.value.pageSize,
      ...searchForm.value
    }
    const params = cleanParams(rawParams)
    const response = await store.fetchAdminLogs(params)
    if (response?.pagination) {
      pagination.value.total = parseInt(response.pagination.total) || 0
    }
  } catch (error) {
    ElMessage.error('加载失败：' + (error.message || '未知错误'))
  } finally {
    await delay(100)
    tableLoading.value = false
  }
}

const handleDateChange = (dates) => {
  if (dates && dates.length === 2) {
    searchForm.value.start_date = dates[0].toISOString().split('T')[0]
    searchForm.value.end_date = dates[1].toISOString().split('T')[0]
  } else {
    searchForm.value.start_date = ''
    searchForm.value.end_date = ''
  }
  handleSearch()
}

// 清理无效参数
const clearInvalidParams = () => {
  // 重置搜索表单
  searchForm.value = {
    username: '',
    actionType: '',
    module: '',
    status: ''
  }
  
  // 清理日期范围
  dateRange.value = []
  
  // 重置分页
  pagination.value.current = 1
  
  ElMessage.success('已清理所有无效参数')
  
  // 重新搜索
  handleSearch()
}



const showLogDetail = (log) => {
  selectedLog.value = log
  detailVisible.value = true
}

const handleDeleteLogs = async () => {
  try {
    await ElMessageBox.confirm(
      deleteType.value === 'days' 
        ? `确定要删除 ${deleteDays.value} 天前的所有日志吗？此操作不可恢复！`
        : '确定要删除所有日志吗？此操作不可恢复！',
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    deleteLoading.value = true
    const data = deleteType.value === 'days' 
      ? { days: deleteDays.value }
      : { all: true }
    
    const response = await store.deleteAdminLogs(data)
    
    if (response?.success) {
      ElMessage.success(response.message || '删除成功')
      showDeleteDialog.value = false
      handleSearch() // 重新加载数据
    } else {
      throw new Error(response?.message || '删除失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error?.message || '删除失败')
    }
  } finally {
    deleteLoading.value = false
  }
}

// 工具方法
const getActionType = (action) => {
  const types = {
    create: 'success',
    update: 'warning',
    delete: 'danger',
    login: 'primary'
  }
  return types[action] || 'info'
}

const getActionText = (action) => {
  const texts = {
    create: '创建',
    update: '更新',
    delete: '删除',
    login: '登录'
  }
  return texts[action] || action
}

const formatJson = (jsonStr) => {
  try {
    const obj = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr
    return JSON.stringify(obj, null, 2)
  } catch (error) {
    return jsonStr
  }
}

// 初始化
const initData = async () => {
  try {
    tableLoading.value = true
    const rawParams = {
      page: pagination.value.current,
      pageSize: pagination.value.pageSize,
      ...searchForm.value
    }
    const params = cleanParams(rawParams)
    const response = await store.fetchAdminLogs(params)
    if (response?.pagination) {
      pagination.value.total = parseInt(response.pagination.total) || 0
    }
  } catch (error) {
    ElMessage.error('初始化失败：' + (error.message || '未知错误'))
  } finally {
    await delay(100)
    tableLoading.value = false
  }
}

onMounted(initData)
onActivated(initData)
</script>

<style scoped>
/* 通用样式已在App.vue中定义 */

.log-detail {
  max-height: 400px;
  overflow-y: auto;
}

.detail-row {
  display: flex;
  margin-bottom: 12px;
  align-items: flex-start;
}

.detail-label {
  width: 100px;
  font-weight: 600;
  color: #333;
  flex-shrink: 0;
}

.detail-value {
  flex: 1;
  color: #666;
  word-break: break-all;
}

.detail-json {
  margin-top: 8px;
  background: #f5f5f5;
  border-radius: 4px;
  padding: 12px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  max-height: 200px;
  overflow-y: auto;
}

.detail-json pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>