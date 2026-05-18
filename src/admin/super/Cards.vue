<template>
  <el-main>
    <!-- 返回区域 -->
    <div class="back-section">
      <el-button @click="goBack" :icon="ArrowLeft" type="default">返回应用列表</el-button>
      <span class="app-title" v-if="appName">当前应用: {{ appName }}</span>
    </div>

    <!-- 搜索区域 -->
    <div class="search-section">
      <div class="search-filters">
        <el-select
          v-model="searchForm.app_id"
          placeholder="选择软件"
          style="width: 150px; margin-right: 10px;"
          clearable
          @change="handleSearch"
        >
          <el-option label="全部软件" value="" />
          <el-option v-for="app in appOptions" :key="app.id" :label="app.app_name" :value="app.id" />
        </el-select>
        <el-select
          v-model="searchForm.status"
          placeholder="状态"
          style="width: 110px; margin-right: 10px;"
          clearable
          @change="handleSearch"
        >
          <el-option label="全部" value="" />
          <el-option label="启用" value="enabled" />
          <el-option label="禁用" value="disabled" />
        </el-select>
        <el-select
          v-model="searchForm.is_expired"
          placeholder="是否过期"
          style="width: 110px; margin-right: 10px;"
          clearable
          @change="handleSearch"
        >
          <el-option label="全部" value="" />
          <el-option label="已到期" value="1" />
          <el-option label="未到期" value="0" />
        </el-select>
        <el-select
          v-model="searchForm.is_activated"
          placeholder="激活状态"
          style="width: 110px; margin-right: 10px;"
          clearable
          @change="handleSearch"
        >
          <el-option label="全部" value="" />
          <el-option label="已激活" value="1" />
          <el-option label="未激活" value="0" />
        </el-select>
        <el-select
          v-model="searchForm.card_type"
          placeholder="卡密类型"
          style="width: 110px; margin-right: 10px;"
          clearable
          @change="handleSearch"
        >
          <el-option label="全部" value="" />
          <el-option label="小时卡" value="小时卡" />
          <el-option label="天卡" value="天卡" />
          <el-option label="周卡" value="周卡" />
          <el-option label="月卡" value="月卡" />
          <el-option label="年卡" value="年卡" />
        </el-select>
        <el-input
          v-model="searchForm.card_content"
          placeholder="卡密内容"
          style="width: 150px; margin-right: 10px;"
          clearable
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        />
        <el-input
          v-model="searchForm.card_remark"
          placeholder="备注内容"
          style="width: 150px; margin-right: 10px;"
          clearable
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        />
        <el-button type="primary" @click="handleSearch">
          <el-icon><Search /></el-icon>
          搜索
        </el-button>
        <el-button type="warning" @click="clearSearch">
          <el-icon><Refresh /></el-icon>
          重置
        </el-button>
      </div>
    </div>

    <!-- 卡密列表 -->
    <div class="table-section">
      <div class="toolbar-section">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          生成卡密
        </el-button>
        <el-button type="danger" @click="handleBatchDelete" :disabled="selectedRows.length === 0">
          <el-icon><Delete /></el-icon>
          批量删除
        </el-button>
        <el-button type="warning" @click="handleBatchDisable" :disabled="selectedRows.length === 0">
          批量禁用
        </el-button>
        <el-button type="success" @click="handleBatchEnable" :disabled="selectedRows.length === 0">
          <el-icon><Check /></el-icon>
          批量解禁
        </el-button>
        <el-button @click="handleExport">
          <el-icon><Download /></el-icon>
          导出卡密
        </el-button>
      </div>
      <el-table :data="cards.data" v-loading="tableLoading" element-loading-text="加载中..."
        :cell-style="{ 'border-right': '1px solid #EEEEEE' }"
        @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" />
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column label="卡密号码" min-width="200">
          <template #default="{ row }">
            <el-tag type="success" size="small" class="card-number-tag">
              {{ row.card }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="app_name" label="所属软件" min-width="120" />
        <el-table-column prop="price" label="价格" width="80" />
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag :type="cardTypeColor(row.card_type)" size="small">
              {{ row.card_type || '天卡' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="积分" width="70" prop="points" />
        <el-table-column prop="card_remark" label="备注" min-width="120" show-overflow-tooltip />
        <el-table-column label="激活" width="70">
          <template #default="{ row }">
            <el-tag :type="row.is_activated ? 'success' : 'info'" size="small">
              {{ row.is_activated ? '已激活' : '未激活' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="70">
          <template #default="{ row }">
            <el-tag :type="row.status === 'enabled' ? 'success' : 'info'" size="small">
              {{ row.status === 'enabled' ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="到期" width="80">
          <template #default="{ row }">
            <el-tag :type="isExpired(row) ? 'danger' : 'success'" size="small">
              {{ isExpired(row) ? '已到期' : '未到期' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="expires_at" label="过期时间" width="160" />
        <el-table-column prop="created_at" label="创建时间" width="160" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button-group>
              <el-button type="primary" size="small" :icon="Edit" @click="handleEdit(row)">编辑</el-button>
              <el-button type="danger" size="small" :icon="Delete" @click="handleDelete(row)">删除</el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="pagination-section">
      <el-pagination @size-change="handleSizeChange" @current-change="handleCurrentChange"
        :current-page="pagination.page" :page-sizes="[20, 30, 40]" :page-size="pagination.per_page"
        layout="total, sizes, prev, pager, next, jumper" :total="pagination.total_records" prev-text="上一页"
        next-text="下一页" background>
      </el-pagination>
    </div>

    <!-- 新增/编辑抽屉 -->
    <el-drawer v-model="drawerVisible" :title="isEdit ? '编辑卡密' : '生成卡密'" direction="rtl" size="500px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px" class="drawer-form">
        <el-form-item label="选择软件" prop="app_id">
          <el-select v-model="form.app_id" placeholder="请选择软件" style="width: 100%;" :disabled="isEdit">
            <el-option v-for="app in appOptions" :key="app.id" :label="app.app_name" :value="app.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="卡密号码" v-if="isEdit">
          <el-input :model-value="form.card" disabled />
        </el-form-item>
        <el-form-item label="卡头" prop="card_prefix" v-if="!isEdit">
          <el-input v-model="form.card_prefix" placeholder="自定义卡密前缀（可选）" maxlength="20" />
        </el-form-item>
        <el-form-item label="生成数量" prop="count" v-if="!isEdit">
          <el-input-number v-model="form.count" :min="1" :max="100" placeholder="请输入生成数量" />
          <span class="form-hint">最多可一次生成100张</span>
        </el-form-item>
        <el-form-item label="价格" prop="price">
          <el-input-number v-model="form.price" :min="0" :precision="2" placeholder="请输入价格" style="width:100%" />
        </el-form-item>
        <el-form-item label="卡密类型" prop="card_type">
          <el-select v-model="form.card_type" placeholder="请选择类型" style="width: 100%;" :disabled="isEdit">
            <el-option label="小时卡" value="小时卡" />
            <el-option label="天卡" value="天卡" />
            <el-option label="周卡" value="周卡" />
            <el-option label="月卡" value="月卡" />
            <el-option label="年卡" value="年卡" />
          </el-select>
        </el-form-item>
        <el-form-item label="积分数量" prop="points">
          <el-input-number v-model="form.points" :min="1" :max="99999" placeholder="积分数量" :disabled="isEdit" />
          <span class="form-hint" v-if="!isEdit">1积分 = {{ pointUnit }}</span>
        </el-form-item>
        <el-form-item label="机器码" prop="mac" v-if="isEdit">
          <el-input v-model="form.mac" placeholder="机器码（可选）" />
        </el-form-item>
        <el-form-item label="已登陆次数" prop="login_count" v-if="isEdit">
          <el-input-number v-model="form.login_count" :min="0" disabled placeholder="已登陆次数" />
        </el-form-item>
        <el-form-item label="激活IP/地址" prop="activation_ip" v-if="isEdit">
          <el-input v-model="form.activation_ip" placeholder="激活IP或地址（可选）" disabled />
        </el-form-item>
        <el-form-item label="激活时间" prop="activated_at" v-if="isEdit">
          <el-input :model-value="form.activated_at" disabled placeholder="激活时间" />
        </el-form-item>
        <el-form-item label="到期时间" prop="expires_at" v-if="isEdit">
          <el-date-picker v-model="form.expires_at" type="datetime" placeholder="选择到期时间（可选）"
            format="YYYY-MM-DD HH:mm:ss" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="上次登陆时间" prop="last_login_time" v-if="isEdit">
          <el-input :model-value="form.last_login_time" disabled placeholder="上次登陆时间" />
        </el-form-item>
        <el-form-item label="上次登陆IP" prop="last_login_ip" v-if="isEdit">
          <el-input :model-value="form.last_login_ip" disabled placeholder="上次登陆IP" />
        </el-form-item>
        <el-form-item label="备注" prop="card_remark">
          <el-input v-model="form.card_remark" type="textarea" :rows="2" placeholder="卡密备注信息（可选）" />
        </el-form-item>
        <el-form-item label="状态" prop="status" v-if="isEdit">
          <el-select v-model="form.status" placeholder="请选择状态" style="width: 100%;">
            <el-option label="启用" value="enabled" />
            <el-option label="禁用" value="disabled" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="drawer-footer">
          <el-button @click="drawerVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit" :loading="saveLoading">确定</el-button>
        </div>
      </template>
    </el-drawer>

    <!-- 生成结果弹窗 -->
    <el-dialog v-model="resultVisible" title="生成卡密" width="500px">
      <p style="margin-bottom:12px;font-weight:600;">成功生成 {{ resultCards.length }} 张卡密</p>
      <div style="max-height:300px;overflow-y:auto;background:#f8f9fa;padding:12px;border-radius:6px;font-family:monospace;font-size:13px;line-height:2;">
        <div v-for="(c, i) in resultCards" :key="i">{{ c.card }}</div>
      </div>
      <template #footer>
        <el-button type="primary" @click="handleCopyCards">复制</el-button>
        <el-button @click="resultVisible = false">确定</el-button>
      </template>
    </el-dialog>
  </el-main>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Edit, Delete, Refresh, ArrowLeft, Check, Download } from '@element-plus/icons-vue'
import { useBusinessStore } from '@/stores/modules/business'
import { superCardService } from '@/utils/service'

const router = useRouter()
const route = useRoute()
const store = useBusinessStore()
const { cards, apps } = storeToRefs(store)

const appId = ref(route.query.app_id || '')
const appName = ref('')
const appOptions = ref([])

const searchForm = reactive({
  app_id: appId.value || '',
  status: '',
  is_expired: '',
  is_activated: '',
  card_type: '',
  card_content: '',
  card_remark: ''
})

const drawerVisible = ref(false)
const isEdit = computed(() => !!form.value.id)
const saveLoading = ref(false)
const tableLoading = ref(true)
const formRef = ref(null)
const selectedRows = ref([])
const resultVisible = ref(false)
const resultCards = ref([])

const pagination = ref({
  page: 1,
  per_page: 20,
  total_records: 0,
  total_pages: 0
})

const form = ref({
  id: null,
  app_id: appId.value || '',
  count: 1,
  card: '',
  card_prefix: '',
  card_type: '天卡',
  price: 0,
  points: 1,
  mac: '',
  login_count: 0,
  activation_ip: '',
  activated_at: '',
  expires_at: '',
  last_login_time: '',
  last_login_ip: '',
  card_remark: '',
  status: 'enabled'
})

const rules = {
  app_id: [{ required: true, message: '请选择软件', trigger: 'change' }],
  card_type: [{ required: true, message: '请选择卡密类型', trigger: 'change' }],
  points: [{ required: true, message: '请输入积分数量', trigger: 'blur' }]
}

const pointUnit = computed(() => {
  const map = { '小时卡': '1小时', '天卡': '1天', '周卡': '1周', '月卡': '1月', '年卡': '1年' }
  return map[form.value.card_type] || ''
})

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const cardTypeColor = (type) => {
  const map = { '小时卡': 'warning', '天卡': 'success', '周卡': '', '月卡': 'primary', '年卡': 'danger' }
  return map[type] || 'info'
}

const isExpired = (row) => {
  if (!row.expires_at) return false
  return new Date(row.expires_at) < new Date()
}

const goBack = () => {
  router.push('/admin/apps')
}

const buildSearchParams = () => {
  const params = { ...pagination.value }
  // 如果有路由传入的 app_id，优先使用
  if (appId.value) {
    params.app_id = appId.value
  } else if (searchForm.app_id) {
    params.app_id = searchForm.app_id
  }
  if (searchForm.status) params.status = searchForm.status
  if (searchForm.is_expired !== '') params.is_expired = searchForm.is_expired
  if (searchForm.is_activated !== '') params.is_activated = searchForm.is_activated
  if (searchForm.card_type) params.card_type = searchForm.card_type
  if (searchForm.card_content) params.card_content = searchForm.card_content
  if (searchForm.card_remark) params.card_remark = searchForm.card_remark
  return params
}

const handleSearch = async () => {
  try {
    tableLoading.value = true
    pagination.value.page = 1
    await store.fetchCards(buildSearchParams())
    pagination.value.total_records = Number(cards.value.pagination?.total_records) || 0
  } catch (error) {
    ElMessage.error('搜索失败')
  } finally {
    tableLoading.value = false
  }
}

const clearSearch = async () => {
  searchForm.app_id = ''
  searchForm.status = ''
  searchForm.is_expired = ''
  searchForm.is_activated = ''
  searchForm.card_type = ''
  searchForm.card_content = ''
  searchForm.card_remark = ''
  await handleSearch()
}

const handleCurrentChange = async (val) => {
  try {
    tableLoading.value = true
    pagination.value.page = val
    await store.fetchCards(buildSearchParams())
    pagination.value.total_records = Number(cards.value.pagination?.total_records) || 0
  } catch (error) { }
  finally {
    await delay(100)
    tableLoading.value = false
  }
}

const handleSizeChange = async (val) => {
  try {
    tableLoading.value = true
    pagination.value.per_page = val
    pagination.value.page = 1
    await store.fetchCards(buildSearchParams())
    pagination.value.total_records = Number(cards.value.pagination?.total_records) || 0
  } catch (error) { }
  finally {
    await delay(100)
    tableLoading.value = false
  }
}

const handleAdd = () => {
  form.value = {
    id: null,
    app_id: appId.value || '',
    count: 1,
    card_prefix: '',
    card_type: '天卡',
    price: 0,
    points: 1,
    mac: '',
    login_count: 0,
    activation_ip: '',
    expires_at: '',
    last_login_time: '',
    last_login_ip: '',
    card_remark: '',
    status: 'enabled'
  }
  drawerVisible.value = true
}

const handleEdit = (row) => {
  form.value = {
    id: row.id,
    app_id: row.app_id,
    count: 1,
    card: row.card || '',
    card_type: row.card_type || '天卡',
    price: row.price || 0,
    points: row.points || 1,
    mac: row.mac || '',
    login_count: row.login_count || 0,
    activation_ip: row.activation_ip || '',
    activated_at: row.activated_at || '',
    expires_at: row.expires_at || '',
    last_login_time: row.last_login_time || '',
    last_login_ip: row.last_login_ip || '',
    card_remark: row.card_remark || '',
    status: row.status || 'enabled'
  }
  drawerVisible.value = true
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate()
  try {
    saveLoading.value = true
    const response = await store.saveCard(form.value)
    if (!form.value.id && response.data) {
      resultCards.value = response.data
      resultVisible.value = true
    } else {
      ElMessage.success(response.message || '更新成功')
    }
    drawerVisible.value = false
    await store.fetchCards(buildSearchParams())
    pagination.value.total_records = Number(cards.value.pagination?.total_records) || 0
  } catch (error) {
    ElMessage.error(error.message || (form.value.id ? '更新失败' : '生成失败'))
  } finally {
    saveLoading.value = false
  }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除该卡密吗？', '警告', { type: 'warning' })
    tableLoading.value = true
    const response = await store.deleteCard(row.id)
    ElMessage.success(response.message || '删除成功')
    await store.fetchCards(buildSearchParams())
    pagination.value.total_records = Number(cards.value.pagination?.total_records) || 0
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  } finally {
    tableLoading.value = false
  }
}

const loadAppOptions = async () => {
  try {
    const response = await store.fetchSuperApps({ per_page: 1000 })
    appOptions.value = response.data || []
  } catch (error) {
    appOptions.value = []
  }
}

const handleSelectionChange = (rows) => {
  selectedRows.value = rows
}

const handleBatchDelete = async () => {
  if (selectedRows.value.length === 0) return
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedRows.value.length} 张卡密吗？`, '警告', { type: 'warning' })
    tableLoading.value = true
    for (const row of selectedRows.value) {
      await store.deleteCard(row.id)
    }
    ElMessage.success(`成功删除 ${selectedRows.value.length} 张卡密`)
    selectedRows.value = []
    await store.fetchCards(buildSearchParams())
    pagination.value.total_records = Number(cards.value.pagination?.total_records) || 0
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(error.message || '批量删除失败')
  } finally {
    tableLoading.value = false
  }
}

const handleBatchDisable = async () => {
  if (selectedRows.value.length === 0) return
  try {
    await ElMessageBox.confirm(`确定要禁用选中的 ${selectedRows.value.length} 张卡密吗？`, '提示', { type: 'warning' })
    tableLoading.value = true
    for (const row of selectedRows.value) {
      await superCardService.update(row.id, { status: 'disabled' })
    }
    ElMessage.success(`成功禁用 ${selectedRows.value.length} 张卡密`)
    selectedRows.value = []
    await store.fetchCards(buildSearchParams())
    pagination.value.total_records = Number(cards.value.pagination?.total_records) || 0
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(error.message || '批量禁用失败')
  } finally {
    tableLoading.value = false
  }
}

const handleBatchEnable = async () => {
  if (selectedRows.value.length === 0) return
  try {
    tableLoading.value = true
    for (const row of selectedRows.value) {
      await superCardService.update(row.id, { status: 'enabled' })
    }
    ElMessage.success(`成功解禁 ${selectedRows.value.length} 张卡密`)
    selectedRows.value = []
    await store.fetchCards(buildSearchParams())
    pagination.value.total_records = Number(cards.value.pagination?.total_records) || 0
  } catch (error) {
    ElMessage.error(error.message || '批量解禁失败')
  } finally {
    tableLoading.value = false
  }
}

const handleCopyCards = () => {
  const text = resultCards.value.map(c => c.card).join('\n')
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('已复制到剪切板')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

const handleExport = () => {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先勾选要导出的卡密')
    return
  }
  const rows = selectedRows.value
  const header = ['卡密ID', '卡密号码', '所属软件', '类型', '积分', '备注', '激活状态', '状态', '过期时间', '创建时间']
  const csv = [header.join(',')]
  rows.forEach(r => {
    csv.push([
      r.id, r.card || '', r.app_name || '', r.card_type || '',
      r.points || 0, r.card_remark || '', r.is_activated ? '已激活' : '未激活',
      r.status === 'enabled' ? '启用' : '禁用', r.expires_at || '', r.created_at || ''
    ].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','))
  })
  const blob = new Blob(['﻿' + csv.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = '卡密导出_' + new Date().toISOString().slice(0, 10) + '.csv'
  link.click()
  ElMessage.success('导出成功')
}

const initData = async () => {
  await Promise.all([store.fetchCards(buildSearchParams()), loadAppOptions()])
  pagination.value.total_records = Number(cards.value.pagination?.total_records) || 0
  if (cards.value.data && cards.value.data.length > 0) {
    appName.value = cards.value.data[0].app_name || ''
  }
  tableLoading.value = false
}

onMounted(initData)
</script>

<style scoped>
.back-section {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.app-title {
  font-size: 14px;
  color: #606266;
}
.card-number-tag {
  font-family: monospace;
  font-size: 13px;
}
.form-hint {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}
.drawer-form {
  padding: 20px;
}
.drawer-footer {
  text-align: right;
  padding: 20px;
}
.toolbar-section {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #ebeef5;
}

.search-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}
</style>
