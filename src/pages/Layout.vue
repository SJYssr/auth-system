<template>
  <div class="frontend-layout">
    <!-- 统一头部 -->
    <header class="header">
      <div class="header-container">
        <div class="logo">
          <img 
            :src="logoSrc" 
            @error="handleLogoError"
            alt="Logo" 
            width="32" 
            height="32" 
          />
          <span>{{ siteName }}</span>
        </div>
        <div class="header-actions">
        </div>
      </div>
    </header>

    <!-- 主要内容区域 -->
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="slide-scale" mode="out-in">
          <div :key="$route.path" class="page-wrapper">
            <component :is="Component" />
          </div>
        </transition>
      </router-view>
    </main>

    <!-- 统一底部 -->
    <footer class="footer">
      <div class="footer-container">
        <div class="footer-content">
          <div class="footer-brand">
            <div class="footer-logo">
              <img 
                :src="logoSrc" 
                @error="handleLogoError"
                alt="Logo" 
                width="20" 
                height="20" 
              />
              <span class="footer-brand-name">{{ siteName }}</span>
            </div>
            <p class="footer-description" v-if="initializeInfo.website?.description">{{ initializeInfo.website.description }}</p>
            <p class="footer-copyright" v-if="initializeInfo.website?.copyright">© {{ copyrightYear }} {{ initializeInfo.website.copyright }}</p>
            <p class="footer-copyright" v-if="initializeInfo.website?.icp_number">{{ initializeInfo.website.icp_number }}</p>
          </div>
          
          <div class="footer-contact" v-if="initializeInfo.website?.email || initializeInfo.website?.phone">
            <a v-if="initializeInfo.website?.email" :href="`mailto:${initializeInfo.website.email}`" class="contact-link">
              {{ initializeInfo.website.email }}
            </a>
            <a v-if="initializeInfo.website?.phone" :href="`tel:${initializeInfo.website.phone}`" class="contact-link">
              {{ initializeInfo.website.phone }}
            </a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useAppStore } from '@/stores/modules/app'

const appStore = useAppStore()

const initializeInfo = computed(() => appStore.initializeInfo || {})
const siteName = computed(() => initializeInfo.value.website?.site_name || '授权管理系统')
const copyrightYear = computed(() => {
  const since = initializeInfo.value.website?.copyright_since
  const now = new Date().getFullYear()
  return since ? `${since}-${now}` : `${now}`
})
const logoSrc = ref('/logo.png')

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
  logoSrc.value = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iOCIgZmlsbD0iIzM5OGVmNCIvPgo8cGF0aCBkPSJNMTYgOGMtNC40IDAtOCAzLjYtOCA4czMuNiA4IDggOCA4LTMuNiA4LTgtMy42LTgtOC04em0wIDEyYy0yLjIgMC00LTEuOC00LTRzMS44LTQgNC00IDQgMS44IDQgNC0xLjggNC00IDR6IiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K'
}

onMounted(() => {
  if (Object.keys(initializeInfo.value).length === 0) {
    appStore.initialize().catch(() => {})
  }
})
</script>

<style scoped>
.frontend-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #ffffff;
}

/* Header Styles */
.header {
  background: #ffffff;
  border-bottom: 1px solid rgb(219, 223, 233);
  position: sticky;
  top: 0;
  z-index: 1000;
  transition: all 0.2s ease;

}

.header-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: #111827;
  font-weight: 700;
  font-size: 18px;
  transition: all 0.2s ease;
}

.logo:hover {
  color: #3b82f6;
}

.logo img {
  border-radius: 6px;
  transition: transform 0.2s ease;
}

.logo:hover img {
  transform: scale(1.05);
}

.nav {
  display: flex;
  align-items: center;
  gap: 32px;
}

.nav-link {
  color: #6b7280;
  text-decoration: none;
  font-weight: 500;
  font-size: 15px;
  padding: 8px 16px;
  border-radius: 6px;
  transition: all 0.15s ease;
  position: relative;
}

.nav-link:hover {
  color: #3b82f6;
  background: #f8fafc;
}

.nav-link.router-link-active {
  color: #3b82f6;
  background: #f1f5f9;
  border: 1px solid rgb(219, 223, 233);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.auth-buttons {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ghost-button {
  padding: 8px 20px;
  border: 1px solid rgb(219, 223, 233);
  border-radius: 6px;
  color: #374151;
  text-decoration: none;
  font-weight: 500;
  font-size: 14px;
  transition: all 0.15s ease;
  background: #ffffff;
}

.ghost-button:hover {
  border-color: #cbd5e1;
  color: #1e293b;
  background: #f8fafc;
}

.primary-button {
  padding: 8px 20px;
  background: #3b82f6;
  color: white;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 500;
  font-size: 14px;
  transition: all 0.15s ease;
  border: 1px solid #3b82f6;
}

.primary-button:hover {
  background: #2563eb;
  border-color: #2563eb;
}

/* User Dropdown Styles */
.user-dropdown {
  position: relative;
  outline: none;
}

.user-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #ffffff;
  border: 1px solid rgb(219, 223, 233);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  min-width: 140px;
}

.user-trigger:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 12px;
  flex-shrink: 0;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  flex: 1;
  text-align: left;
}

.dropdown-icon {
  color: #6b7280;
  transition: transform 0.15s ease;
  flex-shrink: 0;
}

.dropdown-icon.rotated {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: #ffffff;
  border: 1px solid rgb(219, 223, 233);
  border-radius: 8px;

  min-width: 220px;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-8px);
  transition: all 0.15s ease;
  z-index: 1000;
}

.dropdown-menu.show {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.dropdown-header {
  padding: 16px;
  border-bottom: 1px solid rgb(219, 223, 233);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar-large {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
  flex-shrink: 0;
}

.user-details {
  flex: 1;
}

.user-name-large {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 2px;
}

.user-role {
  font-size: 13px;
  color: #6b7280;
}

.dropdown-divider {
  height: 1px;
  background: #ede3e3;
}

.dropdown-items {
  padding: 8px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 6px;
  color: #374151;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.15s ease;
  cursor: pointer;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
}

.dropdown-item:hover {
  background: #f8fafc;
  color: #111827;
}

.dropdown-item svg {
  color: #6b7280;
  flex-shrink: 0;
}

.logout-item:hover {
  background: #fef2f2;
  color: #dc2626;
}

.logout-item:hover svg {
  color: #dc2626;
}

/* Main Content */
.main-content {
  flex: 1;
  min-height: calc(100vh - 64px - 120px); /* 减去头部和底部高度 */
  position: relative;
}

/* 页面包装器 */
.page-wrapper {
  width: 100%;
  height: 100%;
}

/* 页面切换动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.page-fade-enter-to,
.page-fade-leave-from {
  opacity: 1;
  transform: translateY(0);
}

/* Footer Styles */
.footer {
  background: #ffffff;
  border-top: 1px solid rgb(219, 223, 233);
  margin-top: auto;
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px 20px;
}

.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 24px;
}

.footer-logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.footer-brand-name {
  font-size: 16px;
  font-weight: 600;
  color: #1a202c;
}

.footer-description {
  color: #64748b;
  font-size: 14px;
  margin: 0;
}

.footer-copyright {
  color: #94a3b8;
  font-size: 13px;
  margin: 4px 0 0 0;
}

.footer-links {
  display: flex;
  align-items: center;
  gap: 32px;
}

.footer-link {
  color: #64748b;
  text-decoration: none;
  font-size: 14px;
  transition: color 0.2s ease;
}

.footer-link:hover {
  color: #3b82f6;
}

.footer-contact {
  display: flex;
  align-items: center;
  gap: 16px;
}

.contact-link {
  color: #64748b;
  text-decoration: none;
  font-size: 14px;
  transition: color 0.2s ease;
}

.contact-link:hover {
  color: #3b82f6;
}

.footer-bottom {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding-top: 20px;
  border-top: 1px solid rgb(219, 223, 233);
}

.copyright {
  margin: 0;
  color: #94a3b8;
  font-size: 13px;
}

.icp {
  margin: 0;
  color: #94a3b8;
  font-size: 13px;
}

/* 页面切换动画 */
.slide-scale-enter-active,
.slide-scale-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-scale-enter-from {
  opacity: 0;
  transform: translateX(20px) scale(0.95);
}

.slide-scale-leave-to {
  opacity: 0;
  transform: translateX(-20px) scale(0.95);
}

.slide-scale-enter-to,
.slide-scale-leave-from {
  opacity: 1;
  transform: translateX(0) scale(1);
}

.page-wrapper {
  width: 100%;
  min-height: 100%;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .header-container {
    padding: 0 16px;
  }
  
  .nav {
    gap: 20px;
  }
  
  .user-trigger {
    min-width: 120px;
  }
  
  .dropdown-menu {
    min-width: 200px;
  }
}

@media (max-width: 768px) {
  .nav {
    display: none;
  }
  
  .header-container {
    justify-content: space-between;
  }
  
  .user-trigger {
    min-width: 100px;
    padding: 6px 10px;
  }
  
  .user-name {
    display: none;
  }
  
  .dropdown-menu {
    right: -8px;
    min-width: 180px;
  }
  
  .footer-container {
    padding: 24px 16px 16px;
  }
  
  .footer-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 20px;
    margin-bottom: 16px;
  }
  
  .footer-brand {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .footer-links {
    gap: 20px;
  }
  
  .footer-contact {
    gap: 12px;
  }
}

@media (max-width: 480px) {
  .header-container {
    padding: 0 12px;
    height: 56px;
  }
  
  .logo {
    font-size: 16px;
    gap: 8px;
  }
  
  .logo img {
    width: 28px;
    height: 28px;
  }
  
  .auth-buttons {
    gap: 8px;
  }
  
  .ghost-button,
  .primary-button {
    padding: 6px 12px;
    font-size: 13px;
  }
  
  .user-trigger {
    min-width: auto;
    padding: 6px 8px;
  }
  
  .dropdown-menu {
    right: -12px;
    min-width: 160px;
  }
  
  .dropdown-header {
    padding: 12px;
  }
  
  .user-avatar-large {
    width: 36px;
    height: 36px;
    font-size: 14px;
  }
  
  .footer-container {
    padding: 20px 12px 12px;
  }
  
  .footer-content {
    gap: 16px;
    margin-bottom: 12px;
  }
  
  .footer-links {
    flex-wrap: wrap;
    gap: 16px;
  }
  
  .footer-link {
    font-size: 13px;
  }
  
  .footer-description {
    font-size: 13px;
  }
  
  .footer-bottom {
    padding-top: 12px;
    gap: 8px;
  }
  
  .copyright,
  .icp {
    font-size: 12px;
  }
  
  .contact-link {
    font-size: 13px;
  }
}
</style>