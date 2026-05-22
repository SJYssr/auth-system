import { createRouter, createWebHistory } from 'vue-router'
import Layout from '@/pages/Layout.vue'
import Login from '@/pages/Login.vue'
import UserLogin from '@/pages/UserLogin.vue'
import UserRegister from '@/pages/UserRegister.vue'
import Admin from '@/admin/Admin.vue'
import UserAdmin from '@/admin/UserAdmin.vue'
import Dashboard from '@/admin/super/Dashboard.vue'
import Apps from '@/admin/super/Apps.vue'
import Datas from '@/admin/super/Datas.vue'
import AdminLogs from '@/admin/super/AdminLogs.vue'

import { useTabsStore } from '@/stores/modules/tabs'
import { useAppStore } from '@/stores/modules/app'
import { ElMessage } from 'element-plus'

import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import { storeToRefs } from 'pinia'

const routes = [
  {
    path: '/admin',
    component: Layout,
    children: [
      {
        path: '',
        name: 'Login',
        component: Login,
        meta: { requiresAuth: false, title: '管理员登录' }
      }
    ]
  },
  {
    path: '/login',
    component: Layout,
    children: [{ path: '', name: 'UserLogin', component: UserLogin, meta: { requiresAuth: false, title: '用户登录' } }]
  },
  {
    path: '/register',
    component: Layout,
    children: [{ path: '', name: 'UserRegister', component: UserRegister, meta: { requiresAuth: false, title: '用户注册' } }]
  },
  {
    path: '/admin',
    component: Admin,
    meta: { requiresAuth: true },
    children: [
      { path: 'dashboard', name: 'Dashboard', component: Dashboard, meta: { title: '管理面板' } },
      { path: 'apps', name: 'Apps', component: Apps, meta: { title: '应用管理' } },
      { path: 'cards', name: 'Cards', component: () => import('@/admin/super/Cards.vue'), meta: { title: '卡密管理' } },
      { path: 'versions', name: 'Versions', component: () => import('@/admin/super/Versions.vue'), meta: { title: '版本管理' } },
      { path: 'datas', name: 'Datas', component: Datas, meta: { title: '网站设置' } },
      { path: 'admin-logs', name: 'AdminLogs', component: AdminLogs, meta: { title: '操作日志' } },
      { path: 'apis', name: 'ApiList', component: () => import('@/admin/super/ApiList.vue'), meta: { title: 'API列表' } },
      { path: 'error-codes', name: 'ErrorCodes', component: () => import('@/admin/super/ErrorCodes.vue'), meta: { title: '错误码对照表' } }
    ]
  },
  {
    path: '/useradmin',
    component: UserAdmin,
    meta: { requiresAuth: true },
    children: [
      { path: 'dashboard', component: Dashboard, meta: { title: '仪表盘' } },
      { path: 'apps', component: () => import('@/pages/user/UserApps.vue'), meta: { title: '应用列表' } },
      { path: 'cards', component: () => import('@/pages/user/UserCards.vue'), meta: { title: '卡密列表' } },
      { path: 'versions', component: () => import('@/pages/user/UserVersions.vue'), meta: { title: '版本管理' } },
      { path: 'apis', component: () => import('@/admin/super/ApiList.vue'), meta: { title: 'API列表' } },
      { path: 'error-codes', component: () => import('@/admin/super/ErrorCodes.vue'), meta: { title: '错误码对照表' } },
    ]
  },
  {
    path: '/',
    component: Layout,
    children: [
      { path: '/products', name: 'Products', component: () => import('@/pages/Products.vue'), meta: { requiresAuth: false, title: '产品中心' } },
      { path: '/about', name: 'About', component: () => import('@/pages/About.vue'), meta: { requiresAuth: false, title: '关于我们' } },
      { path: '/app/:id', name: 'AppDetail', component: () => import('@/pages/AppDetail.vue'), meta: { requiresAuth: false, title: '应用详情' } }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

let initLoading = false

router.beforeEach(async (to, from, next) => {
  NProgress.start()
  const appStore = useAppStore()
  const { initializeInfo } = storeToRefs(appStore)

  if (Object.keys(initializeInfo.value).length === 0 && !initLoading) {
    initLoading = true
    try {
      await appStore.initialize()
    } catch (error) {
      ElMessage.error(error.message || '初始化失败')
    } finally {
      initLoading = false
    }
  }

  const isLoggedIn = initializeInfo.value.login_status?.is_logged_in

  if (to.matched.some(r => r.meta.requiresAuth) && !isLoggedIn) {
    ElMessage.warning('请先登录')
    return next('/login')
  }

  if (isLoggedIn && to.path === '/admin' && !to.matched.some(r => r.meta.requiresAuth)) {
    return next('/admin/dashboard')
  }

  if (to.path === '/') {
    return next('/login')
  }

  if (to.matched.length === 0) {
    return next('/login')
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
