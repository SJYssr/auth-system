<template>
  <div class="app-detail-page">
    <!-- 顶部导航栏 -->
    <header class="top-nav">
      <div class="nav-container">
        <button @click="goBack" class="nav-back">
          <span class="back-arrow">←</span>
          <span class="back-text">返回应用中心</span>
        </button>
        <div class="nav-breadcrumb" v-if="currentApp">
          <span class="breadcrumb-item">应用中心</span>
          <span class="breadcrumb-separator">/</span>
          <span class="breadcrumb-current">{{ currentApp.app_name }}</span>
        </div>
      </div>
    </header>

    <!-- 主体内容区 -->
    <main class="main-container">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-wrapper">
        <div class="loading-content">
          <div class="spinner"></div>
          <p class="loading-text">正在加载应用信息...</p>
        </div>
      </div>

      <!-- 应用详情内容 -->
      <div v-else-if="currentApp" class="app-content">
        <AppHeaderCard :app="currentApp" />

        <!-- 内容导航 -->
        <section class="content-nav-section">
          <nav class="content-tabs">
            <button @click="activeTab = 'intro'" :class="['tab-button', { 'tab-active': activeTab === 'intro' }]">
              <span class="tab-icon">📖</span>
              <span class="tab-label">产品介绍</span>
            </button>
            <button @click="activeTab = 'deploy'" :class="['tab-button', { 'tab-active': activeTab === 'deploy' }]">
              <span class="tab-icon">🚀</span>
              <span class="tab-label">部署指南</span>
            </button>
            <button @click="activeTab = 'features'" :class="['tab-button', { 'tab-active': activeTab === 'features' }]">
              <span class="tab-icon">⭐</span>
              <span class="tab-label">功能特性</span>
            </button>
          </nav>
        </section>

        <!-- 内容展示区 -->
        <section class="content-display-section">
          <div class="content-wrapper">
            <AppDocPanel
              v-if="activeTab === 'intro'"
              :doc="introDoc"
              icon="📄"
              empty-title="暂无产品介绍"
              empty-description="开发者还未提供详细的产品介绍文档"
            />
            <AppDocPanel
              v-else-if="activeTab === 'deploy'"
              :doc="deployDoc"
              icon="🚀"
              empty-title="暂无部署指南"
              empty-description="开发者还未提供详细的部署文档"
            />
            <AppFeatureGrid v-else-if="activeTab === 'features'" />
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useBusinessStore } from '@/stores/modules/business'
import AppHeaderCard from './app-detail/AppHeaderCard.vue'
import AppDocPanel from './app-detail/AppDocPanel.vue'
import AppFeatureGrid from './app-detail/AppFeatureGrid.vue'

const businessStore = useBusinessStore()
const router = useRouter()
const route = useRoute()

const activeTab = ref('intro')

const currentApp = ref(null)
const loading = ref(false)

const findDoc = (type) => {
  const list = currentApp.value?.docs || []
  if (!Array.isArray(list)) return null
  return list.find(d => d.doc_type === type) || null
}

const introDoc = computed(() => findDoc('intro'))
const deployDoc = computed(() => findDoc('deploy'))

// 加载应用详情
const loadAppDetail = async () => {
  const appId = route.params.id
  if (!appId) {
    ElMessage.error('应用ID不存在')
    goBack()
    return
  }

  try {
    loading.value = true
    const response = await businessStore.getPublicAppDetail(appId)

    currentApp.value = response.data

  } catch (error) {
    console.error('加载应用详情失败:', error)
    ElMessage.error('加载应用详情失败')
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  // 从产品中心进入时 history 可回退；深链直接打开时回退无历史，落到产品中心
  if (window.history.state?.back) {
    router.back()
  } else {
    router.push('/products')
  }
}

onMounted(async () => {
  await loadAppDetail()
})
</script>

<style scoped>
/* 全局样式重置 - 极简白色系 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app-detail-page {
  min-height: 100vh;
  background: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  color: #000000;
  line-height: 1.5;
}

/* 顶部导航栏 - 极简黑白设计 */
.top-nav {
  background: #ffffff;
  border-bottom: 3px solid #000000;
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 40px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-back {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 32px;
  background: #ffffff;
  border: 3px solid #000000;
  color: #000000;
  cursor: pointer;
  font-size: 16px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: all 0.15s ease;
}

.nav-back:hover {
  background: #000000;
  color: #ffffff;
}

.back-arrow {
  font-size: 16px;
  font-weight: 600;
}

.nav-breadcrumb {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
  color: #000000;
}

.breadcrumb-item {
  color: #666666;
  font-weight: 600;
}

.breadcrumb-separator {
  color: #000000;
  font-weight: 800;
  font-size: 18px;
}

.breadcrumb-current {
  color: #000000;
  font-weight: 800;
}

/* 主体容器 */
.main-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 48px 40px;
}

/* 加载状态 */
.loading-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.loading-content {
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f4f6;
  border-top: 3px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.loading-text {
  color: #6b7280;
  font-size: 16px;
  margin: 0;
}

/* 内容导航区域 - 标签式设计 */
.content-nav-section {
  margin-bottom: 48px;
}

.content-tabs {
  display: flex;
  gap: 0;
  background: #ffffff;
  border: 4px solid #000000;
}

.tab-button {
  flex: 1;
  padding: 24px 32px;
  background: #ffffff;
  border: none;
  border-right: 3px solid #000000;
  color: #000000;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.tab-button:last-child {
  border-right: none;
}

.tab-button:hover:not(.tab-active) {
  background: #f0f0f0;
}

.tab-button.tab-active {
  background: #000000;
  color: #ffffff;
}

.tab-icon {
  font-size: 24px;
  font-weight: 800;
}

.tab-label {
  font-weight: 800;
}

/* 内容展示区域 - 清晰布局 */
.content-display-section {
  background: #ffffff;
  border: 4px solid #000000;
}

.content-wrapper {
  min-height: 500px;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .main-container {
    padding: 24px 20px;
  }

  .content-tabs {
    flex-direction: column;
  }

  .tab-button {
    border-right: none;
    border-bottom: 1px solid #e5e7eb;
  }

  .tab-button:last-child {
    border-bottom: none;
  }
}

@media (max-width: 768px) {
  .content-tabs {
    flex-direction: column;
  }

  .tab-button {
    border-right: none;
    border-bottom: 3px solid #000000;
    padding: 20px 24px;
    font-size: 16px;
  }

  .tab-button:last-child {
    border-bottom: none;
  }
}

@media (max-width: 640px) {
  .nav-container {
    padding: 0 16px;
  }

  .main-container {
    padding: 16px;
  }
}
</style>
