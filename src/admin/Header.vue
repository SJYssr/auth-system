<template>
  <div class="main-header">
    <div class="header-left">
      <!-- 统一的汉堡菜单按钮 -->
      <el-button 
        v-if="!isMobile" 
        type="text" 
        @click="toggleSidebar"
        class="menu-button"
      >
        <el-icon size="20px">
          <Menu />
        </el-icon>
      </el-button>
      
      <!-- 移动端汉堡菜单按钮 -->
      <el-button 
        v-if="isMobile" 
        type="text" 
        @click="openMobileMenu"
        class="menu-button"
      >
        <el-icon size="20px">
          <Menu />
        </el-icon>
      </el-button>
      
      <!-- 路由刷新按钮 -->
      <el-button 
        type="text" 
        @click="handleRefreshRoute"
        class="refresh-button"
        title="刷新当前页面"
      >
        <el-icon size="20px">
          <Refresh />
        </el-icon>
      </el-button>
    </div>
    <div class="header-right">
      <!-- 装饰性功能图标 -->
      <div class="header-icons">
        <!-- 搜索图标 -->
        <div class="header-icon" title="搜索" @click="handleIconClick('search')">
          <el-icon size="18px">
            <Search />
          </el-icon>
        </div>
        
        <!-- 通知图标 -->
        <div class="header-icon notification-icon" title="通知" @click="handleIconClick('notification')">
          <el-icon size="18px">
            <Bell />
          </el-icon>
          <span class="notification-badge">3</span>
        </div>
        
        <!-- 帮助图标 -->
        <div class="header-icon" title="帮助" @click="handleIconClick('help')">
          <el-icon size="18px">
            <QuestionFilled />
          </el-icon>
        </div>
        
        <!-- 设置图标 -->
        <div class="header-icon" title="设置" @click="handleIconClick('settings')">
          <el-icon size="18px">
            <Setting />
          </el-icon>
        </div>
      </div>
      
      <!-- 分隔线 -->
      <div class="header-divider"></div>
      
      <!-- 自定义用户下拉菜单 -->
      <div class="user-dropdown" @click.stop>
        <div class="user-trigger" @click="toggleDropdown">
          <div class="user-avatar">
            {{ (store.initializeInfo?.login_status?.user?.username || 'U').charAt(0).toUpperCase() }}
          </div>
          <span class="user-name">{{ store.initializeInfo?.login_status?.user?.username || '未登录' }}</span>
          <svg class="dropdown-icon" :class="{ 'rotate': isDropdownOpen }" viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M7 10l5 5 5-5z"/>
          </svg>
        </div>
        
        <div v-if="isDropdownOpen" class="dropdown-menu" @click.stop>
          <div class="dropdown-header">
            <div class="user-info">
              <div class="user-avatar-large">
                {{ (store.initializeInfo?.login_status?.user?.username || 'U').charAt(0).toUpperCase() }}
              </div>
              <div class="user-details">
                <div class="user-name-large">{{ store.initializeInfo?.login_status?.user?.username || '未登录' }}</div>
                <div class="user-role">{{ (store.initializeInfo?.login_status?.user?.role === 'admin') ? '管理员' : '用户' }}</div>
              </div>
            </div>
          </div>
          
          <div class="dropdown-divider"></div>
          
          <div class="dropdown-items">
            <div class="dropdown-item" @click="handleCommand('home')">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
              </svg>
              返回首页
            </div>
            <div class="dropdown-item logout-item" @click="handleCommand('logout')">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
              </svg>
              退出登录
            </div>
          </div>
        </div>
      </div>
      
      <!-- 点击外部关闭下拉菜单 -->
      <div v-if="isDropdownOpen" class="dropdown-overlay" @click="closeDropdown"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, getCurrentInstance } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAppStore } from '@/stores/modules/app'
import {
  Menu,
  Setting,
  Search,
  Bell,
  QuestionFilled,
  Refresh
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const store = useAppStore()
const { isCollapse } = storeToRefs(store)
const router = useRouter()
const instance = getCurrentInstance()

// 切换侧边栏
const toggleSidebar = () => {
  store.toggleSidebar()
}

// 移动端检测
const isMobile = ref(false)

// 下拉菜单状态
const isDropdownOpen = ref(false)

// 检测屏幕尺寸
const checkScreenSize = () => {
  isMobile.value = window.innerWidth <= 768
}

// 打开移动端菜单
const openMobileMenu = () => {
  // 使用事件总线
  window.dispatchEvent(new CustomEvent('open-mobile-menu'))
}

// 切换下拉菜单
const toggleDropdown = () => {
  isDropdownOpen.value = !isDropdownOpen.value
}

// 关闭下拉菜单
const closeDropdown = () => {
  isDropdownOpen.value = false
}

// 处理图标点击事件
const handleIconClick = (iconType) => {
  console.log(`点击了${iconType}图标，后期可扩展功能`)
  
  switch (iconType) {
    case 'search':
      // 后期可扩展：打开全局搜索
      console.log('搜索功能待开发')
      break
    case 'notification':
      // 后期可扩展：显示通知列表
      console.log('通知功能待开发')
      break
    case 'help':
      // 后期可扩展：打开帮助文档
      console.log('帮助功能待开发')
      break
    case 'settings':
      // 后期可扩展：快速设置面板
      if (!window.location.pathname.startsWith('/useradmin')) router.push('/admin/datas')
      break
  }
}

// 刷新当前路由
const handleRefreshRoute = () => {
  // 直接刷新整个router-view区域
  router.go(0)
}

const handleCommand = async (command) => {
  closeDropdown()
  switch (command) {
    case 'logout':
      await store.logout()
      router.push(window.location.pathname.startsWith('/useradmin') ? '/login' : '/admin')
      break
    case 'home':
      router.push(window.location.pathname.startsWith('/useradmin') ? '/login' : '/admin')
      break
  }
}

// 生命周期
onMounted(() => {
  checkScreenSize()
  window.addEventListener('resize', checkScreenSize)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkScreenSize)
})
</script>

<style scoped>
.main-header {
  padding: 0;
  background-color: rgb(250, 251, 251);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  /* border-bottom: 1px solid var(--el-border-color-light); */
}

.header-left {
  display: flex;
  align-items: center;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-icons {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  color: var(--el-text-color-regular);
}

.header-icon:hover {
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
  transform: translateY(-1px);
}

.notification-icon {
  position: relative;
}

.notification-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  background: #f56565;
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 5px;
  border-radius: 8px;
  min-width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.header-divider {
  width: 1px;
  height: 24px;
  background: var(--el-border-color-light);
  margin: 0 8px;
}

/* 移动端响应式 */
@media (max-width: 768px) {
  .header-icons {
    gap: 8px;
  }
  
  .header-icon {
    width: 32px;
    height: 32px;
  }
  
  .header-icon:nth-child(3),
  .header-icon:nth-child(4) {
    display: none; /* 在移动端隐藏帮助和设置图标 */
  }
  
  .header-divider {
    margin: 0 4px;
  }
}

.menu-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  cursor: pointer;
  transition: all 0.3s ease;
  margin-right: 12px;
}

.menu-button:hover {
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color);
}

.menu-button .el-icon {
  color: var(--el-text-color-regular);
  transition: all 0.3s ease;
}

.menu-button:hover .el-icon {
  color: var(--el-text-color-primary);
  transform: scale(1.05);
}

.refresh-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  cursor: pointer;
  transition: all 0.3s ease;
  margin-right: 12px;
}

.refresh-button:hover {
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color);
}

.refresh-button .el-icon {
  color: var(--el-text-color-regular);
  transition: all 0.3s ease;
}

.refresh-button:hover .el-icon {
  color: var(--el-text-color-primary);
  transform: scale(1.05);
}

/* 用户下拉菜单 */
.user-dropdown {
  position: relative;
  display: inline-block;
}

.user-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 6px;
  transition: all 0.15s ease;
  background: #f8fafc;
  border: 1px solid rgb(219, 223, 233);
  min-width: 120px;
}

.user-trigger:hover {
  background: #f1f5f9;
  border-color: #ede3e3;
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
  font-size: 12px;
  font-weight: 600;
}

.user-name {
  font-size: 14px;
  color: #1f2937;
  font-weight: 500;
  flex: 1;
}

.dropdown-icon {
  color: #6b7280;
  transition: transform 0.15s ease;
}

.dropdown-icon.rotate {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: white;
  border: 1px solid rgb(219, 223, 233);
  border-radius: 8px;

  min-width: 200px;
  z-index: 1000;
  overflow: hidden;
}

.dropdown-header {
  padding: 16px;
  background: #f8fafc;
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
  font-size: 16px;
  font-weight: 600;
}

.user-details {
  flex: 1;
}

.user-name-large {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 2px;
}

.user-role {
  font-size: 12px;
  color: #6b7280;
}

.dropdown-divider {
  height: 1px;
  background: #ede3e3;
}

.dropdown-items {
  padding: 8px 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 14px;
  color: #374151;
}

.dropdown-item:hover {
  background: #f8fafc;
}

.dropdown-item svg {
  color: #6b7280;
}

.logout-item:hover {
  background: #fef2f2;
  color: #dc2626;
}

.logout-item:hover svg {
  color: #dc2626;
}

.dropdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
}

/* 移动端样式 */
@media (max-width: 1024px) {
  .user-trigger {
    min-width: 100px;
  }
  
  .dropdown-menu {
    min-width: 180px;
  }
}

@media (max-width: 768px) {
  .main-header {
    padding: 12px 15px;
  }
  
  .header-right {
    gap: 15px;
  }
  
  .user-name {
    display: none; /* 在小屏幕上隐藏用户名 */
  }
  
  .user-trigger {
    min-width: auto;
    padding: 6px 8px;
  }
  
  .dropdown-menu {
    right: 0;
    min-width: 160px;
  }
  
  .dropdown-header {
    padding: 12px;
  }
}

@media (max-width: 480px) {
  .main-header {
    padding: 10px 12px;
  }
  
  .header-right {
    gap: 10px;
  }
  
  .dropdown-header {
    padding: 10px;
  }
  
  .user-avatar-large {
    width: 36px;
    height: 36px;
    font-size: 14px;
  }
}
</style>
