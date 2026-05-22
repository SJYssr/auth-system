<template>
  <el-main>
    <div class="table-section">
      <div class="toolbar-section">
        <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>生成卡密</el-button>
      </div>
      <el-table :data="list" v-loading="loading">
        <el-table-column prop="card" label="卡密号码" min-width="200" />
        <el-table-column prop="app_name" label="所属应用" min-width="120" />
        <el-table-column prop="card_type" label="类型" width="80" />
        <el-table-column prop="points" label="积分" width="70" />
        <el-table-column label="激活" width="80">
          <template #default="{row}">{{ row.is_activated ? '已激活' : '未激活' }}</template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160" />
        <el-table-column label="操作" width="80">
          <template #default="{row}">
            <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" title="生成卡密" width="400px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="选择应用">
          <el-select v-model="form.app_id" style="width:100%" placeholder="选择应用">
            <el-option v-for="a in appOptions" :key="a.id" :label="a.app_name" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="卡密类型">
          <el-select v-model="form.card_type" style="width:100%">
            <el-option v-for="t in types" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="积分数量"><el-input-number v-model="form.points" :min="1" /></el-form-item>
        <el-form-item label="生成数量"><el-input-number v-model="form.count" :min="1" :max="100" /></el-form-item>
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
import { userAppService, userCardService } from '@/utils/service'

const list = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const appOptions = ref([])
const types = ['小时卡', '天卡', '周卡', '月卡', '年卡']
const form = ref({ app_id: '', card_type: '天卡', points: 1, count: 1 })

const fetchData = async () => {
  loading.value = true
  try { const res = await userCardService.getAll(); list.value = res.data || [] } catch {} finally { loading.value = false }
}

const loadApps = async () => {
  try { const res = await userAppService.getAll({ per_page: 1000 }); appOptions.value = res.data || [] } catch {}
}

const handleAdd = () => { form.value = { app_id: '', card_type: '天卡', points: 1, count: 1 }; dialogVisible.value = true }

const handleSubmit = async () => {
  try {
    await userCardService.create(form.value)
    ElMessage.success('生成成功')
    dialogVisible.value = false
    fetchData()
  } catch (e) { ElMessage.error(e.message || '生成失败') }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除？', '警告', { type: 'warning' })
    await userCardService.delete(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch {}
}

onMounted(() => { fetchData(); loadApps() })
</script>

<style scoped>
.toolbar-section { margin-bottom: 12px; }
</style>
