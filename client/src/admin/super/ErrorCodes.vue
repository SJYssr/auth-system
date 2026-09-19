<template>
  <el-main>
    <div class="search-section">
      <div class="search-filters">
        <el-input v-model="searchForm.keyword" placeholder="搜索错误码/描述" style="width:200px;margin-right:10px;" clearable @clear="handleSearch" @keyup.enter="handleSearch" />
        <el-button type="primary" @click="handleSearch"><el-icon><Search /></el-icon>搜索</el-button>
        <el-button type="warning" @click="clearSearch"><el-icon><Refresh /></el-icon>重置</el-button>
      </div>
    </div>

    <div class="table-section">
      <div class="toolbar-section">
        <el-button v-if="isSuperuser" type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增错误码</el-button>
        <span v-else class="readonly-hint">错误码对照表对所有用户开放查看，仅超级管理员可编辑</span>
      </div>
      <el-table :data="list" v-loading="loading">
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column prop="code" label="错误码" width="100" />
        <el-table-column prop="message" label="错误信息" min-width="160" />
        <el-table-column prop="description" label="说明" min-width="200" show-overflow-tooltip />
        <el-table-column prop="solution" label="解决方案" min-width="200" show-overflow-tooltip />

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

    <el-drawer v-model="drawer" :title="isEdit?'编辑错误码':'新增错误码'" direction="rtl" size="500px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px" class="drawer-form">
        <el-form-item label="错误码" prop="code">
          <el-input v-model="form.code" placeholder="如：1001" />
        </el-form-item>
        <el-form-item label="错误信息" prop="message">
          <el-input v-model="form.message" placeholder="如：参数错误" />
        </el-form-item>
        <el-form-item label="说明" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="详细说明" />
        </el-form-item>
        <el-form-item label="解决方案" prop="solution">
          <el-input v-model="form.solution" type="textarea" :rows="2" placeholder="建议的解决方案" />
        </el-form-item>

      </el-form>
      <template #footer>
        <el-button @click="drawer=false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="saving">确定</el-button>
      </template>
    </el-drawer>
  </el-main>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Refresh } from '@element-plus/icons-vue'
import { superErrorCodeService } from '@/utils/service'
import { useAppStore } from '@/stores/modules/app'
import { useListPage } from '@/composables/useListPage'

// 查看对所有管理员开放；新增/编辑/删除仅超管（后端 requireSuperuser 同步强制）
const appStore = useAppStore()
const isSuperuser = computed(() => !!appStore.initializeInfo?.login_status?.user?.is_superuser)

const drawer = ref(false)
const saving = ref(false)
const formRef = ref(null)
const isEdit = computed(() => !!form.value.id)

const {
  rows: list, loading, filters: searchForm, pagination,
  fetchData, handleSearch, handleCurrentChange, handleSizeChange
} = useListPage({
  fetcher: (params) => superErrorCodeService.getAll(params),
  filters: { keyword: '' }
})

const form = ref({ id: null, code: '', message: '', description: '', solution: '' })
const rules = {
  code: [{ required: true, message: '请输入错误码', trigger: 'blur' }],
  message: [{ required: true, message: '请输入错误信息', trigger: 'blur' }]
}

const clearSearch = () => { searchForm.keyword = ''; handleSearch() }

const handleAdd = () => {
  form.value = { id: null, code: '', message: '', description: '', solution: '' }
  drawer.value = true
}
const handleEdit = (row) => {
  form.value = { ...row }
  drawer.value = true
}
const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate()
  saving.value = true
  try {
    if (form.value.id) { await superErrorCodeService.update(form.value.id, form.value); ElMessage.success('更新成功') }
    else { await superErrorCodeService.create(form.value); ElMessage.success('添加成功') }
    drawer.value = false
    fetchData()
  } catch(e) { ElMessage.error(e.message||'操作失败') }
  finally { saving.value = false }
}
const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除？','警告',{type:'warning'})
    await superErrorCodeService.delete(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch(e) { if(e!=='cancel') ElMessage.error(e.message||'删除失败') }
}

fetchData()
</script>

<style scoped>
.toolbar-section { margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #ebeef5; }
.readonly-hint { color:#909399;font-size:13px; }
.drawer-form { padding:20px; }
</style>
