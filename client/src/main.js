import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { ElLoading } from 'element-plus'
import {
  Monitor, Grid, Tickets, Upload, DocumentCopy, UserFilled, Setting, Management,
  User, Lock, Connection, Bell
} from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia()

// Element Plus 改为 vite 插件按需引入（见 vite.config.js），此处只补两类全局件：
// 1. v-loading 指令（模板组件由 resolver 自动注册）
app.use(ElLoading)

// 2. 侧栏菜单数据与 prefix-icon 以字符串引用的图标，需要全局注册；
//    其余图标均在各组件内显式 import，不再全量注册
const globalIcons = { Monitor, Grid, Tickets, Upload, DocumentCopy, UserFilled, Setting, Management, User, Lock, Connection, Bell }
for (const [key, component] of Object.entries(globalIcons)) {
  app.component(key, component)
}

// 通过 JS API 使用（非模板组件）的这些组件样式不会被 resolver 注入，手动补齐
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
import 'element-plus/es/components/loading/style/css'

app.use(pinia)
app.use(router)
app.mount('#app')
