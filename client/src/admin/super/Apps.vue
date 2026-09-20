<template>
  <el-main>
    <!-- 搜索区域 -->
    <div class="search-section">
      <div class="search-filters">
        <el-input
          v-model="searchForm.app_name"
          placeholder="应用名称"
          style="width: 150px; margin-right: 10px;"
          clearable
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        />
        <el-select
          v-model="searchForm.status"
          placeholder="状态"
          style="width: 120px; margin-right: 10px;"
          clearable
          @change="handleSearch"
        >
          <el-option label="全部" value="" />
          <el-option label="启用" value="enabled" />
          <el-option label="禁用" value="disabled" />
        </el-select>
        <el-select
          v-model="searchForm.category_id"
          placeholder="产品分类"
          style="width: 140px; margin-right: 10px;"
          clearable
          @change="handleSearch"
        >
          <el-option v-for="cat in categoryOptions" :key="cat.id" :label="cat.name" :value="cat.id" />
        </el-select>
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

    <!-- 应用列表 -->
    <div class="table-section">
      <div class="toolbar-section">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增应用
        </el-button>
        <el-button type="danger" @click="handleBatchDelete" :disabled="selectedRows.length === 0">
          <el-icon><Delete /></el-icon>
          批量删除
        </el-button>
      </div>
      <el-table :data="tableRows" v-loading="tableLoading" element-loading-text="加载中..."
        :cell-style="{ 'border-right': '1px solid #EEEEEE' }"
        @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" />
        <el-table-column prop="id" label="软件ID" width="80" />
        <el-table-column prop="softid" label="软件标识" width="190">
          <template #default="{ row }">
            <el-tag v-if="row.softid" type="info" size="small" class="soft-id-tag">{{ row.softid }}</el-tag>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="app_name" label="应用名称" min-width="120" />
        <el-table-column prop="category_name" label="分类" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.category_name" size="small">{{ row.category_name }}</el-tag>
            <span v-else class="text-muted">未分类</span>
          </template>
        </el-table-column>
        <el-table-column prop="version" label="版本号" width="100" />
        <el-table-column prop="developer" label="开发者" width="100" />
        <el-table-column prop="created_at" label="创建时间" width="160" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'enabled' ? 'success' : 'info'">
              {{ row.status === 'enabled' ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="激活/总计" width="100">
          <template #default="{ row }">
            <span>{{ row.activated_cards ?? 0 }} / {{ row.total_cards ?? 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="380">
          <template #default="{ row }">
            <el-button-group>
              <el-button type="primary" size="small" :icon="Edit" @click="handleEdit(row)">编辑</el-button>
              <el-button type="warning" size="small" @click="handleAnnouncement(row)">公告</el-button>
              <el-button type="success" size="small" @click="handleVersions(row)">版本</el-button>
              <el-button type="info" size="small" @click="handleDocs(row)">文档</el-button>
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
    <el-drawer v-model="drawerVisible" :title="isEdit ? '编辑应用' : '新增应用'" direction="rtl" size="500px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px" class="drawer-form">
        <el-form-item label="应用名称" prop="app_name">
          <el-input v-model="form.app_name" placeholder="请输入应用名称" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请输入应用描述" />
        </el-form-item>
        <el-form-item label="版本号" prop="version">
          <el-input v-model="form.version" placeholder="请输入版本号" />
        </el-form-item>
        <el-form-item label="版本名称" prop="version_name">
          <el-input v-model="form.version_name" placeholder="请输入版本名称" />
        </el-form-item>
        <el-form-item label="强制更新" prop="force_update">
          <el-switch
            v-model="form.force_update"
            :active-value="1"
            :inactive-value="0"
            active-text="强制"
            inactive-text="普通"
          />
        </el-form-item>
        <el-form-item label="开发者" prop="developer">
          <el-input v-model="form.developer" placeholder="请输入开发者名称" />
        </el-form-item>
        <el-form-item label="产品分类" prop="category_id">
          <el-select v-model="form.category_id" placeholder="未分类（可留空）" clearable style="width: 100%">
            <el-option v-for="cat in categoryOptions" :key="cat.id" :label="cat.name" :value="cat.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="图标URL" prop="icon_url">
          <el-input v-model="form.icon_url" placeholder="请输入图标URL" />
        </el-form-item>
        <el-form-item label="下载地址" prop="download_url">
          <el-input v-model="form.download_url" placeholder="请输入下载地址" />
        </el-form-item>
        <el-form-item label="使用说明地址" prop="usage_guide">
          <el-input v-model="form.usage_guide" placeholder="请输入使用说明地址" />
        </el-form-item>
        <el-form-item label="购买地址" prop="purchase_url">
          <el-input v-model="form.purchase_url" placeholder="请输入购买地址" />
        </el-form-item>
        <el-form-item label="公告" prop="announcement">
          <el-input v-model="form.announcement" type="textarea" :rows="3" placeholder="请输入公告内容" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="form.status" placeholder="请选择状态">
            <el-option label="启用" value="enabled" />
            <el-option label="禁用" value="disabled" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="drawer-footer">
          <el-button @click="drawerVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit">确定</el-button>
        </div>
      </template>
    </el-drawer>

    <!-- 公告弹窗 -->
    <el-dialog v-model="announceVisible" title="修改公告" width="500px">
      <el-form label-width="80px">
        <el-form-item label="软件标识">
          <el-input :model-value="announceForm.softid" disabled />
        </el-form-item>
        <el-form-item label="软件名称">
          <el-input :model-value="announceForm.app_name" disabled />
        </el-form-item>
        <el-form-item label="公告内容">
          <el-input v-model="announceForm.announcement" type="textarea" :rows="6" placeholder="请输入公告内容" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="announceVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAnnounceSave" :loading="announceSaving">确认保存</el-button>
      </template>
    </el-dialog>

    <!-- 应用文档弹窗（产品介绍/部署文档，前台应用详情页展示） -->
    <el-dialog v-model="docsVisible" title="应用文档" width="720px">
      <el-alert type="info" :closable="false" style="margin-bottom:16px"
        title="支持 HTML 片段，前台展示时会经过 DOMPurify 消毒；留空表示不展示该文档" />
      <el-form label-width="90px">
        <el-divider content-position="left">产品介绍</el-divider>
        <el-form-item label="标题">
          <el-input v-model="docsForm.intro_title" placeholder="如：产品功能介绍（可留空）" maxlength="100" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="docsForm.intro_content" type="textarea" :rows="6"
            placeholder="<h3>功能亮点</h3><p>支持xxx</p>" />
        </el-form-item>
        <el-divider content-position="left">部署文档</el-divider>
        <el-form-item label="标题">
          <el-input v-model="docsForm.deploy_title" placeholder="如：部署教程（可留空）" maxlength="100" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="docsForm.deploy_content" type="textarea" :rows="6"
            placeholder="<ol><li>下载后解压</li><li>运行 install.exe</li></ol>" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="docsVisible = false">取消</el-button>
        <el-button type="primary" @click="handleDocsSave" :loading="docsSaving">保存</el-button>
      </template>
    </el-dialog>

  </el-main>
</template>

<script setup>
// 导入
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Edit, Delete, Refresh } from '@element-plus/icons-vue'

import { useBusinessStore } from '@/stores/modules/business'
import { superAppService, superCategoryService } from '@/utils/service'
import { useListPage } from '@/composables/useListPage'

const store = useBusinessStore()

const router = useRouter()
const selectedRows = ref([])
const categoryOptions = ref([])
const announceVisible = ref(false)
const announceSaving = ref(false)
const announceForm = ref({ softid: '', app_name: '', announcement: '', id: null })
const docsVisible = ref(false)
const docsSaving = ref(false)
const docsForm = ref({ id: null, app_name: '', intro_title: '', intro_content: '', deploy_title: '', deploy_content: '' })

// 列表数据流（分页/加载态/搜索/错误兜底统一由 useListPage 提供）
const {
  rows: tableRows, loading: tableLoading, filters: searchForm, pagination,
  fetchData, handleSearch, handleCurrentChange, handleSizeChange
} = useListPage({
  fetcher: (params) => store.fetchSuperApps(params),
  filters: { app_name: '', status: '', category_id: '', start_date: '', end_date: '' }
})

const handleSelectionChange = (rows) => {
  selectedRows.value = rows
}

const clearSearch = async () => {
  searchForm.app_name = ''
  searchForm.status = ''
  searchForm.category_id = ''
  searchForm.start_date = ''
  searchForm.end_date = ''
  await handleSearch()
}

const handleBatchDelete = async () => {
  if (selectedRows.value.length === 0) return
  try {
    const totalCards = selectedRows.value.reduce((s, r) => s + (r.total_cards ?? 0), 0)
    const activatedCards = selectedRows.value.reduce((s, r) => s + (r.activated_cards ?? 0), 0)
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedRows.value.length} 个应用吗？` +
      (totalCards > 0
        ? `这些应用下共有 ${totalCards} 张卡密${activatedCards > 0 ? `（其中已激活 ${activatedCards} 张）` : ''}，删除后将一并清除，此操作不可恢复！`
        : '此操作不可恢复。'),
      '警告',
      { type: 'warning' }
    )
    for (const row of selectedRows.value) {
      await store.deleteApp(row.id)
    }
    ElMessage.success(`成功删除 ${selectedRows.value.length} 个应用`)
    selectedRows.value = []
    await fetchData()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '批量删除失败')
    }
  }
}




const drawerVisible = ref(false)
const isEdit = computed(() => !!form.value.id)
const saveLoading = ref(false)
const formRef = ref(null)





const rules = {
  app_name: [
    { required: true, message: '请输入应用名称', trigger: 'blur' },
    { min: 2, max: 50, message: '长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  version: [
    { required: true, message: '请输入版本号', trigger: 'blur' }
  ],
  status: [
    { required: true, message: '请选择状态', trigger: 'change' }
  ]
}









const form = ref({
  id: null,
  app_name: '',
  description: '',
  version: '1.0.0',
  version_name: '',
  developer: '',
  category_id: null,
  icon_url: '',
  download_url: '',
  usage_guide: '',
  purchase_url: '',
  announcement: '',
  force_update: 0,
  status: 'enabled'
})

const handleAdd = () => {
  form.value = {
    id: null,
    app_name: '',
    description: '',
    version: '1.0.0',
    version_name: '',
    developer: '',
    category_id: null,
    icon_url: '',
    download_url: '',
    usage_guide: '',
    purchase_url: '',
    announcement: '',
    force_update: 0,
    status: 'enabled'
  }
  drawerVisible.value = true
}

const handleEdit = (row) => {
  form.value = {
    id: row.id,
    app_name: row.app_name,
    description: row.description || '',
    version: row.version || '1.0.0',
    version_name: row.version_name || '',
    developer: row.developer || '',
    category_id: row.category_id ?? null,
    icon_url: row.icon_url || '',
    download_url: row.download_url || '',
    usage_guide: row.usage_guide || '',
    purchase_url: row.purchase_url || '',
    announcement: row.announcement || '',
    force_update: row.force_update || 0,
    status: row.status
  }
  drawerVisible.value = true
}



const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate()
  try {
    saveLoading.value = true
    const response = await store.saveApp(form.value)
    ElMessage.success(response.message || (form.value.id ? '更新成功' : '添加成功'))
    await fetchData()
  } catch (error) {
    ElMessage.error(error.message || (form.value.id ? '更新失败' : '添加失败'))
  } finally {
    saveLoading.value = false
    drawerVisible.value = false
  }
}




const handleAnnouncement = (row) => {
  announceForm.value = {
    id: row.id,
    softid: row.softid || '',
    app_name: row.app_name || '',
    announcement: row.announcement || ''
  }
  announceVisible.value = true
}

const handleAnnounceSave = async () => {
  try {
    announceSaving.value = true
    await store.saveApp({ id: announceForm.value.id, announcement: announceForm.value.announcement })
    ElMessage.success('公告保存成功')
    announceVisible.value = false
    await fetchData()
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    announceSaving.value = false
  }
}

/** 打开应用文档弹窗并加载已有内容 */
const handleDocs = async (row) => {
  docsForm.value = {
    id: row.id,
    app_name: row.app_name || '',
    intro_title: '', intro_content: '',
    deploy_title: '', deploy_content: ''
  }
  docsVisible.value = true
  try {
    const res = await superAppService.getDocs(row.id)
    const docs = res.data || {}
    docsForm.value.intro_title = docs.intro?.title || ''
    docsForm.value.intro_content = docs.intro?.content || ''
    docsForm.value.deploy_title = docs.deploy?.title || ''
    docsForm.value.deploy_content = docs.deploy?.content || ''
  } catch (error) {
    ElMessage.error(error.message || '加载文档失败')
  }
}

const handleDocsSave = async () => {
  try {
    docsSaving.value = true
    await superAppService.saveDocs(docsForm.value.id, {
      intro: { title: docsForm.value.intro_title, content: docsForm.value.intro_content },
      deploy: { title: docsForm.value.deploy_title, content: docsForm.value.deploy_content }
    })
    ElMessage.success('文档保存成功')
    docsVisible.value = false
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    docsSaving.value = false
  }
}

/** 删除确认文案：明确提示会级联删除的卡密数量 */
const deleteConfirmMessage = (row) => {
  const total = row.total_cards ?? 0
  const activated = row.activated_cards ?? 0
  if (total > 0) {
    return `确定要删除应用「${row.app_name}」吗？该应用下有 ${total} 张卡密` +
      (activated > 0 ? `（其中已激活 ${activated} 张）` : '') +
      `，删除后将一并清除，此操作不可恢复！`
  }
  return `确定要删除应用「${row.app_name}」吗？此操作不可恢复。`
}

const handleVersions = (row) => {
  router.push({ path: '/admin/versions', query: { app_id: row.id } })
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(deleteConfirmMessage(row), '警告', { type: 'warning' })
    const response = await store.deleteApp(row.id)
    ElMessage.success(response.message || '删除成功')
    await fetchData()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}








/** 拉取分类下拉选项（失败不阻塞页面） */
const fetchCategoryOptions = async () => {
  try {
    const res = await superCategoryService.getAll()
    categoryOptions.value = res.data || []
  } catch { /* 下拉加载失败不阻塞 */ }
}

onMounted(() => {
  fetchData()
  fetchCategoryOptions()
})


</script>

<style scoped>
/* 通用样式已在App.vue中定义 */

.toolbar-section {
  margin-bottom: 12px;
  padding-bottom: 12px;
  display: flex;
  gap: 10px;
  border-bottom: 1px solid #ebeef5;
}

.auth-progress {
  margin-top: 5px;
}

.price-free {
  color: #67c23a;
  font-weight: bold;
}

.price-paid {
  color: #e6a23c;
  font-weight: bold;
}

.drawer-form {
  padding: 20px;
}

.soft-id-tag {
  font-family: monospace;
  letter-spacing: 1px;
}

.drawer-footer {
  text-align: right;
  padding: 20px;
}
</style>
