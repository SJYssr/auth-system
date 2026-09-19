import { createRouter, createWebHashHistory } from 'vue-router'
import Layout from '@/pages/Layout.vue'
import Login from '@/pages/Login.vue'
import Admin from '@/admin/Admin.vue'

import { useTabsStore } from '@/stores/modules/tabs'
import { useAppStore } from '@/stores/modules/app'
import { ElMessage } from 'element-plus'

import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import { storeToRefs } from 'pinia'

const routes = [
  {
    path: '/',
    component: Layout,
    children: [
      {
        path: '',
        component: Login,
        meta: { requiresAuth: false, title: '管理员登录' }
      },
      {
        path: '/products',
        name: 'Products',
        component: () => import('@/pages/Products.vue'),
        meta: { requiresAuth: false, title: '产品中心' }
      },
      {
        path: '/about',
        name: 'About',
        component: () => import('@/pages/About.vue'),
        meta: { requiresAuth: false, title: '关于我们' }
      },
      {
        path: '/app/:id',
        name: 'AppDetail',
        component: () => import('@/pages/AppDetail.vue'),
        meta: { requiresAuth: false, title: '应用详情' }
      }
    ]
  },
  {
    path: '/admin',
    component: Admin,
    meta: { keepAlive: true, requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/admin/super/Dashboard.vue'),
        meta: { keepAlive: true, title: '管理面板' }
      },
      {
        path: 'apps',
        name: 'Apps',
        component: () => import('@/admin/super/Apps.vue'),
        meta: { keepAlive: true, title: '应用管理' }
      },
      {
        path: 'cards',
        name: 'Cards',
        component: () => import('@/admin/super/Cards.vue'),
        meta: { title: '卡密管理' }
      },
      {
        // 在线会话：所有管理员可见，非超管只看自己名下卡密的会话（后端 owner 隔离）
        path: 'sessions',
        name: 'Sessions',
        component: () => import('@/admin/super/Sessions.vue'),
        meta: { title: '在线会话' }
      },
      {
        // Webhook 事件推送：所有管理员可管理自己应用的 webhook（后端 owner 隔离）
        path: 'webhooks',
        name: 'Webhooks',
        component: () => import('@/admin/super/Webhooks.vue'),
        meta: { title: 'Webhook 推送' }
      },
      {
        path: 'versions',
        name: 'Versions',
        component: () => import('@/admin/super/Versions.vue'),
        meta: { title: '版本管理' }
      },
      {
        path: 'datas',
        name: 'Datas',
        component: () => import('@/admin/super/Datas.vue'),
        meta: { keepAlive: true, title: '网站设置', superuserOnly: true }
      },
      {
        path: 'admin-logs',
        name: 'AdminLogs',
        component: () => import('@/admin/super/AdminLogs.vue'),
        meta: { keepAlive: true, title: '操作日志', superuserOnly: true }
      },
      {
        // 管理员账户管理：仅超管（页面+后端双重 requireSuperuser）
        path: 'admins',
        name: 'Admins',
        component: () => import('@/admin/super/Admins.vue'),
        meta: { keepAlive: true, title: '管理员管理', superuserOnly: true }
      },
      {
        // API文档/错误码：所有管理员可查看，编辑按钮仅超管可见（后端 requireSuperuser 强制）
        path: 'apis',
        name: 'ApiList',
        component: () => import('@/admin/super/ApiList.vue'),
        meta: { keepAlive: true, title: 'API列表' }
      },
      {
        path: 'error-codes',
        name: 'ErrorCodes',
        component: () => import('@/admin/super/ErrorCodes.vue'),
        meta: { keepAlive: true, title: '错误码对照表' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 并发导航时共享同一个初始化 Promise，避免旧实现用布尔量跳过 initialize
// 导致后续判断拿到未定义登录态的竞态
let initPromise = null

router.beforeEach(async (to, from, next) => {
  NProgress.start()
  const appStore = useAppStore()
  const { initializeInfo } = storeToRefs(appStore)

  if (Object.keys(initializeInfo.value).length === 0) {
    if (!initPromise) {
      initPromise = appStore.initialize()
        .catch((error) => {
          ElMessage.error(error.message || '初始化失败')
        })
        .finally(() => { initPromise = null })
    }
    await initPromise
  }

  const isLoggedIn = initializeInfo.value.login_status?.is_logged_in
  const isSuperuser = !!initializeInfo.value.login_status?.user?.is_superuser

  // 已登录用户访问登录页 → 直接进后台
  if (isLoggedIn && to.path === '/') {
    return next('/admin/dashboard')
  }

  // 未登录用户访问需要认证的页面 → 回到登录页
  if (to.matched.some(r => r.meta.requiresAuth) && !isLoggedIn) {
    ElMessage.warning('请先登录')
    return next('/')
  }

  // 超管专属页面：非超管访问时回仪表盘（后端同样有 requireSuperuser 兜底）
  if (to.matched.some(r => r.meta.superuserOnly) && !isSuperuser) {
    ElMessage.warning('无权限访问该页面')
    return next('/admin/dashboard')
  }

  if (to.path === '/admin' || to.path === '/admin/') {
    return next('/admin/dashboard')
  }

  if (to.matched.length === 0) {
    return next('/')
  }

  next()
})

router.afterEach(() => {
  NProgress.done()
  const tabsStore = useTabsStore()
  if (router.currentRoute.value.meta.title) {
    document.title = router.currentRoute.value.meta.title
    tabsStore.addVisitedView(router.currentRoute.value)
  }
})

export default router
