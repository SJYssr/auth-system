<template>
  <div class="zyyo">
    <UserSidebar />
    <div class="zyyo-right">
      <Header />
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
import { Close } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { useTabsStore } from '@/stores/modules/tabs'
import UserSidebar from '@/admin/UserSidebar.vue'
import Header from '@/admin/Header.vue'

const router = useRouter()
const tabsStore = useTabsStore()
const visitedViews = tabsStore.visitedViews

const handleClickTab = (tab) => {
  if (tab.path !== router.currentRoute.value.fullPath) router.push(tab.path)
}

const handleCloseTab = async (tab) => {
  const currentPath = router.currentRoute.value.fullPath
  await tabsStore.delView(tab)
  if (tab.path === currentPath) {
    const last = visitedViews.value[visitedViews.value.length - 1]
    if (last) router.push(last.path)
    else router.push('/useradmin/dashboard')
  }
}
</script>

<style scoped>
.zyyo { display: flex; height: 100vh; overflow: hidden; }
.zyyo-right { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.tabs-bar { height: 40px; border-bottom: 1px solid rgb(219, 223, 233); background: #fafafa; flex-shrink: 0; }
.tabs-scroll { height: 100%; }
.tabs { display: flex; align-items: center; height: 100%; padding: 0 8px; gap: 4px; }
.tab-item { display: flex; align-items: center; padding: 4px 12px; border-radius: 6px; font-size: 13px; color: #666; cursor: pointer; white-space: nowrap; background: transparent; transition: all 0.15s; }
.tab-item:hover { background: #eee; }
.tab-item.active { background: #fff; color: #1c69d4; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.tab-title { margin-right: 6px; }
.tab-close { font-size: 12px; opacity: 0.5; }
.tab-close:hover { opacity: 1; color: #e53e3e; }
.slide-fade-enter-active, .slide-fade-leave-active { transition: all 0.2s ease; }
.slide-fade-enter-from, .slide-fade-leave-to { opacity: 0; transform: translateX(10px); }
</style>
