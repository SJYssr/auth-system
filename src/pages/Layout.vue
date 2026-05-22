<template>
  <div class="frontend-layout" :class="{ 'is-login': isLoginPage }" :style="bgStyle">
    <header class="header" :class="{ 'glass-bar': isLoginPage }">
      <div class="header-container">
        <div class="logo" :class="{ 'logo-light': isLoginPage }">
          <img :src="logoSrc" @error="handleLogoError" alt="Logo" width="32" height="32" />
          <span>{{ siteName }}</span>
        </div>
        <div class="header-actions"></div>
      </div>
    </header>

    <main class="main-content" :class="{ 'login-main': isLoginPage }">
      <router-view v-slot="{ Component }">
        <transition name="slide-scale" mode="out-in">
          <div :key="$route.path" class="page-wrapper">
            <component :is="Component" />
          </div>
        </transition>
      </router-view>
    </main>

    <footer class="footer" :class="{ 'glass-bar': isLoginPage }">
      <div class="footer-container">
        <div class="footer-content">
          <div class="footer-brand">
            <div class="footer-logo">
              <img :src="logoSrc" @error="handleLogoError" alt="Logo" width="20" height="20" />
              <span class="footer-brand-name" :class="{ 'text-light': isLoginPage }">{{ siteName }}</span>
            </div>
            <p class="footer-description" :class="{ 'text-light': isLoginPage }" v-if="initializeInfo.website?.description">{{ initializeInfo.website.description }}</p>
            <p class="footer-copyright" :class="{ 'text-light': isLoginPage }" v-if="initializeInfo.website?.copyright">© {{ copyrightYear }} {{ initializeInfo.website.copyright }}</p>
            <p class="footer-copyright" :class="{ 'text-light': isLoginPage }" v-if="initializeInfo.website?.icp_number">{{ initializeInfo.website.icp_number }}</p>
          </div>
          <div class="footer-contact" v-if="initializeInfo.website?.email || initializeInfo.website?.phone">
            <a v-if="initializeInfo.website?.email" :href="`mailto:${initializeInfo.website.email}`" class="contact-link" :class="{ 'text-light': isLoginPage }">{{ initializeInfo.website.email }}</a>
            <a v-if="initializeInfo.website?.phone" :href="`tel:${initializeInfo.website.phone}`" class="contact-link" :class="{ 'text-light': isLoginPage }">{{ initializeInfo.website.phone }}</a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/modules/app'

const route = useRoute()
const appStore = useAppStore()

const initializeInfo = computed(() => appStore.initializeInfo || {})
const siteName = computed(() => initializeInfo.value.website?.site_name || '授权管理系统')
const copyrightYear = computed(() => {
  const since = initializeInfo.value.website?.copyright_since
  const now = new Date().getFullYear()
  return since ? `${since}-${now}` : `${now}`
})
const logoSrc = ref('/logo.png')
const isLoginPage = computed(() => ['/admin', '/login', '/register'].includes(route.path))
const bgStyle = computed(() => {
  if (!isLoginPage.value) return {}
  const url = initializeInfo.value.website?.login_bg_url
  return url ? { backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}
})

watch(() => initializeInfo.value.website, (site) => {
  if (!site) return
  if (site.logo_url) logoSrc.value = site.logo_url
  if (site.site_name) document.title = site.site_name
  if (site.favicon_url) {
    let link = document.querySelector('link[rel="icon"]')
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
    link.href = site.favicon_url
  }
}, { immediate: true })

const handleLogoError = () => {
  logoSrc.value = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjMzk4ZWY0Ii8+PHBhdGggZD0iTTE2IDhjLTQuNCAwLTggMy42LTggOHMzLjYgOCA4IDggOC0zLjYgOC04LTMuNi04LTgtOHptMCAxMmMtMi4yIDAtNC0xLjgtNC00czEuOC00IDQtNCA0IDEuOCA0IDQtMS44IDQtNCA0eiIgZmlsbD0id2hpdGUiLz48L3N2Zz4K'
}

onMounted(() => {
  if (Object.keys(initializeInfo.value).length === 0) {
    appStore.initialize().catch(() => {})
  }
})
</script>

<style scoped>
.frontend-layout {
  min-height: 100vh; display: flex; flex-direction: column; background: #ffffff;
}
.frontend-layout.is-login {
  background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%);
  position: relative;
}
.frontend-layout.is-login::after {
  content: ''; position: fixed; width: 500px; height: 500px;
  border-radius: 50%; filter: blur(120px); opacity: 0.3;
  background: radial-gradient(circle, #6366f1, transparent);
  top: -150px; right: -100px; z-index: 0; pointer-events: none;
}

/* ===== 头部 ===== */
.header {
  background: #ffffff; border-bottom: 1px solid rgb(219, 223, 233);
  position: sticky; top: 0; z-index: 1000; transition: all 0.2s ease;
}
.glass-bar {
  background: rgba(255, 255, 255, 0.06) !important;
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border-color: rgba(255, 255, 255, 0.1) !important;
}
.header-container {
  max-width: 1200px; margin: 0 auto; padding: 0 24px;
  height: 64px; display: flex; align-items: center; justify-content: space-between;
}
.logo { display: flex; align-items: center; gap: 12px; color: #111827; font-weight: 700; font-size: 18px; }
.logo-light { color: #fff !important; }
.logo img { border-radius: 6px; }

/* ===== 主区域 ===== */
.main-content { flex: 1; }
.login-main { display: flex; align-items: center; justify-content: center; z-index: 1; }

/* ===== 底部 ===== */
.footer { background: #ffffff; border-top: 1px solid rgb(219, 223, 233); margin-top: auto; }
.glass-bar.footer {
  background: rgba(255, 255, 255, 0.06) !important;
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border-color: rgba(255, 255, 255, 0.1) !important;
  position: relative; z-index: 1;
}
.footer-container { max-width: 1200px; margin: 0 auto; padding: 32px 24px 20px; }
.footer-content { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.footer-brand { display: flex; align-items: center; gap: 24px; }
.footer-logo { display: flex; align-items: center; gap: 8px; }
.footer-brand-name { font-size: 16px; font-weight: 600; color: #1a202c; }
.footer-description { color: #64748b; font-size: 14px; margin: 0; }
.footer-copyright { color: #94a3b8; font-size: 13px; margin: 4px 0 0 0; }
.footer-contact { display: flex; align-items: center; gap: 16px; }
.contact-link { color: #64748b; text-decoration: none; font-size: 14px; }
.text-light { color: rgba(255, 255, 255, 0.8) !important; }

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .footer-content { flex-direction: column; align-items: flex-start; gap: 20px; }
  .footer-brand { flex-direction: column; align-items: flex-start; gap: 8px; }
}
</style>
