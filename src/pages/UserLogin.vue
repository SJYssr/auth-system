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
        <p class="subtitle">用户登录</p>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="0" @keyup.enter="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" size="large" class="glass-input" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" show-password size="large" class="glass-input" />
        </el-form-item>
        <el-form-item prop="captcha_code">
          <div class="captcha-row">
            <el-input v-model="form.captcha_code" placeholder="验证码" size="large" class="glass-input captcha-input" />
            <img :src="captchaImage" class="captcha-img" @click="fetchCaptcha" title="点击刷新验证码" />
          </div>
        </el-form-item>
        <el-form-item>
          <el-button size="large" :loading="loading" @click="handleLogin" class="login-btn">登 录</el-button>
        </el-form-item>
      </el-form>
      <div class="card-footer">
        <span class="switch-text">还没有账号？</span>
        <router-link to="/register" class="switch-link">去注册</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/modules/app'
import { storeToRefs } from 'pinia'
import request from '@/utils/request'

const router = useRouter()
const store = useAppStore()
const { initializeInfo } = storeToRefs(store)

const loading = ref(false)
const formRef = ref(null)
const captchaImage = ref('')
const captchaKey = ref('')
const logoSrc = ref('')
const form = reactive({ username: '', password: '', captcha_code: '' })
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  captcha_code: [{ required: true, message: '请输入验证码', trigger: 'blur' }]
}

const siteName = computed(() => initializeInfo.value?.website?.site_name || '授权管理系统')

const fetchCaptcha = async () => {
  try {
    const res = await request.get('/public/captcha')
    captchaImage.value = res.data.image
    captchaKey.value = res.data.key
  } catch {}
}

const handleLogin = async () => {
  if (!formRef.value) return
  await formRef.value.validate()
  try {
    loading.value = true
    const res = await request.post('/public/user-login', {
      username: form.username,
      password: form.password,
      captcha_key: captchaKey.value,
      captcha_code: form.captcha_code
    })
    localStorage.setItem('token', res.data.token)
    await store.initialize()
    ElMessage.success('登录成功')
    router.push('/useradmin/dashboard')
  } catch (error) {
    fetchCaptcha()
    form.captcha_code = ''
    ElMessage.error(error.message || '登录失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (initializeInfo.value?.website?.logo_url) logoSrc.value = initializeInfo.value.website.logo_url
  fetchCaptcha()
})
</script>

<style scoped>
.login-page { display: flex; align-items: center; justify-content: center; flex: 1; padding: 40px 20px; }
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
  background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2);
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
.captcha-row { display: flex; gap: 10px; align-items: center; }
.captcha-input { flex: 1; }
.captcha-img { height: 42px; width: 110px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.18); cursor: pointer; flex-shrink: 0; background: rgba(0,0,0,0.2); }
</style>

<style>
.login-page .glass-input .el-input__wrapper {
  background: rgba(0, 0, 0, 0.2) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 12px !important;
  box-shadow: none !important;
}
.login-page .glass-input .el-input__wrapper:hover { border-color: rgba(255,255,255,0.3) !important; }
.login-page .glass-input.is-focus .el-input__wrapper {
  background: rgba(0,0,0,0.3) !important;
  border-color: rgba(255,255,255,0.5) !important;
  box-shadow: 0 0 16px rgba(255,255,255,0.08) !important;
}
.login-page .glass-input .el-input__inner { color: #fff !important; }
.login-page .glass-input .el-input__inner::placeholder { color: rgba(255,255,255,0.38) !important; }
.login-page .glass-input .el-input__suffix, .login-page .glass-input .el-input__prefix { color: rgba(255,255,255,0.5) !important; }
.login-page .glass-input .el-input__inner:-webkit-autofill,
.login-page .glass-input .el-input__inner:-webkit-autofill:hover,
.login-page .glass-input .el-input__inner:-webkit-autofill:focus,
.login-page .glass-input .el-input__inner:-webkit-autofill:active {
  -webkit-background-clip: text !important;
  -webkit-text-fill-color: #fff !important;
  caret-color: #fff !important;
  transition: background-color 9999s ease-in-out 0s !important;
}
.login-page .glass-input .el-input__wrapper:has(.el-input__inner:-webkit-autofill) { background: rgba(0,0,0,0.2) !important; }
.login-page .login-btn {
  width: 100% !important; height: 48px !important;
  border-radius: 12px !important; border: none !important;
  font-size: 15px !important; font-weight: 700 !important;
  letter-spacing: 2px !important;
  background: rgba(255, 255, 255, 0.9) !important;
  color: #0f172a !important;
}
.login-page .login-btn:hover { background: #fff !important; transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0,0,0,0.3); }
</style>
