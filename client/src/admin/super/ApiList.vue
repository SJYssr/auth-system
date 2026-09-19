<template>
  <el-main>
    <div class="search-section">
      <div class="search-filters">
        <el-input v-model="searchForm.keyword" placeholder="搜索接口名称/地址" style="width:240px;margin-right:10px;" clearable @clear="handleSearch" @keyup.enter="handleSearch" />
        <el-button type="primary" @click="handleSearch"><el-icon><Search /></el-icon>搜索</el-button>
        <el-button type="warning" @click="clearSearch"><el-icon><Refresh /></el-icon>重置</el-button>
      </div>
    </div>

    <div class="table-section">
      <div class="toolbar-section">
        <el-button v-if="isSuperuser" type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增接口</el-button>
        <span v-else class="readonly-hint">接口文档对所有用户开放查看，仅超级管理员可编辑</span>
      </div>
      <el-table :data="list" v-loading="loading">
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column prop="api_name" label="接口名称" min-width="120" />
        <el-table-column prop="api_path" label="接口地址" min-width="220" show-overflow-tooltip />
        <el-table-column prop="api_method" label="调用方式" width="100" />
        <el-table-column prop="param_count" label="参数个数" width="80" />
        <el-table-column label="描述" width="160">
          <template #default="{row}">
            <el-button type="primary" link size="small" @click="showDetail(row)">点击查看具体描述</el-button>
          </template>
        </el-table-column>
        <el-table-column v-if="isSuperuser" label="操作" width="160">
          <template #default="{row}">
            <el-button-group>
              <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
              <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="pagination-section">
      <el-pagination @size-change="handleSizeChange" @current-change="handleCurrentChange" :current-page="pagination.page" :page-sizes="[20,30,40]" :page-size="pagination.per_page" layout="total,sizes,prev,pager,next,jumper" :total="pagination.total_records" background />
    </div>

    <!-- 新增/编辑抽屉 -->
    <el-drawer v-model="drawer" :title="isEdit?'编辑接口':'新增接口'" direction="rtl" size="560px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" class="drawer-form">
        <el-form-item label="接口名称" prop="api_name">
          <el-input v-model="form.api_name" placeholder="如：获取公告" />
        </el-form-item>
        <el-form-item label="接口地址" prop="api_path">
          <el-input v-model="form.api_path" placeholder="如：http://api.1wxyun.com/?type=1" />
        </el-form-item>
        <el-form-item label="调用方式" prop="api_method">
          <el-select v-model="form.api_method" style="width:100%">
            <el-option label="Http Post" value="Http Post" />
            <el-option label="Http Get" value="Http Get" />
            <el-option label="Http Put" value="Http Put" />
            <el-option label="Http Delete" value="Http Delete" />
          </el-select>
        </el-form-item>

        <el-divider content-position="left">请求参数</el-divider>
        <div v-for="(p, idx) in form.params" :key="idx" class="param-row">
          <el-row :gutter="8" align="middle">
            <el-col :span="8">
              <el-form-item label-width="0" :prop="'params.'+idx+'.name'" :rules="[{required:true,message:'请输入参数名',trigger:'blur'}]">
                <el-input v-model="p.name" placeholder="参数名" />
              </el-form-item>
            </el-col>
            <el-col :span="10">
              <el-form-item label-width="0" :prop="'params.'+idx+'.desc'" :rules="[{required:true,message:'请输入参数说明',trigger:'blur'}]">
                <el-input v-model="p.desc" placeholder="参数说明" />
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-button type="danger" plain size="small" @click="removeParam(idx)" :disabled="form.params.length<=1">
                <el-icon><Delete /></el-icon>
              </el-button>
            </el-col>
          </el-row>
        </div>
        <el-button type="primary" plain size="small" @click="addParam">
          <el-icon><Plus /></el-icon>添加参数
        </el-button>

        <el-divider />

        <el-form-item label="POST标准格式">
          <el-input :model-value="postStandardFormat" readonly />
        </el-form-item>
        <el-form-item label="POST例子">
          <el-input :model-value="postExample" readonly />
        </el-form-item>

        <el-form-item label="返回值说明">
          <el-input v-model="form.return_desc" type="textarea" :rows="3" placeholder="如：成功返回公告内容，失败返回错误码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="drawer=false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="saving">确定</el-button>
      </template>
    </el-drawer>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="接口详情" width="560px">
      <template v-if="detailRow">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="接口名称">{{ detailRow.api_name }}</el-descriptions-item>
          <el-descriptions-item label="接口地址">{{ detailRow.api_path }}</el-descriptions-item>
          <el-descriptions-item label="调用方式">{{ detailRow.api_method }}</el-descriptions-item>
          <el-descriptions-item label="参数个数">{{ detailRow.param_count }}</el-descriptions-item>
        </el-descriptions>
        <div v-if="detailParams.length" style="margin-top:16px">
          <el-table :data="detailParams" border size="small">
            <el-table-column prop="name" label="参数" />
            <el-table-column prop="desc" label="参数说明" />
          </el-table>
        </div>
        <div style="margin-top:16px">
          <div class="detail-label">POST标准格式</div>
          <el-input :model-value="detailPostStd" readonly style="margin-top:4px" />
        </div>
        <div style="margin-top:12px">
          <div class="detail-label">POST例子</div>
          <el-input :model-value="detailPostEx" readonly style="margin-top:4px" />
        </div>
        <div style="margin-top:12px">
          <div class="detail-label">返回值说明</div>
          <div style="margin-top:4px;color:#3c3c3c;">{{ detailRow.return_desc }}</div>
        </div>
      </template>
    </el-dialog>
  </el-main>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Refresh, Delete } from '@element-plus/icons-vue'
import { superApiService } from '@/utils/service'
import { useAppStore } from '@/stores/modules/app'
import { useListPage } from '@/composables/useListPage'

// 查看对所有管理员开放；新增/编辑/删除仅超管（后端 requireSuperuser 同步强制）
const appStore = useAppStore()
const isSuperuser = computed(() => !!appStore.initializeInfo?.login_status?.user?.is_superuser)

const drawer = ref(false)
const saving = ref(false)
const formRef = ref(null)
const isEdit = computed(() => !!form.value.id)

const detailVisible = ref(false)
const detailRow = ref(null)

const {
  rows: list, loading, filters: searchForm, pagination,
  fetchData, handleSearch, handleCurrentChange, handleSizeChange
} = useListPage({
  fetcher: (params) => superApiService.getAll(params),
  filters: { keyword: '' }
})

const form = ref({
  id: null, api_name: '', api_path: '', api_method: 'Http Post', param_count: 0,
  params: [{ name: '', desc: '' }]
})
const rules = {
  api_name: [{ required: true, message: '请输入接口名称', trigger: 'blur' }],
  api_path: [{ required: true, message: '请输入接口地址', trigger: 'blur' }]
}

const postStandardFormat = computed(() => {
  return form.value.params.filter(p => p.name).map(p => p.name + '=').join('&')
})
const postExample = computed(() => {
  return form.value.params.filter(p => p.name).map(p => p.name + '=' + (p.desc || '')).join('&')
})

const detailParams = computed(() => {
  if (!detailRow.value) return []
  try { return JSON.parse(detailRow.value.params_config || '[]') } catch { return [] }
})
const detailPostStd = computed(() => {
  return detailParams.value.map(p => p.name + '=').join('&')
})
const detailPostEx = computed(() => {
  return detailParams.value.map(p => p.name + '=' + (p.desc || '')).join('&')
})

const addParam = () => { form.value.params.push({ name: '', desc: '' }) }
const removeParam = (idx) => { if (form.value.params.length > 1) form.value.params.splice(idx, 1) }

const clearSearch = () => { searchForm.keyword = ''; handleSearch() }

const handleAdd = () => {
  form.value = {
    id: null, api_name: '', api_path: '', api_method: 'Http Post', param_count: 0,
    params: [{ name: '', desc: '' }], return_desc: ''
  }
  drawer.value = true
}

const handleEdit = (row) => {
  let params = []
  try { params = JSON.parse(row.params_config || '[]') } catch {}
  if (!params.length) params = [{ name: '', desc: '' }]
  form.value = {
    id: row.id, api_name: row.api_name, api_path: row.api_path, api_method: row.api_method,
    param_count: row.param_count || 0, params, return_desc: row.return_desc || ''
  }
  drawer.value = true
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate()
  saving.value = true
  try {
    const payload = {
      api_name: form.value.api_name,
      api_path: form.value.api_path,
      api_method: form.value.api_method,
      param_count: form.value.params.filter(p => p.name).length,
      params_config: JSON.stringify(form.value.params.filter(p => p.name)),
      return_desc: form.value.return_desc
    }
    if (form.value.id) {
      await superApiService.update(form.value.id, payload)
      ElMessage.success('更新成功')
    } else {
      await superApiService.create(payload)
      ElMessage.success('添加成功')
    }
    drawer.value = false
    fetchData()
  } catch(e) { ElMessage.error(e.message||'操作失败') }
  finally { saving.value = false }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除？','警告',{type:'warning'})
    await superApiService.delete(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch(e) { if(e!=='cancel') ElMessage.error(e.message||'删除失败') }
}

const showDetail = (row) => {
  detailRow.value = row
  detailVisible.value = true
}

fetchData()
</script>

<style scoped>
.toolbar-section { margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #ebeef5; }
.readonly-hint { color:#909399;font-size:13px; }
.drawer-form { padding:20px; }
.param-row { margin-bottom:8px; }
.detail-label { font-size:14px;font-weight:700;color:#262626; }
</style>
