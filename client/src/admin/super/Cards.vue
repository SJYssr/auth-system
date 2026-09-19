<template>
  <el-main>
    <!-- 返回区域 -->
    <div class="back-section">
      <el-button @click="goBack" :icon="ArrowLeft" type="default">返回应用列表</el-button>
    </div>

    <!-- 搜索区域 -->
    <div class="search-section">
      <div class="search-filters">
        <el-select
          v-model="searchForm.app_id"
          placeholder="请选择应用"
          style="width: 180px; margin-right: 10px;"
          clearable
          filterable
          @change="handleAppChange"
        >
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
          maxlength="50"
          style="width: 150px; margin-right: 10px;"
          clearable
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        />
        <el-input
          v-model="searchForm.card_remark"
          placeholder="备注内容"
          maxlength="100"
          style="width: 150px; margin-right: 10px;"
          clearable
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        />
        <el-button type="primary" @click="handleSearch" :disabled="!searchForm.app_id">
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
        <el-button type="primary" @click="handleAdd" :disabled="!searchForm.app_id">
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
      <el-table :data="tableRows" v-loading="tableLoading" element-loading-text="加载中..."
        :cell-style="{ 'border-right': '1px solid #EEEEEE' }"
        @selection-change="handleSelectionChange">
        <template #empty>
          <el-empty :description="searchForm.app_id ? '暂无卡密数据' : '请选择应用'" :image-size="100" />
        </template>
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
        <el-table-column label="是否到期" width="80">
          <template #default="{ row }">
            <el-tag :type="isExpired(row) ? 'danger' : 'success'" size="small">
              {{ isExpired(row) ? '已到期' : '未到期' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="activated_at" label="激活时间" width="160" />
        <el-table-column prop="expires_at" label="过期时间" width="160" />
        <el-table-column label="操作" width="160">
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
          <el-input :model-value="formatTime(form.activated_at)" disabled placeholder="激活时间" />
        </el-form-item>
        <el-form-item label="创建时间" prop="created_at" v-if="isEdit">
          <el-input :model-value="formatTime(form.created_at)" disabled placeholder="创建时间" />
        </el-form-item>
        <el-form-item label="到期时间" prop="expires_at" v-if="isEdit">
          <el-date-picker v-model="form.expires_at" type="datetime" placeholder="选择到期时间（可选）"
            format="YYYY-MM-DD HH:mm:ss" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="上次登陆时间" prop="last_login_time" v-if="isEdit">
          <el-input :model-value="formatTime(form.last_login_time)" disabled placeholder="上次登陆时间" />
        </el-form-item>
        <el-form-item label="上次登陆IP" prop="last_login_ip" v-if="isEdit">
          <el-input :model-value="form.last_login_ip" disabled placeholder="上次登陆IP" />
        </el-form-item>
        <el-form-item label="备注" prop="card_remark">
          <el-input v-model="form.card_remark" type="textarea" :rows="2" maxlength="200" show-word-limit placeholder="卡密备注信息（可选）" />
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Edit, Delete, Refresh, ArrowLeft, Check, Download } from '@element-plus/icons-vue'
import { useBusinessStore } from '@/stores/modules/business'
import { useListPage } from '@/composables/useListPage'
import { superCardService } from '@/utils/service'

const router = useRouter()
const route = useRoute()
const store = useBusinessStore()

// route.query 取回是字符串，转成数字才能与 el-option 的数值 id 匹配回显应用名
const appId = ref(route.query.app_id ? (parseInt(route.query.app_id) || '') : '')
const appName = ref('')
const appOptions = ref([])

const {
  rows: tableRows, loading: tableLoading, filters: searchForm, pagination,
  fetchData, handleSearch: doSearch, handleCurrentChange, handleSizeChange
} = useListPage({
  // 页面必须先选应用（生成卡密依赖 app_id），未选时返回空集
  fetcher: (params) => params.app_id ? store.fetchCards(params) : { data: [], pagination: { total_records: 0 } },
  filters: {
    app_id: appId.value || '',
    status: '',
    is_expired: '',
    is_activated: '',
    card_type: '',
    card_content: '',
    card_remark: ''
  }
})

const drawerVisible = ref(false)
const isEdit = computed(() => !!form.value.id)
const saveLoading = ref(false)
const formRef = ref(null)
const selectedRows = ref([])
const resultVisible = ref(false)
const resultCards = ref([])

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

const formatTime = (input) => {
  if (!input) return ''
  try {
    const s = String(input).replace(/-/g, '/').replace('T', ' ').replace(/\.\d+Z?$/, '')
    const d = new Date(s)
    if (isNaN(d.getTime())) return String(input)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    return `${y}-${m}-${day} ${hh}:${mm}:${ss}`
  } catch { return String(input) }
}

const pointUnit = computed(() => {
  const map = { '小时卡': '1小时', '天卡': '1天', '周卡': '1周', '月卡': '1月', '年卡': '1年' }
  return map[form.value.card_type] || ''
})


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

const handleAppChange = async (val) => {
  if (!val) {
    tableRows.value = []
    pagination.value.total_records = 0
    appName.value = ''
    return
  }
  const selected = appOptions.value.find(a => a.id === val)
  appName.value = selected ? selected.app_name : ''
  doSearch()
}

const handleSearch = async () => {
  if (!searchForm.app_id) return
  doSearch()
}

const clearSearch = async () => {
  searchForm.status = ''
  searchForm.is_expired = ''
  searchForm.is_activated = ''
  searchForm.card_type = ''
  searchForm.card_content = ''
  searchForm.card_remark = ''
  if (searchForm.app_id) {
    handleSearch()
  }
}

const handleAdd = () => {
  form.value = {
    id: null,
    app_id: searchForm.app_id || appId.value,
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
    created_at: row.created_at || '',
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
    if (form.value.id) {
      // 编辑：走单卡更新
      const response = await store.saveCard(form.value)
      ElMessage.success(response.message || '更新成功')
    } else {
      // 生成：走批量接口（count 控制数量，card_prefix 为卡头）
      const response = await superCardService.batchCreate({
        app_id: form.value.app_id,
        count: form.value.count || 1,
        card_prefix: form.value.card_prefix || '',
        card_type: form.value.card_type,
        price: form.value.price,
        points: form.value.points,
        card_remark: form.value.card_remark || ''
      })
      const list = response.data?.cards || []
      if (list.length > 0) {
        resultCards.value = list
        resultVisible.value = true
      } else {
        ElMessage.success(response.message || '生成成功')
      }
    }
    drawerVisible.value = false
    await fetchData()
  } catch (error) {
    ElMessage.error(error.message || (form.value.id ? '更新失败' : '生成失败'))
  } finally {
    saveLoading.value = false
  }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除该卡密吗？', '警告', { type: 'warning' })
    const response = await store.deleteCard(row.id)
    ElMessage.success(response.message || '删除成功')
    await fetchData()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
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

/** 批量执行单卡请求，返回成功/失败数量（单个失败不中断其余） */
const runBatch = async (rows, fn) => {
  const results = await Promise.allSettled(rows.map(row => fn(row)))
  const ok = results.filter(r => r.status === 'fulfilled').length
  const failed = results.length - ok
  return { ok, failed }
}

const handleBatchDelete = async () => {
  if (selectedRows.value.length === 0) return
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedRows.value.length} 张卡密吗？`, '警告', { type: 'warning' })
    tableLoading.value = true
    const { ok, failed } = await runBatch(selectedRows.value, row => store.deleteCard(row.id))
    if (failed > 0) {
      ElMessage.warning(`成功删除 ${ok} 张，失败 ${failed} 张（可能已被他人删除或无权限）`)
    } else {
      ElMessage.success(`成功删除 ${ok} 张卡密`)
    }
    selectedRows.value = []
    await fetchData()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(error.message || '批量删除失败')
  }
}

const handleBatchDisable = async () => {
  if (selectedRows.value.length === 0) return
  try {
    await ElMessageBox.confirm(`确定要禁用选中的 ${selectedRows.value.length} 张卡密吗？`, '提示', { type: 'warning' })
    tableLoading.value = true
    const { ok, failed } = await runBatch(selectedRows.value, row => superCardService.update(row.id, { status: 'disabled' }))
    if (failed > 0) {
      ElMessage.warning(`成功禁用 ${ok} 张，失败 ${failed} 张`)
    } else {
      ElMessage.success(`成功禁用 ${ok} 张卡密`)
    }
    selectedRows.value = []
    await fetchData()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(error.message || '批量禁用失败')
  }
}

const handleBatchEnable = async () => {
  if (selectedRows.value.length === 0) return
  try {
    tableLoading.value = true
    const { ok, failed } = await runBatch(selectedRows.value, row => superCardService.update(row.id, { status: 'enabled' }))
    if (failed > 0) {
      ElMessage.warning(`成功解禁 ${ok} 张，失败 ${failed} 张`)
    } else {
      ElMessage.success(`成功解禁 ${ok} 张卡密`)
    }
    selectedRows.value = []
    await fetchData()
  } catch (error) {
    ElMessage.error(error.message || '批量解禁失败')
  }
}

const handleCopyCards = () => {
  const text = resultCards.value.map(c => typeof c === 'string' ? c : c.card).join('\n')
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('已复制到剪切板')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

const sanitizeCsvCell = (v) => {
  const s = String(v)
  // 防止 CSV 公式注入：以 = + - @ 开头的单元格前加制表符
  if (/^[=+\-@]/.test(s)) return '"\t' + s.replace(/"/g, '""') + '"'
  return '"' + s.replace(/"/g, '""') + '"'
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
    ].map(sanitizeCsvCell).join(','))
  })
  const blob = new Blob(['﻿' + csv.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = '卡密导出_' + new Date().toISOString().slice(0, 10) + '.csv'
  link.click()
  ElMessage.success('导出成功')
}

const initData = async () => {
  // 生命周期重置：每次进入页面清空上次的卡密数据与分页，避免切换路由后残留旧状态
  tableRows.value = []
  pagination.value = { page: 1, per_page: 20, total_records: 0 }
  appName.value = ''
  searchForm.app_id = appId.value || ''
  await loadAppOptions()
  // 如果从应用详情页跳转过来，自动加载该应用的卡密
  if (appId.value) {
    const selected = appOptions.value.find(a => a.id === appId.value)
    appName.value = selected ? selected.app_name : ''
    await fetchData()
  }
}

onMounted(initData)
</script>

<style scoped>
.back-section {
  margin-bottom: 16px;
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
