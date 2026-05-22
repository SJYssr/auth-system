<template>
  <div class="sidebar" :style="{ width: isCollapse ? '80px' : '250px' }">
    <div class="logo-section">
      <span v-if="!isCollapse" class="logo-text">用户中心</span>
      <span v-else class="logo-text-mini">U</span>
    </div>
    <el-menu :default-active="activeMenu" :collapse="isCollapse" :unique-opened="true" router>
      <el-menu-item index="/useradmin/dashboard">
        <el-icon><Monitor /></el-icon>
        <span>仪表盘</span>
      </el-menu-item>
      <el-sub-menu index="/useradmin/app-management">
        <template #title>
          <el-icon><Management /></el-icon>
          <span>应用管理</span>
        </template>
        <el-menu-item index="/useradmin/apps"><el-icon><Grid /></el-icon><span>应用列表</span></el-menu-item>
        <el-menu-item index="/useradmin/cards"><el-icon><Tickets /></el-icon><span>卡密列表</span></el-menu-item>
        <el-menu-item index="/useradmin/versions"><el-icon><Upload /></el-icon><span>版本管理</span></el-menu-item>
      </el-sub-menu>
      <el-sub-menu index="/useradmin/api-management">
        <template #title>
          <el-icon><Management /></el-icon>
          <span>API管理</span>
        </template>
        <el-menu-item index="/useradmin/apis"><el-icon><Grid /></el-icon><span>API列表</span></el-menu-item>
        <el-menu-item index="/useradmin/error-codes"><el-icon><DocumentCopy /></el-icon><span>错误码对照表</span></el-menu-item>
      </el-sub-menu>
    </el-menu>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Monitor, Management, Grid, Tickets, Upload, DocumentCopy } from '@element-plus/icons-vue'

const route = useRoute()
const activeMenu = computed(() => route.path)
const isCollapse = ref(false)
</script>

<style scoped>
.sidebar { height: 100vh; position: relative; transition: width 0.15s ease; overflow: hidden; border-right: 1px solid rgb(219, 223, 233); background: #fff; }
.logo-section { height: 64px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid rgb(219, 223, 233); }
.logo-text { font-size: 18px; font-weight: 700; color: #1f2937; }
.logo-text-mini { font-size: 18px; font-weight: 700; color: #3b82f6; }
.el-sub-menu, .el-menu-item { --el-menu-item-height: 48px; border-radius: 8px !important; margin: 0 10px 10px 10px; }
</style>
