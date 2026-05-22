<template>
  <el-main>
    <div class="table-section">
      <div class="toolbar-section">
        <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增版本</el-button>
      </div>
      <el-table :data="list" v-loading="loading">
        <el-table-column prop="version" label="版本号" width="120" />
        <el-table-column prop="version_name" label="版本名称" min-width="140" />
        <el-table-column prop="app_name" label="所属应用" min-width="120" />
        <el-table-column prop="created_at" label="创建时间" width="160" />
        <el-table-column label="操作" width="80">
          <template #default="{row}">
            <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" title="新增版本" width="400px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="选择应用">
          <el-select v-model="form.app_id" style="width:100%" placeholder="选择应用">
            <el-option v-for="a in appOptions" :key="a.id" :label="a.app_name" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="版本号"><el-input v-model="form.version" placeholder="1.0.0" /></el-form-item>
        <el-form-item label="版本名称"><el-input v-model="form.version_name" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible=false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </el-main>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { userAppService, userVersionService } from '@/utils/service'

const list = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const appOptions = ref([])
const form = ref({ app_id: '', version: '', version_name: '' })

const fetchData = async () => {
  loading.value = true
  try { const res = await userVersionService.getAll(); list.value = res.data || [] } catch {} finally { loading.value = false }
}

const loadApps = async () => {
  try { const res = await userAppService.getAll({ per_page: 1000 }); appOptions.value = res.data || [] } catch {}
}

const handleAdd = () => { form.value = { app_id: '', version: '', version_name: '' }; dialogVisible.value = true }

const handleSubmit = async () => {
  try {
    await userVersionService.create(form.value)
    ElMessage.success('创建成功')
    dialogVisible.value = false
    fetchData()
  } catch (e) { ElMessage.error(e.message || '创建失败') }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除？', '警告', { type: 'warning' })
    await userVersionService.delete(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch {}
}

onMounted(() => { fetchData(); loadApps() })
</script>

<style scoped>
.toolbar-section { margin-bottom: 12px; }
</style>
