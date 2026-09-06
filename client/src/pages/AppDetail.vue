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
        <!-- 应用头部信息 -->
        <section class="app-header-section">
          <div class="app-showcase">
            <div class="app-icon-large">
              <span class="icon-text">{{ currentApp.app_name?.charAt(0)?.toUpperCase() }}</span>
            </div>
            <div class="app-main-info">
              <h1 class="app-title">{{ currentApp.app_name }}</h1>
              <p class="app-tagline">{{ currentApp.description || '专业的应用解决方案' }}</p>

              <div class="app-stats">

                <div class="stat-item">
                  <span class="stat-label">版本</span>
                  <span class="stat-value">{{ currentApp.version || '1.0.0' }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">开发者</span>
                  <span class="stat-value">{{ currentApp.developer || '官方团队' }}</span>
                </div>
              </div>

              <div class="price-section">
                <div class="price-display">
                  <span v-if="isAppFree(currentApp)" class="price-free">免费使用</span>
                  <span v-else class="price-paid">付费应用</span>
                </div>
                <div class="price-note" v-if="!isAppFree(currentApp)">
                  一次购买，永久使用
                </div>
              </div>
            </div>

            <div class="app-actions-panel">
              <a
                v-if="downloadUrl && (isAppFree(currentApp) || !purchaseUrl)"
                class="action-primary"
                :href="downloadUrl"
                target="_blank"
                rel="noopener noreferrer"
              >免费使用 / 下载</a>
              <a
                v-if="purchaseUrl && !isAppFree(currentApp)"
                class="action-primary"
                :href="purchaseUrl"
                target="_blank"
                rel="noopener noreferrer"
              >立即购买</a>
              <a
                v-if="usageUrl"
                class="action-secondary"
                :href="usageUrl"
                target="_blank"
                rel="noopener noreferrer"
              >查看使用说明</a>
              <div v-if="!hasActions" class="no-action">
                暂无在线购买/下载入口，请联系开发者获取授权卡密
              </div>
            </div>
          </div>
        </section>

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
            <!-- 产品介绍 -->
            <div v-if="activeTab === 'intro'" class="content-panel">
              <div v-if="introDoc" class="doc-content">
                <header class="doc-header">
                  <h2 class="doc-title">{{ introDoc.title }}</h2>
                  <div class="doc-meta">
                    <span class="meta-tag">最后更新：{{ formatDate(introDoc.created_at) }}</span>
                  </div>
                </header>
                <div class="doc-body" v-html="introDoc.content"></div>
              </div>
              <div v-else class="empty-content">
                <div class="empty-illustration">📄</div>
                <h3 class="empty-title">暂无产品介绍</h3>
                <p class="empty-description">开发者还未提供详细的产品介绍文档</p>
              </div>
            </div>

            <!-- 部署指南 -->
            <div v-if="activeTab === 'deploy'" class="content-panel">
              <div v-if="deployDoc" class="doc-content">
                <header class="doc-header">
                  <h2 class="doc-title">{{ deployDoc.title }}</h2>
                  <div class="doc-meta">
                    <span class="meta-tag">最后更新：{{ formatDate(deployDoc.created_at) }}</span>
                  </div>
                </header>
                <div class="doc-body" v-html="deployDoc.content"></div>
              </div>
              <div v-else class="empty-content">
                <div class="empty-illustration">🚀</div>
                <h3 class="empty-title">暂无部署指南</h3>
                <p class="empty-description">开发者还未提供详细的部署文档</p>
              </div>
            </div>

            <!-- 功能特性 -->
            <div v-if="activeTab === 'features'" class="content-panel">
              <div class="features-grid">
                <div class="feature-card">
                  <div class="feature-icon">🎯</div>
                  <h4 class="feature-title">高效稳定</h4>
                  <p class="feature-desc">经过严格测试，确保应用运行稳定可靠</p>
                </div>
                <div class="feature-card">
                  <div class="feature-icon">🔧</div>
                  <h4 class="feature-title">易于配置</h4>
                  <p class="feature-desc">简单的配置流程，快速上手使用</p>
                </div>
                <div class="feature-card">
                  <div class="feature-icon">📱</div>
                  <h4 class="feature-title">响应式设计</h4>
                  <p class="feature-desc">完美适配各种设备和屏幕尺寸</p>
                </div>
                <div class="feature-card">
                  <div class="feature-icon">🛡️</div>
                  <h4 class="feature-title">安全可靠</h4>
                  <p class="feature-desc">采用最新安全标准，保护数据安全</p>
                </div>
              </div>
            </div>
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
import DOMPurify from 'dompurify'

const businessStore = useBusinessStore()
const router = useRouter()
const route = useRoute()

const activeTab = ref('intro')

const currentApp = ref(null)
const loading = ref(false)

const sanitize = (html) => {
  if (!html) return ''
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','br','strong','em','u','s','a','ul','ol','li',
      'table','thead','tbody','tr','th','td','blockquote','pre','code','img','span','div','hr'],
    ALLOWED_ATTR: ['href','src','alt','title','class','target','rel','width','height']
  })
}

const introDoc = computed(() => {
  const list = currentApp.value?.docs || []
  if (!Array.isArray(list)) return null
  const doc = list.find(d => d.doc_type === 'intro')
  if (doc) doc.content = sanitize(doc.content)
  return doc || null
})

const deployDoc = computed(() => {
  const list = currentApp.value?.docs || []
  if (!Array.isArray(list)) return null
  const doc = list.find(d => d.doc_type === 'deploy')
  if (doc) doc.content = sanitize(doc.content)
  return doc || null
})

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

// apps表没有price字段，用is_free判断
const isAppFree = (app) => {
  if (!app) return false
  return app.is_free == 1 || app.is_free === true
}

// 可用的操作入口
const downloadUrl = computed(() => currentApp.value?.download_url || '')
const purchaseUrl = computed(() => currentApp.value?.purchase_url || '')
const usageUrl = computed(() => currentApp.value?.usage_guide || '')
const hasActions = computed(() => !!downloadUrl.value || !!purchaseUrl.value || !!usageUrl.value)

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
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

/* 应用头部区域 - 大胆布局 */
.app-header-section {
  margin-bottom: 64px;
}

.app-showcase {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 64px;
  align-items: start;
  padding: 64px;
  background: #ffffff;
  border: 4px solid #000000;
}

.app-icon-large {
  width: 160px;
  height: 160px;
  background: #ffffff;
  border: 4px solid #000000;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-text {
  font-size: 64px;
  font-weight: 800;
  color: #000000;
}

.app-main-info {
  min-width: 0;
}

.app-title {
  font-size: 48px;
  font-weight: 800;
  color: #000000;
  margin: 0 0 16px 0;
  line-height: 1.1;
  letter-spacing: -2px;
}

.app-tagline {
  font-size: 20px;
  color: #000000;
  margin: 0 0 40px 0;
  line-height: 1.4;
  font-weight: 500;
}

.app-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 32px;
  margin-bottom: 40px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: center;
  padding: 20px;
  border: 3px solid #000000;
  background: #ffffff;
}

.stat-label {
  font-size: 14px;
  color: #000000;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stat-value {
  font-size: 20px;
  color: #000000;
  font-weight: 800;
}

.price-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: center;
}

.price-display {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 16px;
}

.price-free {
  font-size: 32px;
  font-weight: 800;
  color: #000000;
}

.price-paid {
  font-size: 36px;
  font-weight: 800;
  color: #000000;
}

.price-note {
  font-size: 16px;
  color: #000000;
  font-weight: 600;
}

/* 操作按钮面板 - 极简设计 */
.app-actions-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: stretch;
  min-width: 280px;
}

.action-primary,
.action-secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  text-decoration: none;
  box-sizing: border-box;
}

.no-action {
  padding: 20px 32px;
  border: 3px dashed #cbd5e1;
  color: #6b7280;
  font-size: 14px;
  text-align: center;
  font-weight: 600;
}

.action-primary {
  padding: 20px 32px;
  background: #000000;
  border: 3px solid #000000;
  color: #ffffff;
  font-size: 18px;
  font-weight: 800;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: all 0.15s ease;
}

.action-primary:hover:not(:disabled) {
  background: #ffffff;
  color: #000000;
}

.action-primary:disabled {
  background: #cccccc;
  border-color: #cccccc;
  color: #666666;
  cursor: not-allowed;
}

.action-owned {
  padding: 20px 32px;
  background: #ffffff;
  border: 3px solid #000000;
  color: #000000;
  font-size: 18px;
  font-weight: 800;
  cursor: not-allowed;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.check-icon {
  font-size: 24px;
  font-weight: 800;
}

.action-secondary {
  padding: 16px 32px;
  background: #ffffff;
  border: 3px solid #000000;
  color: #000000;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: all 0.15s ease;
}

.action-secondary:hover {
  background: #000000;
  color: #ffffff;
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

.content-panel {
  padding: 64px;
}

/* 文档内容样式 - 现代排版 */
.doc-content {
  max-width: none;
}

.doc-header {
  margin-bottom: 48px;
  padding-bottom: 32px;
  border-bottom: 3px solid #000000;
}

.doc-title {
  font-size: 36px;
  font-weight: 800;
  color: #000000;
  margin: 0 0 16px 0;
  letter-spacing: -1px;
}

.doc-meta {
  display: flex;
  gap: 20px;
}

.meta-tag {
  padding: 12px 20px;
  background: #ffffff;
  border: 3px solid #000000;
  font-size: 14px;
  color: #000000;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.doc-body {
  line-height: 1.8;
  color: #000000;
  font-size: 18px;
  font-weight: 400;
}

.doc-body h1,
.doc-body h2,
.doc-body h3,
.doc-body h4,
.doc-body h5,
.doc-body h6 {
  color: #000000;
  font-weight: 800;
  margin: 40px 0 20px 0;
  line-height: 1.2;
  letter-spacing: -0.5px;
}

.doc-body h1 {
  font-size: 40px;
}

.doc-body h2 {
  font-size: 32px;
}

.doc-body h3 {
  font-size: 28px;
}

.doc-body h4 {
  font-size: 24px;
}

.doc-body p {
  margin: 20px 0;
}

.doc-body ul,
.doc-body ol {
  margin: 20px 0;
  padding-left: 32px;
}

.doc-body li {
  margin: 12px 0;
}

.doc-body a {
  color: #000000;
  text-decoration: underline;
  text-decoration-thickness: 2px;
  font-weight: 600;
}

.doc-body a:hover {
  text-decoration-thickness: 3px;
}

.doc-body code {
  background: #f8f8f8;
  border: 2px solid #000000;
  padding: 4px 8px;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
  font-size: 16px;
  color: #000000;
  font-weight: 600;
}

.doc-body pre {
  background: #f8f8f8;
  border: 3px solid #000000;
  padding: 32px;
  margin: 32px 0;
  overflow-x: auto;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
  font-size: 16px;
  line-height: 1.6;
  color: #000000;
  font-weight: 500;
}

.doc-body blockquote {
  background: #ffffff;
  border-left: 8px solid #000000;
  padding: 32px 40px;
  margin: 32px 0;
  font-style: normal;
  color: #000000;
  font-weight: 500;
  font-size: 20px;
  line-height: 1.6;
}

/* 空内容状态 - 极简设计 */
.empty-content {
  text-align: center;
  padding: 120px 40px;
  color: #000000;
}

.empty-illustration {
  font-size: 80px;
  margin-bottom: 32px;
  font-weight: 800;
}

.empty-title {
  font-size: 24px;
  font-weight: 800;
  color: #000000;
  margin: 0 0 16px 0;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.empty-description {
  font-size: 18px;
  color: #000000;
  margin: 0;
  line-height: 1.6;
  font-weight: 500;
}

/* 功能特性网格 - 卡片式布局 */
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 32px;
}

.feature-card {
  padding: 48px;
  background: #ffffff;
  border: 4px solid #000000;
  text-align: center;
  transition: all 0.15s ease;
}

.feature-card:hover {
  background: #f8f8f8;
}

.feature-icon {
  font-size: 48px;
  margin-bottom: 24px;
  color: #000000;
  font-weight: 800;
}

.feature-title {
  font-size: 24px;
  font-weight: 800;
  color: #000000;
  margin: 0 0 16px 0;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.feature-desc {
  font-size: 16px;
  color: #000000;
  margin: 0;
  line-height: 1.6;
  font-weight: 500;
}

/* 购买确认对话框 - 现代设计 */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.purchase-modal {
  background: #ffffff;
  border: 6px solid #000000;
  width: 100%;
  max-width: 600px;
  margin: 20px;
}

.modal-header {
  padding: 32px 48px;
  border-bottom: 4px solid #000000;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title {
  font-size: 28px;
  font-weight: 800;
  color: #000000;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.modal-close {
  width: 48px;
  height: 48px;
  background: #ffffff;
  border: none;
  color: #000000;
  cursor: pointer;
  font-size: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
}

.modal-close:hover {
  background: #f0f0f0;
}

.modal-content {
  padding: 48px;
}

.purchase-summary {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.app-summary {
  display: flex;
  align-items: center;
  gap: 16px;
}

.summary-icon {
  width: 56px;
  height: 56px;
  background: #ffffff;
  border: 3px solid #000000;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 800;
  color: #000000;
}

.summary-info {
  flex: 1;
}

.summary-name {
  font-size: 20px;
  font-weight: 800;
  color: #000000;
  margin: 0 0 8px 0;
}

.summary-category {
  font-size: 16px;
  color: #000000;
  margin: 0;
  font-weight: 600;
}

.price-summary {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.price-row,
.price-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.price-total {
  padding-top: 20px;
  border-top: 3px solid #000000;
  font-weight: 800;
  margin-top: 8px;
}

.price-label,
.total-label {
  font-size: 16px;
  color: #000000;
  font-weight: 600;
}

.price-amount,
.total-amount {
  font-size: 18px;
  font-weight: 700;
}

.free-price {
  color: #000000;
}

.paid-price {
  color: #000000;
}

.modal-footer {
  padding: 32px 48px;
  border-top: 4px solid #000000;
  display: flex;
  gap: 24px;
  justify-content: flex-end;
}

.btn-cancel {
  padding: 16px 32px;
  background: #ffffff;
  border: 3px solid #000000;
  color: #000000;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: all 0.15s ease;
}

.btn-cancel:hover {
  background: #f0f0f0;
}

.btn-confirm {
  padding: 16px 32px;
  background: #000000;
  border: 3px solid #000000;
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: all 0.15s ease;
}

.btn-confirm:hover:not(:disabled) {
  background: #333333;
}

.btn-confirm:disabled {
  background: #cccccc;
  border-color: #cccccc;
  color: #666666;
  cursor: not-allowed;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .main-container {
    padding: 24px 20px;
  }

  .app-showcase {
    grid-template-columns: 1fr;
    gap: 24px;
    padding: 32px;
    text-align: center;
  }

  .app-actions-panel {
    align-self: center;
    min-width: 240px;
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

  .features-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .nav-container {
    padding: 0 16px;
  }

  .main-container {
    padding: 16px;
  }

  .app-showcase {
    padding: 24px;
  }

  .content-panel {
    padding: 24px;
  }

  .app-title {
    font-size: 28px;
  }

  .app-tagline {
    font-size: 16px;
  }

  .app-stats {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .purchase-modal {
    margin: 16px;
  }

  .modal-header,
  .modal-content,
  .modal-footer {
    padding: 20px;
  }
}

.app-price {
  font-size: 24px;
  font-weight: 700;
  color: #d63384;
  margin-bottom: 20px;
}

.price-free {
  color: #28a745 !important;
}

.app-actions {
  display: flex;
  gap: 16px;
  align-items: center;
}

.purchase-btn {
  padding: 14px 28px;
  background: #ffffff;
  color: #007bff;
  border: 2px solid #007bff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  min-width: 140px;
}

.purchase-btn:hover:not(:disabled) {
  background: #007bff;
  color: #ffffff;
}

.purchase-btn:disabled {
  background: #f5f5f5;
  color: #999999;
  border-color: #cccccc;
  cursor: not-allowed;
}

.owned-btn {
  padding: 14px 28px;
  background: #ffffff;
  color: #28a745;
  border: 2px solid #28a745;
  font-size: 16px;
  font-weight: 600;
  cursor: default;
}

/* 加载动画 */
.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e8e8e8;
  border-top: 4px solid #007bff;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

/* 错误状态 */
.error-state {
  text-align: center;
  padding: 80px 24px;
}

.error-message {
  color: #dc3545;
  font-size: 16px;
  margin-bottom: 24px;
  font-weight: 500;
}

.retry-btn {
  padding: 12px 24px;
  background: #ffffff;
  color: #007bff;
  border: 2px solid #007bff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.retry-btn:hover {
  background: #007bff;
  color: #ffffff;
}

/* 文档内容 */
.docs-content {
  background: #ffffff;
  border: 2px solid #e8e8e8;
  overflow: hidden;
}

.docs-nav {
  display: flex;
  background: #f5f5f5;
  border-bottom: 2px solid #e8e8e8;
}

.nav-btn {
  flex: 1;
  padding: 20px 32px;
  background: none;
  border: none;
  color: #666666;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 3px solid transparent;
}

.nav-btn:hover {
  color: #333333;
  background: #eeeeee;
}

.nav-btn.active {
  color: #007bff;
  background: #ffffff;
  border-bottom-color: #007bff;
}

.doc-content {
  padding: 40px;
}

.doc-section {
  min-height: 480px;
}

.doc-item {
  max-width: none;
}

.doc-title {
  font-size: 28px;
  font-weight: 700;
  color: #333333;
  margin: 0 0 32px 0;
  padding-bottom: 16px;
  border-bottom: 2px solid #e8e8e8;
}

.doc-body {
  line-height: 1.8;
  color: #555555;
  font-size: 16px;
}

/* 文档内容样式 */
.doc-body :deep(h1) {
  font-size: 28px;
  font-weight: 700;
  margin: 40px 0 20px 0;
  color: #333333;
  border-bottom: 3px solid #e8e8e8;
  padding-bottom: 12px;
}

.doc-body :deep(h2) {
  font-size: 24px;
  font-weight: 700;
  margin: 36px 0 18px 0;
  color: #333333;
  border-bottom: 2px solid #f0f0f0;
  padding-bottom: 8px;
}

.doc-body :deep(h3) {
  font-size: 20px;
  font-weight: 700;
  margin: 32px 0 16px 0;
  color: #333333;
}

.doc-body :deep(p) {
  margin: 20px 0;
  color: #555555;
}

.doc-body :deep(ul),
.doc-body :deep(ol) {
  margin: 20px 0;
  padding-left: 32px;
  color: #555555;
}

.doc-body :deep(li) {
  margin: 10px 0;
}

.doc-body :deep(a) {
  color: #007bff;
  text-decoration: underline;
  font-weight: 500;
}

.doc-body :deep(img) {
  max-width: 100%;
  height: auto;
  margin: 24px 0;
  border: 2px solid #e8e8e8;
}

.doc-body :deep(code) {
  background: #f5f5f5;
  padding: 4px 8px;
  border: 1px solid #e8e8e8;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  color: #d63384;
}

.doc-body :deep(pre) {
  background: #f5f5f5;
  padding: 20px;
  border: 2px solid #e8e8e8;
  overflow-x: auto;
  margin: 24px 0;
  font-size: 14px;
}

.doc-body :deep(pre code) {
  background: none;
  padding: 0;
  border: none;
  color: #333333;
}

.doc-body :deep(blockquote) {
  border-left: 4px solid #cccccc;
  padding: 20px 24px;
  margin: 24px 0;
  color: #777777;
  background: #f9f9f9;
  border: 1px solid #e8e8e8;
}

.doc-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 24px 0;
  border: 2px solid #e8e8e8;
}

.doc-body :deep(th),
.doc-body :deep(td) {
  border: 1px solid #e8e8e8;
  padding: 12px 16px;
  text-align: left;
}

.doc-body :deep(th) {
  background: #f5f5f5;
  font-weight: 700;
  color: #333333;
}

.doc-meta {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 2px solid #e8e8e8;
  color: #666666;
  font-size: 14px;
}

.meta-item {
  margin-right: 24px;
  font-weight: 500;
}

/* 空状态 */
.empty-doc {
  text-align: center;
  padding: 100px 24px;
  color: #999999;
}

.empty-icon {
  font-size: 56px;
  margin-bottom: 20px;
}

.empty-text {
  font-size: 18px;
  margin: 0;
  font-weight: 500;
}

/* 操作按钮 */
.action-buttons {
  margin-top: 48px;
  padding-top: 32px;
  border-top: 2px solid #e8e8e8;
  display: flex;
  gap: 20px;
  justify-content: center;
}

.cart-btn {
  padding: 14px 32px;
  background: #ffffff;
  color: #6c757d;
  border: 2px solid #6c757d;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.cart-btn:hover {
  background: #6c757d;
  color: #ffffff;
}

/* 模态框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #ffffff;
  width: 90%;
  max-width: 520px;
  max-height: 90vh;
  overflow: hidden;
  border: 2px solid #e8e8e8;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 32px;
  border-bottom: 2px solid #e8e8e8;
  background: #f5f5f5;
}

.modal-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #333333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  color: #666666;
  cursor: pointer;
  padding: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.close-btn:hover {
  background: #e8e8e8;
  color: #333333;
}

.modal-body {
  padding: 32px;
}

.modal-body p {
  margin: 0 0 20px 0;
  color: #555555;
  font-size: 16px;
  line-height: 1.6;
}

.app-price {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  background: #f5f5f5;
  border: 2px solid #e8e8e8;
}

.price-label {
  color: #666666;
  font-size: 16px;
  font-weight: 500;
}

.price-value {
  color: #d63384;
  font-size: 20px;
  font-weight: 700;
}

.modal-footer {
  display: flex;
  gap: 16px;
  padding: 24px 32px;
  border-top: 2px solid #e8e8e8;
  justify-content: flex-end;
  background: #f5f5f5;
}

.cancel-btn {
  padding: 12px 24px;
  background: #ffffff;
  color: #6c757d;
  border: 2px solid #6c757d;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.cancel-btn:hover {
  background: #6c757d;
  color: #ffffff;
}

.confirm-btn {
  padding: 12px 24px;
  background: #ffffff;
  color: #007bff;
  border: 2px solid #007bff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}

.confirm-btn:hover:not(:disabled) {
  background: #007bff;
  color: #ffffff;
}

.confirm-btn:disabled {
  background: #f5f5f5;
  color: #999999;
  border-color: #cccccc;
  cursor: not-allowed;
}

/* 响应式设计 - 移动端优化 */
@media (max-width: 768px) {
  .app-detail-container {
    padding: 20px;
  }

  .page-header {
    padding: 24px 0;
  }

  .header-title {
    font-size: 24px;
    font-weight: 800;
  }

  .app-main-info {
    flex-direction: column;
    gap: 32px;
  }

  .app-icon {
    width: 100px;
    height: 100px;
    border-width: 4px;
  }

  .app-title {
    font-size: 28px;
    font-weight: 800;
  }

  .app-tagline {
    font-size: 16px;
    font-weight: 500;
  }

  .app-stats {
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
  }

  .stat-value {
    font-size: 24px;
    font-weight: 800;
  }

  .stat-label {
    font-size: 14px;
    font-weight: 600;
  }

  .action-buttons {
    flex-direction: column;
    gap: 16px;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
    justify-content: center;
    padding: 20px 32px;
    font-size: 18px;
  }

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

  .content-panel {
    padding: 32px;
  }

  .features-grid {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .feature-card {
    padding: 32px;
  }

  .feature-title {
    font-size: 20px;
  }

  .feature-description {
    font-size: 14px;
  }

  .purchase-modal {
    margin: 20px;
    max-width: none;
    border-width: 4px;
  }

  .modal-header {
    padding: 24px 32px;
  }

  .modal-title {
    font-size: 24px;
  }

  .modal-content {
    padding: 32px;
  }

  .modal-footer {
    padding: 24px 32px;
    flex-direction: column;
    gap: 16px;
  }

  .btn-cancel,
  .btn-confirm {
    width: 100%;
    justify-content: center;
    padding: 16px 24px;
  }

  .doc-title {
    font-size: 28px;
  }

  .doc-body h1 {
    font-size: 32px;
  }

  .doc-body h2 {
    font-size: 28px;
  }

  .doc-body h3 {
    font-size: 24px;
  }

  .doc-body h4 {
    font-size: 20px;
  }
}
</style>