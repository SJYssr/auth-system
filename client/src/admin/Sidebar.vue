<template>
  <!-- 桌面端侧边栏 -->
  <el-aside v-if="!isMobile" :width="isCollapse ? '80px' : '250px'" class="sidebar">
    <el-menu :default-active="route.path" :collapse="isCollapse" :collapse-transition="false" router>
      <el-menu-item class="sidebar-title">
        <el-icon size="30px">
          <HomeFilled />
        </el-icon>
        <template #title>综合管理平台</template>
      </el-menu-item>
      <!-- 所有管理员可见仪表盘与API文档；超管额外看到其余管理菜单 -->
        <template v-for="menu in visibleMenus" :key="menu.path">
          <!-- 如果是子菜单 -->
          <el-sub-menu v-if="menu.children" :index="menu.path">
            <template #title>
              <el-icon>
                <component :is="menu.icon" />
              </el-icon>
              <span>{{ menu.title }}</span>
            </template>
            <el-menu-item v-for="child in menu.children" :key="child.path" :index="child.path">
              <el-icon>
                <component :is="child.icon" />
              </el-icon>
              <template #title>{{ child.title }}</template>
            </el-menu-item>
          </el-sub-menu>
          <!-- 如果是普通菜单项 -->
          <el-menu-item v-else :index="menu.path">
            <el-icon>
              <component :is="menu.icon" />
            </el-icon>
            <template #title>{{ menu.title }}</template>
          </el-menu-item>
        </template>
    </el-menu>
  </el-aside>

  <!-- 移动端抽屉式侧边栏 -->
  <el-drawer
    v-if="isMobile"
    v-model="mobileDrawerVisible"
    direction="ltr"
    :size="280"
    :with-header="false"
    class="mobile-sidebar-drawer"
  >
    <div class="mobile-sidebar">
      <div class="mobile-sidebar-header">
        <el-icon size="30px" class="logo-icon">
          <HomeFilled />
        </el-icon>
        <span class="logo-text">综合管理平台</span>
        <el-button 
          type="text" 
          @click="closeMobileDrawer"
          class="close-button"
        >
          <el-icon size="20px">
            <Close />
          </el-icon>
        </el-button>
      </div>
      
      <el-menu 
        :default-active="route.path" 
        router 
        class="mobile-menu"
        @select="handleMobileMenuSelect"
      >
        <!-- 所有管理员可见仪表盘与API文档；超管额外看到其余管理菜单 -->
          <template v-for="menu in visibleMenus" :key="menu.path">
            <!-- 如果是子菜单 -->
            <el-sub-menu v-if="menu.children" :index="menu.path">
              <template #title>
                <el-icon>
                  <component :is="menu.icon" />
                </el-icon>
                <span>{{ menu.title }}</span>
              </template>
              <el-menu-item v-for="child in menu.children" :key="child.path" :index="child.path">
                <el-icon>
                  <component :is="child.icon" />
                </el-icon>
                <template #title>{{ child.title }}</template>
              </el-menu-item>
            </el-sub-menu>
            <!-- 如果是普通菜单项 -->
            <el-menu-item v-else :index="menu.path">
              <el-icon>
                <component :is="menu.icon" />
              </el-icon>
              <template #title>{{ menu.title }}</template>
            </el-menu-item>
          </template>
      </el-menu>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAppStore } from '@/stores/modules/app'
import {
  HomeFilled,
  Close,
  Monitor,
  Grid,
  DocumentCopy,
  Setting,
  Management,
  Tickets,
  Upload
} from '@element-plus/icons-vue'

const route = useRoute()
const store = useAppStore()
const { isCollapse } = storeToRefs(store)

// 移动端检测
const isMobile = ref(false)
const mobileDrawerVisible = ref(false)

const login_is_superuser = computed(() => {
  return !!store?.initializeInfo?.login_status?.user?.is_superuser
})

// 检测屏幕尺寸
const checkScreenSize = () => {
  isMobile.value = window.innerWidth <= 768
  // 如果切换到桌面端，关闭移动端抽屉
  if (!isMobile.value) {
    mobileDrawerVisible.value = false
  }
}



// 打开移动端抽屉
const openMobileDrawer = () => {
  if (isMobile.value) {
    mobileDrawerVisible.value = true
  }
}

// 关闭移动端抽屉
const closeMobileDrawer = () => {
  mobileDrawerVisible.value = false
}

// 移动端菜单选择后关闭抽屉
const handleMobileMenuSelect = () => {
  if (isMobile.value) {
    mobileDrawerVisible.value = false
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

// 暴露方法给父组件
defineExpose({
  openMobileDrawer,
  isMobile
})

// 非超管也可见的菜单：仪表盘 + API文档/错误码（只读，编辑入口在页面内按角色隐藏）
const normalMenus = [
  { path: '/admin/dashboard', icon: 'Monitor', title: '仪表盘' },
  {
    path: '/admin/api-management',
    icon: 'Management',
    title: 'API管理',
    children: [
      { path: '/admin/apis', icon: 'Grid', title: 'API列表' },
      { path: '/admin/error-codes', icon: 'DocumentCopy', title: '错误码对照表' }
    ]
  }
]

const superMenus = [
  { path: '/admin/dashboard', icon: 'Monitor', title: '仪表盘' },
  {
    path: '/admin/app-management',
    icon: 'Management',
    title: '应用管理',
    children: [
      { path: '/admin/apps', icon: 'Grid', title: '应用列表' },
      { path: '/admin/cards', icon: 'Tickets', title: '卡密管理' },
      { path: '/admin/versions', icon: 'Upload', title: '版本管理' }
    ]
  },
  {
    path: '/admin/api-management',
    icon: 'Management',
    title: 'API管理',
    children: [
      { path: '/admin/apis', icon: 'Grid', title: 'API列表' },
      { path: '/admin/error-codes', icon: 'DocumentCopy', title: '错误码对照表' }
    ]
  },
  { path: '/admin/admin-logs', icon: 'DocumentCopy', title: '系统日志' },
  { path: '/admin/admins', icon: 'UserFilled', title: '管理员管理' },
  { path: '/admin/datas', icon: 'Setting', title: '网站设置' }
]

const visibleMenus = computed(() => (login_is_superuser.value ? superMenus : normalMenus))
</script>

<style scoped>
.sidebar {
  height: 100vh;
  position: relative;
  transition: width 0.15s ease;
  overflow: hidden;
  border-right: 1px solid rgb(219, 223, 233);
  
  background: rgb(255, 255, 255);
 
}
.el-sub-menu,.el-menu-item {
    --el-menu-item-height: 48px;
    border-radius: 8px!important;
    margin: 0 10px 10px 10px;
    transition: all 0.2s ease;
    background: rgb(255 255 255);
    /* border: 1px solid rgb(219, 223, 233); */
    /* color: #6b7280; */
}

  

  .el-menu-item:hover {
  background: rgba(255, 255, 255, 0.8);
  color: #374151;
}

.el-sub-menu:hover .el-icon,.el-menu-item:hover .el-icon {
  color: #374151;
}

.el-sub-menu.is-active,.el-menu-item.is-active {
  background: rgba(255, 255, 255, 1);
  color: #0369a1;
}

.el-sub-menu.is-active .el-icon,.el-menu-item.is-active .el-icon {
  color: #0369a1;
}

.el-sub-menu.sidebar-title,.el-menu-item.sidebar-title {
  font-size: 1.2rem;
  margin: 16px 8px 20px 8px;
  color: #1f2937;
  font-weight: 600;
  border: none;
  background: transparent;
}

.el-sub-menu.sidebar-title .el-icon,.el-menu-item.sidebar-title .el-icon {
  color: #3b82f6;
  transition: all 0.2s ease;
}

.el-sub-menu.sidebar-title:hover,.el-menu-item.sidebar-title:hover {
  background: transparent;
  border: none;
}

.el-sub-menu.sidebar-title:hover .el-icon,.el-menu-item.sidebar-title:hover .el-icon {
  color: #2563eb;
}

.el-menu {
  width: 100% !important;
  padding: 12px 0;
  --el-menu-border-color: transparent;
  background: transparent;
}

.el-divider--horizontal {
  width: calc(100% - 32px);
  margin: 16px auto;
  border-color: #ede3e3;
}


/* 移动端样式 */
.mobile-sidebar-drawer {
  --el-drawer-padding-primary: 0;
}

.mobile-sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f8fbff;
}

.mobile-sidebar-header {
  display: flex;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid rgb(219, 223, 233);
  background: #f8fbff;
}

.logo-icon {
  color: #3b82f6;
  margin-right: 12px;
  transition: all 0.2s ease;
}

.logo-icon:hover {
  color: #2563eb;
}

.logo-text {
  flex: 1;
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.close-button {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  border: 1px solid rgb(219, 223, 233);
  border-radius: 6px;
  color: #6b7280;
  transition: all 0.2s ease;
  padding: 0;
}

.close-button:hover {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.close-button .el-icon {
  transition: all 0.2s ease;
}

.mobile-menu {
  flex: 1;
  padding: 15px;
  border: none;
  --el-menu-border-color: transparent;
}

.mobile-menu .el-menu-item {
  --el-menu-item-height: 48px;
  border-radius: 8px;
  margin: 0 8px 6px 8px;
  font-size: 16px;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.6);
  border: none;
  color: #6b7280;
}

.mobile-menu .el-menu-item .el-icon {
  font-size: 20px;
  transition: all 0.2s ease;
  color: #6b7280;
}

.mobile-menu .el-menu-item:hover {
  background: rgba(255, 255, 255, 0.8);
  color: #374151;
}

.mobile-menu .el-menu-item:hover .el-icon {
  color: #374151;
}

.mobile-menu .el-menu-item.is-active {
  background: rgba(255, 255, 255, 1);
  color: #0369a1;
}

.mobile-menu .el-menu-item.is-active .el-icon {
  color: #0369a1;
}

.mobile-menu .el-divider--horizontal {
  width: 100%;
  margin: 15px 0;
}

/* 移动端二级菜单样式 */
.mobile-menu .el-sub-menu {
  margin: 0 8px 6px 8px;
  border-radius: 8px;
  overflow: hidden;
}

.mobile-menu .el-sub-menu .el-sub-menu__title {
  height: 48px;
  line-height: 48px;
  padding: 0 16px;
  border-radius: 8px;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.6);
  border: none;
  color: #6b7280;
  font-size: 16px;
}

.mobile-menu .el-sub-menu .el-sub-menu__title:hover {
  background: rgba(255, 255, 255, 0.8);
  color: #374151;
}

.mobile-menu .el-sub-menu .el-sub-menu__title .el-icon {
  font-size: 20px;
  color: #6b7280;
  transition: all 0.2s ease;
}

.mobile-menu .el-sub-menu .el-sub-menu__title:hover .el-icon {
  color: #374151;
}

.mobile-menu .el-sub-menu.is-opened .el-sub-menu__title {
  background: rgba(255, 255, 255, 1);
  color: #0369a1;
}

.mobile-menu .el-sub-menu.is-opened .el-sub-menu__title .el-icon {
  color: #0369a1;
}

.mobile-menu .el-sub-menu .el-menu {
  background: transparent;
}

.mobile-menu .el-sub-menu .el-menu-item {
  height: 44px;
  line-height: 44px;
  margin: 0 8px 4px 8px;
  padding-left: 44px !important;
  border-radius: 6px;
  font-size: 15px;
  background: rgba(255, 255, 255, 0.4);
  border: none;
  color: #6b7280;
}

.mobile-menu .el-sub-menu .el-menu-item .el-icon {
  font-size: 18px;
  color: #6b7280;
}

.mobile-menu .el-sub-menu .el-menu-item:hover {
  background: rgba(255, 255, 255, 0.6);
  color: #374151;
}

.mobile-menu .el-sub-menu .el-menu-item:hover .el-icon {
  color: #374151;
}

.mobile-menu .el-sub-menu .el-menu-item.is-active {
  background: rgba(255, 255, 255, 0.8);
  color: #0369a1;
}

.mobile-menu .el-sub-menu .el-menu-item.is-active .el-icon {
  color: #0369a1;
}

/* 响应式样式 */
@media (max-width: 768px) {
  .sidebar {
    display: none;
  }
}
</style>