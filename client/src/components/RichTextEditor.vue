<template>
  <div class="rich-text-editor">
    <div class="editor-toolbar">
      <button 
        type="button"
        @click="execCommand('bold')"
        :class="{ active: isActive('bold') }"
        class="toolbar-btn"
      >
        <strong>B</strong>
      </button>
      <button 
        type="button"
        @click="execCommand('italic')"
        :class="{ active: isActive('italic') }"
        class="toolbar-btn"
      >
        <em>I</em>
      </button>
      <button 
        type="button"
        @click="execCommand('underline')"
        :class="{ active: isActive('underline') }"
        class="toolbar-btn"
      >
        <u>U</u>
      </button>
      <div class="toolbar-divider"></div>
      <select @change="execCommand('formatBlock', $event.target.value)" class="format-select">
        <option value="">格式</option>
        <option value="h1">标题 1</option>
        <option value="h2">标题 2</option>
        <option value="h3">标题 3</option>
        <option value="p">段落</option>
      </select>
      <div class="toolbar-divider"></div>
      <button 
        type="button"
        @click="execCommand('insertUnorderedList')"
        class="toolbar-btn"
      >
        • 列表
      </button>
      <button 
        type="button"
        @click="execCommand('insertOrderedList')"
        class="toolbar-btn"
      >
        1. 列表
      </button>
      <div class="toolbar-divider"></div>
      <button 
        type="button"
        @click="insertLink"
        class="toolbar-btn"
      >
        链接
      </button>
      <button 
        type="button"
        @click="insertImage"
        class="toolbar-btn"
      >
        图片
      </button>
    </div>
    
    <div 
      ref="editor"
      class="editor-content"
      contenteditable="true"
      @input="handleInput"
      @keydown="handleKeydown"
      @paste="handlePaste"
      v-html="modelValue"
    ></div>
  </div>
</template>

<script>
export default {
  name: 'RichTextEditor',
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: '请输入内容...'
    }
  },
  emits: ['update:modelValue'],
  
  mounted() {
    this.initEditor()
  },
  
  methods: {
    initEditor() {
      if (this.$refs.editor) {
        this.$refs.editor.innerHTML = this.modelValue || ''
        if (!this.modelValue) {
          this.$refs.editor.setAttribute('data-placeholder', this.placeholder)
        }
      }
    },
    
    handleInput(event) {
      const content = event.target.innerHTML
      this.$emit('update:modelValue', content)
      
      // 处理占位符
      if (content.trim() === '') {
        this.$refs.editor.setAttribute('data-placeholder', this.placeholder)
      } else {
        this.$refs.editor.removeAttribute('data-placeholder')
      }
    },
    
    handleKeydown(event) {
      // 处理Tab键
      if (event.key === 'Tab') {
        event.preventDefault()
        this.execCommand('insertHTML', '&nbsp;&nbsp;&nbsp;&nbsp;')
      }
    },
    
    handlePaste(event) {
      event.preventDefault()
      const text = (event.clipboardData || window.clipboardData).getData('text/plain')
      this.execCommand('insertText', text)
    },
    
    execCommand(command, value = null) {
      document.execCommand(command, false, value)
      this.$refs.editor.focus()
      this.handleInput({ target: this.$refs.editor })
    },
    
    isActive(command) {
      return document.queryCommandState(command)
    },
    
    insertLink() {
      const url = prompt('请输入链接地址:')
      if (url) {
        this.execCommand('createLink', url)
      }
    },
    
    insertImage() {
      const url = prompt('请输入图片地址:')
      if (url) {
        this.execCommand('insertImage', url)
      }
    }
  },
  
  watch: {
    modelValue(newVal) {
      if (this.$refs.editor && this.$refs.editor.innerHTML !== newVal) {
        this.$refs.editor.innerHTML = newVal || ''
        if (!newVal) {
          this.$refs.editor.setAttribute('data-placeholder', this.placeholder)
        } else {
          this.$refs.editor.removeAttribute('data-placeholder')
        }
      }
    }
  }
}
</script>

<style scoped>
.rich-text-editor {
  border: 1px solid rgb(219, 223, 233);
  border-radius: 8px;
  background: #ffffff;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px;
  border-bottom: 1px solid rgb(219, 223, 233);
  background: #f8fafc;
  border-radius: 8px 8px 0 0;
}

.toolbar-btn {
  padding: 6px 10px;
  border: 1px solid rgb(219, 223, 233);
  background: #ffffff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
  transition: all 0.2s ease;
}

.toolbar-btn:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.toolbar-btn.active {
  background: #667eea;
  color: #ffffff;
  border-color: #667eea;
}

.format-select {
  padding: 6px 8px;
  border: 1px solid rgb(219, 223, 233);
  border-radius: 4px;
  background: #ffffff;
  color: #374151;
  font-size: 14px;
  cursor: pointer;
}

.format-select:focus {
  outline: none;
  border-color: #667eea;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: #ede3e3;
  margin: 0 8px;
}

.editor-content {
  min-height: 200px;
  padding: 16px;
  outline: none;
  line-height: 1.6;
  color: #374151;
  font-size: 14px;
}

.editor-content:empty:before {
  content: attr(data-placeholder);
  color: #9ca3af;
  pointer-events: none;
}

.editor-content h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 16px 0 8px 0;
  color: #1f2937;
}

.editor-content h2 {
  font-size: 20px;
  font-weight: 600;
  margin: 14px 0 6px 0;
  color: #1f2937;
}

.editor-content h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 12px 0 4px 0;
  color: #1f2937;
}

.editor-content p {
  margin: 8px 0;
}

.editor-content ul, .editor-content ol {
  margin: 8px 0;
  padding-left: 24px;
}

.editor-content li {
  margin: 4px 0;
}

.editor-content a {
  color: #667eea;
  text-decoration: underline;
}

.editor-content img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 8px 0;
}

.editor-content blockquote {
  border-left: 4px solid #ede3e3;
  padding-left: 16px;
  margin: 16px 0;
  color: #6b7280;
  font-style: italic;
}

.editor-content code {
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #dc2626;
}

.editor-content pre {
  background: #f3f4f6;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 12px 0;
}

.editor-content pre code {
  background: none;
  padding: 0;
  color: #374151;
}
</style>