<template>
  <section class="app-header-section">
    <div class="app-showcase">
      <div class="app-icon-large">
        <span class="icon-text">{{ app.app_name?.charAt(0)?.toUpperCase() }}</span>
      </div>
      <div class="app-main-info">
        <h1 class="app-title">{{ app.app_name }}</h1>
        <p class="app-tagline">{{ app.description || '专业的应用解决方案' }}</p>

        <div class="app-stats">

          <div class="stat-item">
            <span class="stat-label">版本</span>
            <span class="stat-value">{{ app.version || '1.0.0' }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">开发者</span>
            <span class="stat-value">{{ app.developer || '官方团队' }}</span>
          </div>
        </div>

        <div class="price-section">
          <div class="price-display">
            <span v-if="isAppFree(app)" class="price-free">免费使用</span>
            <span v-else class="price-paid">付费应用</span>
          </div>
          <div class="price-note" v-if="!isAppFree(app)">
            一次购买，永久使用
          </div>
        </div>
      </div>

      <div class="app-actions-panel">
        <a
          v-if="downloadUrl && (isAppFree(app) || !purchaseUrl)"
          class="action-primary"
          :href="downloadUrl"
          target="_blank"
          rel="noopener noreferrer"
        >免费使用 / 下载</a>
        <a
          v-if="purchaseUrl && !isAppFree(app)"
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
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  app: { type: Object, required: true }
})

// apps表没有price字段，用is_free判断
const isAppFree = (app) => {
  if (!app) return false
  return app.is_free == 1 || app.is_free === true
}

// 外链协议白名单：管理员填写的 URL 只允许 http(s) 或站内相对路径，拦截 javascript: 等注入
const safeExternalUrl = (u) => {
  const s = String(u || '').trim()
  return (/^https?:\/\//i.test(s) || s.startsWith('/')) ? s : ''
}

// 可用的操作入口
const downloadUrl = computed(() => safeExternalUrl(props.app?.download_url))
const purchaseUrl = computed(() => safeExternalUrl(props.app?.purchase_url))
const usageUrl = computed(() => safeExternalUrl(props.app?.usage_guide))
const hasActions = computed(() => !!downloadUrl.value || !!purchaseUrl.value || !!usageUrl.value)
</script>

<style scoped>
/* 全局样式重置 - 极简白色系（scoped 后仅作用于本组件渲染的元素） */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
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

/* 历史遗留的强调色：后定义 + !important，实际渲染为绿色，保留以维持现状 */
.price-free {
  color: #28a745 !important;
}

@media (max-width: 1024px) {
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
}

@media (max-width: 768px) {
  .app-main-info {
    flex-direction: column;
    gap: 32px;
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
}

@media (max-width: 640px) {
  .app-showcase {
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
}
</style>
