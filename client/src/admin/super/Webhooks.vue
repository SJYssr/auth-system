<template>
  <el-main>
    <!-- 操作栏 -->
    <div class="search-section">
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon>
        新建 Webhook
      </el-button>
      <span class="hint">卡密激活/禁用/启用/删除事件将 POST 推送到订阅的 URL（HMAC-SHA256 签名）</span>
    </div>

    <!-- 列表 -->
    <div class="table-section">
      <el-table :data="rows" v-loading="tableLoading" style="width: 100%"
        :cell-style="{ borderColor: '#e8e8e8' }" :header-cell-style="{ borderColor: '#e8e8e8' }">
        <el-table-column prop="app_name" label="应用" min-width="120" show-overflow-tooltip />
        <el-table-column prop="url" label="推送地址" min-width="220" show-overflow-tooltip />
        <el-table-column prop="events" label="订阅事件" min-width="200">
          <template #default="{ row }">
            <el-tag v-for="e in parseEvents(row.events)" :key="e" size="small" style="margin-right:4px">{{ e }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'enabled' ? 'success' : 'info'" size="small">
              {{ row.status === 'enabled' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="170">
          <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="handleTest(row)">测试</el-button>
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无 webhook，点击「新建 Webhook」订阅卡密事件" />
        </template>
      </el-table>
    </div>

    <!-- 分页 -->
    <div class="pagination-section" v-if="pagination.total_records > 0">
      <el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.per_page"
        :total="pagination.total_records" layout="total, prev, pager, next" @current-change="fetchList" />
    </div>

    <!-- 新建/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑 Webhook' : '新建 Webhook'" width="560px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="应用" required>
          <el-select v-model="form.app_id" placeholder="选择应用" filterable style="width: 100%" :disabled="!!form.id">
            <el-option v-for="app in appOptions" :key="app.id" :label="app.app_name" :value="app.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="推送地址" required>
          <el-input v-model="form.url" placeholder="https://your-server.com/webhook" />
        </el-form-item>
        <el-form-item label="订阅事件" required>
          <el-select v-model="form.events" multiple style="width: 100%" placeholder="选择要订阅的事件">
            <el-option v-for="e in allEvents" :key="e" :label="e" :value="e" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="!form.id" label="签名密钥">
          <el-input v-model="form.secret" placeholder="留空自动生成（创建后可在编辑时更换）" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" active-value="enabled" inactive-value="disabled"
            active-text="启用" inactive-text="停用" />
        </el-form-item>
        <el-alert v-if="createdSecret" type="success" :closable="false"
          :title="`签名密钥（仅此一次完整展示，请立即保存）：${createdSecret}`"
          description="每次推送都会携带 X-Webhook-Signature: sha256=HMAC_SHA256(secret, body)，用于接收端验签。" />
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </el-main>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { superWebhookService, superAppService } from '@/utils/service'

const allEvents = ['card.activated', 'card.disabled', 'card.enabled', 'card.deleted']

const rows = ref([])
const tableLoading = ref(true)
const appOptions = ref([])
const dialogVisible = ref(false)
const saving = ref(false)
const createdSecret = ref('')
const pagination = ref({ page: 1, per_page: 20, total_records: 0 })
const form = reactive({ id: null, app_id: null, url: '', events: [], secret: '', status: 'enabled' })

const parseEvents = (json) => {
  try { return JSON.parse(json || '[]') } catch { return [] }
}

const formatTime = (input) => {
  if (!input) return '-'
  const d = new Date(input)
  if (isNaN(d.getTime())) return String(input)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const fetchList = async () => {
  try {
    tableLoading.value = true
    const response = await superWebhookService.getAll({ page: pagination.value.page, per_page: pagination.value.per_page })
    rows.value = response.data || []
    pagination.value.total_records = Number(response.pagination?.total_records) || 0
  } catch (error) {
    ElMessage.error(error.message || '获取webhook列表失败')
  } finally {
    tableLoading.value = false
  }
}

const fetchAppOptions = async () => {
  try {
    const response = await superAppService.getAll({ page: 1, per_page: 200 })
    appOptions.value = response.data || []
  } catch { /* 下拉加载失败不阻塞 */ }
}

const openCreate = () => {
  Object.assign(form, { id: null, app_id: null, url: '', events: ['card.activated'], secret: '', status: 'enabled' })
  createdSecret.value = ''
  dialogVisible.value = true
}

const openEdit = (row) => {
  Object.assign(form, { id: row.id, app_id: row.app_id, url: row.url, events: parseEvents(row.events), secret: '', status: row.status })
  createdSecret.value = ''
  dialogVisible.value = true
}

const handleSave = async () => {
  if (!form.app_id || !form.url || form.events.length === 0) {
    ElMessage.warning('应用、推送地址与订阅事件均为必填')
    return
  }
  try {
    saving.value = true
    if (form.id) {
      await superWebhookService.update(form.id, { url: form.url, events: form.events, status: form.status })
      ElMessage.success('更新成功')
    } else {
      const response = await superWebhookService.create({ app_id: form.app_id, url: form.url, events: form.events, secret: form.secret, status: form.status })
      createdSecret.value = response.data?.secret || ''
      ElMessage.success('创建成功')
    }
    if (!createdSecret.value) dialogVisible.value = false
    fetchList()
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除该 webhook 吗？删除后将不再推送事件。', '删除确认', { type: 'warning' })
  } catch { return }
  try {
    await superWebhookService.delete(row.id)
    ElMessage.success('删除成功')
    fetchList()
  } catch (error) {
    ElMessage.error(error.message || '删除失败')
  }
}

const handleTest = async (row) => {
  try {
    const response = await superWebhookService.test(row.id)
    ElMessage.success(response.message || '测试事件投递成功')
  } catch (error) {
    ElMessage.error(error.message || '测试事件发送失败')
  }
}

onMounted(() => {
  fetchList()
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

.hint {
  color: #6b7280;
  font-size: 13px;
}
</style>
