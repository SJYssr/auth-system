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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { useBusinessStore } from '@/stores/modules/business'

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
})
</script>

<style scoped>
.settings-page { padding: 20px; background: #f8f9fa; min-height: 100vh; }
.settings-content { background: white; border-radius: 15px; padding: 24px; }
.tab-content { padding: 20px 0; }
.image-input { display: flex; gap: 8px; align-items: center; }
.image-input .el-input { flex: 1; }
.form-actions { text-align: center; padding-top: 20px; border-top: 1px solid #eee; margin-top: 20px; }
.preview-container { display: flex; justify-content: center; align-items: center; padding: 20px; }
.preview-image { max-width: 100%; max-height: 300px; border-radius: 4px; }
@media (max-width: 768px) {
  .settings-page { padding: 16px; }
  .settings-content { padding: 20px; }
  .image-input { flex-direction: column; align-items: stretch; }
  .preview-image { max-height: 200px; }
}
</style>
