<template>
  <div class="settings-page">
    <div class="settings-content">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-tabs v-model="activeTab" class="settings-tabs">
          <el-tab-pane label="基本信息" name="basic">
            <div class="tab-content">
              <el-form-item label="网站名称" prop="site_name">
                <el-input v-model="form.site_name" placeholder="请输入网站名称" />
              </el-form-item>
              <el-form-item label="浏览器标题" prop="site_title">
                <el-input v-model="form.site_title" placeholder="浏览器标签页标题（留空则用网站名称）" />
              </el-form-item>
              <el-form-item label="SEO关键词">
                <el-input v-model="form.keywords" placeholder="多个关键词用英文逗号分隔" />
              </el-form-item>
              <el-form-item label="底部描述">
                <el-input v-model="form.description" placeholder="请输入底部描述文字" />
              </el-form-item>
              <el-form-item label="版权信息">
                <el-input v-model="form.copyright" placeholder="如：zyyo. 保留所有权利" />
              </el-form-item>
              <el-form-item label="版权起始年份">
                <el-input v-model="form.copyright_since" placeholder="如：2025，留空则仅显示当前年份" maxlength="4" />
              </el-form-item>
              <el-form-item label="ICP备案号">
                <el-input v-model="form.icp_number" placeholder="如：京ICP备XXXXXXXX号" />
              </el-form-item>
              <el-form-item label="联系邮箱" prop="contact_email">
                <el-input v-model="form.contact_email" placeholder="请输入联系邮箱" />
              </el-form-item>
              <el-form-item label="联系电话">
                <el-input v-model="form.contact_phone" placeholder="请输入联系电话" />
              </el-form-item>
              <el-form-item label="联系地址">
                <el-input v-model="form.contact_address" placeholder="请输入联系地址（可选）" />
              </el-form-item>
            </div>
          </el-tab-pane>

          <el-tab-pane label="图片设置" name="images">
            <div class="tab-content">
              <el-form-item label="网站Logo">
                <div class="image-input">
                  <el-input v-model="form.logo_url" placeholder="请输入Logo图片地址" />
                  <el-button type="primary" link @click="previewImage(form.logo_url)">预览</el-button>
                </div>
              </el-form-item>
              <el-form-item label="网站图标">
                <div class="image-input">
                  <el-input v-model="form.favicon_url" placeholder="请输入网站图标地址" />
                  <el-button type="primary" link @click="previewImage(form.favicon_url)">预览</el-button>
                </div>
              </el-form-item>
              <el-form-item label="登录页背景">
                <div class="image-input">
                  <el-input v-model="form.login_bg_url" placeholder="请输入登录页背景图地址（可选）" />
                  <el-button type="primary" link @click="previewImage(form.login_bg_url)">预览</el-button>
                </div>
              </el-form-item>
            </div>
          </el-tab-pane>

          <el-tab-pane label="产品分类" name="categories">
            <div class="tab-content">
              <div class="category-toolbar">
                <span class="category-hint">前台「产品中心」按分类过滤；删除分类后引用它的应用自动回到未分类</span>
                <el-button type="primary" @click="openCategoryForm()">
                  <el-icon><Plus /></el-icon>
                  新增分类
                </el-button>
              </div>
              <el-table :data="categories" v-loading="categoriesLoading" style="width: 100%"
                :cell-style="{ borderColor: '#e8e8e8' }" :header-cell-style="{ borderColor: '#e8e8e8' }">
                <el-table-column prop="name" label="分类名称" min-width="140" />
                <el-table-column prop="sort_order" label="排序" width="80" />
                <el-table-column label="状态" width="90">
                  <template #default="{ row }">
                    <el-tag :type="row.status === 'enabled' ? 'success' : 'info'" size="small">
                      {{ row.status === 'enabled' ? '启用' : '停用' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="created_at" label="创建时间" width="170" />
                <el-table-column label="操作" width="150" fixed="right">
                  <template #default="{ row }">
                    <el-button size="small" @click="openCategoryForm(row)">编辑</el-button>
                    <el-button type="danger" size="small" @click="handleCategoryDelete(row)">删除</el-button>
                  </template>
                </el-table-column>
                <template #empty>
                  <el-empty description="暂无分类，点击「新增分类」创建" />
                </template>
              </el-table>
            </div>
          </el-tab-pane>
        </el-tabs>

        <div class="form-actions">
          <el-button type="primary" size="large" :loading="saveLoading" @click="handleSubmit">保存设置</el-button>
        </div>
      </el-form>
    </div>

    <el-dialog v-model="previewVisible" title="图片预览" width="500px" center>
      <div class="preview-container">
        <img :src="previewUrl" alt="预览图片" class="preview-image" />
      </div>
    </el-dialog>

    <el-dialog v-model="categoryDialogVisible" :title="categoryForm.id ? '编辑分类' : '新增分类'" width="440px">
      <el-form :model="categoryForm" label-width="80px">
        <el-form-item label="分类名称" required>
          <el-input v-model="categoryForm.name" placeholder="如：工具软件" maxlength="64" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="categoryForm.sort_order" :min="0" :max="9999" />
          <span class="category-hint" style="margin-left:8px">数字越小越靠前</span>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="categoryForm.status" active-value="enabled" inactive-value="disabled"
            active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="categoryDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="categorySaving" @click="handleCategorySave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useBusinessStore } from '@/stores/modules/business'
import { superCategoryService } from '@/utils/service'

const store = useBusinessStore()
const { websiteInfo } = storeToRefs(store)

const formRef = ref(null)
const saveLoading = ref(false)
const previewVisible = ref(false)
const previewUrl = ref('')
const activeTab = ref('basic')

const form = ref({
  site_name: '',
  site_title: '',
  keywords: '',
  description: '',
  copyright: '',
  copyright_since: '',
  icp_number: '',
  logo_url: '',
  favicon_url: '',
  login_bg_url: '',
  contact_email: '',
  contact_phone: '',
  contact_address: ''
})

const rules = ref({
  site_name: [{ required: true, message: '请输入网站名称', trigger: 'blur' }],
  contact_email: [
    { required: true, message: '请输入联系邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ]
})

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate()
  try {
    saveLoading.value = true
    await store.saveWebsiteInfo(form.value)
    ElMessage.success('保存成功')
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    saveLoading.value = false
  }
}

const previewImage = (url) => {
  if (!url) { ElMessage.warning('请先输入图片地址'); return }
  previewUrl.value = url
  previewVisible.value = true
}

// ===== 产品分类管理 =====
const categories = ref([])
const categoriesLoading = ref(false)
const categoryDialogVisible = ref(false)
const categorySaving = ref(false)
const categoryForm = ref({ id: null, name: '', sort_order: 0, status: 'enabled' })

const fetchCategories = async () => {
  try {
    categoriesLoading.value = true
    const res = await superCategoryService.getAll()
    categories.value = res.data || []
  } catch (error) {
    ElMessage.error(error.message || '获取分类失败')
  } finally {
    categoriesLoading.value = false
  }
}

const openCategoryForm = (row = null) => {
  categoryForm.value = row
    ? { id: row.id, name: row.name, sort_order: row.sort_order ?? 0, status: row.status }
    : { id: null, name: '', sort_order: 0, status: 'enabled' }
  categoryDialogVisible.value = true
}

const handleCategorySave = async () => {
  if (!categoryForm.value.name || !categoryForm.value.name.trim()) {
    ElMessage.warning('请输入分类名称')
    return
  }
  try {
    categorySaving.value = true
    if (categoryForm.value.id) {
      await superCategoryService.update(categoryForm.value.id, {
        name: categoryForm.value.name, sort_order: categoryForm.value.sort_order, status: categoryForm.value.status
      })
      ElMessage.success('更新成功')
    } else {
      await superCategoryService.create({
        name: categoryForm.value.name, sort_order: categoryForm.value.sort_order, status: categoryForm.value.status
      })
      ElMessage.success('创建成功')
    }
    categoryDialogVisible.value = false
    fetchCategories()
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    categorySaving.value = false
  }
}

const handleCategoryDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除分类「${row.name}」吗？引用它的应用将回到未分类。`,
      '删除确认',
      { type: 'warning' }
    )
  } catch { return }
  try {
    await superCategoryService.delete(row.id)
    ElMessage.success('删除成功')
    fetchCategories()
  } catch (error) {
    ElMessage.error(error.message || '删除失败')
  }
}

onMounted(async () => {
  await store.getWebsiteInfo()
  form.value = {
    site_name: websiteInfo.value?.site_name || '',
    site_title: websiteInfo.value?.site_title || '',
    keywords: websiteInfo.value?.keywords || '',
    description: websiteInfo.value?.description || '',
    copyright: websiteInfo.value?.copyright || '',
    copyright_since: websiteInfo.value?.copyright_since || '',
    icp_number: websiteInfo.value?.icp_number || '',
    logo_url: websiteInfo.value?.logo_url || '',
    favicon_url: websiteInfo.value?.favicon_url || '',
    login_bg_url: websiteInfo.value?.login_bg_url || '',
    contact_email: websiteInfo.value?.contact_email || '',
    contact_phone: websiteInfo.value?.contact_phone || '',
    contact_address: websiteInfo.value?.contact_address || ''
  }
  fetchCategories()
})
</script>

<style scoped>
.settings-page { padding: 20px; background: #f8f9fa; min-height: 100vh; }
.settings-content { background: white; border-radius: 15px; padding: 24px; }
.tab-content { padding: 20px 0; }
.image-input { display: flex; gap: 8px; align-items: center; }
.image-input .el-input { flex: 1; }
.form-actions { text-align: center; padding-top: 20px; border-top: 1px solid #eee; margin-top: 20px; }
.category-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 12px; }
.category-hint { color: #6b7280; font-size: 13px; }
.preview-container { display: flex; justify-content: center; align-items: center; padding: 20px; }
.preview-image { max-width: 100%; max-height: 300px; border-radius: 4px; }
@media (max-width: 768px) {
  .settings-page { padding: 16px; }
  .settings-content { padding: 20px; }
  .image-input { flex-direction: column; align-items: stretch; }
  .preview-image { max-height: 200px; }
}
</style>
