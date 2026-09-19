<template>
  <el-main>
    <div class="table-section">
      <div class="toolbar-section">
        <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增管理员</el-button>
        <span class="readonly-hint">超级管理员可管理管理员账户、配额限制与额度套餐；普通管理员默认 2 应用 / 5 激活</span>
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
        <el-table-column label="软件用量" width="140">
          <template #default="{ row }">
            <span v-if="row.is_superuser === 1" style="color:#909399">不限</span>
            <template v-else>
              <span style="font-size:13px">{{ row.apps_used ?? 0 }} / {{ row.effective_max_apps === -1 ? '不限' : row.effective_max_apps }}</span>
              <el-tag v-if="row.apps_plan_delta > 0" type="warning" size="small" style="margin-left:4px">+{{ row.apps_plan_delta }}</el-tag>
            </template>
          </template>
        </el-table-column>
        <el-table-column label="激活用量" width="140">
          <template #default="{ row }">
            <span v-if="row.is_superuser === 1" style="color:#909399">不限</span>
            <template v-else>
              <span style="font-size:13px">{{ row.activated_used ?? 0 }} / {{ row.effective_max_card_activations === -1 ? '不限' : row.effective_max_card_activations }}</span>
              <el-tag v-if="row.activations_plan_delta > 0" type="warning" size="small" style="margin-left:4px">+{{ row.activations_plan_delta }}</el-tag>
            </template>
          </template>
        </el-table-column>
        <el-table-column prop="last_login" label="最后登录" width="170" />
        <el-table-column label="操作" width="450" fixed="right">
          <template #default="{ row }">
            <el-button-group>
              <el-button type="primary" size="small" @click="handleEditLimits(row)"
                :disabled="row.is_superuser === 1">配额</el-button>
              <el-button type="success" size="small" @click="handleGrantPlan(row)"
                :disabled="row.is_superuser === 1">套餐</el-button>
              <el-button type="info" size="small" @click="handleViewPlans(row)"
                :disabled="row.is_superuser === 1">记录</el-button>
              <el-button type="warning" size="small" @click="handleRenew(row)"
                :disabled="row.is_superuser === 1">续期</el-button>
              <el-button :type="row.status === 'enabled' ? 'danger' : 'success'" size="small" @click="handleToggleStatus(row)"
                :disabled="row.id === currentUserId">{{ row.status === 'enabled' ? '禁用' : '启用' }}</el-button>
              <el-button type="danger" size="small" :icon="Delete" @click="handleDelete(row)"
                :disabled="row.id === currentUserId">删除</el-button>
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
          <el-alert type="info" :closable="false" style="margin-bottom:16px">
            普通管理员默认配额：2 个应用 / 5 个最大激活卡密，可在创建后通过「配额」按钮调整
          </el-alert>
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
            <span class="form-hint">-1 表示不限，默认 2</span>
          </el-form-item>
          <el-form-item label="激活上限" prop="max_card_activations">
            <el-input-number v-model="form.max_card_activations" :min="-1" :step="1" style="width:100%" />
            <span class="form-hint">-1 表示不限，默认 5</span>
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="saving">确定</el-button>
      </template>
    </el-dialog>

    <!-- 配额编辑弹窗 -->
    <el-dialog v-model="limitsDialogVisible" title="配置管理员基础配额" width="480px">
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
          <span class="form-hint">基础永久额度，-1 表示不限</span>
        </el-form-item>
        <el-form-item label="激活上限">
          <el-input-number v-model="limitsForm.max_card_activations" :min="-1" :step="1" style="width:100%" />
          <span class="form-hint">基础永久额度，-1 表示不限</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="limitsDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveLimits" :loading="savingLimits">保存</el-button>
      </template>
    </el-dialog>

    <!-- 发放额度套餐弹窗 -->
    <el-dialog v-model="planDialogVisible" title="发放额度套餐" width="520px">
      <el-alert type="warning" :closable="false" style="margin-bottom:16px">
        临时额度会在有效期内叠加到基础配额上，过期自动失效，无需手动清理
      </el-alert>
      <el-form :model="planForm" label-width="100px">
        <el-form-item label="管理员">
          <span style="font-weight:600">{{ planForm.username }}</span>
        </el-form-item>
        <el-form-item label="配额类型">
          <el-select v-model="planForm.type" style="width:100%">
            <el-option label="软件配额" value="max_apps" />
            <el-option label="激活配额" value="max_card_activations" />
          </el-select>
        </el-form-item>
        <el-form-item label="增减量">
          <el-input-number v-model="planForm.delta" :min="1" :step="1" style="width:100%" />
          <span class="form-hint">正数=增加额度</span>
        </el-form-item>
        <el-form-item label="有效天数">
          <el-input-number v-model="planForm.duration_days" :min="0" :step="1" style="width:100%" />
          <span class="form-hint">0 = 永久有效，7 = 7天后自动失效</span>
        </el-form-item>
        <el-form-item label="来源">
          <el-select v-model="planForm.source" style="width:100%">
            <el-option label="手动发放" value="admin_grant" />
            <el-option label="周卡" value="weekly_card" />
            <el-option label="月卡" value="monthly_card" />
            <el-option label="系统赠送" value="system_gift" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="planForm.remark" placeholder="可选备注" maxlength="255" />
        </el-form-item>
      </el-form>
      <!-- 快捷模板 -->
      <div style="margin-top:8px">
        <span style="color:#909399;font-size:13px;margin-right:8px">快捷模板:</span>
        <el-button size="small" @click="applyTemplate('apps_weekly')">软件配额周卡 +50/7天</el-button>
        <el-button size="small" @click="applyTemplate('activations_monthly')">激活配额月卡 +200/30天</el-button>
        <el-button size="small" @click="applyTemplate('apps_permanent')">软件配额永久 +10</el-button>
      </div>
      <template #footer>
        <el-button @click="planDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSavePlan" :loading="savingPlan">发放</el-button>
      </template>
    </el-dialog>

    <!-- 套餐记录弹窗 -->
    <el-dialog v-model="plansRecordVisible" title="额度套餐记录" width="750px">
      <el-table :data="plansList" v-loading="loadingPlans" size="small">
        <el-table-column type="index" label="#" width="50" />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.type === 'max_apps' ? 'primary' : 'success'">
              {{ row.type === 'max_apps' ? '软件配额' : '激活配额' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="delta" label="增减量" width="80">
          <template #default="{ row }">
            <span :style="{color: row.delta > 0 ? '#67c23a' : '#f56c6c'}">{{ row.delta > 0 ? '+' : '' }}{{ row.delta }}</span>
          </template>
        </el-table-column>
        <el-table-column label="有效期" width="200">
          <template #default="{ row }">
            <div style="font-size:12px">
              <div>生效: {{ formatTime(row.effective_at) }}</div>
              <div v-if="row.expires_at" :style="{color: isExpired(row.expires_at) ? '#f56c6c' : '#909399'}">
                过期: {{ formatTime(row.expires_at) }}{{ isExpired(row.expires_at) ? ' (已失效)' : '' }}
              </div>
              <div v-else style="color:#909399">永久有效</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="source" label="来源" width="100" />
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag v-if="!row.expires_at || !isExpired(row.expires_at)" type="success" size="small">有效</el-tag>
            <el-tag v-else type="info" size="small">已失效</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="plansRecordVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 续期弹窗 -->
    <el-dialog v-model="renewDialogVisible" title="续期管理员账号" width="460px">
      <el-alert type="info" :closable="false" style="margin-bottom:16px">
        续期会在当前到期时间基础上叠加延长，不会覆盖未用完的时间
      </el-alert>
      <el-form :model="renewForm" label-width="100px">
        <el-form-item label="管理员">
          <span style="font-weight:600">{{ renewForm.username }}</span>
        </el-form-item>
        <el-form-item label="当前到期">
          <span v-if="renewForm.current_expires" :style="{color: isExpired(renewForm.current_expires) ? '#f56c6c' : '#67c23a'}">
            {{ renewForm.current_expires }}
          </span>
          <span v-else style="color:#909399">未设置</span>
        </el-form-item>
        <el-form-item label="续期天数">
          <el-input-number v-model="renewForm.duration_days" :min="1" :step="1" style="width:100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="renewForm.remark" placeholder="可选备注" maxlength="255" />
        </el-form-item>
      </el-form>
      <div style="margin-top:8px">
        <span style="color:#909399;font-size:13px;margin-right:8px">快捷:</span>
        <el-button size="small" @click="renewForm.duration_days = 7">7天</el-button>
        <el-button size="small" @click="renewForm.duration_days = 30">30天</el-button>
        <el-button size="small" @click="renewForm.duration_days = 90">90天</el-button>
        <el-button size="small" @click="renewForm.duration_days = 365">1年</el-button>
      </div>
      <template #footer>
        <el-button @click="renewDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveRenew" :loading="savingRenew">续期</el-button>
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
const savingPlan = ref(false)
const savingRenew = ref(false)
const loadingPlans = ref(false)
const dialogVisible = ref(false)
const limitsDialogVisible = ref(false)
const planDialogVisible = ref(false)
const plansRecordVisible = ref(false)
const renewDialogVisible = ref(false)
const formRef = ref(null)
const currentUserId = ref(null)
const plansList = ref([])

const form = reactive({
  username: '',
  email: '',
  password: '',
  is_superuser: 0,
  expires_at: null,
  max_apps: 2,
  max_card_activations: 5
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

const planForm = reactive({
  id: null,
  username: '',
  type: 'max_apps',
  delta: 50,
  duration_days: 7,
  source: 'admin_grant',
  remark: ''
})

const renewForm = reactive({
  id: null,
  username: '',
  current_expires: null,
  duration_days: 30,
  remark: ''
})

/** 判断是否已过期 */
function isExpired(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

/** 格式化时间 */
function formatTime(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN', { hour12: false })
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
  form.max_apps = 2
  form.max_card_activations = 5
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate()
  try {
    saving.value = true
    const payload = { ...form }
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

/** 打开发放套餐弹窗 */
const handleGrantPlan = (row) => {
  planForm.id = row.id
  planForm.username = row.username
  planForm.type = 'max_apps'
  planForm.delta = 50
  planForm.duration_days = 7
  planForm.source = 'admin_grant'
  planForm.remark = ''
  planDialogVisible.value = true
}

/** 快捷模板 */
const applyTemplate = (template) => {
  switch (template) {
    case 'apps_weekly':
      planForm.type = 'max_apps'; planForm.delta = 50; planForm.duration_days = 7; planForm.source = 'weekly_card'; planForm.remark = '软件配额周卡'
      break
    case 'activations_monthly':
      planForm.type = 'max_card_activations'; planForm.delta = 200; planForm.duration_days = 30; planForm.source = 'monthly_card'; planForm.remark = '激活配额月卡'
      break
    case 'apps_permanent':
      planForm.type = 'max_apps'; planForm.delta = 10; planForm.duration_days = 0; planForm.source = 'admin_grant'; planForm.remark = '永久增加软件配额'
      break
  }
}

/** 保存套餐 */
const handleSavePlan = async () => {
  try {
    savingPlan.value = true
    const res = await request.post(`/admin/admins/${planForm.id}/plans`, {
      type: planForm.type,
      delta: planForm.delta,
      duration_days: planForm.duration_days,
      source: planForm.source,
      remark: planForm.remark
    })
    ElMessage.success(res.message || '额度套餐发放成功')
    planDialogVisible.value = false
    await fetchList()
  } catch (error) {
    ElMessage.error(error.message || '发放套餐失败')
  } finally {
    savingPlan.value = false
  }
}

/** 查看套餐记录 */
const handleViewPlans = async (row) => {
  plansRecordVisible.value = true
  try {
    loadingPlans.value = true
    const res = await request.get(`/admin/admins/${row.id}/plans`)
    plansList.value = res.data || []
  } catch (error) {
    ElMessage.error(error.message || '获取套餐记录失败')
  } finally {
    loadingPlans.value = false
  }
}

/** 打开续期弹窗 */
const handleRenew = (row) => {
  renewForm.id = row.id
  renewForm.username = row.username
  renewForm.current_expires = row.expires_at || null
  renewForm.duration_days = 30
  renewForm.remark = ''
  renewDialogVisible.value = true
}

/** 保存续期 */
const handleSaveRenew = async () => {
  try {
    savingRenew.value = true
    const res = await request.post(`/admin/admins/${renewForm.id}/renew`, {
      duration_days: renewForm.duration_days,
      remark: renewForm.remark
    })
    ElMessage.success(res.message || '续期成功')
    renewDialogVisible.value = false
    await fetchList()
  } catch (error) {
    ElMessage.error(error.message || '续期失败')
  } finally {
    savingRenew.value = false
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
  const apps = row.apps_used ?? 0
  const activated = row.activated_used ?? 0
  const resourceHint = (apps > 0 || activated > 0)
    ? `其名下的 ${apps} 个应用与 ${activated} 张已激活卡密将转移给你，之后可再分配。`
    : ''
  try {
    await ElMessageBox.confirm(
      `确定要删除管理员「${row.username}」吗？此操作不可恢复。${resourceHint}`,
      '警告', { type: 'warning' }
    )
    const res = await request.delete(`/admin/admins/${row.id}`)
    ElMessage.success(res.message || '删除成功')
    await fetchList()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(error.message || '删除失败')
  }
}

onMounted(() => {
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
