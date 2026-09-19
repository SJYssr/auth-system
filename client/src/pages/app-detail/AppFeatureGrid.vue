<template>
  <div class="content-panel">
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
</template>

<style scoped>
/* 全局样式重置 - 极简白色系（scoped 后仅作用于本组件渲染的元素） */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.content-panel {
  padding: 64px;
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

@media (max-width: 1024px) {
  .features-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
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
}
</style>
