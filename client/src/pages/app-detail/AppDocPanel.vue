<template>
  <div class="content-panel">
    <div v-if="doc" class="doc-content">
      <header class="doc-header">
        <h2 class="doc-title">{{ doc.title }}</h2>
        <div class="doc-meta">
          <span class="meta-tag">最后更新：{{ formatDate(doc.created_at) }}</span>
        </div>
      </header>
      <div class="doc-body" v-html="safeContent"></div>
    </div>
    <div v-else class="empty-content">
      <div class="empty-illustration">{{ icon }}</div>
      <h3 class="empty-title">{{ emptyTitle }}</h3>
      <p class="empty-description">{{ emptyDescription }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import DOMPurify from 'dompurify'

const props = defineProps({
  doc: { type: Object, default: null },
  icon: { type: String, default: '📄' },
  emptyTitle: { type: String, default: '暂无内容' },
  emptyDescription: { type: String, default: '开发者还未提供详细文档' }
})

const sanitize = (html) => {
  if (!html) return ''
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','br','strong','em','u','s','a','ul','ol','li',
      'table','thead','tbody','tr','th','td','blockquote','pre','code','img','span','div','hr'],
    ALLOWED_ATTR: ['href','src','alt','title','class','target','rel','width','height']
  })
}

// v-html 内容不经过 Vue 编译器，必须在渲染前消毒（服务端保存时已消毒，此处双保险）
const safeContent = computed(() => sanitize(props.doc?.content))

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
</script>

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

/* 后定义的同名规则：与原文件相对顺序一致，级联结果不变 */
.doc-content {
  padding: 40px;
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

/* 文档内容样式：v-html 子元素拿不到 scoped 属性，必须用 :deep() 穿透 */
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

@media (max-width: 768px) {
  .content-panel {
    padding: 32px;
  }

  .doc-title {
    font-size: 28px;
  }
}

@media (max-width: 640px) {
  .content-panel {
    padding: 24px;
  }
}
</style>
