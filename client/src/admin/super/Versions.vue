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
          style="width: 200px; margin-right: 10px;"
          clearable
          filterable
          @change="handleAppChange"
        >
          <el-option v-for="app in appOptions" :key="app.id" :label="app.app_name" :value="app.id" />
        </el-select>
        <el-select
          v-model="searchForm.status"
          placeholder="状态"
          style="width: 100px; margin-right: 10px;"
          clearable
          @change="handleSearch"
        >
          <el-option label="全部" value="" />
          <el-option label="启用" value="enabled" />
          <el-option label="禁用" value="disabled" />
        </el-select>

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

    <!-- 版本列表 -->
    <div class="table-section">
      <div class="toolbar-section">
        <el-button type="primary" @click="handleAdd" :disabled="!searchForm.app_id">
          <el-icon><Plus /></el-icon>
          新增版本
        </el-button>
      </div>
      <el-table :data="versions.data" v-loading="tableLoading" element-loading-text="加载中..."
        :cell-style="{ 'border-right': '1px solid #EEEEEE' }">
        <template #empty>
          <el-empty :description="searchForm.app_id ? '暂无版本数据' : '请选择应用'" :image-size="100" />
        </template>
        <el-table-column type="selection" width="55" />
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column prop="app_name" label="应用名称" min-width="120" />
        <el-table-column prop="version" label="版本号" width="100" />
        <el-table-column prop="version_name" label="版本名称" min-width="140" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'enabled' ? 'success' : 'info'" size="small">
              {{ row.status === 'enabled' ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160" />
        <el-table-column prop="updated_at" label="更新时间" width="160" />
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button-group>
              <el-button type="primary" size="small" :icon="Edit" @click="handleEdit(row)">
                编辑
              </el-button>
              <el-button type="danger" size="small" :icon="Delete" @click="handleDelete(row)">
                删除
              </el-button>
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
    <el-drawer v-model="drawerVisible" :title="isEdit ? '编辑版本' : '新增版本'" direction="rtl" size="500px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px" class="drawer-form">
        <el-form-item label="选择软件" prop="app_id">
          <el-select v-model="form.app_id" placeholder="请选择软件" style="width: 100%;" filterable>
            <el-option v-for="app in appOptions" :key="app.id" :label="app.app_name" :value="app.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="版本号" prop="version">
          <el-input v-model="form.version" placeholder="请输入版本号，如 2.0.0" maxlength="20" />
        </el-form-item>
        <el-form-item label="版本名称" prop="version_name">
          <el-input v-model="form.version_name" placeholder="请输入版本名称" maxlength="50" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-switch
            v-model="form.status"
            active-value="enabled"
            inactive-value="disabled"
            active-text="启用"
            inactive-text="禁用"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="drawer-footer">
          <el-button @click="drawerVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit" :loading="saveLoading">确定</el-button>
        </div>
      </template>
    </el-drawer>
  </el-main>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Edit, Delete, Refresh, ArrowLeft } from '@element-plus/icons-vue'
import { useBusinessStore } from '@/stores/modules/business'

const router = useRouter()
const route = useRoute()
const store = useBusinessStore()
const { versions } = storeToRefs(store)

const appId = ref(route.query.app_id || '')
const appName = ref('')
const appOptions = ref([])

const searchForm = reactive({
  app_id: appId.value || '',
  status: '',
  version_name: ''
})

const drawerVisible = ref(false)
const isEdit = computed(() => !!form.value.id)
const saveLoading = ref(false)
const tableLoading = ref(false)
const formRef = ref(null)

const pagination = ref({
  page: 1,
  per_page: 20,
  total_records: 0,
  total_pages: 0
})

const form = ref({
  id: null,
  app_id: appId.value,
  version: '',
  version_name: '',
  status: 'enabled'
})

const rules = {
  app_id: [{ required: true, message: '请选择软件', trigger: 'change' }],
  version: [
    { required: true, message: '请输入版本号', trigger: 'blur' },
    { pattern: /^\d+\.\d+\.\d+$/, message: '版本号格式如: 1.0.0', trigger: 'blur' }
  ],
  version_name: [
    { required: true, message: '请输入版本名称', trigger: 'blur' }
  ]
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const goBack = () => {
  router.push('/admin/apps')
}

const buildSearchParams = () => ({
  ...pagination.value,
  app_id: searchForm.app_id,
  ...searchForm
})

const handleAppChange = async (val) => {
  if (!val) {
    versions.value = {}
    pagination.value.total_records = 0
    appName.value = ''
    return
  }
  const selected = appOptions.value.find(a => a.id === val)
  appName.value = selected ? selected.app_name : ''
  pagination.value.page = 1
  await handleSearch()
}

const handleSearch = async () => {
  if (!searchForm.app_id) return
  try {
    tableLoading.value = true
    pagination.value.page = 1
    await store.fetchVersions(buildSearchParams())
    pagination.value.total_records = Number(versions.value.pagination?.total_records) || 0
  } catch (error) {
    ElMessage.error('搜索失败')
  } finally {
    tableLoading.value = false
  }
}

const clearSearch = async () => {
  searchForm.status = ''
  searchForm.version_name = ''
  if (searchForm.app_id) {
    await handleSearch()
  }
}

const handleCurrentChange = async (val) => {
  try {
    tableLoading.value = true
    pagination.value.page = val
    await store.fetchVersions(buildSearchParams())
    pagination.value.total_records = Number(versions.value.pagination?.total_records) || 0
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
    await store.fetchVersions(buildSearchParams())
    pagination.value.total_records = Number(versions.value.pagination?.total_records) || 0
  } catch (error) { }
  finally {
    await delay(100)
    tableLoading.value = false
  }
}

const handleAdd = () => {
  form.value = {
    id: null,
    app_id: searchForm.app_id || appId.value,
    version: '',
    version_name: '',
    status: 'enabled'
  }
  drawerVisible.value = true
}

const handleEdit = (row) => {
  form.value = {
    id: row.id,
    app_id: row.app_id,
    version: row.version || '',
    version_name: row.version_name || '',
    status: row.status || 'enabled'
  }
  drawerVisible.value = true
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate()
  try {
    saveLoading.value = true
    const response = await store.saveVersion(form.value)
    ElMessage.success(response.message || (form.value.id ? '更新成功' : '创建成功'))
    drawerVisible.value = false
    await store.fetchVersions(buildSearchParams())
    pagination.value.total_records = Number(versions.value.pagination?.total_records) || 0
  } catch (error) {
    ElMessage.error(error.message || (form.value.id ? '更新失败' : '创建失败'))
  } finally {
    saveLoading.value = false
  }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除该版本吗？', '警告', { type: 'warning' })
    tableLoading.value = true
    const response = await store.deleteVersion(row.id)
    ElMessage.success(response.message || '删除成功')
    await store.fetchVersions(buildSearchParams())
    pagination.value.total_records = Number(versions.value.pagination?.total_records) || 0
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

const initData = async () => {
  await loadAppOptions()
  // 如果从应用详情页跳转过来，自动加载该应用的版本
  if (appId.value) {
    searchForm.app_id = appId.value
    const selected = appOptions.value.find(a => a.id === appId.value)
    appName.value = selected ? selected.app_name : ''
    tableLoading.value = true
    await store.fetchVersions(buildSearchParams())
    pagination.value.total_records = Number(versions.value.pagination?.total_records) || 0
    tableLoading.value = false
  }
}

onMounted(initData)
</script>

<style scoped>
.back-section {
  margin-bottom: 16px;
}
.drawer-form {
  padding: 20px;
}
.toolbar-section {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #ebeef5;
}

.drawer-footer {
  text-align: right;
  padding: 20px;
}
</style>
