<template>
  <div class="login-page">
    <div class="login-card">
      <div class="card-header">
        <div class="logo-icon" v-if="logoSrc">
          <img :src="logoSrc" @error="logoSrc=''" class="logo-img" />
        </div>
        <div class="logo-icon" v-else>
          <span class="logo-emoji">🔐</span>
        </div>
        <h2>{{ siteName }}</h2>
        <p class="subtitle">创建您的账号</p>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="0" @keyup.enter="handleRegister">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" size="large" class="glass-input" />
        </el-form-item>
        <el-form-item prop="email">
          <el-input v-model="form.email" placeholder="电子邮箱" size="large" class="glass-input" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码（至少6位）" show-password size="large" class="glass-input" />
        </el-form-item>
        <el-form-item prop="confirmPassword">
          <el-input v-model="form.confirmPassword" type="password" placeholder="确认密码" show-password size="large" class="glass-input" />
        </el-form-item>
        <el-form-item>
          <el-button size="large" :loading="loading" @click="handleRegister" class="login-btn">
            注 册
          </el-button>
        </el-form-item>
      </el-form>
      <div class="card-footer">
        <span class="switch-text">已经有账号了？</span>
        <router-link to="/login" class="switch-link">立即登录</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/modules/app'
import { storeToRefs } from 'pinia'
import request from '@/utils/request'

const store = useAppStore()
const { initializeInfo } = storeToRefs(store)

const loading = ref(false)
const formRef = ref(null)
const logoSrc = ref('')
const form = reactive({ username: '', email: '', password: '', confirmPassword: '' })

const validateConfirm = (rule, value, callback) => {
  if (value !== form.password) callback(new Error('两次密码输入不一致'))
  else callback()
}
const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, message: '用户名至少3位', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: validateConfirm, trigger: 'blur' }
  ]
}

const siteName = computed(() => initializeInfo.value?.website?.site_name || '授权管理系统')

const handleRegister = async () => {
  if (!formRef.value) return
  await formRef.value.validate()
  try {
    loading.value = true
    await request.post('/public/register', {
      username: form.username,
      email: form.email,
      password: form.password
    })
    ElMessage.success('注册成功，请登录')
    formRef.value.resetFields()
  } catch (error) {
    ElMessage.error(error.message || '注册失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (initializeInfo.value?.website?.logo_url) {
    logoSrc.value = initializeInfo.value.website.logo_url
  }
})
</script>

<style scoped>
.login-page {
  display: flex; align-items: center; justify-content: center;
  flex: 1; padding: 40px 20px;
}
.login-card {
  width: 420px; padding: 48px 40px 36px;
  background: rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
  border-top: 1px solid rgba(255, 255, 255, 0.25);
  border-left: 1px solid rgba(255, 255, 255, 0.25);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.35);
}
.card-header { text-align: center; margin-bottom: 36px; }
.logo-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 64px; height: 64px; border-radius: 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  margin-bottom: 16px; overflow: hidden;
}
.logo-img { width: 100%; height: 100%; object-fit: cover; }
.logo-emoji { font-size: 28px; }
.card-header h2 { font-size: 24px; font-weight: 700; color: #fff; margin: 0; letter-spacing: 1px; }
.subtitle { font-size: 13px; color: rgba(255, 255, 255, 0.45); margin: 8px 0 0; }
.card-footer { text-align: center; margin-top: 20px; padding-top: 16px; border-top: 1px solid rgba(255, 255, 255, 0.1); }
.switch-text { color: rgba(255, 255, 255, 0.4); font-size: 13px; }
.switch-link { color: rgba(255, 255, 255, 0.7); font-size: 13px; text-decoration: none; transition: color 0.2s; font-weight: 500; }
.switch-link:hover { color: #fff; }
</style>

<style>
.login-page .glass-input .el-input__wrapper {
  background: rgba(0, 0, 0, 0.2) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 12px !important;
  box-shadow: none !important;
}
.login-page .glass-input .el-input__wrapper:hover {
  border-color: rgba(255, 255, 255, 0.3) !important;
}
.login-page .glass-input.is-focus .el-input__wrapper {
  background: rgba(0, 0, 0, 0.3) !important;
  border-color: rgba(255, 255, 255, 0.5) !important;
  box-shadow: 0 0 16px rgba(255, 255, 255, 0.08) !important;
}
.login-page .glass-input .el-input__inner {
  color: #fff !important;
}
.login-page .glass-input .el-input__inner::placeholder {
  color: rgba(255, 255, 255, 0.38) !important;
}
.login-page .glass-input .el-input__suffix,
.login-page .glass-input .el-input__prefix {
  color: rgba(255, 255, 255, 0.5) !important;
}
.login-page .login-btn {
  width: 100% !important; height: 48px !important;
  border-radius: 12px !important; border: none !important;
  font-size: 15px !important; font-weight: 700 !important;
  letter-spacing: 2px !important;
  background: rgba(255, 255, 255, 0.9) !important;
  color: #0f172a !important;
}
.login-page .login-btn:hover {
  background: #fff !important;
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.3);
}
</style>
