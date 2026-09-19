<template>
  <el-main>
    <!-- 搜索栏 -->
    <div class="search-section">
      <el-input v-model="searchForm.keyword" placeholder="卡密 / 机器码" clearable style="width: 220px"
        @keyup.enter="handleSearch" @clear="handleSearch">
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-select v-model="searchForm.app_id" placeholder="全部应用" clearable filterable style="width: 180px"
        @change="handleSearch">
        <el-option v-for="app in appOptions" :key="app.id" :label="app.app_name" :value="app.id" />
      </el-select>
      <el-button type="primary" @click="handleSearch">
        <el-icon><Search /></el-icon>
        搜索
      </el-button>
      <el-button @click="refresh">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </div>

    <!-- 会话列表 -->
    <div class="table-section">
      <el-table :data="sessions" v-loading="tableLoading" style="width: 100%"
        :cell-style="{ borderColor: '#e8e8e8' }" :header-cell-style="{ borderColor: '#e8e8e8' }">
        <el-table-column prop="card" label="卡密" min-width="160" show-overflow-tooltip />
        <el-table-column prop="app_name" label="所属应用" min-width="120" show-overflow-tooltip />
        <el-table-column prop="mac" label="机器码" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.mac || '-' }}</template>
        </el-table-column>
        <el-table-column prop="last_login_ip" label="登录IP" width="130">
          <template #default="{ row }">{{ row.last_login_ip || '-' }}</template>
        </el-table-column>
        <el-table-column prop="last_login_time" label="最后登录" width="170">
          <template #default="{ row }">{{ formatTime(row.last_login_time) }}</template>
        </el-table-column>
        <el-table-column prop="token_expires_at" label="会话到期" width="170">
          <template #default="{ row }">{{ formatTime(row.token_expires_at) }}</template>
        </el-table-column>
        <el-table-column prop="login_count" label="登录次数" width="90" align="center" />
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button type="danger" size="small" @click="handleKick(row)">踢下线</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无在线会话" />
        </template>
      </el-table>
    </div>

    <!-- 分页 -->
    <div class="pagination-section" v-if="pagination.total_records > 0">
      <el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.per_page"
        :total="pagination.total_records" :page-sizes="[20, 30, 50]" layout="total, sizes, prev, pager, next"
        @size-change="handleSizeChange" @current-change="handleCurrentChange" />
    </div>
  </el-main>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh } from '@element-plus/icons-vue'
import { superSessionService, superAppService } from '@/utils/service'

const sessions = ref([])
const tableLoading = ref(true)
const appOptions = ref([])
const searchForm = reactive({ keyword: '', app_id: null })
const pagination = ref({ page: 1, per_page: 20, total_records: 0 })

const formatTime = (input) => {
  if (!input) return '-'
  const date = new Date(input)
  if (isNaN(date.getTime())) return String(input)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const fetchSessions = async () => {
  try {
    tableLoading.value = true
    const params = { page: pagination.value.page, per_page: pagination.value.per_page }
    if (searchForm.keyword) params.keyword = searchForm.keyword
    if (searchForm.app_id) params.app_id = searchForm.app_id
    const response = await superSessionService.getAll(params)
    sessions.value = response.data || []
    pagination.value.total_records = Number(response.pagination?.total_records) || 0
  } catch (error) {
    console.error('获取在线会话失败:', error)
    ElMessage.error(error.message || '获取在线会话失败')
  } finally {
    tableLoading.value = false
  }
}

const fetchAppOptions = async () => {
  try {
    const response = await superAppService.getAll({ page: 1, per_page: 200 })
    appOptions.value = response.data || []
  } catch { /* 下拉加载失败不阻塞主列表 */ }
}

const handleSearch = () => {
  pagination.value.page = 1
  fetchSessions()
}

const refresh = () => fetchSessions()

const handleCurrentChange = () => fetchSessions()

const handleSizeChange = () => {
  pagination.value.page = 1
  fetchSessions()
}

// 踢下线：清空该卡密会话，客户端下次心跳将收到 -1002 需重新登录
const handleKick = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要踢下线卡密「${row.card}」的在线会话吗？该设备将被强制退出，需重新登录。`,
      '踢下线确认',
      { type: 'warning', confirmButtonText: '踢下线', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    const response = await superSessionService.kick(row.id)
    ElMessage.success(response.message || '已踢下线')
    fetchSessions()
  } catch (error) {
    ElMessage.error(error.message || '踢下线失败')
  }
}

onMounted(() => {
  fetchSessions()
  fetchAppOptions()
})
</script>

<style scoped>
.search-section {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 16px;
}
</style>
