<template>
  <div class="zyyo">
    <Sidebar ref="sidebarRef" />
    <div class="zyyo-right">
      <Header @open-mobile-menu="handleOpenMobileMenu" />

      <div class="tabs-bar">
        <el-scrollbar class="tabs-scroll">
          <div class="tabs">
            <div 
              v-for="tab in visitedViews" 
              :key="tab.path" 
              class="tab-item" 
              :class="{ active: tab.path === $route.fullPath }"
              @click="handleClickTab(tab)"
            >
              <span class="tab-title">{{ tab.title }}</span>
              <el-icon class="tab-close" @click.stop="handleCloseTab(tab)"><Close /></el-icon>
            </div>
          </div>
        </el-scrollbar>
      </div>

      <router-view v-slot="{ Component }">
        <transition name="slide-fade" mode="out-in">
          <component :is="Component" :key="$route.fullPath" />
        </transition>
      </router-view>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTabsStore } from '@/stores/modules/tabs'
import Sidebar from '@/admin/Sidebar.vue'
import Header from '@/admin/Header.vue'

const sidebarRef = ref(null)
const router = useRouter()
const tabsStore = useTabsStore()
const visitedViews = tabsStore.visitedViews

// 处理打开移动端菜单
const handleOpenMobileMenu = () => {
  if (sidebarRef.value) {
    sidebarRef.value.openMobileDrawer()
  }
}

const handleClickTab = (tab) => {
  if (tab.path !== router.currentRoute.value.fullPath) {
    router.push(tab.path)
  }
}

const handleCloseTab = async (tab) => {
  const currentPath = router.currentRoute.value.fullPath
  await tabsStore.delView(tab)
  // 如果关闭的是当前激活标签，跳转到最后一个
  if (tab.path === currentPath) {
    const last = visitedViews.value[visitedViews.value.length - 1]
    if (last) {
      router.push(last.path)
    } else {
      router.push('/admin/dashboard')
    }
  }
}

// 监听自定义事件
const handleCustomEvent = (event) => {
  if (event.type === 'open-mobile-menu') {
    handleOpenMobileMenu()
  }
}

onMounted(() => {
  window.addEventListener('open-mobile-menu', handleCustomEvent)
})

onUnmounted(() => {
  window.removeEventListener('open-mobile-menu', handleCustomEvent)
})
</script>


<style>
/*
  进入和离开动画可以使用不同
  持续时间和速度曲线。
*/
.slide-fade-enter-active {
  transition: all 0.12s cubic-bezier(0.4, 0, 1, 1);
}

.slide-fade-leave-active {
  transition: all 0.10s cubic-bezier(0.4, 0, 1, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(8px);
  opacity: 0;
}

.zyyo {
  height: 100vh;
  display: flex;
}

.zyyo-right {
  width: 100%;
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 移动端样式 */
@media (max-width: 768px) {
  .zyyo {
    flex-direction: column;
  }
  
  .zyyo-right {
    width: 100%;
    height: 100vh;
  }
}

.el-main {
  background-color: rgb(250, 251, 251);
  overflow-y: auto;
  --el-main-padding: 25px
}
.tabs-bar {
    background: rgb(250, 251, 251);
    height: 60px;
    /* border-bottom: 1px solid #e5e7eb; */
}

.tabs-scroll {
  height: 100%;
}
.tabs {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 0 16px;
    height: 60px;
}
.tab-item {
    position: relative;
    display: inline-flex;
    align-items: center;
    border: 1px solid #e4e4e4;
    gap: 8px;
    border-radius: 8px;
    padding: 10px;
    background: transparent;
    /* border-radius: 0; */
    cursor: pointer;
    user-select: none;
    color: #6b7280;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
    /* border-bottom: 2px solid transparent; */
}

.tab-item:hover {
  color: #374151;
}

.tab-item.active {
  background: transparent;
  color: #3b82f6;
}

.tab-item.active:hover {
  background: rgba(59, 130, 246, 0.04);
}

.tab-title {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: inherit;
}

.tab-close {
  color: #9ca3af;
  font-size: 14px;
  transition: all 0.2s ease;
  opacity: 0.7;
}

.tab-close:hover {
  color: #ef4444;
  opacity: 1;
  transform: scale(1.1);
}

@media (max-width: 768px) {
  .tabs-scroll {
    height: 44px;
  }
  .tabs {
    height: 44px;
    padding: 0 12px;
    gap: 1px;
  }
  .tab-item {
    padding: 10px 12px;
    font-size: 13px;
    gap: 6px;
  }
  .tab-title {
    max-width: 100px;
  }
  .tab-close {
    font-size: 13px;
  }
}
</style>