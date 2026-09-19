<template>
  <div class="login-page" :style="loginBgUrl ? { backgroundImage: `url(${loginBgUrl})` } : {}">
    <div class="login-card">
      <h2>管理员登录</h2>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="0" @keyup.enter="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" prefix-icon="User" size="large" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" prefix-icon="Lock" show-password size="large" />
        </el-form-item>
        <el-form-item prop="captcha_code">
          <div class="captcha-row">
            <el-input v-model="form.captcha_code" placeholder="验证码" size="large" style="flex:1" />
            <img :src="captchaImage" class="captcha-img" @click="fetchCaptcha" title="点击刷新验证码" />
          </div>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" :loading="loading" @click="handleLogin" style="width: 100%;">
            登 录
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/modules/app'
import request from '@/utils/request'

const router = useRouter()
const store = useAppStore()

// 站点设置里的登录页背景图（后台「网站设置→图片设置」可配置），未配置时用默认纯色
const loginBgUrl = computed(() => {
  const url = String(store.initializeInfo?.website?.login_bg_url || '').trim()
  return /^https?:\/\//i.test(url) || url.startsWith('/') ? url : ''
})

const loading = ref(false)
const formRef = ref(null)
const captchaImage = ref('')
const captchaKey = ref('')
const form = reactive({ username: '', password: '', captcha_code: '' })
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  captcha_code: [{ required: true, message: '请输入验证码', trigger: 'blur' }]
}

const fetchCaptcha = async () => {
  try {
    const res = await request.get('/public/captcha')
    captchaImage.value = res.data.image
    captchaKey.value = res.data.key
  } catch { /* 验证码加载失败，点击刷新重试 */ }
}

const handleLogin = async () => {
  if (!formRef.value) return
  await formRef.value.validate()
  try {
    loading.value = true
    const response = await store.login({
      username: form.username,
      password: form.password,
      captcha_key: captchaKey.value,
      captcha_code: form.captcha_code
    })
    localStorage.setItem('token', response.data.token)
    await store.initialize()
    ElMessage.success('登录成功')
    router.push('/admin/dashboard')
  } catch (error) {
    fetchCaptcha()
    form.captcha_code = ''
    ElMessage.error(error.message || '登录失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => { fetchCaptcha() })
</script>

<style scoped>
.login-page {
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  background-size: cover;
  background-position: center;
}
.login-card {
  width: 400px;
  padding: 40px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}
.login-card h2 {
  text-align: center;
  margin: 0 0 32px;
  font-size: 22px;
  color: #1f2937;
}
.captcha-row {
  display: flex;
  gap: 10px;
  align-items: center;
}
.captcha-img {
  height: 40px;
  width: 100px;
  border-radius: 6px;
  border: 1px solid #dcdfe6;
  cursor: pointer;
  flex-shrink: 0;
}
</style>
