<template>
  <el-main>
    <div class="table-section">
      <div class="toolbar-section">
        <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增管理员</el-button>
        <span class="readonly-hint">超级管理员可管理管理员账户及配额限制；普通管理员只能查看API文档与错误码</span>
      </div>
      <el-table :data="list" v-loading="loading">
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column prop="username" label="用户名" min-width="120" />
        <el-table-column prop="email" label="邮箱" min-width="180" show-overflow-tooltip />
        <el-table-column label="角色" width="110">
          <template #default="{ row }">
            <el-tag :type="row.is_superuser === 1 ? 'danger' : 'info'" size="small">
              {{ row.is_superuser === 1 ? '超级管理员' : '管理员' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'enabled' ? 'success' : 'info'" size="small">
              {{ row.status === 'enabled' ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="到期时间" width="170">
          <template #default="{ row }">
            <span v-if="row.is_superuser === 1" style="color:#909399">永不过期</span>
            <span v-else-if="!row.expires_at" style="color:#909399">未设置</span>
            <el-tag v-else :type="isExpired(row.expires_at) ? 'danger' : 'success'" size="small">
              {{ row.expires_at }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="软件上限" width="100">
          <template #default="{ row }">
            <span v-if="row.is_superuser === 1 || row.max_apps === -1" style="color:#909399">不限</span>
            <span v-else>{{ row.max_apps }}</span>
          </template>
        </el-table-column>
        <el-table-column label="激活上限" width="100">
          <template #default="{ row }">
            <span v-if="row.is_superuser === 1 || row.max_card_activations === -1" style="color:#909399">不限</span>
            <span v-else>{{ row.max_card_activations }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="last_login" label="最后登录" width="170" />
        <el-table-column label="操作" width="320">
          <template #default="{ row }">
            <el-button-group>
              <el-button type="primary" size="small" @click="handleEditLimits(row)"
                :disabled="row.is_superuser === 1">
                配额
              </el-button>
              <el-button type="warning" size="small" @click="handleToggleStatus(row)"
                :disabled="row.id === currentUserId">
                {{ row.status === 'enabled' ? '禁用' : '启用' }}
              </el-button>
              <el-button type="danger" size="small" :icon="Delete" @click="handleDelete(row)"
                :disabled="row.id === currentUserId">
                删除
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 新增管理员弹窗 -->
    <el-dialog v-model="dialogVisible" title="新增管理员" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" maxlength="50" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="请输入邮箱" maxlength="100" />
        </el-form-item>
        <el-form-item label="初始密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="至少8位" show-password maxlength="64" />
        </el-form-item>
        <el-form-item label="角色" prop="is_superuser">
          <el-select v-model="form.is_superuser" style="width:100%">
            <el-option label="管理员（受配额限制）" :value="0" />
            <el-option label="超级管理员（全部权限）" :value="1" />
          </el-select>
        </el-form-item>
        <template v-if="form.is_superuser === 0">
          <el-form-item label="到期时间" prop="expires_at">
            <el-date-picker
              v-model="form.expires_at"
              type="datetime"
              placeholder="留空表示永不到期"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss"
              style="width:100%"
            />
          </el-form-item>
          <el-form-item label="软件上限" prop="max_apps">
            <el-input-number v-model="form.max_apps" :min="-1" :step="1" style="width:100%" />
            <span class="form-hint">-1 表示不限</span>
          </el-form-item>
          <el-form-item label="激活上限" prop="max_card_activations">
            <el-input-number v-model="form.max_card_activations" :min="-1" :step="1" style="width:100%" />
            <span class="form-hint">-1 表示不限</span>
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="saving">确定</el-button>
      </template>
    </el-dialog>

    <!-- 配额编辑弹窗 -->
    <el-dialog v-model="limitsDialogVisible" title="配置管理员配额" width="480px">
      <el-form :model="limitsForm" label-width="100px">
        <el-form-item label="管理员">
          <span style="font-weight:600">{{ limitsForm.username }}</span>
        </el-form-item>
        <el-form-item label="到期时间">
          <el-date-picker
            v-model="limitsForm.expires_at"
            type="datetime"
            placeholder="留空表示永不到期"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width:100%"
            clearable
          />
        </el-form-item>
        <el-form-item label="软件上限">
          <el-input-number v-model="limitsForm.max_apps" :min="-1" :step="1" style="width:100%" />
          <span class="form-hint">-1 表示不限</span>
        </el-form-item>
        <el-form-item label="激活上限">
          <el-input-number v-model="limitsForm.max_card_activations" :min="-1" :step="1" style="width:100%" />
          <span class="form-hint">-1 表示不限</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="limitsDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveLimits" :loading="savingLimits">保存</el-button>
      </template>
    </el-dialog>
  </el-main>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete } from '@element-plus/icons-vue'
import request from '@/utils/request'

const list = ref([])
const loading = ref(false)
const saving = ref(false)
const savingLimits = ref(false)
const dialogVisible = ref(false)
const limitsDialogVisible = ref(false)
const formRef = ref(null)
const currentUserId = ref(null)

const form = reactive({
  username: '',
  email: '',
  password: '',
  is_superuser: 0,
  expires_at: null,
  max_apps: -1,
  max_card_activations: -1
})

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 50, message: '长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, message: '密码长度至少8位', trigger: 'blur' }
  ]
}

const limitsForm = reactive({
  id: null,
  username: '',
  expires_at: null,
  max_apps: -1,
  max_card_activations: -1
})

/** 判断是否已过期 */
function isExpired(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

const fetchList = async () => {
  try {
    loading.value = true
    const res = await request.get('/admin/admins')
    list.value = res.data || []
  } catch (error) {
    ElMessage.error(error.message || '获取管理员列表失败')
  } finally {
    loading.value = false
  }
}

const handleAdd = () => {
  form.username = ''
  form.email = ''
  form.password = ''
  form.is_superuser = 0
  form.expires_at = null
  form.max_apps = -1
  form.max_card_activations = -1
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate()
  try {
    saving.value = true
    const payload = { ...form }
    // 超管不需要配额字段
    if (payload.is_superuser === 1) {
      delete payload.expires_at
      delete payload.max_apps
      delete payload.max_card_activations
    }
    const res = await request.post('/admin/admins', payload)
    ElMessage.success(res.message || '创建成功')
    dialogVisible.value = false
    await fetchList()
  } catch (error) {
    ElMessage.error(error.message || '创建失败')
  } finally {
    saving.value = false
  }
}

/** 打开配额编辑弹窗 */
const handleEditLimits = (row) => {
  limitsForm.id = row.id
  limitsForm.username = row.username
  limitsForm.expires_at = row.expires_at || null
  limitsForm.max_apps = row.max_apps !== undefined ? row.max_apps : -1
  limitsForm.max_card_activations = row.max_card_activations !== undefined ? row.max_card_activations : -1
  limitsDialogVisible.value = true
}

/** 保存配额 */
const handleSaveLimits = async () => {
  try {
    savingLimits.value = true
    const res = await request.put(`/admin/admins/${limitsForm.id}/limits`, {
      expires_at: limitsForm.expires_at || null,
      max_apps: limitsForm.max_apps,
      max_card_activations: limitsForm.max_card_activations
    })
    ElMessage.success(res.message || '配额更新成功')
    limitsDialogVisible.value = false
    await fetchList()
  } catch (error) {
    ElMessage.error(error.message || '更新配额失败')
  } finally {
    savingLimits.value = false
  }
}

const handleToggleStatus = async (row) => {
  const target = row.status === 'enabled' ? 'disabled' : 'enabled'
  const action = target === 'disabled' ? '禁用' : '启用'
  try {
    await ElMessageBox.confirm(`确定要${action}管理员「${row.username}」吗？`, '警告', { type: 'warning' })
    const res = await request.put(`/admin/admins/${row.id}/status`, { status: target })
    ElMessage.success(res.message || '更新成功')
    await fetchList()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(error.message || '更新失败')
  }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要删除管理员「${row.username}」吗？此操作不可恢复。`, '警告', { type: 'warning' })
    const res = await request.delete(`/admin/admins/${row.id}`)
    ElMessage.success(res.message || '删除成功')
    await fetchList()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(error.message || '删除失败')
  }
}

onMounted(() => {
  // 当前登录用户 id 来自 /public/init（路由守卫已保证已登录）
  request.get('/public/init').then(res => {
    currentUserId.value = res.data?.login_status?.user?.id ?? null
  }).catch(() => {})
  fetchList()
})
</script>

<style scoped>
.toolbar-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.readonly-hint {
  color: #909399;
  font-size: 13px;
}
.form-hint {
  color: #909399;
  font-size: 12px;
  margin-left: 8px;
}
</style>
