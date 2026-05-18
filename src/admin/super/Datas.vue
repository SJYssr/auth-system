<template>
  <div class="settings-page">
    <!-- 设置内容 -->
    <div class="settings-content">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-tabs v-model="activeTab" class="settings-tabs">
          <!-- 网站基本信息 -->
           <el-tab-pane label="基本信息" name="basic">
             <div class="tab-content">
               <el-form-item label="网站名称" prop="site_name">
                 <el-input 
                   v-model="form.site_name" 
                   placeholder="请输入网站名称"
                 />
               </el-form-item>
               <el-form-item label="网站标题" prop="site_title">
                 <el-input 
                   v-model="form.site_title" 
                   placeholder="请输入网站标题"
                 />
               </el-form-item>
               <el-form-item label="关键词" prop="keywords">
                 <el-input 
                   v-model="form.keywords" 
                   placeholder="请输入关键词，多个关键词用英文逗号分隔"
                 />
               </el-form-item>
               <el-form-item label="网站描述" prop="description">
                 <el-input 
                   v-model="form.description" 
                   type="textarea" 
                   :rows="4"
                   placeholder="请输入网站描述"
                 />
               </el-form-item>
               <el-form-item label="ICP备案号">
                 <el-input 
                   v-model="form.icp_number" 
                   placeholder="请输入ICP备案号"
                 />
               </el-form-item>
               <el-form-item label="版权信息">
                 <el-input 
                   v-model="form.copyright" 
                   placeholder="请输入版权信息"
                 />
               </el-form-item>
             </div>
           </el-tab-pane>

          <!-- 图片设置 -->
           <el-tab-pane label="图片设置" name="images">
             <div class="tab-content">
               <el-form-item label="网站Logo">
                 <div class="image-input">
                   <el-input 
                     v-model="form.logo_url" 
                     placeholder="请输入Logo图片地址"
                   />
                   <el-button 
                     type="primary" 
                     link
                     @click="previewImage(form.logo_url)"
                   >
                     预览
                   </el-button>
                 </div>
               </el-form-item>
               <el-form-item label="网站图标">
                 <div class="image-input">
                   <el-input 
                     v-model="form.favicon_url" 
                     placeholder="请输入网站图标地址"
                   />
                   <el-button 
                     type="primary" 
                     link
                     @click="previewImage(form.favicon_url)"
                   >
                     预览
                   </el-button>
                 </div>
               </el-form-item>
             </div>
           </el-tab-pane>

          <!-- 联系方式 -->
           <el-tab-pane label="联系方式" name="contact">
             <div class="tab-content">
               <el-form-item label="联系邮箱" prop="contact_email">
                 <el-input 
                   v-model="form.contact_email" 
                   placeholder="请输入联系邮箱"
                 />
               </el-form-item>
               <el-form-item label="联系电话">
                 <el-input 
                   v-model="form.contact_phone" 
                   placeholder="请输入联系电话"
                 />
               </el-form-item>
               <el-form-item label="联系地址">
                 <el-input 
                   v-model="form.contact_address" 
                   type="textarea"
                   :rows="3"
                   placeholder="请输入联系地址"
                 />
               </el-form-item>
             </div>
           </el-tab-pane>

          <!-- 其他设置 -->
           <el-tab-pane label="其他设置" name="other">
             <div class="tab-content">
               <el-form-item label="网站状态">
                 <el-switch 
                   v-model="form.status" 
                   :active-value="1" 
                   :inactive-value="0"
                   active-text="正常运行"
                   inactive-text="维护中"
                 />
               </el-form-item>
             </div>
           </el-tab-pane>
        </el-tabs>

        <!-- 保存按钮 -->
        <div class="form-actions">
          <el-button 
            type="primary" 
            size="large"
            :loading="saveLoading"
            @click="handleSubmit"
          >
            保存设置
          </el-button>
        </div>
      </el-form>
    </div>

    <!-- 图片预览对话框 -->
    <el-dialog
      v-model="previewVisible"
      title="图片预览"
      width="500px"
      center
    >
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
// 不需要导入图标，保持简约
import { useBusinessStore } from '@/stores/modules/business'

// store 初始化
const store = useBusinessStore()
const { websiteInfo } = storeToRefs(store)

// 状态定义
const formRef = ref(null)
const saveLoading = ref(false)
const tableLoading = ref(true)
const previewVisible = ref(false)
const previewUrl = ref('')
const activeTab = ref('basic')



// 表单数据
const form = ref({
  site_name: '',
  site_title: '',
  keywords: '',
  description: '',
  logo_url: '',
  favicon_url: '',
  icp_number: '',
  contact_email: '',
  contact_phone: '',
  contact_address: '',
  copyright: '',
  status: 'enabled'
})



// 表单验证规则
const rules = ref({
  site_name: [
    { required: true, message: '请输入网站名称', trigger: 'blur' }
  ],
  site_title: [
    { required: true, message: '请输入网站标题', trigger: 'blur' }
  ],
  description: [
    { required: true, message: '请输入网站描述', trigger: 'blur' }
  ],
  contact_email: [
    { required: true, message: '请输入联系邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ]
})

// 方法定义
const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate()

  try {
    saveLoading.value = true
    const response = await store.saveWebsiteInfo(form.value)

    ElMessage.success('保存成功')

  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    saveLoading.value = false
  }
}

// 图片预览方法
const previewImage = (url) => {
  if (!url) {
    ElMessage.warning('请先输入图片地址')
    return
  }
  previewUrl.value = url
  previewVisible.value = true
}



// 生命周期钩子
onMounted(async () => {
  await store.getWebsiteInfo()
  form.value = websiteInfo.value
  tableLoading.value = false
})


</script>

<style scoped>
/* 页面容器 */
.settings-page {
  padding: 20px;
  background: #f8f9fa;
  min-height: 100vh;
}

/* 设置内容 */
.settings-content {
  background: white;
  border-radius: 15px;
  padding: 24px;

}

/* 标签页样式 */
.settings-tabs {
  margin-bottom: 20px;
}

.tab-content {
  padding: 20px 0;
}

/* 图片输入组 */
.image-input {
  display: flex;
  gap: 8px;
  align-items: center;
}

.image-input .el-input {
  flex: 1;
}

/* 表单操作按钮 */
.form-actions {
  text-align: center;
  padding-top: 20px;
  border-top: 1px solid #eee;
  margin-top: 20px;
}

/* 图片预览样式 */
.preview-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.preview-image {
  max-width: 100%;
  max-height: 300px;
  border-radius: 4px;

}

/* 移动端适配 */
@media (max-width: 768px) {
  .settings-page {
    padding: 16px;
  }
  
  .settings-content {
    padding: 20px;
  }
  
  .image-input {
    flex-direction: column;
    align-items: stretch;
  }
  
  .preview-image {
    max-height: 200px;
  }
}
</style>